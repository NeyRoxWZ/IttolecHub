'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import {
  generateCrashPoint, multiplierAtElapsed, elapsedForMultiplier,
  ROCKET_GROWTH_TAU, CASINO_MIN_BET,
} from '@/lib/casino/rocket';
import {
  GameShell, fmt, BetControls, PlayButton, PlayRow, ResultBanner, HistoryStrip, CountUp, type RulesSpec,
  useAutoPlay, AutoBadge, AutoTargetField,
} from '../_components/CasinoUI';
import Confetti from '../_components/Confetti';
import { ArtRocketShip } from '../_components/CasinoArt';

const RULES: RulesSpec = {
  howTo: [
    'Mise, puis la fusée décolle et le multiplicateur grimpe en continu depuis ×1.',
    'Appuie sur ENCAISSER avant l’explosion pour empocher ta mise × le multiplicateur affiché.',
    'La fusée peut exploser à tout moment — y compris dès ×1. Si elle explose avant que tu encaisses, tu perds ta mise.',
    'Le point d’explosion est tiré au sort au décollage et gardé secret : rien ne s’ajuste selon ta mise.',
  ],
  payouts: [
    { label: 'Encaissé à ×2', value: 'Mise doublée' },
    { label: 'Encaissé à ×5', value: 'Mise ×5' },
    { label: 'Explosion avant encaissement', value: 'Mise perdue' },
  ],
  rtp: '~95%',
};

type Phase = 'idle' | 'flying' | 'crashed' | 'cashed';
/** Gap between the end of one status poll and the start of the next. */
const STATUS_POLL_GAP_MS = 90;
/** How far past the last server confirmation the curve may run, in ms of growth. */
const MAX_LEAD_MS = 450;
const VIEW_W = 460;
const VIEW_H = 240;
const WINDOW_MS = 14_000;

