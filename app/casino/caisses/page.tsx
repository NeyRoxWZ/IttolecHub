'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { hideJackpot, resolveCaisses, CAISSES_COUNT, CAISSES_PAYOUT, CASINO_MIN_BET } from '@/lib/casino/caisses';
import {
  GameShell, BetControls, PlayButton, ResultBanner, HistoryStrip, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';

const RULES: RulesSpec = {
  howTo: [
    `Place ta mise, puis choisis une des ${CAISSES_COUNT} caisses.`,
    'Une seule contient le jackpot, les autres sont vides.',
    `Tu as 1 chance sur ${CAISSES_COUNT} de tomber dessus.`,
    'Toutes les caisses sont ouvertes après ton choix pour que tu voies où était le lot.',
  ],
  payouts: [
    { label: 'Caisse au jackpot', value: `×${CAISSES_PAYOUT}` },
    { label: 'Caisse vide', value: 'Mise perdue' },
  ],
  rtp: '~93%',
};

type Phase = 'idle' | 'choosing' | 'opening' | 'revealed';

export default function CaissesPage() {
  const { balance, isLoaded, isLocal, maxBet, stats, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<(GenericBetResult & { jackpotCrate: number; chosenCrate: number }) | null>(null);
  const [openedCrate, setOpenedCrate] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confetti, setConfetti] = useState(0);

  const handlePick = async (crate: number) => {
    if (busy || phase !== 'choosing') return;
    setBusy(true); setOpenedCrate(crate); setPhase('opening');
    vibrate(HAPTIC.MEDIUM); sfx.click();

    const [r] = await Promise.all([
      placeBet('caisses', amount, { crate }, () => {
        const jackpotCrate = hideJackpot();
        return { ...resolveCaisses(jackpotCrate, crate), meta: { jackpotCrate, chosenCrate: crate } };
      }),
      new Promise((res) => setTimeout(res, 700)),
    ]);

    setBusy(false);
    if ('error' in r) { setPhase('choosing'); setOpenedCrate(null); toast.error(r.error); return; }

    setResult({ ...r, jackpotCrate: r.meta.jackpotCrate, chosenCrate: r.meta.chosenCrate });
    setPhase('revealed');

    if (r.won) {
      vibrate(HAPTIC.SUCCESS); sfx.bigWin(); setConfetti((c) => c + 1);
      toast.success(`Jackpot ! +${r.payout} ₶`);
    } else {
      vibrate(HAPTIC.ERROR); sfx.lose();
      toast.error(`Vide. Le lot était dans la caisse ${r.meta.jackpotCrate + 1}.`);
    }
  };

  const handleReset = () => { sfx.click(); setPhase('idle'); setResult(null); setOpenedCrate(null); };

  const gameHistory = history.filter((h) => h.game_slug === 'caisses').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-5">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}
      <style jsx global>{`
        @keyframes crateShake { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-5deg); } 75% { transform: rotate(5deg); } }
        @keyframes cratePop { 0% { transform: scale(0.5) translateY(10px); opacity: 0; } 100% { transform: scale(1) translateY(-6px); opacity: 1; } }
      `}</style>

      <div className="flex flex-wrap gap-3 justify-center">
        {Array.from({ length: CAISSES_COUNT }, (_, i) => {
          const revealed = phase === 'revealed' && result;
          const hasJackpot = revealed && result.jackpotCrate === i;
          const isChosen = openedCrate === i;
          const isOpening = phase === 'opening' && isChosen;

          return (
            <button
              key={i}
              onClick={() => handlePick(i)}
              disabled={phase !== 'choosing'}
              className={cn(
                'relative w-[74px] h-[74px] rounded-xl border-4 flex items-center justify-center text-3xl transition-all focus:outline-none',
                hasJackpot ? 'border-accent-success bg-accent-success/25'
                  : isChosen && revealed ? 'border-accent-secondary bg-accent-secondary/20'
                  : revealed ? 'border-brand-border opacity-45'
                  : phase === 'choosing' ? 'border-brand-border hover:border-accent-primary hover:-translate-y-1 cursor-pointer'
                  : 'border-brand-border'
              )}
              style={{
                background: hasJackpot ? undefined : 'linear-gradient(160deg, #6B4A2A 0%, #4A3018 100%)',
                animation: isOpening ? 'crateShake 180ms ease-in-out 3' : undefined,
              }}
            >
              {revealed
                ? (hasJackpot
                  ? <span style={{ animation: 'cratePop 320ms ease-out forwards' }}>💰</span>
                  : <span className="opacity-40 text-2xl">📭</span>)
                : <span>📦</span>}
              {!revealed && phase === 'choosing' && (
                <span className="absolute bottom-1 right-1.5 text-[10px] font-black text-white/60">{i + 1}</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs font-bold text-tx-secondary">
        {phase === 'idle' ? 'Règle ta mise puis lance' : phase === 'choosing' ? 'Choisis une caisse' : phase === 'opening' ? 'Ouverture...' : result?.won ? 'Jackpot !' : 'Caisse vide'}
      </p>

      <ResultBanner state={!result ? 'idle' : result.won ? 'win' : 'lose'}>
        {result?.won ? `+${result.payout} ₶` : 'Perdu'}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={phase === 'choosing' || phase === 'opening' || busy} />

      {phase === 'choosing' ? (
        <div className="rounded-xl border-2 border-accent-primary bg-accent-primary/10 p-4 text-center">
          <div className="font-display font-black text-sm text-accent-primary">Choisis ta caisse</div>
          <p className="text-xs text-tx-secondary mt-1">Une seule des {CAISSES_COUNT} contient le lot.</p>
        </div>
      ) : (
        <PlayButton
          onClick={() => { if (phase === 'revealed') handleReset(); else { sfx.bet(); setPhase('choosing'); } }}
          loading={busy}
          disabled={!isLoaded || amount < CASINO_MIN_BET}
        >
          {phase === 'revealed' ? 'REJOUER' : `MISER · ${amount} ₶ (×${CAISSES_PAYOUT})`}
        </PlayButton>
      )}

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell title="Frenly Caisses" rules={RULES} balance={balance} isLoaded={isLoaded} isLocal={isLocal} streak={stats.currentStreak} stage={stage} panel={panel} />
  );
}
