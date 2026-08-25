'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { spinSlots, resolveSlots, CASINO_MIN_BET } from '@/lib/casino/slots';
import {
  GameShell, BetControls, PlayButton, ResultBanner, HistoryStrip, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';

const RULES: RulesSpec = {
  howTo: [
    'Choisis ta mise et lance les rouleaux.',
    'Les 3 rouleaux s’arrêtent un par un, de gauche à droite.',
    'Si les 3 symboles sont identiques, tu gagnes selon le symbole obtenu.',
    'Aucune combinaison partielle ne paie : il faut les trois.',
  ],
  payouts: [
    { label: '🍒 🍒 🍒 Cerises', value: 'Mise remboursée' },
    { label: '🔔 🔔 🔔 Cloches', value: '×4' },
    { label: '⭐ ⭐ ⭐ Étoiles', value: '×10' },
    { label: '💎 💎 💎 Diamants', value: '×42' },
  ],
  rtp: '~94%',
};

const CELL = 88;
const SYMBOLS = ['🍒', '🔔', '⭐', '💎', '🍋', '🍇'];
// Long strip so the reel has something to scroll through; every symbol
// appears several times so any target can be reached from anywhere.
const STRIP = Array.from({ length: 6 }, () => SYMBOLS).flat();

type ReelState = { spinning: boolean; offset: number; settled: boolean };

function Reel({ state, symbol, highlight }: { state: ReelState; symbol: string; highlight: boolean }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border-4 bg-brand-bg transition-colors duration-300',
        highlight ? 'border-accent-primary' : 'border-brand-border'
      )}
      style={{ width: CELL, height: CELL }}
    >
      <div
        className="absolute left-0 right-0 flex flex-col items-center"
        style={{
          transform: `translateY(${-state.offset}px)`,
          transition: state.spinning ? 'none' : `transform 900ms cubic-bezier(0.15, 0.85, 0.2, 1.02)`,
          filter: state.spinning ? 'blur(3px)' : 'none',
        }}
      >
        {STRIP.map((s, i) => (
          <div key={i} className="flex items-center justify-center shrink-0" style={{ height: CELL, fontSize: 44 }}>
            {s}
          </div>
        ))}
      </div>
      {highlight && <div className="absolute inset-0 rounded-lg bg-accent-primary/20 animate-pulse pointer-events-none" />}
    </div>
  );
}

