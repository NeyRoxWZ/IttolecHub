'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { ArtDino, ArtCactus, ArtRock, ArtFire, ArtVolcano, ArtFinishFlag } from '../_components/CasinoArt';

const CONFIG = LADDER_CONFIGS.dino;

const RULES: RulesSpec = {
  howTo: [
    'Mise, puis le dino part en course tout seul et saute les obstacles qui arrivent.',
    `Chaque obstacle franchi augmente ton multiplicateur. Chaque saut a ${Math.round(CONFIG.survivalProb * 100)}% de réussir.`,
    'Ton seul choix : appuyer sur ENCAISSER avant qu’il se prenne un obstacle.',
    'Un obstacle raté et la course s’arrête : mise perdue.',
    `${CONFIG.totalSteps} obstacles au total — franchis-les tous et tu touches ×${multiplierAtStep(CONFIG, CONFIG.totalSteps)}.`,
  ],
  payouts: [1, 3, 6, 9, CONFIG.totalSteps].map((s) => ({ label: `Obstacle ${s}`, value: `×${multiplierAtStep(CONFIG, s)}` })),
  rtp: '~95%',
};

/* ---- world tuning ---- */
const WORLD_H = 300;
const GROUND_H = 64;
const DINO_X = 76;
const DINO_SIZE = 52;
const SPEED = 210;            // px/s the world scrolls
const OBSTACLE_GAP = 420;     // px between obstacles
const GRAVITY = 2100;         // px/s²
const JUMP_V0 = 620;          // px/s — clears an obstacle comfortably
const JUMP_TRIGGER_X = 190;   // start the jump this far ahead of the dino
const OBSTACLE_KINDS = [ArtCactus, ArtRock, ArtFire, ArtCactus, ArtRock, ArtVolcano];

type Phase = 'idle' | 'running' | 'dead' | 'cashed';

interface Obstacle {
  id: number;
  index: number;                       // which step it corresponds to
  x: number;
  outcome: 'safe' | 'dead' | null;     // decided by the server before it arrives
  jumped: boolean;
  passed: boolean;
  el: HTMLDivElement | null;
}

