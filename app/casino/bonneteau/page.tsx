'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { hideBall, resolveBonneteau, BONNETEAU_CUPS, BONNETEAU_PAYOUT, CASINO_MIN_BET } from '@/lib/casino/bonneteau';
import {
  GameShell, BetControls, PlayButton, ResultBanner, HistoryStrip, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';

const RULES: RulesSpec = {
  howTo: [
    'Place ta mise et lance la partie : les gobelets se mélangent.',
    'Une fois le mélange terminé, choisis le gobelet sous lequel tu penses que la bille se trouve.',
    `Tu as 1 chance sur ${BONNETEAU_CUPS} de tomber juste.`,
    'Le mélange est purement visuel : la position de la bille est tirée au sort à la mise, pas influencée par ton choix.',
  ],
  payouts: [
    { label: 'Bon gobelet', value: `×${BONNETEAU_PAYOUT}` },
    { label: 'Mauvais gobelet', value: 'Mise perdue' },
  ],
  rtp: '~93%',
};

const SLOT_W = 96;
type Phase = 'idle' | 'shuffling' | 'choosing' | 'revealed';

export default function BonneteauPage() {
  const { balance, isLoaded, isLocal, maxBet, stats, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [phase, setPhase] = useState<Phase>('idle');
  const [positions, setPositions] = useState<number[]>([0, 1, 2]); // cup id -> slot
  const [result, setResult] = useState<(GenericBetResult & { ballCup: number; chosenCup: number }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [pending, setPending] = useState<GenericBetResult | null>(null);

  const shuffle = async () => {
    const pos = [...positions];
    for (let i = 0; i < 7; i++) {
      const a = Math.floor(Math.random() * BONNETEAU_CUPS);
      let b = Math.floor(Math.random() * BONNETEAU_CUPS);
      while (b === a) b = Math.floor(Math.random() * BONNETEAU_CUPS);
      [pos[a], pos[b]] = [pos[b], pos[a]];
      setPositions([...pos]);
      sfx.tick();
      await new Promise((r) => setTimeout(r, 280));
    }
  };

  const handleStart = async () => {
    if (busy) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setBusy(true); setResult(null); setPhase('shuffling');
    vibrate(HAPTIC.MEDIUM); sfx.bet();

    // Resolve first (server decides), then shuffle purely for show.
    const r = await placeBet('bonneteau', amount, { cup: 0 }, () => {
      const ballCup = hideBall();
      return { ...resolveBonneteau(ballCup, 0), meta: { ballCup, chosenCup: 0 } };
    });

    if ('error' in r) { setBusy(false); setPhase('idle'); toast.error(r.error); return; }

    await shuffle();
    setPending(r);
    setBusy(false);
    setPhase('choosing');
  };

  /**
   * The server already rolled the ball's cup for a nominal pick of 0. We keep
   * that exact outcome and just relabel which cup the player pointed at, so
   * the odds stay 1-in-3 and the payout already settled stays correct.
   */
  const handlePick = (slot: number) => {
    if (phase !== 'choosing' || !pending) return;
    sfx.reveal(); vibrate(HAPTIC.MEDIUM);

    const won = pending.won;
    const ballCup = won ? slot : (slot + 1 + Math.floor(Math.random() * (BONNETEAU_CUPS - 1))) % BONNETEAU_CUPS;

    setResult({ ...pending, ballCup, chosenCup: slot });
    setPhase('revealed');
    setPending(null);

    if (won) {
      vibrate(HAPTIC.SUCCESS); sfx.win(); setConfetti((c) => c + 1);
      toast.success(`Bonne pioche — +${pending.payout} ₶`);
    } else {
      vibrate(HAPTIC.ERROR); sfx.lose();
      toast.error(`La bille était sous le gobelet ${ballCup + 1}.`);
    }
  };

  const handleReset = () => { sfx.click(); setPhase('idle'); setResult(null); setPending(null); setPositions([0, 1, 2]); };

  const gameHistory = history.filter((h) => h.game_slug === 'bonneteau').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-5">
      {confetti > 0 && <Confetti trigger={confetti} intensity="big" />}

      <div
        className="relative rounded-2xl border-4 border-brand-border px-4 pt-10 pb-6"
        style={{ width: SLOT_W * BONNETEAU_CUPS + 32, background: 'linear-gradient(180deg, #3B2416 0%, #24160E 100%)' }}
      >
        {Array.from({ length: BONNETEAU_CUPS }, (_, cupId) => {
          const slot = positions[cupId];
          const revealed = phase === 'revealed' && result;
          const hasBall = revealed && result.ballCup === slot;
          const isChosen = revealed && result.chosenCup === slot;

          return (
            <button
              key={cupId}
              onClick={() => handlePick(slot)}
              disabled={phase !== 'choosing'}
              className="absolute focus:outline-none"
              style={{
                left: 16 + slot * SLOT_W,
                bottom: 24,
                width: SLOT_W - 12,
                transition: 'left 260ms cubic-bezier(0.45, 0, 0.55, 1)',
              }}
            >
              <div className={cn(
                'flex flex-col items-center transition-transform',
                phase === 'choosing' && 'hover:-translate-y-2 cursor-pointer',
                revealed && hasBall && '-translate-y-6'
              )}>
                <div
                  className={cn(
                    'w-full rounded-t-[42px] border-4 flex items-end justify-center pb-2 font-display font-black transition-colors',
                    isChosen && !hasBall ? 'border-accent-secondary' : hasBall ? 'border-accent-success' : 'border-brand-border'
                  )}
                  style={{ height: 86, background: 'linear-gradient(180deg, #E05A2B 0%, #A83C18 100%)', color: '#fff' }}
                >
                  {slot + 1}
                </div>
                <div className="h-3 w-full flex items-center justify-center">
                  {revealed && hasBall && <span className="text-lg">⚪</span>}
                </div>
              </div>
            </button>
          );
        })}

        <div className="absolute top-3 left-0 right-0 text-center text-[11px] font-black uppercase tracking-widest text-white/60">
          {phase === 'idle' ? 'Mise pour commencer'
            : phase === 'shuffling' ? 'Mélange...'
            : phase === 'choosing' ? 'Choisis un gobelet'
            : result?.won ? 'Gagné !' : 'Raté'}
        </div>
      </div>

      <ResultBanner state={!result ? 'idle' : result.won ? 'win' : 'lose'}>
        {result?.won ? `+${result.payout} ₶` : 'Perdu'}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={phase === 'shuffling' || phase === 'choosing' || busy} />

      {phase === 'choosing' ? (
        <div className="rounded-xl border-2 border-accent-primary bg-accent-primary/10 p-4 text-center">
          <div className="font-display font-black text-sm text-accent-primary">À toi de jouer</div>
          <p className="text-xs text-tx-secondary mt-1">Clique le gobelet qui cache la bille.</p>
        </div>
      ) : (
        <PlayButton onClick={phase === 'revealed' ? handleReset : handleStart} loading={busy || phase === 'shuffling'} disabled={!isLoaded || amount < CASINO_MIN_BET}>
          {phase === 'revealed' ? 'REJOUER' : `MISER · ${amount} ₶ (×${BONNETEAU_PAYOUT})`}
        </PlayButton>
      )}

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell title="Frenly Bonneteau" rules={RULES} balance={balance} isLoaded={isLoaded} isLocal={isLocal} streak={stats.currentStreak} stage={stage} panel={panel} />
  );
}
