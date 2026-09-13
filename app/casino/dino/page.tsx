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
  GameShell, fmt, BetControls, PlayButton, PlayRow, ResultBanner, HistoryStrip, CountUp, type RulesSpec,
  useAutoPlay, AutoBadge, AutoTargetField,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import { ArtDino, ArtCactus, ArtRock, ArtFire, ArtVolcano, ArtFinishFlag } from '../_components/CasinoArt';

const CONFIG = LADDER_CONFIGS.dino;

const RULES: RulesSpec = {
  howTo: [
    'Mise, puis le dino part en course tout seul et saute les obstacles qui arrivent.',
    `Chaque obstacle franchi augmente ton multiplicateur. Chaque saut a ${Math.round(CONFIG.survivalProb * 100)}% de réussir.`,
    'Ton seul choix : appuyer sur ENCAISSER entre deux obstacles.',
    'Quand un obstacle arrive tout près, ENCAISSER se bloque le temps de le passer : son résultat est tiré à ce moment-là, pas avant.',
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
const OBSTACLE_W = 38;        // drawn width, used to find its centre
const GRAVITY = 1750;         // px/s²
const JUMP_V0 = 700;          // px/s

// Derived, not guessed: the jump has to *peak* exactly when the obstacle
// reaches the dino. Hardcoding this lead distance is what made the dino
// jump way too early and land before the obstacle arrived.
const TIME_TO_PEAK = JUMP_V0 / GRAVITY;              // s
const JUMP_LEAD_PX = SPEED * TIME_TO_PEAK;           // distance to start the jump

/**
 * Where an obstacle is committed to: the server draws its outcome only once it
 * is this close, and cashing out is locked from then until it is cleared.
 *
 * Outcomes used to be drawn the instant an obstacle spawned, about three
 * seconds out. The server then busted the round on an obstacle still far off
 * screen, so a player who could see themselves alive and pressed "encaisser"
 * got a loss — and on a safe draw was paid for a step not yet reached. It also
 * sent the future to the browser early enough to read it and cash out just
 * before every death.
 *
 * It is asked ~1.2 s before take-off: with a shorter margin a slow round trip
 * answered after the dino had already jumped "blind", so it sailed over an
 * obstacle the server had busted. Cashing out stays locked while pending, so
 * asking early leaks nothing.
 */
const COMMIT_PX = JUMP_LEAD_PX + SPEED * 1.2;
const OBSTACLE_KINDS = [ArtCactus, ArtRock, ArtFire, ArtCactus, ArtRock, ArtVolcano];

type Phase = 'idle' | 'running' | 'dead' | 'cashed';

interface Obstacle {
  id: number;
  index: number;                       // which step it corresponds to
  x: number;
  outcome: 'safe' | 'dead' | null;     // drawn by the server once committed
  committed: boolean;                  // outcome requested; no cashing out until cleared
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
  /** An obstacle is committed and not yet cleared: cashing out would be a guess. */
  const [pending, setPending] = useState(false);

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
  const pendingRef = useRef(false);
  const setPendingBoth = (v: boolean) => { pendingRef.current = v; setPending(v); };

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
        // Never pretend a failed draw was safe: the run would carry on on
        // screen and the cash-out would then come back as a loss.
        if (!res.ok) { (ob as any).error = data.error || 'La course a été interrompue.'; ob.outcome = 'dead'; return; }
        ob.outcome = data.safe ? 'safe' : 'dead';
        (ob as any).serverMultiplier = data.multiplier;
        (ob as any).progression = data.progression;
      } catch {
        (ob as any).error = 'Connexion perdue pendant la course.';
        ob.outcome = 'dead';
      }
    } else {
      ob.outcome = stepOutcome(CONFIG) ? 'safe' : 'dead';
    }
  }, [user]);

  const endRun = (dead: boolean, progression?: any, error?: string) => {
    stopLoop();
    setPendingBoth(false);
    phaseRef.current = 'dead';
    setPhase('dead');
    if (error) {
      vibrate(HAPTIC.ERROR);
      toast.error(error);
      void refresh();
    } else if (dead) {
      vibrate(HAPTIC.ERROR); sfx.bust();
      toast.error('Impact ! La course s’arrête là.');
      if (progression) announceProgression(progression);
    }
  };

  const loop = useCallback((ts: number) => {
    if (phaseRef.current !== 'running') return;
    const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000 || 0);
    lastTsRef.current = ts;

    // An obstacle has reached the dino before the server has drawn it: hold
    // the whole world still rather than invent an outcome the server has not
    // decided. Only happens on a slow round trip.
    // The hold starts at take-off distance, not at contact: the jump itself
    // must wait for the answer, or the dino clears an obstacle it lost to.
    const waiting = obstaclesRef.current.some(
      (o) => o.committed && !o.passed && !o.jumped && o.outcome === null && o.x + OBSTACLE_W / 2 - DINO_X <= JUMP_LEAD_PX
    );
    if (waiting) { rafRef.current = requestAnimationFrame(loop); return; }

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
        outcome: null, committed: false, jumped: false, passed: false, el: null,
      };
      obstaclesRef.current.push(ob);
      spawnedRef.current++;
      setObstacleTick((t) => t + 1);
    }

    /* --- move obstacles --- */
    for (const ob of obstaclesRef.current) {
      ob.x -= SPEED * dt;
      if (ob.el) ob.el.style.transform = `translateX(${ob.x}px)`;

      // Measure from the obstacle's centre, not its left edge, so the jump
      // and the collision line up with what you actually see.
      const obCenter = ob.x + OBSTACLE_W / 2;

      // Commit: from here the obstacle must be faced, so its outcome is drawn
      // now and not before. Obstacles are 420 px apart and the commit line is
      // well inside that, so the previous one is always cleared first and the
      // server sees the steps strictly in order.
      if (!ob.committed && obCenter - DINO_X <= COMMIT_PX) {
        ob.committed = true;
        setPendingBoth(true);
        void resolveObstacle(ob);
      }

      // Take off exactly one "time to peak" before contact, and only on an
      // obstacle the server has cleared (the hold above guarantees an answer).
      if (!ob.jumped && obCenter - DINO_X <= JUMP_LEAD_PX && ob.outcome === 'safe' && dinoYRef.current === 0) {
        ob.jumped = true;
        dinoVRef.current = JUMP_V0;
        sfx.step(Math.min(8, ob.index));
        vibrate(HAPTIC.SOFT);
      }

      // Collision / clear resolution when the obstacle's centre meets the dino.
      if (!ob.passed && obCenter <= DINO_X) {
        // Not decided yet: leave it unpassed so the hold above freezes the
        // world next frame. Counting it as cleared here let a slow round trip
        // carry the dino to the finish while the server had already lost the
        // run — then cashing out at the end came back as a loss.
        if (ob.outcome === null) continue;
        ob.passed = true;
        if (ob.outcome === 'dead') {
          endRun(true, (ob as any).progression, (ob as any).error);
          setObstacleTick((t) => t + 1);
          return;
        }
        const newStep = ob.index + 1;
        setPendingBoth(false);
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
    setPendingBoth(false);
    stepRef.current = 0;
    setStep(0); setMultiplier(1); setLockedAmount(amount); setObstacleTick((t) => t + 1);
    phaseRef.current = 'running'; setPhase('running');
    startLoop();
  };

  const handleCashout = async () => {
    if (busy || phaseRef.current !== 'running' || stepRef.current === 0 || pendingRef.current) return;
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
      if (!res.ok) {
        toast.error(data.error || 'Erreur');
        // The round is over server-side either way; the wallet is re-read so
        // the balance shown is the real one rather than a guess.
        void refresh();
        setPhase('dead');
        return;
      }
      applyServerCashout('dino', data.newBalance, data.payout, multiplier);
      setPhase('cashed'); sfx.cashout(); vibrate(HAPTIC.SUCCESS);
      if (multiplier >= 3) setConfetti((c) => c + 1);
      toast.success(`Encaissé +${fmt(data.payout)} ₶ à ×${multiplier}`); announceProgression(data.progression);
    } else {
      const p = Math.round(lockedAmount * multiplier);
      creditLocal('dino', p, multiplier);
      setBusy(false); setPhase('cashed'); sfx.cashout(); vibrate(HAPTIC.SUCCESS);
      if (multiplier >= 3) setConfetti((c) => c + 1);
      toast.success(`Encaissé +${fmt(p)} ₶ à ×${multiplier}`);
    }
  };

  /** Auto runs the course and cashes out at a target drawn per run. */
  const [autoTarget, setAutoTarget] = useState(3);
  const autoTargetRef = useRef(0);

  const autoTick = () => {
    if (busy) return;
    if (phase === 'idle') {
      autoTargetRef.current = autoTarget;
      void handleStart();
      return;
    }
    if (running) {
      if (step >= autoTargetRef.current) void handleCashout();
      return;
    }
    handleReset();
  };

  // The loop lives here, not in the button: this game swaps its panel once a
  // round starts, which used to unmount the button and kill auto mid-round.
  const autoCtl = useAutoPlay({
    run: autoTick,
    ready: isLoaded && !busy && amount >= CASINO_MIN_BET && amount <= balance,
    betKey: amount,
    balance,
  });

  const handleReset = () => {
    sfx.click(); stopLoop();
    obstaclesRef.current = []; spawnedRef.current = 0; distanceRef.current = 0;
    dinoYRef.current = 0; dinoVRef.current = 0; stepRef.current = 0;
    setPendingBoth(false);
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

      <div className="flex items-center gap-3">
        <span className={cn(
          'font-display text-5xl leading-none tabular-nums [-webkit-text-stroke:5px_#05061A] [paint-order:stroke_fill] [text-shadow:0_4px_0_#05061A]',
          phase === 'dead' ? 'text-accent-secondary' : 'text-accent-primary'
        )}>
          ×{multiplier.toFixed(2)}
        </span>
        {running && step > 0 && (
          <span className="px-3 py-1 rounded-xl border-[3px] border-brand-border bg-accent-success text-brand-bg font-display text-lg">
            <CountUp value={potentialPayout} /> ₶
          </span>
        )}
      </div>

      {/* The running world */}
      <div
        ref={worldRef}
        className="relative w-full rounded-[22px] border-4 border-brand-border overflow-hidden select-none shadow-[0_6px_0_#05061A]"
        style={{ height: WORLD_H, background: 'linear-gradient(180deg, #5B8CFF 0%, #9DBBFF 100%)' }}
      >
        {/* distant hills */}
        <div className="absolute inset-x-0" style={{ bottom: GROUND_H - 6, height: 46 }}>
          <svg viewBox="0 0 400 46" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0 46 L40 18 L80 40 L130 12 L190 42 L240 20 L300 44 L350 22 L400 46Z" fill="#3B6BFF" stroke="#05061A" strokeWidth="3" strokeLinejoin="round" />
          </svg>
        </div>

        {/* ground */}
        <div
          ref={groundRef}
          className="absolute inset-x-0 bottom-0"
          style={{
            height: GROUND_H,
            background: 'repeating-linear-gradient(90deg, #FFB547 0 46px, #F2A33A 46px 92px)',
            borderTop: '4px solid #05061A',
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
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 rounded-md border-2 border-brand-border bg-[#0E1030] text-xs font-display text-white whitespace-nowrap">
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
          <div className="absolute inset-0 flex items-center justify-center bg-[#0E1030]/55">
            <span className="font-display text-3xl text-stroke">Mise pour lancer la course</span>
          </div>
        )}

        <div className="absolute top-2 right-3 px-2 py-0.5 rounded-lg border-2 border-brand-border bg-[#0E1030] font-display text-sm text-white">
          {step}/{CONFIG.totalSteps} obstacles
        </div>
      </div>

      <ResultBanner state={phase === 'dead' ? 'lose' : phase === 'cashed' ? 'win' : 'idle'}>
        {phase === 'dead' ? 'Impact — mise perdue' : `Encaissé +${fmt(potentialPayout)} ₶`}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      {!running ? (
        <>
          <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={busy} />
          <PlayRow
            balance={balance}
            onClick={phase === 'idle' ? handleStart : handleReset}
            onAuto={autoTick}
            control={autoCtl}
            autoExtra={
              <AutoTargetField
                label="Encaisse après"
                value={autoTarget}
                onChange={setAutoTarget}
                min={1} max={CONFIG.totalSteps} step={1} suffix="obst."
              />
            }
            loading={busy}
            disabled={!isLoaded || amount < CASINO_MIN_BET}
            blocked={amount > balance}
            betKey={amount}
          >
            {phase === 'idle' ? `LANCER LA COURSE · ${fmt(amount)} ₶` : 'REJOUER'}
          </PlayRow>
        </>
      ) : (
        <>
          {/* Mid-round the play button is gone, so this is the only way out
              of an auto run before it finishes. */}
          <AutoBadge control={autoCtl} className="w-full justify-center" />

          <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-widest text-tx-muted">Franchis</div>
              <div className="font-display text-2xl leading-none mt-0.5">{step}/{CONFIG.totalSteps}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-black uppercase tracking-widest text-tx-muted">Mise</div>
              <div className="font-display text-2xl leading-none mt-0.5">{fmt(lockedAmount)} ₶</div>
            </div>
          </div>

          <button
            onClick={handleCashout}
            disabled={busy || step === 0 || pending}
            className={cn(
              'h-24 w-full rounded-2xl font-display text-3xl leading-none border-4 border-brand-border transition-transform focus:outline-none',
              step === 0 || pending
                ? 'bg-brand-inner text-tx-muted cursor-not-allowed shadow-[inset_0_4px_0_#0B0E2A]'
                : 'bg-accent-success text-brand-bg shadow-[inset_0_-7px_0_#1E9A55,0_6px_0_#05061A] active:translate-y-[5px]'
            )}
          >
            ENCAISSER
            <div className="text-base font-black">
              {step === 0 ? 'attends le 1er obstacle' : pending ? 'obstacle en approche…' : `${fmt(potentialPayout)} ₶`}
            </div>
          </button>

          <p className="text-[11px] text-tx-muted">Le dino saute tout seul. Ton seul choix : quand t’arrêter.</p>
        </>
      )}
      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell
      gameSlug="dino"
      title="Frenly Dino"
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