export default function SlotsPage() {
  const { balance, isLoaded, isLocal, maxBet, stats, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<ReelState[]>([
    { spinning: false, offset: 0, settled: true },
    { spinning: false, offset: 0, settled: true },
    { spinning: false, offset: 0, settled: true },
  ]);
  const [finalSymbols, setFinalSymbols] = useState<string[]>(['🍒', '🔔', '⭐']);
  const [lastResult, setLastResult] = useState<GenericBetResult | null>(null);
  const [confetti, setConfetti] = useState(0);
  const rafRefs = useRef<(number | null)[]>([null, null, null]);

  useEffect(() => () => { rafRefs.current.forEach((r) => r && cancelAnimationFrame(r)); }, []);

  const startReel = (idx: number) => {
    const speed = 2600 + idx * 180; // px/sec
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setReels((prev) => {
        const next = [...prev];
        const maxOffset = (STRIP.length - 3) * CELL;
        let off = next[idx].offset + speed * dt;
        if (off > maxOffset) off -= maxOffset; // wrap without visible seam
        next[idx] = { ...next[idx], offset: off, spinning: true, settled: false };
        return next;
      });
      rafRefs.current[idx] = requestAnimationFrame(loop);
    };
    rafRefs.current[idx] = requestAnimationFrame(loop);
  };

  const stopReel = (idx: number, symbol: string) => {
    if (rafRefs.current[idx]) cancelAnimationFrame(rafRefs.current[idx]!);
    // Land on a copy of the target symbol that sits comfortably inside the strip.
    const candidates = STRIP.map((s, i) => (s === symbol ? i : -1)).filter((i) => i >= 2 && i < STRIP.length - 2);
    const landing = candidates[Math.floor(candidates.length / 2)];
    setReels((prev) => {
      const next = [...prev];
      next[idx] = { spinning: false, offset: landing * CELL, settled: true };
      return next;
    });
    sfx.step(idx);
    vibrate(HAPTIC.SOFT);
  };

  const handleSpin = async () => {
    if (spinning) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setSpinning(true);
    setLastResult(null);
    vibrate(HAPTIC.MEDIUM);
    sfx.bet();
    [0, 1, 2].forEach(startReel);

    const [result] = await Promise.all([
      placeBet('slots', amount, {}, () => {
        const { tier, multiplier, reels: r } = spinSlots();
        return { ...resolveSlots(multiplier), meta: { tier, reels: r } };
      }),
      new Promise((r) => setTimeout(r, 900)),
    ]);

    if ('error' in result) {
      [0, 1, 2].forEach((i) => rafRefs.current[i] && cancelAnimationFrame(rafRefs.current[i]!));
      setReels((p) => p.map((r) => ({ ...r, spinning: false })));
      setSpinning(false);
      toast.error(result.error);
      return;
    }

    const symbols: string[] = result.meta.reels;
    setFinalSymbols(symbols);

    // Sequential stop, with a longer beat before the last reel when the first
    // two already match — the classic near-miss tension, and it's honest:
    // the outcome was already decided server-side before the reels moved.
    stopReel(0, symbols[0]);
    await new Promise((r) => setTimeout(r, 620));
    stopReel(1, symbols[1]);
    const suspense = symbols[0] === symbols[1] ? 1250 : 620;
    await new Promise((r) => setTimeout(r, suspense));
    stopReel(2, symbols[2]);

    await new Promise((r) => setTimeout(r, 700));
    setSpinning(false);
    setLastResult(result);

    if (result.won) {
      vibrate(HAPTIC.SUCCESS);
      if (result.multiplier >= 10) { sfx.bigWin(); setConfetti((c) => c + 1); }
      else sfx.win();
      toast.success(`${symbols.join(' ')} — +${result.payout} ₶`);
    } else {
      vibrate(HAPTIC.ERROR);
      sfx.lose();
    }
  };

  const gameHistory = history.filter((h) => h.game_slug === 'slots').slice(0, 10);
  const allSettled = reels.every((r) => r.settled);
  const isWinLine = !!lastResult?.won && allSettled;

  const stage = (
    <div className="w-full flex flex-col items-center gap-5">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}

      <div
        className="rounded-3xl border-4 border-brand-border p-6"
        style={{ background: 'linear-gradient(180deg, #2A1B3D 0%, #1A1028 100%)' }}
      >
        <div className="flex gap-3">
          {reels.map((r, i) => (
            <Reel key={i} state={r} symbol={finalSymbols[i]} highlight={isWinLine} />
          ))}
        </div>
        <div className="mt-4 h-1 rounded-full bg-accent-primary/25">
          <div className={cn('h-full rounded-full bg-accent-primary transition-all duration-500', isWinLine ? 'w-full' : 'w-0')} />
        </div>
      </div>

      <ResultBanner state={lastResult === null ? 'idle' : lastResult.won ? 'win' : 'lose'}>
        {lastResult?.won ? `×${lastResult.multiplier} — +${lastResult.payout} ₶` : 'Pas de combinaison'}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={spinning} />
      <PlayButton onClick={handleSpin} loading={spinning} disabled={!isLoaded || amount < CASINO_MIN_BET}>
        {spinning ? 'ÇA TOURNE...' : `LANCER · ${amount} ₶`}
      </PlayButton>

      <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2">Table des gains</div>
        <div className="space-y-1.5 text-xs">
          {[['💎💎💎', '×42'], ['⭐⭐⭐', '×10'], ['🔔🔔🔔', '×4'], ['🍒🍒🍒', '×1']].map(([sym, mult]) => (
            <div key={sym} className="flex justify-between items-center">
              <span className="text-base tracking-widest">{sym}</span>
              <span className="font-display font-black text-accent-primary">{mult}</span>
            </div>
          ))}
        </div>
      </div>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell
      title="Frenly Slots"
      rules={RULES}
      balance={balance}
      isLoaded={isLoaded}
      isLocal={isLocal}
      streak={stats.currentStreak}
      stage={stage}
      panel={panel}
    />
  );
}
