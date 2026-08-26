'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { flipCoin, resolveCoinflip, COINFLIP_PAYOUT, CASINO_MIN_BET, type CoinSide } from '@/lib/casino/coinflip';
import {
  GameShell, BetControls, PlayButton, PlayRow, ResultBanner, HistoryStrip, type RulesSpec,
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
      toast.success(`${landed === 'pile' ? 'Pile' : 'Face'} — +${r.payout} ₶`);
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
            className="absolute inset-0 rounded-full border-8 flex flex-col items-center justify-center font-display font-black"
            style={{
              backfaceVisibility: 'hidden',
              background: '#FFD000',
              borderColor: '#12121A', color: '#12121A',
            }}
          >
            <ArtFrenlyCoin variant="gold" size={92} />
            <span className="text-base tracking-[0.3em] mt-1">PILE</span>
          </div>
          {/* Face */}
          <div
            className="absolute inset-0 rounded-full border-8 flex flex-col items-center justify-center font-display font-black"
            style={{
              backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
              background: '#1E1E28',
              borderColor: '#12121A', color: '#FFD000',
            }}
          >
            <ArtFrenlyCoin variant="dark" size={92} />
            <span className="text-base tracking-[0.3em] mt-1">FACE</span>
          </div>
        </div>
      </div>

      <ResultBanner state={!result ? 'idle' : result.won ? 'win' : 'lose'}>
        {result?.won ? `${result.landed === 'pile' ? 'Pile' : 'Face'} — +${result.payout} ₶` : `${result?.landed === 'pile' ? 'Pile' : 'Face'} — perdu`}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <div>
        <div className="text-[10px] font-black tracking-widest uppercase text-tx-muted mb-2">Ton choix</div>
        <div className="grid grid-cols-2 gap-2">
          {(['pile', 'face'] as const).map((c) => (
            <button
              key={c}
              onClick={() => { sfx.select(); vibrate(HAPTIC.SOFT); setChoice(c); }}
              disabled={flipping}
              className={cn(
                'h-20 rounded-xl border-4 font-display font-black flex flex-col items-center justify-center gap-1 transition-all focus:outline-none disabled:opacity-50',
                choice === c ? 'border-accent-primary scale-[1.03]' : 'border-brand-border'
              )}
              style={
                c === 'pile'
                  ? { background: '#FFD000', color: '#12121A' }
                  : { background: '#1E1E28', color: '#FFD000' }
              }
            >
              <ArtFrenlyCoin variant={c === 'pile' ? 'gold' : 'dark'} size={30} />
              {c === 'pile' ? 'PILE' : 'FACE'}
            </button>
          ))}
        </div>
      </div>

      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={flipping} />

      <PlayRow onClick={handleFlip} loading={flipping} disabled={!isLoaded || amount < CASINO_MIN_BET} betKey={amount} blocked={amount > balance}>
        {flipping ? 'ÇA TOURNE...' : `LANCER · ${amount} ₶ (×${COINFLIP_PAYOUT})`}
      </PlayRow>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell gameSlug="coinflip" title="Frenly Coinflip" rules={RULES} balance={balance} isLoaded={isLoaded} isLocal={isLocal} streak={stats.currentStreak} level={stats.level} xpIntoLevel={stats.xpIntoLevel} xpForNext={stats.xpForNext} stage={stage} panel={panel} />
  );
}
