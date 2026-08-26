'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { LADDER_CONFIGS, multiplierAtStep, stepOutcome, CASINO_MIN_BET } from '@/lib/casino/ladder';
import {
  GameShell, fmt, BetControls, PlayButton, PlayRow, ResultBanner, HistoryStrip, CountUp, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import { ArtChicken, ArtCar, ArtImpact, ArtFinishFlag } from '../_components/CasinoArt';
import { tempo } from '@/lib/casino/turbo';

const CONFIG = LADDER_CONFIGS.poulet;

const RULES: RulesSpec = {
  howTo: [
    'Mise, puis fais traverser le poulet voie par voie.',
    'Chaque voie franchie augmente ton multiplicateur — mais une voiture peut surgir.',
    `Chaque voie a ${Math.round(CONFIG.survivalProb * 100)}% de chances d’être franchie sans encombre.`,
    'Encaisse quand tu veux : tu repars avec ta mise multipliée. Si une voiture te touche, tu perds tout.',
    `${CONFIG.totalSteps} voies au total — la dernière paie ×${multiplierAtStep(CONFIG, CONFIG.totalSteps)}.`,
  ],
  payouts: Array.from({ length: 5 }, (_, i) => {
    const step = i + 1;
    return { label: `Voie ${step}`, value: `×${multiplierAtStep(CONFIG, step)}` };
  }).concat([{ label: `Voie ${CONFIG.totalSteps} (finale)`, value: `×${multiplierAtStep(CONFIG, CONFIG.totalSteps)}` }]),
  rtp: '~96%',
};

type Phase = 'idle' | 'crossing' | 'hopping' | 'dead' | 'cashed';

/** Decorative traffic — never decides anything, the server does. */
function Car({ lane, delay, danger }: { lane: number; delay: number; danger: boolean }) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 select-none pointer-events-none"
      style={{
        animation: `pouletTraffic ${2.4 + (lane % 3) * 0.5}s linear ${delay}s infinite`,
        filter: danger ? 'drop-shadow(0 0 6px #FF2A55)' : undefined,
      }}
    >
      <ArtCar size={26} />
    </div>
  );
}

