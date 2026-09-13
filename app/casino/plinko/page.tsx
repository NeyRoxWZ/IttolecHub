'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { dropBall, resolvePlinko, PLINKO_MULTIPLIERS, PLINKO_ROWS, CASINO_MIN_BET } from '@/lib/casino/plinko';
import {
  GameShell, fmt, BetControls, PlayButton, PlayRow, ResultBanner, HistoryStrip, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import { tempo } from '@/lib/casino/turbo';

const RULES: RulesSpec = {
  howTo: [
    'Mise, puis lâche la bille en haut du plateau.',
    `Elle rebondit sur ${PLINKO_ROWS} rangées de picots, partant à gauche ou à droite à chaque fois.`,
    'Elle finit dans une des 9 cases du bas, chacune avec son multiplicateur.',
    'Les cases du centre sont les plus probables mais paient peu ; les extrêmes sont rares et paient ×11.',
  ],
  payouts: [
    { label: 'Cases extrêmes (bords)', value: '×11' },
    { label: 'Cases intermédiaires', value: '×2 / ×1,3' },
    { label: 'Cases centrales', value: '×0,9 / ×0,3' },
  ],
  rtp: '~97%',
};

const SPACING = 46;
const ROW_H = 40;
const BOARD_W = SPACING * (PLINKO_ROWS + 1);
const BOARD_H = ROW_H * (PLINKO_ROWS + 1) + 20;
const STEP_MS = 78;

export default function PlinkoPage() {
  const { balance, isLoaded, isLocal, maxBet, stats, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [dropping, setDropping] = useState(false);
  const [ball, setBall] = useState<{ row: number; offset: number } | null>(null);
  const [result, setResult] = useState<GenericBetResult | null>(null);
  const [landedBucket, setLandedBucket] = useState<number | null>(null);
  const [confetti, setConfetti] = useState(0);

  const handleDrop = async () => {
    if (dropping) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setDropping(true); setResult(null); setLandedBucket(null);
    vibrate(HAPTIC.MEDIUM); sfx.bet();
    setBall({ row: 0, offset: 0 });

    const r = await placeBet('plinko', amount, {}, () => {
      const { bucket, path, multiplier } = dropBall();
      return { ...resolvePlinko(multiplier), meta: { bucket, path } };
    });

    if ('error' in r) { setDropping(false); setBall(null); toast.error(r.error); return; }

    // Walk the exact path the server rolled — the animation reports the
    // result, it never produces it.
    const path: ('L' | 'R')[] = r.meta.path;
    let offset = 0;
    for (let i = 0; i < path.length; i++) {
      offset += path[i] === 'R' ? 0.5 : -0.5;
      await new Promise((res) => setTimeout(res, tempo(STEP_MS)));
      setBall({ row: i + 1, offset });
      sfx.tick(); vibrate(HAPTIC.SOFT);
    }

    await new Promise((res) => setTimeout(res, tempo(130)));
    setLandedBucket(r.meta.bucket);
    setResult(r);
    setDropping(false);

    if (r.won) {
      vibrate(HAPTIC.SUCCESS);
      if (r.multiplier >= 11) { sfx.jackpot(); setConfetti((c) => c + 1); }
      else { sfx.win(); }
      toast.success(`×${r.multiplier} — +${fmt(r.payout)} ₶`);
    } else {
      vibrate(HAPTIC.ERROR); sfx.lose();
      toast.error(`×${r.multiplier} — tu récupères ${fmt(r.payout)} ₶`);
    }
  };

  const gameHistory = history.filter((h) => h.game_slug === 'plinko').slice(0, 10);
  const bucketColor = (m: number) => (m >= 11 ? '#FFC61A' : m >= 2 ? '#33D17A' : m >= 1 ? '#5B8CFF' : '#FF4F8B');

  const stage = (
    <div className="w-full flex flex-col items-center gap-4">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}

      <div
        className="relative rounded-[22px] border-4 border-brand-border p-3"
        style={{
          background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 16px, transparent 16px 32px), #0E1030',
          boxShadow: 'inset 0 -8px 0 #070920, 0 6px 0 #05061A',
        }}
      >
        <div className="relative" style={{ width: BOARD_W, height: BOARD_H }}>
          {/* Pegs */}
          {Array.from({ length: PLINKO_ROWS }, (_, row) => {
            const pegCount = row + 2;
            return Array.from({ length: pegCount }, (_, p) => {
              const x = BOARD_W / 2 + (p - (pegCount - 1) / 2) * SPACING;
              const y = (row + 1) * ROW_H;
              const active = ball !== null && ball.row === row + 1;
              return (
                <div
                  key={`${row}-${p}`}
                  className={cn('absolute rounded-full border-2 border-brand-border transition-colors duration-150', active ? 'bg-accent-primary' : 'bg-white')}
                  style={{ width: 11, height: 11, left: x - 5.5, top: y - 5.5 }}
                />
              );
            });
          })}

          {/* Ball */}
          {ball && (
            <div
              className="absolute rounded-full bg-accent-primary border-[3px] border-brand-border z-10"
              style={{
                width: 22, height: 22,
                left: BOARD_W / 2 + ball.offset * SPACING - 11,
                top: ball.row * ROW_H + 1,
                transition: `left ${tempo(STEP_MS)}ms cubic-bezier(0.4,0,0.6,1), top ${tempo(STEP_MS)}ms cubic-bezier(0.3,0,0.7,1)`,
                boxShadow: 'inset -3px -4px 0 #D98E00, 0 3px 0 #05061A',
              }}
            />
          )}
        </div>

        {/* Buckets */}
        <div className="flex gap-1 mt-1">
          {PLINKO_MULTIPLIERS.map((m, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-12 rounded-lg border-[3px] border-brand-border flex items-center justify-center font-display text-sm transition-transform duration-300',
                landedBucket === i ? 'scale-110 -translate-y-1 z-10 ring-4 ring-white' : landedBucket !== null ? 'opacity-60' : ''
              )}
              style={{
                width: SPACING,
                background: bucketColor(m),
                color: m >= 1 && m < 2 ? '#FFFFFF' : m < 1 ? '#FFFFFF' : '#0E1030',
                boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.22)',
              }}
            >
              ×{m}
            </div>
          ))}
        </div>
      </div>

      <ResultBanner state={!result ? 'idle' : result.won ? 'win' : 'lose'}>
        {result ? `×${result.multiplier} — ${result.payout > 0 ? `+${result.payout}` : result.payout} ₶` : ''}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={dropping} />
      <PlayRow balance={balance} onClick={handleDrop} loading={dropping} disabled={!isLoaded || amount < CASINO_MIN_BET} betKey={amount} blocked={amount > balance}>
        {dropping ? 'ÇA TOMBE...' : `LÂCHER LA BILLE · ${fmt(amount)} ₶`}
      </PlayRow>

      <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
        <div className="font-display text-base leading-none mb-2">Cases du bas</div>
        <p className="text-sm font-bold text-tx-secondary leading-relaxed">
          Les bords paient <span className="font-black text-accent-primary">×11</span> mais sont rares :
          la bille finit le plus souvent au centre, où les cases rendent moins que la mise.
        </p>
      </div>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell
      gameSlug="plinko"
      title="Frenly Plinko"
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