export default function DinoPage() {
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, maxBet, stats, startLocalBet, creditLocal, applyServerBalance, applyServerCashout, announceProgression, refresh, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [phase, setPhase] = useState<Phase>('idle');
  const [step, setStep] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [lockedAmount, setLockedAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [obstacleTick, setObstacleTick] = useState(0); // forces a re-render when the obstacle list changes

  /* ---- imperative game state (refs so the loop never re-renders) ---- */
  const worldRef = useRef<HTMLDivElement>(null);
  const dinoRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);

  const roundIdRef = useRef<string | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const stepRef = useRef(0);
  const spawnedRef = useRef(0);
  const distanceRef = useRef(0);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const dinoYRef = useRef(0);
  const dinoVRef = useRef(0);
  const runCycleRef = useRef(0);
  const nextIdRef = useRef(1);

  const stopLoop = () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; };
  useEffect(() => () => stopLoop(), []);

  /** Ask the server whether the upcoming obstacle is cleared, well before it arrives. */
  const resolveObstacle = useCallback(async (ob: Obstacle) => {
    if (user && roundIdRef.current) {
      try {
        const res = await fetch('/api/casino/dino/step', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, round_id: roundIdRef.current, payload: {} }),
        });
        const data = await res.json();
        if (!res.ok) { ob.outcome = 'safe'; return; }
        ob.outcome = data.safe ? 'safe' : 'dead';
        (ob as any).serverMultiplier = data.multiplier;
        (ob as any).progression = data.progression;
      } catch {
        ob.outcome = 'safe';
      }
    } else {
      ob.outcome = stepOutcome(CONFIG) ? 'safe' : 'dead';
    }
  }, [user]);

  const endRun = (dead: boolean, progression?: any) => {
    stopLoop();
    phaseRef.current = 'dead';
    setPhase('dead');
    if (dead) {
      vibrate(HAPTIC.ERROR); sfx.bust();
      toast.error('Impact ! La course s’arrête là.');
      if (progression) announceProgression(progression);
    }
  };

  const loop = useCallback((ts: number) => {
    if (phaseRef.current !== 'running') return;
    const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000 || 0);
    lastTsRef.current = ts;

    distanceRef.current += SPEED * dt;

    /* --- ground parallax --- */
    if (groundRef.current) groundRef.current.style.backgroundPositionX = `${-distanceRef.current}px`;

    /* --- spawn: one obstacle every OBSTACLE_GAP px of travel --- */
    const worldW = worldRef.current?.clientWidth ?? 600;
    while (spawnedRef.current < CONFIG.totalSteps && distanceRef.current >= spawnedRef.current * OBSTACLE_GAP) {
      const ob: Obstacle = {
        id: nextIdRef.current++,
        index: spawnedRef.current,
        x: worldW + 40,
        outcome: null, jumped: false, passed: false, el: null,
      };
      obstaclesRef.current.push(ob);
      spawnedRef.current++;
      void resolveObstacle(ob);
      setObstacleTick((t) => t + 1);
    }

    /* --- move obstacles --- */
    for (const ob of obstaclesRef.current) {
      ob.x -= SPEED * dt;
      if (ob.el) ob.el.style.transform = `translateX(${ob.x}px)`;

      // Jump when it gets close (only if we already know it's cleared).
      if (!ob.jumped && ob.x - DINO_X < JUMP_TRIGGER_X && ob.outcome === 'safe' && dinoYRef.current === 0) {
        ob.jumped = true;
        dinoVRef.current = JUMP_V0;
        sfx.step(Math.min(8, ob.index));
        vibrate(HAPTIC.SOFT);
      }

      // Collision / clear resolution at the dino's position.
      if (!ob.passed && ob.x <= DINO_X) {
        ob.passed = true;
        if (ob.outcome === 'dead') {
          endRun(true, (ob as any).progression);
          setObstacleTick((t) => t + 1);
          return;
        }
        const newStep = ob.index + 1;
        stepRef.current = newStep;
        setStep(newStep);
        setMultiplier((ob as any).serverMultiplier ?? multiplierAtStep(CONFIG, newStep));
        sfx.reveal();
        if (newStep >= CONFIG.totalSteps) {
          toast.success('Parcours terminé ! Encaisse ton gain.');
        }
      }
    }

    // Drop obstacles that left the screen.
    if (obstaclesRef.current.some((o) => o.x < -80)) {
      obstaclesRef.current = obstaclesRef.current.filter((o) => o.x >= -80);
      setObstacleTick((t) => t + 1);
    }

    /* --- dino physics --- */
    if (dinoVRef.current !== 0 || dinoYRef.current > 0) {
      dinoVRef.current -= GRAVITY * dt;
      dinoYRef.current += dinoVRef.current * dt;
      if (dinoYRef.current <= 0) { dinoYRef.current = 0; dinoVRef.current = 0; }
    }
    runCycleRef.current += dt * 14;
    const bob = dinoYRef.current === 0 ? Math.abs(Math.sin(runCycleRef.current)) * 2.5 : 0;
    if (dinoRef.current) {
      dinoRef.current.style.transform = `translateY(${-dinoYRef.current - bob}px) rotate(${dinoYRef.current > 0 ? -8 : 0}deg)`;
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [resolveObstacle, announceProgression]);

  const startLoop = () => {
    lastTsRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
  };

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
      roundIdRef.current = data.roundId;
      applyServerBalance('dino', data.newBalance, amount);
    } else {
      const r = startLocalBet('dino', amount);
      setBusy(false);
      if ('error' in r) { toast.error(r.error); return; }
      roundIdRef.current = 'local';
    }

    obstaclesRef.current = [];
    spawnedRef.current = 0; distanceRef.current = 0;
    dinoYRef.current = 0; dinoVRef.current = 0; runCycleRef.current = 0;
    stepRef.current = 0;
    setStep(0); setMultiplier(1); setLockedAmount(amount); setObstacleTick((t) => t + 1);
    phaseRef.current = 'running'; setPhase('running');
    startLoop();
  };

  const handleCashout = async () => {
    if (busy || phaseRef.current !== 'running' || stepRef.current === 0) return;
    setBusy(true); stopLoop();
    phaseRef.current = 'cashed';
    vibrate(HAPTIC.MEDIUM);

    if (user && roundIdRef.current) {
      const res = await fetch('/api/casino/dino/cashout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundIdRef.current }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); setPhase('dead'); return; }
      applyServerCashout('dino', data.newBalance, data.payout, multiplier);
      setPhase('cashed'); sfx.cashout(); vibrate(HAPTIC.SUCCESS);
      if (multiplier >= 3) setConfetti((c) => c + 1);
      toast.success(`Encaissé +${data.payout} ₶ à ×${multiplier}`); announceProgression(data.progression);
    } else {
      const p = Math.round(lockedAmount * multiplier);
      creditLocal('dino', p, multiplier);
      setBusy(false); setPhase('cashed'); sfx.cashout(); vibrate(HAPTIC.SUCCESS);
      if (multiplier >= 3) setConfetti((c) => c + 1);
      toast.success(`Encaissé +${p} ₶ à ×${multiplier}`);
    }
  };

  const handleReset = () => {
    sfx.click(); stopLoop();
    obstaclesRef.current = []; spawnedRef.current = 0; distanceRef.current = 0;
    dinoYRef.current = 0; dinoVRef.current = 0; stepRef.current = 0;
    roundIdRef.current = null;
    phaseRef.current = 'idle'; setPhase('idle');
    setStep(0); setMultiplier(1); setObstacleTick((t) => t + 1);
  };

  const running = phase === 'running';
  const potentialPayout = Math.round(lockedAmount * multiplier);
  const gameHistory = history.filter((h) => h.game_slug === 'dino').slice(0, 10);

  const stage = (
    <div className="w-full flex flex-col items-center gap-3">
      {confetti > 0 && <Confetti trigger={confetti} intensity="big" />}

      <div className="flex items-baseline gap-3">
        <span className={cn('font-display text-4xl font-black tabular-nums', phase === 'dead' ? 'text-accent-secondary' : 'text-accent-primary')}>
          ×{multiplier.toFixed(2)}
        </span>
        {running && step > 0 && (
          <span className="text-sm font-bold text-tx-secondary">= <CountUp value={potentialPayout} className="text-accent-success" /> ₶</span>
        )}
      </div>

      {/* The running world */}
      <div
        ref={worldRef}
        className="relative w-full rounded-2xl border-4 border-brand-border overflow-hidden select-none"
        style={{ height: WORLD_H, background: 'linear-gradient(180deg, #21344B 0%, #3E5C72 60%, #6D8496 100%)' }}
      >
        {/* distant hills */}
        <div className="absolute inset-x-0" style={{ bottom: GROUND_H - 6, height: 46, opacity: 0.35 }}>
          <svg viewBox="0 0 400 46" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0 46 L40 18 L80 40 L130 12 L190 42 L240 20 L300 44 L350 22 L400 46Z" fill="#16202E" />
          </svg>
        </div>

        {/* ground */}
        <div
          ref={groundRef}
          className="absolute inset-x-0 bottom-0"
          style={{
            height: GROUND_H,
            background: 'repeating-linear-gradient(90deg, #C8A165 0 46px, #BE9758 46px 92px)',
            borderTop: '3px solid #8E6C3A',
          }}
        />

        {/* dino */}
        <div className="absolute" style={{ left: DINO_X - DINO_SIZE / 2, bottom: GROUND_H - 4 }}>
          <div ref={dinoRef} style={{ willChange: 'transform' }}>
            <ArtDino size={DINO_SIZE} dead={phase === 'dead'} />
          </div>
        </div>

        {/* obstacles */}
        {obstaclesRef.current.map((ob) => {
          const Art = OBSTACLE_KINDS[ob.index % OBSTACLE_KINDS.length];
          return (
            <div
              key={ob.id}
              ref={(el) => { ob.el = el; if (el) el.style.transform = `translateX(${ob.x}px)`; }}
              className="absolute"
              style={{ left: 0, bottom: GROUND_H - 4, willChange: 'transform' }}
            >
              <div className="relative">
                <Art size={38} />
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-display font-black text-white/90 whitespace-nowrap">
                  ×{multiplierAtStep(CONFIG, ob.index + 1)}
                </span>
              </div>
            </div>
          );
        })}

        {/* finish marker once everything is cleared */}
        {step >= CONFIG.totalSteps && (
          <div className="absolute right-4" style={{ bottom: GROUND_H - 4 }}><ArtFinishFlag size={34} /></div>
        )}

        {phase === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45">
            <span className="font-display font-black text-white/85 text-sm">Mise pour lancer la course</span>
          </div>
        )}

        <div className="absolute top-2 right-3 text-[10px] font-black uppercase tracking-widest text-white/60">
          {step}/{CONFIG.totalSteps} obstacles
        </div>
      </div>

      <ResultBanner state={phase === 'dead' ? 'lose' : phase === 'cashed' ? 'win' : 'idle'}>
        {phase === 'dead' ? 'Impact — mise perdue' : `Encaissé +${potentialPayout} ₶`}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      {!running ? (
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
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Franchis</div>
              <div className="font-display text-xl font-black">{step}/{CONFIG.totalSteps}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Mise</div>
              <div className="font-display text-xl font-black">{lockedAmount} ₶</div>
            </div>
          </div>

          <button
            onClick={handleCashout}
            disabled={busy || step === 0}
            className={cn(
              'h-24 w-full rounded-2xl font-display text-xl font-black tracking-wider border-4 border-brand-border shadow-brutal transition-all active:translate-y-1 active:shadow-none focus:outline-none',
              step === 0 ? 'bg-brand-inner text-tx-muted cursor-not-allowed shadow-none' : 'bg-accent-success text-brand-bg hover:brightness-110'
            )}
          >
            ENCAISSER
            <div className="text-base font-black">{step === 0 ? 'attends le 1er obstacle' : `${potentialPayout} ₶`}</div>
          </button>

          <p className="text-[11px] text-tx-muted">Le dino saute tout seul. Ton seul choix : quand t’arrêter.</p>
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
