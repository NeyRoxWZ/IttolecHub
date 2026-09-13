'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { drawCard, resolveHilo, getHiloPayout, CASINO_MIN_BET, type HiloDirection } from '@/lib/casino/hilo';
import {
  GameShell, fmt, BetControls, PlayButton, PlayRow, PlayingCard, ResultBanner, HistoryStrip, rankLabel, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import { tempo } from '@/lib/casino/turbo';

const RULES: RulesSpec = {
  howTo: [
    'Une carte est retournée (As = 1, Valet = 11, Dame = 12, Roi = 13).',
    'Parie sur le fait que la carte suivante sera plus haute ou plus basse.',
    'La cote s’adapte à la carte affichée : parier "plus haut" sur un 2 paie peu, sur un Roi c’est impossible.',
    'Si la carte suivante a exactement la même valeur, ta mise est remboursée.',
  ],
  payouts: [
    { label: 'Plus haut sur un 2', value: '≈ ×1,13' },
    { label: 'Plus haut sur un 10', value: '≈ ×4,16' },
    { label: 'Même valeur', value: 'Mise remboursée' },
  ],
  rtp: '~96%',
};

type HiloResult = GenericBetResult & { currentCard: number; nextCard: number; direction: HiloDirection; push: boolean };

export default function HiloPage() {
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, maxBet, stats, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [card, setCard] = useState<number | null>(null);
  const [token, setToken] = useState('');
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<HiloResult | null>(null);
  const [confetti, setConfetti] = useState(0);

  const dealCard = useCallback(async () => {
    if (user) {
      const res = await fetch('/api/casino/hilo/deal');
      const data = await res.json();
      setCard(data.card); setToken(data.token);
    } else {
      setCard(drawCard()); setToken('');
    }
  }, [user]);

  useEffect(() => { dealCard(); }, [dealCard]);

  const higherPayout = card ? getHiloPayout(card, 'higher') : null;
  const lowerPayout = card ? getHiloPayout(card, 'lower') : null;

  /**
   * Auto takes whichever call is possible; when both are, it picks the side
   * with the shorter odds — the same reflex a player has.
   */
  const autoTick = () => {
    if (playing) return;
    const options: HiloDirection[] = [];
    if (higherPayout !== null) options.push('higher');
    if (lowerPayout !== null) options.push('lower');
    if (options.length === 0) return;
    const pick = options.length === 1
      ? options[0]
      : (higherPayout || 99) <= (lowerPayout || 99) ? 'higher' : 'lower';
    void handleGuess(pick);
  };

  const handleGuess = async (direction: HiloDirection) => {
    if (playing || card === null) return;
    const payout = direction === 'higher' ? higherPayout : lowerPayout;
    if (payout === null) { toast.error('Pari impossible sur cette carte.'); return; }
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setPlaying(true); setResult(null);
    vibrate(HAPTIC.MEDIUM); sfx.bet();
    const currentCard = card;

    const [r] = await Promise.all([
      placeBet('hilo', amount, { card: currentCard, token, direction }, () => {
        const nextCard = drawCard();
        const res = resolveHilo(currentCard, nextCard, direction);
        return { won: res.won, multiplier: res.multiplier, meta: { currentCard, nextCard, direction, push: res.push } };
      }),
      new Promise((res) => setTimeout(res, tempo(320))),
    ]);

    setPlaying(false);
    if ('error' in r) { toast.error(r.error); await dealCard(); return; }

    const full: HiloResult = { ...r, currentCard: r.meta.currentCard, nextCard: r.meta.nextCard, direction: r.meta.direction, push: r.meta.push };
    setResult(full);
    setCard(full.nextCard);
    sfx.card();

    if (full.push) { vibrate(HAPTIC.WARNING); sfx.reveal(); toast.info(`${rankLabel(full.nextCard)} — égalité, remboursé.`); }
    else if (full.won) {
      vibrate(HAPTIC.SUCCESS); sfx.win();
      if (full.multiplier >= 4) setConfetti((c) => c + 1);
      toast.success(`${rankLabel(full.nextCard)} — +${fmt(full.payout)} ₶`);
    } else { vibrate(HAPTIC.ERROR); sfx.lose(); toast.error(`${rankLabel(full.nextCard)} — perdu`); }

    await dealCard();
  };

  const gameHistory = history.filter((h) => h.game_slug === 'hilo').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-5">
      {confetti > 0 && <Confetti trigger={confetti} intensity="big" />}

      <div className="flex items-center gap-8">
        {result && (
          <div className="flex flex-col items-center gap-2 opacity-70">
            <PlayingCard rank={result.currentCard} index={1} size="md" />
            <span className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-[#0E1030] font-display text-sm text-white">Précédente</span>
          </div>
        )}
        <div className="flex flex-col items-center gap-2">
          {card !== null ? <PlayingCard rank={card} index={0} size="lg" highlight={!!result?.won} /> : <PlayingCard hidden size="lg" />}
          <span className="px-3 py-0.5 rounded-lg border-2 border-brand-border bg-accent-primary font-display text-base text-brand-bg">Carte en jeu</span>
        </div>
      </div>

      <div className="flex gap-1.5">
        {['A = 1', 'V = 11', 'D = 12', 'R = 13'].map((l) => (
          <span key={l} className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-[#2B3170] font-display text-sm text-white">{l}</span>
        ))}
      </div>

      <ResultBanner state={!result ? 'idle' : result.push ? 'push' : result.won ? 'win' : 'lose'}>
        {result?.push ? 'Égalité — remboursé' : result?.won ? `+${fmt(result.payout)} ₶` : 'Perdu'}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={playing} />

      <PlayRow
        balance={balance}
        onClick={autoTick}
        onAuto={autoTick}
        loading={playing}
        disabled={!isLoaded || amount < CASINO_MIN_BET}
        blocked={amount > balance}
        betKey={amount}
      >
        {`JOUER AU HASARD · ${fmt(amount)} ₶`}
      </PlayRow>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleGuess('higher')}
          disabled={playing || !isLoaded || amount < CASINO_MIN_BET || higherPayout === null}
          className={cn(
            'h-24 rounded-2xl border-4 border-brand-border flex flex-col items-center justify-center gap-0.5 transition-transform active:translate-y-[4px] focus:outline-none bg-accent-success text-brand-bg shadow-[inset_0_-6px_0_#1E9A55,0_5px_0_#05061A]',
            (playing || higherPayout === null) && 'opacity-40 cursor-not-allowed active:translate-y-0'
          )}
        >
          <ChevronUp className="w-7 h-7" strokeWidth={3} />
          <span className="font-display text-xl leading-none">Plus haut</span>
          <span className="font-display text-sm leading-none opacity-80">{higherPayout ? `×${higherPayout}` : 'impossible'}</span>
        </button>
        <button
          onClick={() => handleGuess('lower')}
          disabled={playing || !isLoaded || amount < CASINO_MIN_BET || lowerPayout === null}
          className={cn(
            'h-24 rounded-2xl border-4 border-brand-border flex flex-col items-center justify-center gap-0.5 transition-transform active:translate-y-[4px] focus:outline-none bg-accent-secondary text-white shadow-[inset_0_-6px_0_#C92D63,0_5px_0_#05061A]',
            (playing || lowerPayout === null) && 'opacity-40 cursor-not-allowed active:translate-y-0'
          )}
        >
          <ChevronDown className="w-7 h-7" strokeWidth={3} />
          <span className="font-display text-xl leading-none">Plus bas</span>
          <span className="font-display text-sm leading-none opacity-80">{lowerPayout ? `×${lowerPayout}` : 'impossible'}</span>
        </button>
      </div>

      <p className="text-[11px] text-tx-muted">La cote change à chaque carte : plus le pari est probable, moins il paie.</p>

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell gameSlug="hilo" title="Frenly HiLo" rules={RULES} balance={balance} isLoaded={isLoaded} isLocal={isLocal} streak={stats.currentStreak} level={stats.level} xpIntoLevel={stats.xpIntoLevel} xpForNext={stats.xpForNext} stage={stage} panel={panel} />
  );
}
