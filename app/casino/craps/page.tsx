'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { playPassLine, resolveCraps, CRAPS_PAYOUT, CASINO_MIN_BET, type DiceRoll } from '@/lib/casino/craps';
import {
  GameShell, BetControls, PlayButton, ResultBanner, HistoryStrip, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';

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
      className={cn('w-16 h-16 rounded-xl border-4 border-brand-border bg-white grid p-2', rolling && 'animate-bounce')}
      style={{ gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,1fr)', boxShadow: '0 3px 8px rgba(0,0,0,0.4)' }}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const row = Math.floor(i / 3), col = i % 3;
        const on = (PIPS[value] || []).some(([r, c]) => r === row && c === col);
        return <div key={i} className={cn('rounded-full', on ? 'bg-[#13131A]' : 'bg-transparent')} />;
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
        await new Promise((res) => setTimeout(res, 55));
      }
      setDice(rolls[i]);
      setRollLog((prev) => [...prev, rolls[i].sum]);
      sfx.card(); vibrate(HAPTIC.SOFT);
      if (i === 0 && r.meta.point) setPoint(r.meta.point);
      await new Promise((res) => setTimeout(res, 520));
    }

    setRolling(false);
    setResult(r);

    if (r.won) {
      vibrate(HAPTIC.SUCCESS); sfx.win(); setConfetti((c) => c + 1);
      toast.success(`Ça passe — +${r.payout} ₶`);
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
        className="w-full rounded-2xl border-4 border-brand-border p-6 flex flex-col items-center gap-4"
        style={{ background: 'radial-gradient(ellipse at 50% 25%, #1B5E3F 0%, #0E3524 70%, #0A2419 100%)' }}
      >
        <div className="flex gap-4">
          <Die value={dice.d1} rolling={rolling} />
          <Die value={dice.d2} rolling={rolling} />
        </div>

        <div className="font-display text-3xl font-black text-white">{dice.sum > 0 ? dice.sum : '—'}</div>

        {point !== null && (
          <div className="px-3 py-1 rounded-lg border-2 border-accent-primary bg-accent-primary/15 text-accent-primary font-display font-black text-sm">
            POINT : {point} — refais-le avant un 7
          </div>
        )}

        {rollLog.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {rollLog.map((s, i) => (
              <span key={i} className={cn(
                'w-7 h-7 rounded-md border-2 flex items-center justify-center text-xs font-black',
                point !== null && s === point ? 'border-accent-success text-accent-success'
                  : s === 7 && i > 0 ? 'border-accent-secondary text-accent-secondary'
                  : 'border-white/25 text-white/70'
              )}>{s}</span>
            ))}
          </div>
        )}
      </div>

      <ResultBanner state={!result ? 'idle' : result.won ? 'win' : 'lose'}>
        {result?.won ? `Ça passe — +${result.payout} ₶` : 'Ça casse — perdu'}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={rolling} />
      <PlayButton onClick={handleRoll} loading={rolling} disabled={!isLoaded || amount < CASINO_MIN_BET}>
        {rolling ? 'ÇA ROULE...' : `LANCER LES DÉS · ${amount} ₶`}
      </PlayButton>

      <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3 space-y-1.5 text-xs">
        <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-1">Premier lancer</div>
        <div className="flex justify-between"><span className="text-tx-secondary">7 ou 11</span><span className="font-black text-accent-success">Gagné</span></div>
        <div className="flex justify-between"><span className="text-tx-secondary">2, 3 ou 12</span><span className="font-black text-accent-secondary">Perdu</span></div>
        <div className="flex justify-between"><span className="text-tx-secondary">Autre total</span><span className="font-black text-accent-primary">Devient le point</span></div>
      </div>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell title="Frenly Craps" rules={RULES} balance={balance} isLoaded={isLoaded} isLocal={isLocal} streak={stats.currentStreak} stage={stage} panel={panel} />
  );
}
