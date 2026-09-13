'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { playPassLine, resolveCraps, CRAPS_PAYOUT, CASINO_MIN_BET, type DiceRoll } from '@/lib/casino/craps';
import {
  GameShell, fmt, BetControls, PlayButton, PlayRow, ResultBanner, HistoryStrip, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import { tempo } from '@/lib/casino/turbo';

const RULES: RulesSpec = {
  howTo: [
    'Place ta mise sur "Ça passe" et lance les deux dés.',
    'Premier lancer : 7 ou 11 → tu gagnes tout de suite. 2, 3 ou 12 → tu perds tout de suite.',
    'Tout autre total devient ton "point" : on relance jusqu’à le refaire (gagné) ou tomber sur 7 (perdu).',
    'C’est le pari le plus équitable du casino : à peine 1,4% d’avantage pour la maison.',
  ],
  payouts: [
    { label: 'Ça passe', value: `×${CRAPS_PAYOUT}` },
    { label: 'Ça casse', value: 'Mise perdue' },
  ],
  rtp: '~98,6%',
};

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <div
      className={cn('w-24 h-24 rounded-[22px] border-[5px] border-brand-border bg-white grid gap-1 p-3', rolling && 'animate-bounce')}
      style={{ gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)', boxShadow: 'inset 0 -7px 0 #D5DCF5, 0 6px 0 #05061A' }}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const row = Math.floor(i / 3), col = i % 3;
        const on = (PIPS[value] || []).some(([r, c]) => r === row && c === col);
        return <div key={i} className={cn('rounded-full', on ? 'bg-[#FF3B5C] border-2 border-brand-border' : 'bg-transparent')} />;
      })}
    </div>
  );
}

export default function CrapsPage() {
  const { balance, isLoaded, isLocal, maxBet, stats, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [rolling, setRolling] = useState(false);
  const [dice, setDice] = useState<DiceRoll>({ d1: 3, d2: 4, sum: 7 });
  const [rollLog, setRollLog] = useState<number[]>([]);
  const [point, setPoint] = useState<number | null>(null);
  const [result, setResult] = useState<GenericBetResult | null>(null);
  const [confetti, setConfetti] = useState(0);

  const handleRoll = async () => {
    if (rolling) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setRolling(true); setResult(null); setRollLog([]); setPoint(null);
    vibrate(HAPTIC.MEDIUM); sfx.bet();

    const r = await placeBet('craps', amount, {}, () => {
      const { won, rolls, point: p } = playPassLine();
      return { ...resolveCraps(won), meta: { rolls, point: p } };
    });

    if ('error' in r) { setRolling(false); toast.error(r.error); return; }

    // Replay the sequence the server already rolled, one throw at a time.
    const rolls: DiceRoll[] = r.meta.rolls;
    for (let i = 0; i < rolls.length; i++) {
      // Tumble before each result lands.
      for (let t = 0; t < 5; t++) {
        setDice({ d1: 1 + Math.floor(Math.random() * 6), d2: 1 + Math.floor(Math.random() * 6), sum: 0 });
        await new Promise((res) => setTimeout(res, tempo(35)));
      }
      setDice(rolls[i]);
      setRollLog((prev) => [...prev, rolls[i].sum]);
      sfx.card(); vibrate(HAPTIC.SOFT);
      if (i === 0 && r.meta.point) setPoint(r.meta.point);
      await new Promise((res) => setTimeout(res, tempo(300)));
    }

    setRolling(false);
    setResult(r);

    if (r.won) {
      vibrate(HAPTIC.SUCCESS); sfx.win(); setConfetti((c) => c + 1);
      toast.success(`Ça passe — +${fmt(r.payout)} ₶`);
    } else {
      vibrate(HAPTIC.ERROR); sfx.lose();
      toast.error('Ça casse — perdu');
    }
  };

  const gameHistory = history.filter((h) => h.game_slug === 'craps').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-5">
      {confetti > 0 && <Confetti trigger={confetti} intensity="big" />}

      <div
        className="w-full rounded-[22px] border-4 border-brand-border p-6 flex flex-col items-center gap-4"
        style={{
          background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.07) 0 18px, transparent 18px 36px), #169A55',
          boxShadow: 'inset 0 -8px 0 #0F7A42, 0 6px 0 #05061A',
        }}
      >
        <div className="flex gap-5">
          <Die value={dice.d1} rolling={rolling} />
          <Die value={dice.d2} rolling={rolling} />
        </div>

        <div className="font-display text-6xl leading-none text-stroke">{dice.sum > 0 ? dice.sum : '?'}</div>

        {point !== null && (
          <div className="px-4 py-1.5 rounded-xl border-[3px] border-brand-border bg-accent-primary text-brand-bg font-display text-base shadow-[inset_0_-4px_0_#D98E00,0_4px_0_#05061A]">
            Point : {point} · refais-le avant un 7
          </div>
        )}

        {rollLog.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {rollLog.map((s, i) => (
              <span key={i} className={cn(
                'w-10 h-10 rounded-xl border-[3px] border-brand-border flex items-center justify-center font-display text-lg',
                point !== null && s === point ? 'bg-accent-primary text-brand-bg'
                  : s === 7 && i > 0 ? 'bg-accent-secondary text-white'
                  : 'bg-[#0E1030] text-white'
              )}>{s}</span>
            ))}
          </div>
        )}
      </div>

      <ResultBanner state={!result ? 'idle' : result.won ? 'win' : 'lose'}>
        {result?.won ? `Ça passe — +${fmt(result.payout)} ₶` : 'Ça casse — perdu'}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={rolling} />
      <PlayRow balance={balance} onClick={handleRoll} loading={rolling} disabled={!isLoaded || amount < CASINO_MIN_BET} betKey={amount} blocked={amount > balance}>
        {rolling ? 'ÇA ROULE...' : `LANCER LES DÉS · ${fmt(amount)} ₶`}
      </PlayRow>

      <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3 space-y-2 text-sm">
        <div className="font-display text-base leading-none mb-1">Premier lancer</div>
        <div className="flex justify-between items-center"><span className="font-bold text-tx-secondary">7 ou 11</span><span className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-success text-brand-bg font-display">Gagné</span></div>
        <div className="flex justify-between items-center"><span className="font-bold text-tx-secondary">2, 3 ou 12</span><span className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-secondary text-white font-display">Perdu</span></div>
        <div className="flex justify-between items-center"><span className="font-bold text-tx-secondary">Autre total</span><span className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-primary text-brand-bg font-display">Devient le point</span></div>
      </div>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell gameSlug="craps" title="Frenly Craps" rules={RULES} balance={balance} isLoaded={isLoaded} isLocal={isLocal} streak={stats.currentStreak} level={stats.level} xpIntoLevel={stats.xpIntoLevel} xpForNext={stats.xpForNext} stage={stage} panel={panel} />
  );
}
