'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Minus, Plus, Rocket as RocketIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { generateCrashPoint, multiplierAtElapsed, CASINO_MIN_BET } from '@/lib/casino/rocket';

type Phase = 'idle' | 'flying' | 'crashed' | 'cashed';
const STATUS_POLL_MS = 600;

export default function RocketPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, maxBet, startLocalBet, creditLocal, announceProgression, refresh, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [phase, setPhase] = useState<Phase>('idle');
  const [multiplier, setMultiplier] = useState(1);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [lockedAmount, setLockedAmount] = useState(0);
  const [crashedAt, setCrashedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const startedAtRef = useRef(0);
  const localCrashPointRef = useRef(0);
  const animRef = useRef<number | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const clampAmount = (v: number) => Math.max(CASINO_MIN_BET, Math.min(maxBet, Math.floor(v)));

  const stopLoops = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  useEffect(() => () => stopLoops(), []);

  const startLocalAnimation = () => {
    const loop = () => {
      const elapsed = Date.now() - startedAtRef.current;
      const m = multiplierAtElapsed(elapsed);
      if (!user && m >= localCrashPointRef.current) {
        setMultiplier(localCrashPointRef.current);
        setPhase('crashed');
        setCrashedAt(localCrashPointRef.current);
        vibrate(HAPTIC.ERROR);
        toast.error(`Explosé à x${localCrashPointRef.current}`);
        stopLoops();
        return;
      }
      setMultiplier(m);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  };

  const startStatusPolling = (uid: string, rid: string) => {
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/casino/rocket/status?user_id=${uid}&round_id=${rid}`);
      const data = await res.json();
      if (data.status === 'busted') {
        setPhase('crashed');
        setCrashedAt(data.crashPoint);
        vibrate(HAPTIC.ERROR);
        toast.error(`Explosé à x${data.crashPoint}`);
        stopLoops();
        announceProgression(data.progression);
      }
    }, STATUS_POLL_MS);
  };

  const handleStart = async () => {
    if (busy) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }
    if (amount > maxBet) { toast.error(`Mise max: ${maxBet} ₶ (50% du solde).`); return; }

    setBusy(true);
    vibrate(HAPTIC.MEDIUM);
    setCrashedAt(null);

    if (user) {
      const res = await fetch('/api/casino/rocket/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, amount }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setRoundId(data.roundId);
      setLockedAmount(amount);
      startedAtRef.current = data.startedAt;
      setMultiplier(1);
      setPhase('flying');
      await refresh();
      startLocalAnimation();
      startStatusPolling(user.id, data.roundId);
    } else {
      const result = startLocalBet('rocket', amount);
      setBusy(false);
      if ('error' in result) { toast.error(result.error); return; }
      localCrashPointRef.current = generateCrashPoint();
      startedAtRef.current = Date.now();
      setRoundId('local');
      setLockedAmount(amount);
      setMultiplier(1);
      setPhase('flying');
      startLocalAnimation();
    }
  };

  const handleCashout = async () => {
    if (busy || phase !== 'flying') return;
    setBusy(true);
    stopLoops();
    vibrate(HAPTIC.MEDIUM);

    if (user && roundId) {
      const res = await fetch('/api/casino/rocket/cashout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        setPhase('crashed');
        vibrate(HAPTIC.ERROR);
        toast.error(data.error || 'Erreur');
        return;
      }
      setMultiplier(data.multiplier);
      setPhase('cashed');
      vibrate(HAPTIC.SUCCESS);
      toast.success(`Encaissé +${data.payout} ₶ à x${data.multiplier}`);
      await refresh();
      announceProgression(data.progression);
    } else {
      const elapsed = Date.now() - startedAtRef.current;
      const m = multiplierAtElapsed(elapsed);
      if (m >= localCrashPointRef.current) {
        setBusy(false);
        setPhase('crashed');
        vibrate(HAPTIC.ERROR);
        toast.error(`Trop tard, explosé à x${localCrashPointRef.current}`);
        return;
      }
      const payout = Math.round(lockedAmount * m);
      creditLocal('rocket', payout, m);
      setMultiplier(m);
      setBusy(false);
      setPhase('cashed');
      vibrate(HAPTIC.SUCCESS);
      toast.success(`Encaissé +${payout} ₶ à x${m}`);
    }
  };

  const handleReset = () => {
    stopLoops();
    setPhase('idle');
    setMultiplier(1);
    setRoundId(null);
    setCrashedAt(null);
  };

  const gameHistory = history.filter((h) => h.game_slug === 'rocket').slice(0, 12);
  const potentialPayout = Math.round(lockedAmount * multiplier);

  return (
    <main className="min-h-screen bg-transparent text-tx-base p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/casino')} className="h-12 w-12 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-display text-2xl md:text-3xl font-black">Frenly Rocket</h1>
          </div>
          <div className="h-12 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
            <Coins className="h-5 w-5 text-accent-primary" />
            <span className="font-display font-black text-lg tabular-nums">{isLoaded ? balance.toLocaleString('fr-FR') : '...'}</span>
            <span className="text-tx-secondary font-bold">₶</span>
            {isLocal && <span className="ml-1 text-[9px] font-black uppercase bg-brand-card border border-brand-border px-1.5 py-0.5 rounded text-tx-muted">Local</span>}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col items-center justify-center bg-brand-card border-4 border-brand-border rounded-[32px] p-6 min-h-[240px]">
            <RocketIcon className={cn('w-16 h-16 transition-transform', phase === 'flying' ? 'text-accent-primary -translate-y-2' : phase === 'crashed' ? 'text-accent-secondary rotate-45' : 'text-tx-muted')} />
            <div className={cn('mt-4 font-display font-black text-4xl tabular-nums', phase === 'crashed' ? 'text-accent-secondary' : 'text-tx-base')}>
              x{multiplier.toFixed(2)}
            </div>
            <div className="mt-4 h-10 flex items-center">
              {phase === 'crashed' && (
                <div className="px-4 py-2 rounded-xl border-2 border-accent-secondary text-accent-secondary bg-accent-secondary/10 font-bold text-sm animate-in fade-in duration-200">
                  Explosé {crashedAt ? `à x${crashedAt}` : ''}
                </div>
              )}
              {phase === 'cashed' && (
                <div className="px-4 py-2 rounded-xl border-2 border-accent-success text-accent-success bg-accent-success/10 font-bold text-sm animate-in fade-in duration-200">
                  Encaissé +{potentialPayout} ₶
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6 bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal">
            {phase === 'idle' || phase === 'crashed' || phase === 'cashed' ? (
              <>
                <div>
                  <label className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Mise (max {maxBet} ₶)</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setAmount((a) => clampAmount(a - 5))} className="h-11 w-11 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base">
                      <Minus className="h-4 w-4" />
                    </button>
                    <input type="number" value={amount} onChange={(e) => setAmount(clampAmount(Number(e.target.value) || 0))} className="flex-1 h-11 bg-brand-inner border-2 border-brand-border rounded-lg px-3 text-center font-display font-black" />
                    <button onClick={() => setAmount((a) => clampAmount(a + 5))} className="h-11 w-11 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base">
                      <Plus className="h-4 w-4" />
                    </button>
                    <button onClick={() => setAmount(maxBet)} className="h-11 px-3 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner text-xs font-bold hover:border-tx-base">MAX</button>
                  </div>
                </div>
                <button
                  onClick={phase === 'idle' ? handleStart : handleReset}
                  disabled={busy || !isLoaded || amount < CASINO_MIN_BET}
                  className={cn('h-16 rounded-2xl font-display text-xl font-black tracking-wider border-4 border-brand-border transition-colors shadow-brutal', busy ? 'bg-brand-inner text-tx-muted cursor-not-allowed' : 'bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary')}
                >
                  {phase === 'idle' ? (busy ? 'DÉCOLLAGE...' : `MISER ${amount} ₶`) : 'REJOUER'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-tx-secondary">
                  Mise verrouillée: <span className="font-bold text-tx-base">{lockedAmount} ₶</span>. Encaisse avant l&apos;explosion.
                </p>
                <button
                  onClick={handleCashout}
                  disabled={busy}
                  className={cn('h-20 rounded-2xl font-display text-2xl font-black tracking-wider border-4 border-brand-border transition-colors shadow-brutal', busy ? 'bg-brand-inner text-tx-muted cursor-not-allowed' : 'bg-accent-success text-brand-bg hover:bg-brand-inner hover:text-accent-success')}
                >
                  ENCAISSER +{potentialPayout} ₶
                </button>
              </>
            )}

            {gameHistory.length > 0 && (
              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Derniers vols</span>
                <div className="flex flex-wrap gap-2">
                  {gameHistory.map((h) => (
                    <span key={h.id} className={cn('text-xs font-bold px-2 py-1 rounded-md border-2', h.amount >= 0 ? 'border-accent-success text-accent-success' : 'border-accent-secondary text-accent-secondary')}>
                      {h.amount >= 0 ? '+' : ''}{h.amount}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
