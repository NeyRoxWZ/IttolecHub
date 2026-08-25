'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { drawStadeOutcome, resolveStade, STADE_PAYOUTS, CASINO_MIN_BET, type StadeBet, type StadeOutcome } from '@/lib/casino/stade';
import {
  GameShell, BetControls, PlayButton, PlayingCard, ResultBanner, HistoryStrip, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';

const RULES: RulesSpec = {
  howTo: [
    'Deux cartes sont tirées : une pour Domicile, une pour Extérieur.',
    'Parie sur l’équipe qui tirera la carte la plus haute, ou sur le match nul.',
    'Domicile et Extérieur ont exactement les mêmes chances (48% chacun).',
    'Le match nul est rare (4%) mais paie très gros.',
  ],
  payouts: [
    { label: 'Domicile', value: `×${STADE_PAYOUTS.home}` },
    { label: 'Extérieur', value: `×${STADE_PAYOUTS.away}` },
    { label: 'Match nul', value: `×${STADE_PAYOUTS.draw}` },
  ],
  rtp: '~96%',
};

const BETS: { value: StadeBet; label: string; emoji: string }[] = [
  { value: 'home', label: 'Domicile', emoji: '🏠' },
  { value: 'draw', label: 'Match nul', emoji: '🤝' },
  { value: 'away', label: 'Extérieur', emoji: '✈️' },
];
const LABEL: Record<StadeOutcome, string> = { home: 'Domicile', away: 'Extérieur', draw: 'Match nul' };

export default function StadePage() {
  const { balance, isLoaded, isLocal, maxBet, stats, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [bet, setBet] = useState<StadeBet>('home');
  const [playing, setPlaying] = useState(false);
  const [cards, setCards] = useState<{ home?: number; away?: number }>({});
  const [result, setResult] = useState<(GenericBetResult & { outcome: StadeOutcome }) | null>(null);
  const [confetti, setConfetti] = useState(0);

  const handlePlay = async () => {
    if (playing) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setPlaying(true); setResult(null); setCards({});
    vibrate(HAPTIC.MEDIUM); sfx.bet();

    const r = await placeBet('stade', amount, { bet }, () => {
      const outcome = drawStadeOutcome();
      return { ...resolveStade(outcome, bet), meta: { outcome, bet } };
    });

    if ('error' in r) { setPlaying(false); toast.error(r.error); return; }

    // Pick two card values consistent with the outcome the server chose.
    const outcome: StadeOutcome = r.meta.outcome;
    let home: number, away: number;
    if (outcome === 'draw') { home = 1 + Math.floor(Math.random() * 13); away = home; }
    else {
      const hi = 2 + Math.floor(Math.random() * 12);
      const lo = 1 + Math.floor(Math.random() * (hi - 1));
      [home, away] = outcome === 'home' ? [hi, lo] : [lo, hi];
    }

    await new Promise((res) => setTimeout(res, 380));
    setCards({ home }); sfx.card();
    await new Promise((res) => setTimeout(res, 520));
    setCards({ home, away }); sfx.reveal();
    await new Promise((res) => setTimeout(res, 420));

    setPlaying(false);
    setResult({ ...r, outcome });

    if (r.won) {
      vibrate(HAPTIC.SUCCESS);
      if (outcome === 'draw') { sfx.jackpot(); setConfetti((c) => c + 1); }
      else { sfx.win(); setConfetti((c) => c + 1); }
      toast.success(`${LABEL[outcome]} — +${r.payout} ₶`);
    } else {
      vibrate(HAPTIC.ERROR); sfx.lose();
      toast.error(`${LABEL[outcome]} — perdu`);
    }
  };

  const gameHistory = history.filter((h) => h.game_slug === 'stade').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-5">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}

      <div
        className="w-full rounded-2xl border-4 border-brand-border p-6"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #1B5E3F 0%, #0E3524 70%, #0A2419 100%)' }}
      >
        <div className="flex items-center justify-around">
          {(['home', 'away'] as const).map((side) => {
            const value = cards[side];
            const isWinnerSide = result && result.outcome === side;
            return (
              <div key={side} className="flex flex-col items-center gap-2">
                <span className={cn('text-[10px] font-black uppercase tracking-widest', isWinnerSide ? 'text-accent-primary' : 'text-white/60')}>
                  {side === 'home' ? '🏠 Domicile' : '✈️ Extérieur'}
                </span>
                {value !== undefined
                  ? <PlayingCard rank={value} index={side === 'home' ? 0 : 2} size="lg" highlight={!!isWinnerSide} />
                  : <PlayingCard hidden size="lg" />}
              </div>
            );
          })}
        </div>

        {result?.outcome === 'draw' && (
          <div className="text-center mt-4 font-display font-black text-accent-primary tracking-widest">MATCH NUL</div>
        )}
      </div>

      <ResultBanner state={!result ? 'idle' : result.won ? 'win' : 'lose'}>
        {result?.won ? `${LABEL[result.outcome]} — +${result.payout} ₶` : result ? `${LABEL[result.outcome]} — perdu` : ''}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <div>
        <div className="text-[10px] font-black tracking-widest uppercase text-tx-muted mb-2">Ton pari</div>
        <div className="space-y-2">
          {BETS.map((b) => (
            <button
              key={b.value}
              onClick={() => { sfx.select(); vibrate(HAPTIC.SOFT); setBet(b.value); }}
              disabled={playing}
              className={cn(
                'w-full h-14 rounded-xl border-2 flex items-center justify-between px-4 font-bold transition-all focus:outline-none disabled:opacity-50',
                bet === b.value ? 'bg-accent-primary text-brand-bg border-accent-primary' : 'bg-brand-inner border-brand-border text-tx-secondary hover:border-tx-base/60'
              )}
            >
              <span className="flex items-center gap-2"><span className="text-lg">{b.emoji}</span>{b.label}</span>
              <span>×{STADE_PAYOUTS[b.value]}</span>
            </button>
          ))}
        </div>
      </div>

      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={playing} />

      <PlayButton onClick={handlePlay} loading={playing} disabled={!isLoaded || amount < CASINO_MIN_BET}>
        {playing ? 'TIRAGE...' : `PARIER · ${amount} ₶`}
      </PlayButton>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell title="Frenly Stade" rules={RULES} balance={balance} isLoaded={isLoaded} isLocal={isLocal} streak={stats.currentStreak} stage={stage} panel={panel} />
  );
}
