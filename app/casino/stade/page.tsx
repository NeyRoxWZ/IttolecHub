'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { drawStadeOutcome, resolveStade, STADE_PAYOUTS, CASINO_MIN_BET, type StadeBet, type StadeOutcome } from '@/lib/casino/stade';
import {
  GameShell, fmt, BetControls, PlayButton, PlayRow, PlayingCard, ResultBanner, HistoryStrip, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import { ArtShield, ArtHandshake } from '../_components/CasinoArt';
import { tempo } from '@/lib/casino/turbo';
import { brawlChoice } from '@/lib/ui/brawl';

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

const BETS: { value: StadeBet; label: string }[] = [
  { value: 'home', label: 'Domicile' },
  { value: 'draw', label: 'Match nul' },
  { value: 'away', label: 'Extérieur' },
];

function BetIcon({ value, size = 18 }: { value: StadeBet; size?: number }) {
  if (value === 'draw') return <ArtHandshake size={size} />;
  return <ArtShield size={size} away={value === 'away'} />;
}
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

    await new Promise((res) => setTimeout(res, tempo(200)));
    setCards({ home }); sfx.card();
    await new Promise((res) => setTimeout(res, tempo(280)));
    setCards({ home, away }); sfx.reveal();
    await new Promise((res) => setTimeout(res, tempo(220)));

    setPlaying(false);
    setResult({ ...r, outcome });

    if (r.won) {
      vibrate(HAPTIC.SUCCESS);
      if (outcome === 'draw') { sfx.jackpot(); setConfetti((c) => c + 1); }
      else { sfx.win(); setConfetti((c) => c + 1); }
      toast.success(`${LABEL[outcome]} — +${fmt(r.payout)} ₶`);
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
        className="relative w-full rounded-[24px] border-4 border-brand-border p-6 overflow-hidden"
        style={{
          background: 'repeating-linear-gradient(90deg, #169A55 0 46px, #1BAE60 46px 92px)',
          boxShadow: 'inset 0 -8px 0 #0F7A42, 0 6px 0 #05061A',
        }}
      >
        {/* Centre line and circle of the pitch. */}
        <span className="absolute left-1/2 top-0 bottom-0 w-1.5 -translate-x-1/2 bg-white/60" aria-hidden="true" />
        <span className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-[6px] border-white/60" aria-hidden="true" />
        <div className="relative flex items-center justify-around">
          {(['home', 'away'] as const).map((side) => {
            const value = cards[side];
            const isWinnerSide = result && result.outcome === side;
            return (
              <div key={side} className="flex flex-col items-center gap-2">
                <span className={cn(
                  'px-3 py-1 rounded-xl border-[3px] border-brand-border font-display text-base flex items-center gap-2',
                  isWinnerSide ? 'bg-accent-primary text-brand-bg' : 'bg-[#0E1030] text-white'
                )}>
                  <ArtShield size={18} away={side === 'away'} />
                  {side === 'home' ? 'Domicile' : 'Extérieur'}
                </span>
                {value !== undefined
                  ? <PlayingCard rank={value} index={side === 'home' ? 0 : 2} size="lg" highlight={!!isWinnerSide} />
                  : <PlayingCard hidden size="lg" />}
              </div>
            );
          })}
        </div>

        {result?.outcome === 'draw' && (
          <div className="relative text-center mt-4 font-display text-4xl text-stroke">Match nul !</div>
        )}
      </div>

      <ResultBanner state={!result ? 'idle' : result.won ? 'win' : 'lose'}>
        {result?.won ? `${LABEL[result.outcome]} — +${fmt(result.payout)} ₶` : result ? `${LABEL[result.outcome]} — perdu` : ''}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <div>
        <div className="font-display text-lg leading-none mb-2">Ton pari</div>
        <div className="space-y-2.5">
          {BETS.map((b) => (
            <button
              key={b.value}
              onClick={() => { sfx.select(); vibrate(HAPTIC.SOFT); setBet(b.value); }}
              disabled={playing}
              className={cn(brawlChoice(bet === b.value), 'w-full h-14 flex items-center justify-between px-4 text-lg')}
            >
              <span className="flex items-center gap-2"><BetIcon value={b.value} />{b.label}</span>
              <span>×{STADE_PAYOUTS[b.value]}</span>
            </button>
          ))}
        </div>
      </div>

      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={playing} />

      <PlayRow balance={balance} onClick={handlePlay} loading={playing} disabled={!isLoaded || amount < CASINO_MIN_BET} betKey={amount} blocked={amount > balance}>
        {playing ? 'TIRAGE...' : `PARIER · ${fmt(amount)} ₶`}
      </PlayRow>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell gameSlug="stade" title="Frenly Stade" rules={RULES} balance={balance} isLoaded={isLoaded} isLocal={isLocal} streak={stats.currentStreak} level={stats.level} xpIntoLevel={stats.xpIntoLevel} xpForNext={stats.xpForNext} stage={stage} panel={panel} />
  );
}