export default function PouletPage() {
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, maxBet, stats, startLocalBet, creditLocal, applyServerBalance, applyServerCashout, announceProgression, refresh, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [phase, setPhase] = useState<Phase>('idle');
  const [step, setStep] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [lockedAmount, setLockedAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deathLane, setDeathLane] = useState<number | null>(null);
  const [confetti, setConfetti] = useState(0);

  const active = phase === 'crossing' || phase === 'hopping';
  const potentialPayout = Math.round(lockedAmount * multiplier);
  const nextMultiplier = multiplierAtStep(CONFIG, step + 1);


  const handleStart = async () => {
    if (busy) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setBusy(true); vibrate(HAPTIC.MEDIUM); sfx.bet();
    setDeathLane(null);

    if (user) {
      const res = await fetch('/api/casino/poulet/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, amount, payload: {} }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setRoundId(data.roundId);
      applyServerBalance('poulet', data.newBalance, amount);
      setLockedAmount(amount); setStep(0); setMultiplier(1); setPhase('crossing');
    } else {
      const result = startLocalBet('poulet', amount);
      setBusy(false);
      if ('error' in result) { toast.error(result.error); return; }
      setRoundId('local');
      setLockedAmount(amount); setStep(0); setMultiplier(1); setPhase('crossing');
    }
  };

  const handleHop = async () => {
    if (busy || phase !== 'crossing' || step >= CONFIG.totalSteps) return;
    setBusy(true); setPhase('hopping');
    vibrate(HAPTIC.SOFT); sfx.step(step);

    // Brief hop animation before the outcome lands.
    await new Promise((r) => setTimeout(r, tempo(140)));

    const targetLane = step;

    if (user && roundId) {
      const res = await fetch('/api/casino/poulet/step', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId, payload: {} }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { setPhase('crossing'); toast.error(data.error || 'Erreur'); return; }
      if (!data.safe) {
        setDeathLane(targetLane); setPhase('dead');
        vibrate(HAPTIC.ERROR); sfx.bust();
        toast.error('Écrasé ! Le poulet n’a pas survécu.');
        announceProgression(data.progression);
        return;
      }
      setStep(data.step); setMultiplier(data.multiplier); setPhase('crossing');
      sfx.reveal();
      if (data.atTop) toast.success('Traversée complète ! Encaisse maintenant.');
    } else {
      const survived = stepOutcome(CONFIG);
      setBusy(false);
      if (!survived) {
        setDeathLane(targetLane); setPhase('dead');
        vibrate(HAPTIC.ERROR); sfx.bust();
        toast.error('Écrasé ! Le poulet n’a pas survécu.');
        return;
      }
      const newStep = step + 1;
      setStep(newStep); setMultiplier(multiplierAtStep(CONFIG, newStep)); setPhase('crossing');
      sfx.reveal();
    }
  };

  const handleCashout = async () => {
    if (busy || phase !== 'crossing' || step === 0) return;
    setBusy(true); vibrate(HAPTIC.MEDIUM);

    if (user && roundId) {
      const res = await fetch('/api/casino/poulet/cashout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      applyServerCashout('poulet', data.newBalance, data.payout, multiplier);
      setPhase('cashed'); sfx.cashout(); vibrate(HAPTIC.SUCCESS);
      if (multiplier >= 3) setConfetti((c) => c + 1);
      toast.success(`Encaissé +${fmt(data.payout)} ₶ à ×${multiplier}`);
      announceProgression(data.progression);
    } else {
      const p = Math.round(lockedAmount * multiplier);
      creditLocal('poulet', p, multiplier);
      setBusy(false); setPhase('cashed'); sfx.cashout(); vibrate(HAPTIC.SUCCESS);
      if (multiplier >= 3) setConfetti((c) => c + 1);
      toast.success(`Encaissé +${fmt(p)} ₶ à ×${multiplier}`);
    }
  };

  /** Auto crosses a few lanes, then cashes out at a target drawn per round. */
  const autoTargetRef = useRef(0);

  const autoTick = () => {
    if (busy) return;
    if (phase === 'idle') {
      autoTargetRef.current = 2 + Math.floor(Math.random() * 4);
      void handleStart();
      return;
    }
    if (active) {
      if (step >= autoTargetRef.current) void handleCashout();
      else void handleHop();
      return;
    }
    handleReset();
  };

  const handleReset = () => {
    sfx.click();
    setPhase('idle'); setStep(0); setMultiplier(1); setRoundId(null); setDeathLane(null);
  };

  const gameHistory = history.filter((h) => h.game_slug === 'poulet').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-4">
      {confetti > 0 && <Confetti trigger={confetti} intensity="big" />}
      <style jsx global>{`
        @keyframes pouletTraffic {
          0% { top: -18%; opacity: 0; }
          12% { opacity: 1; }
          88% { opacity: 1; }
          100% { top: 110%; opacity: 0; }
        }
        @keyframes pouletHop {
          0% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-16px) scale(1.15); }
          100% { transform: translateY(0) scale(1); }
        }
        @keyframes pouletSquash {
          0% { transform: scale(1) rotate(0deg); }
          100% { transform: scaleX(1.5) scaleY(0.35) rotate(12deg); opacity: 0.75; }
        }
      `}</style>

      {/* Multiplier readout */}
      <div className="flex items-baseline gap-3">
        <span className={cn('font-display text-4xl font-black tabular-nums', phase === 'dead' ? 'text-accent-secondary' : 'text-accent-primary')}>
          ×{multiplier.toFixed(2)}
        </span>
        {active && step > 0 && (
          <span className="text-sm font-bold text-tx-secondary">
            = <CountUp value={potentialPayout} className="text-accent-success" /> ₶
          </span>
        )}
      </div>

      {/* The road — every lane fits on screen, nothing scrolls */}
      <div className="w-full rounded-2xl border-4 border-brand-border overflow-hidden">
        <div className="flex" style={{ height: 300 }}>
          {/* Start kerb */}
          <div className="w-12 shrink-0 flex flex-col items-center justify-end pb-4" style={{ background: '#4A5057' }}>
            {step === 0 && phase !== 'dead' && (
              <span style={{ animation: phase === 'hopping' ? 'pouletHop 260ms ease-out' : undefined }}>
                <ArtChicken size={40} />
              </span>
            )}
          </div>

          {/* Lanes */}
          {Array.from({ length: CONFIG.totalSteps }, (_, i) => {
            const laneNumber = i + 1;
            const crossed = step >= laneNumber;
            const isCurrent = step === i && active;
            const isDeath = deathLane === i;
            const chickenHere = (step === laneNumber && phase !== 'dead') || (isDeath && phase === 'dead');

            return (
              <div
                key={i}
                className="relative flex-1 min-w-0 flex flex-col items-center justify-end overflow-hidden border-r border-dashed border-white/20"
                style={{ background: crossed ? '#2E3A32' : '#33383D' }}
              >
                <div className={cn(
                  'absolute top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[11px] font-display font-black border z-20 whitespace-nowrap',
                  crossed ? 'bg-accent-success text-brand-bg border-accent-success'
                    : isCurrent ? 'bg-accent-primary text-brand-bg border-accent-primary animate-pulse'
                    : 'bg-black/50 text-white/70 border-white/20'
                )}>
                  ×{multiplierAtStep(CONFIG, laneNumber)}
                </div>

                {active && !crossed && <Car lane={i} delay={i * 0.42} danger={isCurrent} />}
                {isDeath && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                    <ArtImpact size={56} />
                  </div>
                )}

                {chickenHere && (
                  <span
                    className="mb-4 z-10"
                    style={{ animation: phase === 'dead' ? 'pouletSquash 400ms ease-out forwards' : phase === 'hopping' ? 'pouletHop 260ms ease-out' : undefined }}
                  >
                    <ArtChicken size={40} dead={phase === 'dead'} />
                  </span>
                )}

                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-full opacity-20"
                  style={{ background: 'repeating-linear-gradient(180deg, #fff 0 12px, transparent 12px 26px)' }} />
              </div>
            );
          })}

          {/* Finish */}
          <div className="w-12 shrink-0 flex items-center justify-center" style={{ background: 'repeating-conic-gradient(#fff 0% 25%, #222 0% 50%) 50%/12px 12px' }}>
            <ArtFinishFlag size={30} />
          </div>
        </div>
      </div>

      <ResultBanner state={phase === 'dead' ? 'lose' : phase === 'cashed' ? 'win' : 'idle'}>
        {phase === 'dead' ? 'Écrasé — mise perdue' : `Encaissé +${fmt(potentialPayout)} ₶`}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      {!active ? (
        <>
          <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={busy} />
          <PlayRow
            balance={balance}
            onClick={phase === 'idle' ? handleStart : handleReset}
            onAuto={autoTick}
            loading={busy}
            disabled={!isLoaded || amount < CASINO_MIN_BET}
            blocked={amount > balance}
            betKey={amount}
          >
            {phase === 'idle' ? `LÂCHER LE POULET · ${fmt(amount)} ₶` : 'REJOUER'}
          </PlayRow>
        </>
      ) : (
        <>
          <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Voie</div>
              <div className="font-display text-xl font-black">{step}/{CONFIG.totalSteps}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Mise</div>
              <div className="font-display text-xl font-black">{fmt(lockedAmount)} ₶</div>
            </div>
          </div>

          <PlayButton onClick={handleHop} loading={busy} disabled={step >= CONFIG.totalSteps}>
            {step >= CONFIG.totalSteps ? 'ARRIVÉ AU BOUT' : `TRAVERSER · ×${nextMultiplier}`}
          </PlayButton>

          <PlayButton onClick={handleCashout} disabled={busy || step === 0} variant="success" className="h-14 text-base">
            {step === 0 ? 'FRANCHIS UNE VOIE D’ABORD' : `ENCAISSER ${fmt(potentialPayout)} ₶`}
          </PlayButton>
        </>
      )}

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell
      gameSlug="poulet"
      title="Frenly Poulet"
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
