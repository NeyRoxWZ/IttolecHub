'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { LADDER_CONFIGS, multiplierAtStep, stepOutcome, CASINO_MIN_BET } from '@/lib/casino/ladder';

interface LadderGameProps {
  gameSlug: 'tower' | 'poulet' | 'dino';
  title: string;
  stepLabel: string; // "étage", "voie", "obstacle"
  icon: any;
  bustMessage: string;
}

type Phase = 'idle' | 'active' | 'busted' | 'cashed';

export default function LadderGame({ gameSlug, title, stepLabel, icon: Icon, bustMessage }: LadderGameProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, maxBet, startLocalBet, creditLocal, announceProgression, refresh, history } = useCasinoWallet();
  const config = LADDER_CONFIGS[gameSlug];

  const [amount, setAmount] = useState(10);
  const [phase, setPhase] = useState<Phase>('idle');
  const [step, setStep] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clampAmount = (v: number) => Math.max(CASINO_MIN_BET, Math.min(maxBet, Math.floor(v)));
  const [lockedAmount, setLockedAmount] = useState(0);

  const handleStart = async () => {
    if (busy) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }
    if (amount > maxBet) { toast.error(`Mise max: ${maxBet} ₶ (50% du solde).`); return; }

    setBusy(true);
    vibrate(HAPTIC.MEDIUM);

    if (user) {
      const res = await fetch(`/api/casino/${gameSlug}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, amount, payload: {} }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setRoundId(data.roundId);
      setLockedAmount(amount);
      setStep(0);
      setMultiplier(1);
      setPhase('active');
      await refresh();
    } else {
      const result = startLocalBet(gameSlug, amount);
      setBusy(false);
      if ('error' in result) { toast.error(result.error); return; }
      setRoundId('local');
      setLockedAmount(amount);
      setStep(0);
      setMultiplier(1);
      setPhase('active');
    }
  };

  const handleAdvance = async () => {
    if (busy || phase !== 'active') return;
    setBusy(true);
    vibrate(HAPTIC.SOFT);

    if (user && roundId) {
      const res = await fetch(`/api/casino/${gameSlug}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId, payload: {} }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      if (!data.safe) {
        setPhase('busted');
        vibrate(HAPTIC.ERROR);
        toast.error(bustMessage);
        announceProgression(data.progression);
        return;
      }
      setStep(data.step);
      setMultiplier(data.multiplier);
      vibrate(HAPTIC.SUCCESS);
      if (data.atTop) { toast.success('Sommet atteint !'); }
    } else {
      const survived = stepOutcome(config);
      setBusy(false);
      if (!survived) {
        setPhase('busted');
        vibrate(HAPTIC.ERROR);
        toast.error(bustMessage);
        return;
      }
      const newStep = step + 1;
      setStep(newStep);
      setMultiplier(multiplierAtStep(config, newStep));
      vibrate(HAPTIC.SUCCESS);
    }
  };

  const handleCashout = async () => {
    if (busy || phase !== 'active' || step === 0) return;
    setBusy(true);
    vibrate(HAPTIC.MEDIUM);

    if (user && roundId) {
      const res = await fetch(`/api/casino/${gameSlug}/cashout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setPhase('cashed');
      vibrate(HAPTIC.SUCCESS);
      toast.success(`Encaissé +${data.payout} ₶`);
      await refresh();
      announceProgression(data.progression);
    } else {
      const payout = Math.round(lockedAmount * multiplier);
      creditLocal(gameSlug, payout, multiplier);
      setBusy(false);
      setPhase('cashed');
      vibrate(HAPTIC.SUCCESS);
      toast.success(`Encaissé +${payout} ₶`);
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setStep(0);
    setMultiplier(1);
    setRoundId(null);
  };

  const gameHistory = history.filter((h) => h.game_slug === gameSlug).slice(0, 12);
  const potentialPayout = Math.round(lockedAmount * multiplier);

  return (
    <main className="min-h-screen bg-transparent text-tx-base p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/casino')} className="h-12 w-12 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-display text-2xl md:text-3xl font-black">{title}</h1>
          </div>
          <div className="h-12 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
            <Coins className="h-5 w-5 text-accent-primary" />
            <span className="font-display font-black text-lg tabular-nums">{isLoaded ? balance.toLocaleString('fr-FR') : '...'}</span>
            <span className="text-tx-secondary font-bold">₶</span>
            {isLocal && <span className="ml-1 text-[9px] font-black uppercase bg-brand-card border border-brand-border px-1.5 py-0.5 rounded text-tx-muted">Local</span>}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LADDER VISUAL */}
          <div className="flex flex-col items-center justify-center bg-brand-card border-4 border-brand-border rounded-[32px] p-6">
            <div className="w-full flex flex-col-reverse gap-1.5">
              {Array.from({ length: config.totalSteps }, (_, i) => {
                const s = i + 1;
                const cleared = phase !== 'idle' && step >= s;
                const isCurrentBustRow = phase === 'busted' && step === i;
                return (
                  <div
                    key={s}
                    className={cn(
                      'h-9 rounded-lg border-2 flex items-center justify-between px-3 text-xs font-bold transition-colors',
                      cleared ? 'border-accent-success bg-accent-success/15 text-accent-success' :
                      isCurrentBustRow ? 'border-accent-secondary bg-accent-secondary/15 text-accent-secondary' :
                      'border-brand-border bg-brand-inner text-tx-muted'
                    )}
                  >
                    <span>{stepLabel} {s}</span>
                    <span>x{multiplierAtStep(config, s)}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Icon className={cn('w-8 h-8', phase === 'busted' ? 'text-accent-secondary' : phase === 'cashed' ? 'text-accent-success' : 'text-accent-primary')} />
              <div>
                <div className="font-display font-black text-2xl">x{multiplier}</div>
                {phase === 'active' && step > 0 && <div className="text-xs text-tx-secondary">Encaisser = +{potentialPayout} ₶</div>}
              </div>
            </div>

            <div className="mt-4 h-10 flex items-center">
              {phase === 'busted' && (
                <div className="px-4 py-2 rounded-xl border-2 border-accent-secondary text-accent-secondary bg-accent-secondary/10 font-bold text-sm animate-in fade-in duration-200">
                  {bustMessage}
                </div>
              )}
              {phase === 'cashed' && (
                <div className="px-4 py-2 rounded-xl border-2 border-accent-success text-accent-success bg-accent-success/10 font-bold text-sm animate-in fade-in duration-200">
                  Encaissé +{potentialPayout} ₶
                </div>
              )}
            </div>
          </div>

          {/* CONTROLS */}
          <div className="flex flex-col gap-6 bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal">
            {phase === 'idle' || phase === 'busted' || phase === 'cashed' ? (
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
                  {phase === 'idle' ? (busy ? 'DÉMARRAGE...' : `MISER ${amount} ₶`) : 'REJOUER'}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-tx-secondary">
                  Mise verrouillée: <span className="font-bold text-tx-base">{lockedAmount} ₶</span>. Continue pour monter le multiplicateur, ou encaisse maintenant.
                </p>
                <button
                  onClick={handleAdvance}
                  disabled={busy}
                  className={cn('h-16 rounded-2xl font-display text-xl font-black tracking-wider border-4 border-brand-border transition-colors shadow-brutal', busy ? 'bg-brand-inner text-tx-muted cursor-not-allowed' : 'bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary')}
                >
                  {busy ? '...' : `CONTINUER (x${multiplierAtStep(config, step + 1)})`}
                </button>
                <button
                  onClick={handleCashout}
                  disabled={busy || step === 0}
                  className={cn('h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border transition-colors', (busy || step === 0) ? 'bg-brand-inner text-tx-muted cursor-not-allowed' : 'bg-accent-success text-brand-bg hover:bg-brand-inner hover:text-accent-success')}
                >
                  ENCAISSER {step > 0 ? `(+${potentialPayout} ₶)` : ''}
                </button>
              </>
            )}

            {gameHistory.length > 0 && (
              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Dernières parties</span>
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