export default function RocketPage() {
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, maxBet, stats, startLocalBet, creditLocal, applyServerBalance, applyServerCashout, announceProgression, refresh, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [phase, setPhase] = useState<Phase>('idle');
  const [multiplier, setMultiplier] = useState(1);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [lockedAmount, setLockedAmount] = useState(0);
  const [crashedAt, setCrashedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([{ x: 0, y: VIEW_H }]);

  const startedAtRef = useRef(0);
  const localCrashRef = useRef(0);
  const animRef = useRef<number | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const lastBeepRef = useRef(1);
  /** Set once the round is over, so late replies can't fire a second time. */
  const settledRef = useRef(false);
  /** Highest multiplier the server has confirmed the rocket was still alive at. */
  const aliveRef = useRef(1);
  const aliveAtRef = useRef(0);

  const stopLoops = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (pollRef.current) clearTimeout(pollRef.current);
    animRef.current = null; pollRef.current = null;
  };
  useEffect(() => () => stopLoops(), []);

  /** Map elapsed/multiplier onto the chart, auto-scaling as it climbs. */
  const projectPoints = (elapsed: number) => {
    const pts: { x: number; y: number }[] = [];
    const steps = 46;
    const spanMs = Math.max(WINDOW_MS, elapsed);
    const topMult = Math.max(2, multiplierAtElapsed(elapsed) * 1.12);
    for (let i = 0; i <= steps; i++) {
      const t = (elapsed * i) / steps;
      const m = multiplierAtElapsed(t);
      pts.push({
        x: (t / spanMs) * VIEW_W,
        y: VIEW_H - ((m - 1) / (topMult - 1)) * (VIEW_H - 18),
      });
    }
    return pts;
  };

  const startAnimation = () => {
    const loop = () => {
      const elapsed = Date.now() - startedAtRef.current;
      const m = multiplierAtElapsed(elapsed);

      if (!user && m >= localCrashRef.current) {
        setMultiplier(localCrashRef.current);
        setPoints(projectPoints(elapsed));
        crash(localCrashRef.current);
        return;
      }

      // Never draw past what the server has confirmed still alive (plus a
      // short allowance for the round-trip). Without this the curve ran
      // seconds ahead of the truth and the crash landed far below it.
      const lead = Math.min(MAX_LEAD_MS, Date.now() - aliveAtRef.current);
      const cap = user ? aliveRef.current * Math.exp(lead / 1000 / ROCKET_GROWTH_TAU) : Infinity;
      const shown = Math.min(m, cap);

      setMultiplier(shown);
      setPoints(projectPoints(user ? elapsedForMultiplier(shown) : elapsed));

      // Rising beeps as it climbs past each whole multiplier.
      if (Math.floor(shown) > lastBeepRef.current) {
        lastBeepRef.current = Math.floor(shown);
        sfx.step(Math.min(10, lastBeepRef.current));
      }

      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  };

  const crash = (at: number) => {
    // A queued reply can arrive after the round is already over; one crash
    // per round, one toast per round.
    if (settledRef.current) return;
    settledRef.current = true;
    stopLoops();
    // The poll can land a beat after the real crash, so rewind the curve to
    // the exact point it blew up instead of leaving the trail hanging past it.
    setPoints(projectPoints(elapsedForMultiplier(at)));
    setMultiplier(at);
    setPhase('crashed'); setCrashedAt(at);
    vibrate(HAPTIC.ERROR); sfx.bust();
    toast.error(`Explosé à ×${at.toFixed(2)}`);
  };

  /**
   * Sequential polling: the next request only leaves once the previous one
   * has answered. The old fixed interval fired faster than the server could
   * reply, so requests piled up behind the browser's connection limit and
   * came back seconds late — which is how the curve reached ×4.25 while the
   * real crash had happened at ×2.33.
   */
  const startPolling = (uid: string, rid: string) => {
    const tick = async () => {
      if (settledRef.current) return;
      try {
        const res = await fetch(`/api/casino/rocket/status?user_id=${uid}&round_id=${rid}`);
        const data = await res.json();
        if (settledRef.current) return;

        if (data.status === 'busted') {
          crash(Number(data.crashPoint));
          announceProgression(data.progression);
          return;
        }
        if (data.status === 'active' && typeof data.multiplier === 'number') {
          aliveRef.current = data.multiplier;
          aliveAtRef.current = Date.now();
        } else if (data.status && data.status !== 'active') {
          // Cashed out elsewhere, or already settled: stop asking.
          return;
        }
      } catch {
        // Network blip — keep trying, the cap simply holds the curve steady.
      }
      if (!settledRef.current) pollRef.current = setTimeout(tick, STATUS_POLL_GAP_MS);
    };
    void tick();
  };

  const handleStart = async () => {
    if (busy) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }

    setBusy(true); vibrate(HAPTIC.MEDIUM); sfx.bet();
    setCrashedAt(null); setPoints([{ x: 0, y: VIEW_H }]); lastBeepRef.current = 1;

    if (user) {
      const res = await fetch('/api/casino/rocket/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, amount }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setRoundId(data.roundId); setLockedAmount(amount);
      applyServerBalance('rocket', data.newBalance, amount);
      startedAtRef.current = data.startedAt;
      settledRef.current = false;
      aliveRef.current = 1;
      aliveAtRef.current = Date.now();
      setMultiplier(1); setPhase('flying');
      startAnimation(); startPolling(user.id, data.roundId);
    } else {
      const result = startLocalBet('rocket', amount);
      setBusy(false);
      if ('error' in result) { toast.error(result.error); return; }
      localCrashRef.current = generateCrashPoint();
      startedAtRef.current = Date.now();
      settledRef.current = false;
      setRoundId('local'); setLockedAmount(amount);
      setMultiplier(1); setPhase('flying');
      startAnimation();
    }
  };

  const handleCashout = async () => {
    if (busy || phase !== 'flying' || settledRef.current) return;
    settledRef.current = true;
    setBusy(true); stopLoops(); vibrate(HAPTIC.MEDIUM);

    if (user && roundId) {
      const res = await fetch('/api/casino/rocket/cashout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        setPhase('crashed'); vibrate(HAPTIC.ERROR); sfx.bust();
        toast.error(data.error || 'Erreur');
        return;
      }
      applyServerCashout('rocket', data.newBalance, data.payout, data.multiplier);
      setMultiplier(data.multiplier); setPhase('cashed');
      sfx.cashout(); vibrate(HAPTIC.SUCCESS);
      if (data.multiplier >= 3) setConfetti((c) => c + 1);
      toast.success(`Encaissé +${fmt(data.payout)} ₶ à ×${data.multiplier}`);
      announceProgression(data.progression);
    } else {
      const m = multiplierAtElapsed(Date.now() - startedAtRef.current);
      if (m >= localCrashRef.current) { setBusy(false); crash(localCrashRef.current); return; }
      const p = Math.round(lockedAmount * m);
      creditLocal('rocket', p, m);
      setMultiplier(m); setBusy(false); setPhase('cashed');
      sfx.cashout(); vibrate(HAPTIC.SUCCESS);
      if (m >= 3) setConfetti((c) => c + 1);
      toast.success(`Encaissé +${fmt(p)} ₶ à ×${m.toFixed(2)}`);
    }
  };

  /** Auto takes off and cashes out at a multiplier drawn fresh each flight. */
  const [autoTarget, setAutoTarget] = useState(2);
  const autoTargetRef = useRef(0);

  const autoTick = () => {
    if (busy) return;
    if (phase === 'idle') {
      autoTargetRef.current = autoTarget;
      void handleStart();
      return;
    }
    if (phase === 'flying') {
      if (multiplier >= autoTargetRef.current) void handleCashout();
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
    sfx.click(); stopLoops();
    setPhase('idle'); setMultiplier(1); setRoundId(null);
    setCrashedAt(null); setPoints([{ x: 0, y: VIEW_H }]);
  };

  const gameHistory = history.filter((h) => h.game_slug === 'rocket').slice(0, 10);
  const flying = phase === 'flying';
  const potentialPayout = Math.round(lockedAmount * multiplier);
  const head = points[points.length - 1] || { x: 0, y: VIEW_H };
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${head.x.toFixed(1)},${VIEW_H} L0,${VIEW_H} Z`;

  const stage = (
    <div className="w-full flex flex-col items-center gap-4">
      {confetti > 0 && <Confetti trigger={confetti} intensity="huge" />}
      <style jsx global>{`
        @keyframes rocketBoom { 0% { transform: scale(0.4); opacity: 1; } 100% { transform: scale(2.4); opacity: 0; } }
        @keyframes rocketFall {
          0% { transform: translate(-50%, -50%) rotate(38deg); opacity: 1; }
          30% { transform: translate(-50%, -40%) rotate(120deg); opacity: 1; }
          100% { transform: translate(-40%, 120%) rotate(320deg); opacity: 0; }
        }
        @keyframes rocketSmoke { 0% { opacity: 0.85; transform: scale(0.6); } 100% { opacity: 0; transform: scale(2.2) translateY(-30px); } }
      `}</style>

      <div
        className="relative w-full rounded-2xl border-4 border-brand-border overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0B1026 0%, #131A38 55%, #1D1030 100%)' }}
      >
        {/* Multiplier readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <span
            className={cn(
              'font-display font-black tabular-nums leading-none transition-colors',
              phase === 'crashed' ? 'text-accent-secondary' : phase === 'cashed' ? 'text-accent-success' : 'text-white'
            )}
            style={{ fontSize: 52, textShadow: '0 4px 18px rgba(0,0,0,0.6)' }}
          >
            ×{multiplier.toFixed(2)}
          </span>
          {phase === 'crashed' && <span className="font-display font-black text-accent-secondary tracking-widest mt-1">EXPLOSÉ</span>}
          {flying && lockedAmount > 0 && (
            <span className="text-sm font-bold text-white/70 mt-1">
              <CountUp value={potentialPayout} /> ₶ si tu encaisses
            </span>
          )}
        </div>

        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full block" style={{ height: VIEW_H }} preserveAspectRatio="none">
          <defs>
            <linearGradient id="rocketFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFD000" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#FFD000" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" y1={VIEW_H * f} x2={VIEW_W} y2={VIEW_H * f} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
          ))}

          {points.length > 1 && (
            <>
              <path d={areaPath} fill="url(#rocketFill)" />
              <path
                d={linePath}
                fill="none"
                stroke={phase === 'crashed' ? '#FF2A55' : phase === 'cashed' ? '#00FF94' : '#FFD000'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
        </svg>

        {/* Rocket head */}
        {points.length > 1 && (
          <div
            className="absolute pointer-events-none transition-none"
            style={{
              left: `${(head.x / VIEW_W) * 100}%`,
              top: `${(head.y / VIEW_H) * 100}%`,
              transform: 'translate(-50%, -50%) rotate(38deg)',
              // The wreck tumbles out of the chart instead of freezing mid-air.
              animation: phase === 'crashed' ? 'rocketFall 900ms ease-in forwards' : undefined,
            }}
          >
            <ArtRocketShip size={30} crashed={phase === 'crashed'} />
          </div>
        )}

        {phase === 'crashed' && points.length > 1 && (
          <div
            className="absolute pointer-events-none rounded-full"
            style={{
              left: `${(head.x / VIEW_W) * 100}%`,
              top: `${(head.y / VIEW_H) * 100}%`,
              width: 70, height: 70, marginLeft: -35, marginTop: -35,
              background: 'radial-gradient(circle, rgba(255,120,40,0.9), rgba(255,42,85,0.35) 45%, transparent 70%)',
              animation: 'rocketSmoke 900ms ease-out forwards',
            }}
          />
        )}

        {phase === 'crashed' && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 60% 45%, rgba(255,42,85,0.45), transparent 60%)', animation: 'rocketBoom 700ms ease-out forwards' }}
          />
        )}
      </div>

      <ResultBanner state={phase === 'crashed' ? 'lose' : phase === 'cashed' ? 'win' : 'idle'}>
        {phase === 'crashed' ? `Explosé à ×${crashedAt?.toFixed(2)} — mise perdue` : `Encaissé +${fmt(potentialPayout)} ₶`}
      </ResultBanner>
    </div>
  );

  const panel = (
    <>
      {!flying ? (
        <>
          <BetControls amount={amount} setAmount={setAmount} maxBet={maxBet} disabled={busy} />
          <PlayRow
            balance={balance}
            onAuto={autoTick}
            control={autoCtl}
            autoExtra={
              <AutoTargetField
                label="Encaisse à"
                value={autoTarget}
                onChange={setAutoTarget}
                min={1.1} max={50} step={0.1} suffix="×"
              />
            }
            blocked={amount > balance}
            betKey={amount}
            onClick={phase === 'idle' ? handleStart : handleReset}
            loading={busy}
            disabled={!isLoaded || amount < CASINO_MIN_BET}
          >
            {phase === 'idle' ? `DÉCOLLER · ${fmt(amount)} ₶` : 'REJOUER'}
          </PlayRow>
        </>
      ) : (
        <>
          {/* Mid-round the play button is gone, so this is the only way out
              of an auto run before it finishes. */}
          <AutoBadge control={autoCtl} className="w-full justify-center" />

          <div className="rounded-xl border-2 border-brand-border bg-brand-inner p-3 text-center">
            <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Mise en vol</div>
            <div className="font-display text-2xl font-black text-accent-primary">{fmt(lockedAmount)} ₶</div>
          </div>
          <button
            onClick={handleCashout}
            disabled={busy}
            className="h-24 w-full rounded-2xl font-display text-2xl font-black tracking-wider border-4 border-brand-border bg-accent-success text-brand-bg shadow-brutal hover:brightness-110 transition-all active:translate-y-1 active:shadow-none focus:outline-none disabled:opacity-50"
          >
            ENCAISSER
            <div className="text-base font-black">{fmt(potentialPayout)} ₶</div>
          </button>
        </>
      )}

      <HistoryStrip history={gameHistory} />
    </>
  );

  return (
    <GameShell
      gameSlug="rocket"
      title="Frenly Rocket"
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
