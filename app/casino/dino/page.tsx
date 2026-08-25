'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { LADDER_CONFIGS, multiplierAtStep, stepOutcome, CASINO_MIN_BET } from '@/lib/casino/ladder';
import {
  GameShell, BetControls, PlayButton, ResultBanner, HistoryStrip, CountUp, type RulesSpec,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';

const CONFIG = LADDER_CONFIGS.dino;

const RULES: RulesSpec = {
  howTo: [
    'Mise, puis fais courir le dino. Chaque obstacle sauté augmente ton multiplicateur.',
    `Chaque saut a ${Math.round(CONFIG.survivalProb * 100)}% de réussir.`,
    'Encaisse quand tu veux pour repartir avec ta mise multipliée.',
    'Un obstacle raté et la course s’arrête : mise perdue.',
    `${CONFIG.totalSteps} obstacles au total — le dernier paie ×${multiplierAtStep(CONFIG, CONFIG.totalSteps)}.`,
  ],
  payouts: [1, 3, 6, 9, CONFIG.totalSteps].map((s) => ({ label: `Obstacle ${s}`, value: `×${multiplierAtStep(CONFIG, s)}` })),
  rtp: '~95%',
};

const OBSTACLES = ['🌵', '🪨', '🌵', '🔥', '🪨', '🌵', '🔥', '🪨', '🌵', '🔥', '🪨', '🌋'];
type Phase = 'idle' | 'running' | 'jumping' | 'dead' | 'cashed';

export default function DinoPage() {
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, maxBet, stats, startLocalBet, creditLocal, announceProgression, refresh, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [phase, setPhase] = useState<Phase>('idle');
  const [step, setStep] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [lockedAmount, setLockedAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const active = phase === 'running' || phase === 'jumping';
  const potentialPayout = Math.round(lockedAmount * multiplier);

  useEffect(() => {
    trackRef.current?.scrollTo({ left: Math.max(0, (step - 1) * 82), behavior: 'smooth' });
  }, [step]);

  const handleStart = async () => {
    if (busy) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }
    setBusy(true); vibrate(HAPTIC.MEDIUM); sfx.bet();

    if (user) {
      const res = await fetch('/api/casino/dino/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, amount, payload: {} }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setRoundId(data.roundId); setLockedAmount(amount);
      setStep(0); setMultiplier(1); setPhase('running');
      await refresh();
    } else {
      const r = startLocalBet('dino', amount);
      setBusy(false);
      if ('error' in r) { toast.error(r.error); return; }
      setRoundId('local'); setLockedAmount(amount);
      setStep(0); setMultiplier(1); setPhase('running');
    }
  };

  const handleJump = async () => {
    if (busy || phase !== 'running' || step >= CONFIG.totalSteps) return;
    setBusy(true); setPhase('jumping');
    vibrate(HAPTIC.SOFT); sfx.step(Math.min(8, step));
    await new Promise((r) => setTimeout(r, 300));

    if (user && roundId) {
      const res = await fetch('/api/casino/dino/step', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId, payload: {} }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { setPhase('running'); toast.error(data.error || 'Erreur'); return; }
      if (!data.safe) {
        setPhase('dead'); vibrate(HAPTIC.ERROR); sfx.bust();
        toast.error('Impact ! Le dino n’a pas esquivé.');
        announceProgression(data.progression);
        return;
      }
      setStep(data.step); setMultiplier(data.multiplier); setPhase('running'); sfx.reveal();
      if (data.atTop) toast.success('Parcours terminé ! Encaisse.');
    } else {
      const survived = stepOutcome(CONFIG);
      setBusy(false);
      if (!survived) {
        setPhase('dead'); vibrate(HAPTIC.ERROR); sfx.bust();
        toast.error('Impact ! Le dino n’a pas esquivé.');
        return;
      }
      const ns = step + 1;
      setStep(ns); setMultiplier(multiplierAtStep(CONFIG, ns)); setPhase('running'); sfx.reveal();
    }
  };

  const handleCashout = async () => {
    if (busy || phase !== 'running' || step === 0) return;
    setBusy(true); vibrate(HAPTIC.MEDIUM);

    if (user && roundId) {
      const res = await fetch('/api/casino/dino/cashout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setPhase('cashed'); sfx.cashout(); vibrate(HAPTIC.SUCCESS);
      if (multiplier >= 3) setConfetti((c) => c + 1);
      toast.success(`Encaissé +${data.payout} ₶ à ×${multiplier}`);
      await refresh(); announceProgression(data.progression);
    } else {
      const p = Math.round(lockedAmount * multiplier);
      creditLocal('dino', p, multiplier);
      setBusy(false); setPhase('cashed'); sfx.cashout(); vibrate(HAPTIC.SUCCESS);
      if (multiplier >= 3) setConfetti((c) => c + 1);
      toast.success(`Encaissé +${p} ₶ à ×${multiplier}`);
    }
  };

  const handleReset = () => { sfx.click(); setPhase('idle'); setStep(0); setMultiplier(1); setRoundId(null); };

  const gameHistory = history.filter((h) => h.game_slug === 'dino').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-4">
      {confetti > 0 && <Confetti trigger={confetti} intensity="big" />}
      <style jsx global>{`
        @keyframes dinoJump { 0% { transform: translateY(0); } 45% { transform: translateY(-38px) rotate(-12deg); } 100% { transform: translateY(0); } }
        @keyframes dinoRun { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes dinoHit { 0% { transform: rotate(0); } 100% { transform: rotate(88deg) translateY(10px); opacity: 0.6; } }
      `}</style>

      <div className="flex items-baseline gap-3">
        <span className={cn('font-display text-4xl font-black tabular-nums', phase === 'dead' ? 'text-accent-secondary' : 'text-accent-primary')}>
          ×{multiplier.toFixed(2)}
        </span>
        {active && step > 0 && (
          <span className="text-sm font-bold text-tx-secondary">= <CountUp value={potentialPayout} className="text-accent-success" /> ₶</span>
        )}
      </div>

      <div
        ref={trackRef}
        className="w-full overflow-x-auto custom-scrollbar rounded-2xl border-4 border-brand-border"
        style={{ background: 'linear-gradient(180deg, #2C3E50 0%, #4A6572 55%, #C8A165 55%, #A9834E 100%)' }}
      >
        <div className="relative flex items-end" style={{ minWidth: 'max-content', height: 180 }}>
          {/* Start */}
          <div className="w-16 shrink-0 h-full flex items-end justify-center pb-6">
            {step === 0 && phase !== 'dead' && (
              <span className="text-3xl" style={{ animation: phase === 'jumping' ? 'dinoJump 300ms ease-out' : 'dinoRun 400ms ease-in-out infinite' }}>🦖</span>
            )}
          </div>

          {Array.from({ length: CONFIG.totalSteps }, (_, i) => {
            const n = i + 1;
            const cleared = step >= n;
            const dinoHere = step === n && phase !== 'dead';
            const dinoDiedHere = phase === 'dead' && step === i;

            return (
              <div key={i} className="relative shrink-0 h-full flex items-end justify-center" style={{ width: 82 }}>
                <div className={cn(
                  'absolute top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[10px] font-display font-black border whitespace-nowrap',
                  cleared ? 'bg-accent-success text-brand-bg border-accent-success'
                    : (active && step === i) ? 'bg-accent-primary text-brand-bg border-accent-primary animate-pulse'
                    : 'bg-black/40 text-white/70 border-white/20'
                )}>
                  ×{multiplierAtStep(CONFIG, n)}
                </div>

                <span className={cn('text-2xl mb-6 transition-opacity', cleared && 'opacity-25')}>{OBSTACLES[i % OBSTACLES.length]}</span>

                {dinoDiedHere && <span className="absolute bottom-6 left-2 text-3xl" style={{ animation: 'dinoHit 400ms ease-out forwards' }}>🦖</span>}
                {dinoHere && (
                  <span className="absolute bottom-6 left-1 text-3xl z-10"
                    style={{ animation: phase === 'jumping' ? 'dinoJump 300ms ease-out' : 'dinoRun 400ms ease-in-out infinite' }}>
                    🦖
                  </span>
                )}
              </div>
            );
          })}

          <div className="w-16 shrink-0 h-full flex items-end justify-center pb-6"><span className="text-2xl">🏁</span></div>
        </div>
      </div>

      <ResultBanner state={phase === 'dead' ? 'lose' : phase === 'cashed' ? 'win' : 'idle'}>
        {phase === 'dead' ? 'Impact — mise perdue' : `Encaissé +${potentialPayout} ₶`}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      {!active ? (
        <>
          <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={busy} />
          <PlayButton onClick={phase === 'idle' ? handleStart : handleReset} loading={busy} disabled={!isLoaded || amount < CASINO_MIN_BET}>
            {phase === 'idle' ? `LANCER LA COURSE · ${amount} ₶` : 'REJOUER'}
          </PlayButton>
        </>
      ) : (
        <>
          <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Obstacles</div>
              <div className="font-display text-xl font-black">{step}/{CONFIG.totalSteps}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Mise</div>
              <div className="font-display text-xl font-black">{lockedAmount} ₶</div>
            </div>
          </div>
          <PlayButton onClick={handleJump} loading={busy} disabled={step >= CONFIG.totalSteps}>
            {step >= CONFIG.totalSteps ? 'ARRIVÉ' : `SAUTER · ×${multiplierAtStep(CONFIG, step + 1)}`}
          </PlayButton>
          <PlayButton onClick={handleCashout} disabled={busy || step === 0} variant="success" className="h-14 text-base">
            {step === 0 ? 'SAUTE D’ABORD UN OBSTACLE' : `ENCAISSER ${potentialPayout} ₶`}
          </PlayButton>
        </>
      )}
      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell
      title="Frenly Dino"
      rules={RULES}
      balance={balance}
      isLoaded={isLoaded}
      isLocal={isLocal}
      streak={stats.currentStreak}
      stage={stage}
      panel={panel}
    />
  );
}
