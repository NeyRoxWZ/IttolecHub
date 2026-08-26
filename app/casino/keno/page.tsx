'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import {
  drawKenoNumbers, resolveKeno, KENO_PAYTABLE,
  KENO_PICK_COUNT, KENO_POOL_SIZE, KENO_DRAW_COUNT, CASINO_MIN_BET,
} from '@/lib/casino/keno';
import {
  GameShell, BetControls, PlayButton, ResultBanner, HistoryStrip, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import { tempo } from '@/lib/casino/turbo';

const RULES: RulesSpec = {
  howTo: [
    `Coche exactement ${KENO_PICK_COUNT} numéros parmi ${KENO_POOL_SIZE} (ou utilise le bouton Auto).`,
    `Place ta mise et lance le tirage : ${KENO_DRAW_COUNT} numéros sortent au hasard.`,
    'Chaque numéro que tu avais coché ET qui sort compte comme une correspondance.',
    `${KENO_DRAW_COUNT} numéros sur ${KENO_POOL_SIZE}, c'est la moitié du tableau : tomber sur 5 correspondances est la normale, pas un exploit.`,
    `6 correspondances remboursent la mise, 7 la doublent, et ça grimpe vite ensuite. En dessous de 6, la mise est perdue.`,
  ],
  payouts: Object.entries(KENO_PAYTABLE).map(([k, v]) => ({
    label: `${k} correspondances`,
    value: v === 1 ? 'Mise remboursée' : `×${v}`,
  })),
  rtp: '~94,5%',
};

type Phase = 'picking' | 'drawing' | 'done';

export default function KenoPage() {
  const { balance, isLoaded, isLocal, maxBet, stats, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [picks, setPicks] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>('picking');
  const [drawn, setDrawn] = useState<number[]>([]);
  const [result, setResult] = useState<(GenericBetResult & { matches: number }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [confetti, setConfetti] = useState(0);

  const picksComplete = picks.length === KENO_PICK_COUNT;
  const liveMatches = drawn.filter((n) => picks.includes(n)).length;

  const togglePick = (n: number) => {
    if (phase !== 'picking') return;
    setPicks((prev) => {
      if (prev.includes(n)) { sfx.click(); return prev.filter((x) => x !== n); }
      if (prev.length >= KENO_PICK_COUNT) { toast.error(`Tu as déjà coché ${KENO_PICK_COUNT} numéros.`); return prev; }
      sfx.select(); vibrate(HAPTIC.SOFT);
      return [...prev, n];
    });
  };

  const quickPick = () => {
    const pool = Array.from({ length: KENO_POOL_SIZE }, (_, i) => i + 1);
    const picked: number[] = [];
    while (picked.length < KENO_PICK_COUNT) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    setPicks(picked); sfx.select(); vibrate(HAPTIC.SOFT);
  };

  const clearPicks = () => { setPicks([]); sfx.click(); };

  const handleDraw = async () => {
    if (busy || !picksComplete) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setBusy(true); setPhase('drawing'); setDrawn([]); setResult(null);
    vibrate(HAPTIC.MEDIUM); sfx.bet();

    const r = await placeBet('keno', amount, { picks }, () => {
      const d = drawKenoNumbers();
      const res = resolveKeno(picks, d);
      return { won: res.won, multiplier: res.multiplier, meta: { drawn: d, matches: res.matches, picks } };
    });

    if ('error' in r) { setBusy(false); setPhase('picking'); toast.error(r.error); return; }

    // Reveal the draw one ball at a time so matches land visibly.
    const all: number[] = r.meta.drawn;
    for (let i = 0; i < all.length; i++) {
      await new Promise((res) => setTimeout(res, tempo(45)));
      setDrawn(all.slice(0, i + 1));
      if (picks.includes(all[i])) { sfx.step(Math.min(8, i)); vibrate(HAPTIC.SOFT); }
      else sfx.tick();
    }

    await new Promise((res) => setTimeout(res, tempo(180)));
    setBusy(false); setPhase('done');
    setResult({ ...r, matches: r.meta.matches });

    if (r.won) {
      vibrate(HAPTIC.SUCCESS);
      if (r.multiplier >= 90) { sfx.jackpot(); setConfetti((c) => c + 1); }
      else { sfx.win(); setConfetti((c) => c + 1); }
      toast.success(`${r.meta.matches} correspondances — +${r.payout} ₶`);
    } else {
      vibrate(HAPTIC.ERROR); sfx.lose();
      toast.error(`${r.meta.matches} correspondances — il en faut 5.`);
    }
  };

  const handleReset = () => { sfx.click(); setPhase('picking'); setDrawn([]); setResult(null); };

  const gameHistory = history.filter((h) => h.game_slug === 'keno').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-4">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}

      {/* Instruction bar — the thing that was missing */}
      <div className={cn(
        'w-full rounded-xl border-2 px-4 py-2.5 flex items-center justify-between gap-3',
        phase === 'picking' && !picksComplete ? 'border-accent-primary bg-accent-primary/10' : 'border-brand-border bg-brand-inner'
      )}>
        <span className="text-sm font-bold">
          {phase === 'picking'
            ? picksComplete ? 'Grille complète — lance le tirage !' : `Coche ${KENO_PICK_COUNT} numéros`
            : phase === 'drawing' ? `Tirage en cours... ${drawn.length}/${KENO_DRAW_COUNT}`
            : `${result?.matches ?? 0} correspondances`}
        </span>
        <span className={cn('font-display font-black text-lg', picksComplete ? 'text-accent-success' : 'text-accent-primary')}>
          {phase === 'picking' ? `${picks.length}/${KENO_PICK_COUNT}` : `${liveMatches} bons`}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-8 gap-2 w-full max-w-[520px]">
        {Array.from({ length: KENO_POOL_SIZE }, (_, i) => i + 1).map((n) => {
          const picked = picks.includes(n);
          const isDrawn = drawn.includes(n);
          const isMatch = picked && isDrawn;

          return (
            <button
              key={n}
              onClick={() => togglePick(n)}
              disabled={phase !== 'picking'}
              className={cn(
                'aspect-square rounded-lg border-2 text-base font-black flex items-center justify-center transition-all duration-200 focus:outline-none',
                isMatch ? 'bg-accent-success border-accent-success text-brand-bg scale-110 z-10'
                  : isDrawn ? 'bg-accent-secondary/25 border-accent-secondary text-tx-base'
                  : picked ? 'bg-accent-primary border-accent-primary text-brand-bg'
                  : 'bg-brand-inner border-brand-border text-tx-secondary hover:border-tx-base/60'
              )}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-[10px] font-bold text-tx-muted">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-accent-primary inline-block" /> Ton choix</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-accent-secondary/60 inline-block" /> Tiré</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-accent-success inline-block" /> Correspondance</span>
      </div>

      <ResultBanner
        state={!result ? 'idle' : result.multiplier > 1 ? 'win' : result.multiplier === 1 ? 'push' : 'lose'}
        nearMiss={result && result.multiplier === 0 && result.matches === 5 ? 'À un numéro du remboursement !' : undefined}
      >
        {result?.won ? `${result.matches} bons — +${result.payout} ₶`
          : result?.multiplier === 1 ? `${result.matches} bons — mise remboursée`
          : `${result?.matches ?? 0} bons — perdu`}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      {phase === 'picking' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={quickPick} className="h-11 rounded-xl border-2 border-brand-border bg-brand-inner text-sm font-bold hover:border-accent-primary focus:outline-none">
              Auto ({KENO_PICK_COUNT})
            </button>
            <button onClick={clearPicks} disabled={picks.length === 0} className="h-11 rounded-xl border-2 border-brand-border bg-brand-inner text-sm font-bold hover:border-tx-base disabled:opacity-40 focus:outline-none">
              Effacer
            </button>
          </div>

          <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={busy} />

          <PlayButton onClick={handleDraw} loading={busy} disabled={!isLoaded || !picksComplete || amount < CASINO_MIN_BET}>
            {picksComplete ? `LANCER LE TIRAGE · ${amount} ₶` : `ENCORE ${KENO_PICK_COUNT - picks.length} NUMÉRO${KENO_PICK_COUNT - picks.length > 1 ? 'S' : ''}`}
          </PlayButton>
        </>
      ) : (
        <PlayButton onClick={handleReset} disabled={phase === 'drawing'}>
          {phase === 'drawing' ? 'TIRAGE...' : 'NOUVELLE GRILLE'}
        </PlayButton>
      )}

      <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2">Gains selon correspondances</div>
        <div className="space-y-1 text-xs">
          {Object.entries(KENO_PAYTABLE).map(([k, v]) => (
            <div key={k} className={cn('flex justify-between items-center rounded px-1.5 py-0.5', result && result.matches === Number(k) && 'bg-accent-success/20')}>
              <span className="text-tx-secondary">{k} bons</span>
              <span className="font-display font-black text-accent-primary">{v === 1 ? 'remboursé' : `×${v}`}</span>
            </div>
          ))}
          <div className="flex justify-between items-center text-tx-muted px-1.5 pt-1 border-t border-brand-border">
            <span>0 à 4 bons</span><span className="font-bold">rien</span>
          </div>
        </div>
      </div>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell
      title="Frenly Keno"
      rules={RULES}
      balance={balance}
      isLoaded={isLoaded}
      isLocal={isLocal}
      streak={stats.currentStreak}
      level={stats.level}
      xpIntoLevel={stats.xpIntoLevel}
      xpForNext={stats.xpForNext}
      stage={stage}
      panel={panel}
    />
  );
}
