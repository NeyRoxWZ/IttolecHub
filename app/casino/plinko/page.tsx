'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { dropBall, resolvePlinko, PLINKO_MULTIPLIERS, PLINKO_ROWS, CASINO_MIN_BET } from '@/lib/casino/plinko';
import {
  GameShell, BetControls, PlayButton, ResultBanner, HistoryStrip, type RulesSpec,
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
      toast.success(`×${r.multiplier} — +${r.payout} ₶`);
    } else {
      vibrate(HAPTIC.ERROR); sfx.lose();
      toast.error(`×${r.multiplier} — tu récupères ${r.payout} ₶`);
    }
  };

  // Stake of the previous round, for the one-tap rebet chip.
  const lastBet = Number(history.find((h) => h.meta?.amount)?.meta?.amount) || undefined;
  const gameHistory = history.filter((h) => h.game_slug === 'plinko').slice(0, 10);
  const bucketColor = (m: number) => (m >= 11 ? '#FFD000' : m >= 2 ? '#00FF94' : m >= 1 ? '#4FC3F7' : '#FF2A55');

  const stage = (
    <div className="w-full flex flex-col items-center gap-4">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}

      <div
        className="relative rounded-2xl border-4 border-brand-border p-3"
        style={{ background: 'linear-gradient(180deg, #141B33 0%, #0C1122 100%)' }}
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
                  className={cn('absolute rounded-full transition-colors duration-150', active ? 'bg-accent-primary' : 'bg-white/35')}
                  style={{ width: 8, height: 8, left: x - 4, top: y - 4 }}
                />
              );
            });
          })}

          {/* Ball */}
          {ball && (
            <div
              className="absolute rounded-full bg-accent-primary z-10"
              style={{
                width: 20, height: 20,
                left: BOARD_W / 2 + ball.offset * SPACING - 10,
                top: ball.row * ROW_H + 2,
                transition: `left ${STEP_MS}ms cubic-bezier(0.4,0,0.6,1), top ${STEP_MS}ms cubic-bezier(0.3,0,0.7,1)`,
                boxShadow: '0 0 10px rgba(255,208,0,0.8)',
              }}
            />
          )}
        </div>

        {/* Buckets */}
        <div className="flex gap-0.5 mt-1">
          {PLINKO_MULTIPLIERS.map((m, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-12 rounded-md border-2 flex items-center justify-center text-xs font-black transition-all duration-300',
                landedBucket === i ? 'scale-110 z-10' : ''
              )}
              style={{
                width: SPACING,
                borderColor: landedBucket === i ? bucketColor(m) : 'rgba(255,255,255,0.15)',
                background: landedBucket === i ? bucketColor(m) : 'rgba(255,255,255,0.05)',
                color: landedBucket === i ? '#13131A' : bucketColor(m),
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
      <BetControls lastBet={lastBet} amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={dropping} />
      <PlayButton onClick={handleDrop} loading={dropping} disabled={!isLoaded || amount < CASINO_MIN_BET}>
        {dropping ? 'ÇA TOMBE...' : `LÂCHER LA BILLE · ${amount} ₶`}
      </PlayButton>

      <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2">Cases du bas</div>
        <p className="text-xs text-tx-secondary leading-relaxed">
          Les bords paient <span className="font-black text-accent-primary">×11</span> mais sont rares :
          la bille finit le plus souvent au centre, où les cases rendent moins que la mise.
        </p>
      </div>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell
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
