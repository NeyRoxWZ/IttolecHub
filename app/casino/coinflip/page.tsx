'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { flipCoin, resolveCoinflip, COINFLIP_PAYOUT, CASINO_MIN_BET, type CoinSide } from '@/lib/casino/coinflip';
import {
  GameShell, fmt, BetControls, PlayButton, PlayRow, ResultBanner, HistoryStrip, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import { ArtFrenlyCoin } from '../_components/CasinoArt';
import { tempo } from '@/lib/casino/turbo';

const RULES: RulesSpec = {
  howTo: [
    'Choisis Pile ou Face, place ta mise et lance la pièce.',
    'La pièce est parfaitement équilibrée : 50% de chances de chaque côté.',
    'Si le côté sorti est celui que tu as choisi, tu récupères ta mise multipliée par 1,94.',
  ],
  payouts: [
    { label: 'Bon côté', value: '×1,94' },
    { label: 'Mauvais côté', value: 'Mise perdue' },
  ],
  rtp: '~97%',
};

const SPIN_SPEED = 1100;
const SETTLE_MS = 850;

export default function CoinflipPage() {
  const { balance, isLoaded, isLocal, maxBet, stats, placeBet, history } = useCasinoWallet();

  const [choice, setChoice] = useState<CoinSide>('pile');
  const [amount, setAmount] = useState(10);
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<(GenericBetResult & { landed: CoinSide }) | null>(null);
  const [confetti, setConfetti] = useState(0);

  const coinRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const apply = (deg: number, transition?: string) => {
    if (!coinRef.current) return;
    coinRef.current.style.transition = transition || 'none';
    coinRef.current.style.transform = `rotateX(-12deg) rotateY(${deg}deg)`;
  };

  const handleFlip = async () => {
    if (flipping) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setFlipping(true); setResult(null);
    vibrate(HAPTIC.MEDIUM); sfx.bet();

    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      angleRef.current += SPIN_SPEED * dt;
      apply(angleRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    const r = await placeBet('coinflip', amount, { choice }, () => {
      const landed = flipCoin();
      return { ...resolveCoinflip(landed, choice), meta: { landed, choice } };
    });

    if ('error' in r) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setFlipping(false); toast.error(r.error); return;
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const landed: CoinSide = r.meta.landed;
    const targetMod = landed === 'pile' ? 0 : 180;
    const current = ((angleRef.current % 360) + 360) % 360;
    let delta = targetMod - current;
    if (delta < 0) delta += 360;
    angleRef.current += delta + 360 * 3;
    const settleMs = tempo(SETTLE_MS);
    apply(angleRef.current, `transform ${settleMs}ms cubic-bezier(0.18, 0.72, 0.1, 1)`);

    await new Promise((res) => setTimeout(res, settleMs));
    setResult({ ...r, landed });
    setFlipping(false);

    if (r.won) {
      vibrate(HAPTIC.SUCCESS); sfx.win(); setConfetti((c) => c + 1);
      toast.success(`${landed === 'pile' ? 'Pile' : 'Face'} — +${fmt(r.payout)} ₶`);
    } else {
      vibrate(HAPTIC.ERROR); sfx.lose();
      toast.error(`${landed === 'pile' ? 'Pile' : 'Face'} — perdu`);
    }
  };

  const gameHistory = history.filter((h) => h.game_slug === 'coinflip').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-6">
      {confetti > 0 && <Confetti trigger={confetti} intensity="big" />}

      <div style={{ perspective: 900 }}>
        <div ref={coinRef} className="relative w-56 h-56" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(-12deg) rotateY(0deg)' }}>
          {/* Pile */}
          <div
            className="absolute inset-0 rounded-full border-8 flex flex-col items-center justify-center"
            style={{
              backfaceVisibility: 'hidden',
              background: '#FFC61A',
              borderColor: '#05061A',
              boxShadow: 'inset 0 -12px 0 #D98E00, inset 0 10px 0 #FFE07A',
            }}
          >
            <ArtFrenlyCoin variant="gold" size={92} />
            <span className="font-display text-2xl tracking-widest mt-1 text-stroke-sm">PILE</span>
          </div>
          {/* Face */}
          <div
            className="absolute inset-0 rounded-full border-8 flex flex-col items-center justify-center"
            style={{
              backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
              background: '#3B6BFF',
              borderColor: '#05061A',
              boxShadow: 'inset 0 -12px 0 #2A4FC4, inset 0 10px 0 #6E92FF',
            }}
          >
            <ArtFrenlyCoin variant="dark" size={92} />
            <span className="font-display text-2xl tracking-widest mt-1 text-stroke-sm">FACE</span>
          </div>
        </div>
      </div>

      <ResultBanner state={!result ? 'idle' : result.won ? 'win' : 'lose'}>
        {result?.won ? `${result.landed === 'pile' ? 'Pile' : 'Face'} — +${fmt(result.payout)} ₶` : `${result?.landed === 'pile' ? 'Pile' : 'Face'} — perdu`}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <div>
        <div className="font-display text-lg leading-none mb-2">Ton choix</div>
        <div className="grid grid-cols-2 gap-3">
          {(['pile', 'face'] as const).map((c) => (
            <button
              key={c}
              onClick={() => { sfx.select(); vibrate(HAPTIC.SOFT); setChoice(c); }}
              disabled={flipping}
              className={cn(
                'h-24 rounded-2xl border-[3px] border-brand-border flex flex-col items-center justify-center gap-1 transition-transform active:translate-y-[3px] focus:outline-none disabled:opacity-50',
                choice === c ? 'ring-4 ring-white scale-[1.03]' : 'opacity-80 hover:opacity-100'
              )}
              style={
                c === 'pile'
                  ? { background: '#FFC61A', boxShadow: 'inset 0 -6px 0 #D98E00, 0 5px 0 #05061A' }
                  : { background: '#3B6BFF', boxShadow: 'inset 0 -6px 0 #2A4FC4, 0 5px 0 #05061A' }
              }
            >
              <ArtFrenlyCoin variant={c === 'pile' ? 'gold' : 'dark'} size={34} />
              <span className="font-display text-xl leading-none text-stroke-sm">{c === 'pile' ? 'Pile' : 'Face'}</span>
            </button>
          ))}
        </div>
      </div>

      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={flipping} />

      <PlayRow balance={balance} onClick={handleFlip} loading={flipping} disabled={!isLoaded || amount < CASINO_MIN_BET} betKey={amount} blocked={amount > balance}>
        {flipping ? 'ÇA TOURNE...' : `LANCER · ${fmt(amount)} ₶ (×${COINFLIP_PAYOUT})`}
      </PlayRow>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell gameSlug="coinflip" title="Frenly Coinflip" rules={RULES} balance={balance} isLoaded={isLoaded} isLocal={isLocal} streak={stats.currentStreak} level={stats.level} xpIntoLevel={stats.xpIntoLevel} xpForNext={stats.xpForNext} stage={stage} panel={panel} />
  );
}
