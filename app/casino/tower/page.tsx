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

const CONFIG = LADDER_CONFIGS.tower;
// survivalProb is 0.75, i.e. exactly 3 safe doors out of 4 — so the visual
// (pick 1 of 4, one is trapped) matches the real odds instead of faking it.
const DOORS = Math.round(1 / (1 - CONFIG.survivalProb));

const RULES: RulesSpec = {
  howTo: [
    `Mise, puis grimpe la tour étage par étage. Chaque étage a ${DOORS} portes dont une seule est piégée.`,
    'Choisis une porte : si elle est sûre, tu montes et ton multiplicateur augmente.',
    'Encaisse quand tu veux pour repartir avec ta mise multipliée.',
    'Si tu ouvres la porte piégée, tu perds ta mise.',
    `${CONFIG.totalSteps} étages au total — le sommet paie ×${multiplierAtStep(CONFIG, CONFIG.totalSteps)}.`,
  ],
  payouts: [1, 2, 3, 5, CONFIG.totalSteps].map((s) => ({ label: `Étage ${s}`, value: `×${multiplierAtStep(CONFIG, s)}` })),
  rtp: '~96%',
};

type Phase = 'idle' | 'climbing' | 'dead' | 'cashed';

export default function TowerPage() {
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
  /** floor index -> { picked, trap } once resolved */
  const [revealed, setRevealed] = useState<Record<number, { picked: number; trap: number }>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = phase === 'climbing';
  const potentialPayout = Math.round(lockedAmount * multiplier);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [step, phase]);

  const handleStart = async () => {
    if (busy) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }
    setBusy(true); vibrate(HAPTIC.MEDIUM); sfx.bet();
    setRevealed({});

    if (user) {
      const res = await fetch('/api/casino/tower/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, amount, payload: {} }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setRoundId(data.roundId); setLockedAmount(amount);
      setStep(0); setMultiplier(1); setPhase('climbing');
      await refresh();
    } else {
      const r = startLocalBet('tower', amount);
      setBusy(false);
      if ('error' in r) { toast.error(r.error); return; }
      setRoundId('local'); setLockedAmount(amount);
      setStep(0); setMultiplier(1); setPhase('climbing');
    }
  };

  const handlePickDoor = async (door: number) => {
    if (busy || !active) return;
    setBusy(true); vibrate(HAPTIC.SOFT); sfx.click();
    const floor = step;

    const settle = (safe: boolean) => {
      // Show a trap position consistent with the outcome: the door you picked
      // if you died, otherwise any other door.
      const others = Array.from({ length: DOORS }, (_, i) => i).filter((d) => d !== door);
      const trap = safe ? others[Math.floor(Math.random() * others.length)] : door;
      setRevealed((prev) => ({ ...prev, [floor]: { picked: door, trap } }));
    };

    if (user && roundId) {
      const res = await fetch('/api/casino/tower/step', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId, payload: {} }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      settle(data.safe);
      if (!data.safe) {
        setPhase('dead'); vibrate(HAPTIC.ERROR); sfx.bust();
        toast.error('Porte piégée ! Tu chutes.');
        announceProgression(data.progression);
        return;
      }
      setStep(data.step); setMultiplier(data.multiplier); sfx.step(Math.min(8, data.step));
      if (data.atTop) toast.success('Sommet atteint ! Encaisse.');
    } else {
      const survived = stepOutcome(CONFIG);
      setBusy(false);
      settle(survived);
      if (!survived) {
        setPhase('dead'); vibrate(HAPTIC.ERROR); sfx.bust();
        toast.error('Porte piégée ! Tu chutes.');
        return;
      }
      const ns = step + 1;
      setStep(ns); setMultiplier(multiplierAtStep(CONFIG, ns)); sfx.step(Math.min(8, ns));
    }
  };

  const handleCashout = async () => {
    if (busy || !active || step === 0) return;
    setBusy(true); vibrate(HAPTIC.MEDIUM);

    if (user && roundId) {
      const res = await fetch('/api/casino/tower/cashout', {
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
      creditLocal('tower', p, multiplier);
      setBusy(false); setPhase('cashed'); sfx.cashout(); vibrate(HAPTIC.SUCCESS);
      if (multiplier >= 3) setConfetti((c) => c + 1);
      toast.success(`Encaissé +${p} ₶ à ×${multiplier}`);
    }
  };

  const handleReset = () => {
    sfx.click();
    setPhase('idle'); setStep(0); setMultiplier(1); setRoundId(null); setRevealed({});
  };

  const gameHistory = history.filter((h) => h.game_slug === 'tower').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-3">
      {confetti > 0 && <Confetti trigger={confetti} intensity="big" />}

      <div className="flex items-baseline gap-3">
        <span className={cn('font-display text-4xl font-black tabular-nums', phase === 'dead' ? 'text-accent-secondary' : 'text-accent-primary')}>
          ×{multiplier.toFixed(2)}
        </span>
        {active && step > 0 && (
          <span className="text-sm font-bold text-tx-secondary">= <CountUp value={potentialPayout} className="text-accent-success" /> ₶</span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="w-full max-w-[380px] max-h-[300px] overflow-y-auto custom-scrollbar rounded-2xl border-4 border-brand-border p-2 flex flex-col-reverse gap-1.5"
        style={{ background: 'linear-gradient(180deg, #241C33 0%, #16111F 100%)' }}
      >
        {Array.from({ length: CONFIG.totalSteps }, (_, floor) => {
          const floorNumber = floor + 1;
          const rev = revealed[floor];
          const isCurrent = active && step === floor;
          const cleared = step > floor;

          return (
            <div key={floor} className={cn('flex items-center gap-2 rounded-lg p-1.5 transition-colors', isCurrent && 'bg-accent-primary/10 ring-2 ring-accent-primary')}>
              <span className={cn('w-11 shrink-0 text-[10px] font-black text-right', cleared ? 'text-accent-success' : isCurrent ? 'text-accent-primary' : 'text-tx-muted')}>
                ×{multiplierAtStep(CONFIG, floorNumber)}
              </span>
              <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${DOORS}, minmax(0,1fr))` }}>
                {Array.from({ length: DOORS }, (_, d) => {
                  const isTrap = rev && rev.trap === d;
                  const isPicked = rev && rev.picked === d;
                  return (
                    <button
                      key={d}
                      onClick={() => handlePickDoor(d)}
                      disabled={!isCurrent || busy}
                      className={cn(
                        'h-9 rounded-md border-2 flex items-center justify-center text-sm transition-all focus:outline-none',
                        isTrap ? 'border-accent-secondary bg-accent-secondary/30'
                          : isPicked ? 'border-accent-success bg-accent-success/25'
                          : rev ? 'border-white/10 bg-white/[0.04] opacity-45'
                          : isCurrent ? 'border-white/25 bg-white/[0.08] hover:border-accent-primary hover:bg-white/15 cursor-pointer'
                          : 'border-white/8 bg-white/[0.03]'
                      )}
                    >
                      {isTrap ? '💀' : isPicked ? '✅' : isCurrent ? '🚪' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <ResultBanner state={phase === 'dead' ? 'lose' : phase === 'cashed' ? 'win' : 'idle'}>
        {phase === 'dead' ? 'Porte piégée — mise perdue' : `Encaissé +${potentialPayout} ₶`}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      {!active ? (
        <>
          <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={busy} />
          <PlayButton onClick={phase === 'idle' ? handleStart : handleReset} loading={busy} disabled={!isLoaded || amount < CASINO_MIN_BET}>
            {phase === 'idle' ? `MISER · ${amount} ₶` : 'REJOUER'}
          </PlayButton>
        </>
      ) : (
        <>
          <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Étage</div>
              <div className="font-display text-xl font-black">{step}/{CONFIG.totalSteps}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Mise</div>
              <div className="font-display text-xl font-black">{lockedAmount} ₶</div>
            </div>
          </div>
          <p className="text-xs text-tx-secondary">Choisis une porte à l’étage surligné. {DOORS - 1} sur {DOORS} sont sûres.</p>
          <PlayButton onClick={handleCashout} disabled={busy || step === 0} variant="success">
            {step === 0 ? 'MONTE D’ABORD D’UN ÉTAGE' : `ENCAISSER ${potentialPayout} ₶`}
          </PlayButton>
        </>
      )}
      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell
      title="Frenly Tower"
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
