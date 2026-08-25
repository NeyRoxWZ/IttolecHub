'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Minus, Plus, Bomb, Gem } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { generateMinePositions, multiplierAfterReveals, MINES_TOTAL_CELLS, MINES_MIN_COUNT, MINES_MAX_COUNT, CASINO_MIN_BET } from '@/lib/casino/mines';

type Phase = 'idle' | 'active' | 'busted' | 'cashed';

export default function MinesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, maxBet, startLocalBet, creditLocal, refresh, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [mineCount, setMineCount] = useState(3);
  const [phase, setPhase] = useState<Phase>('idle');
  const [roundId, setRoundId] = useState<string | null>(null);
  const [lockedAmount, setLockedAmount] = useState(0);
  const [lockedMineCount, setLockedMineCount] = useState(3);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [minePositions, setMinePositions] = useState<number[] | null>(null); // only known locally (anon) or after bust
  const [multiplier, setMultiplier] = useState(1);
  const [busy, setBusy] = useState(false);

  const clampAmount = (v: number) => Math.max(CASINO_MIN_BET, Math.min(maxBet, Math.floor(v)));
  const maxSafeReveals = MINES_TOTAL_CELLS - lockedMineCount;

  const handleStart = async () => {
    if (busy) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }
    if (amount > maxBet) { toast.error(`Mise max: ${maxBet} ₶ (50% du solde).`); return; }

    setBusy(true);
    vibrate(HAPTIC.MEDIUM);

    if (user) {
      const res = await fetch('/api/casino/mines/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, amount, payload: { mineCount } }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      setRoundId(data.roundId);
      setLockedAmount(amount);
      setLockedMineCount(mineCount);
      setRevealed([]);
      setMinePositions(null);
      setMultiplier(1);
      setPhase('active');
      await refresh();
    } else {
      const result = startLocalBet('mines', amount);
      setBusy(false);
      if ('error' in result) { toast.error(result.error); return; }
      setRoundId('local');
      setLockedAmount(amount);
      setLockedMineCount(mineCount);
      setRevealed([]);
      setMinePositions(generateMinePositions(mineCount));
      setMultiplier(1);
      setPhase('active');
    }
  };

  const handleReveal = async (cellIndex: number) => {
    if (busy || phase !== 'active' || revealed.includes(cellIndex)) return;
    setBusy(true);
    vibrate(HAPTIC.SOFT);

    if (user && roundId) {
      const res = await fetch('/api/casino/mines/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, round_id: roundId, payload: { cellIndex } }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }
      if (!data.safe) {
        setMinePositions(data.minePositions);
        setPhase('busted');
        vibrate(HAPTIC.ERROR);
        toast.error('Boum ! Mine touchée.');
        return;
      }
      setRevealed(data.revealed);
      setMultiplier(data.multiplier);
      vibrate(HAPTIC.SUCCESS);
      if (data.allCleared) toast.success('Toutes les cases sûres révélées !');
    } else {
      const mines = minePositions!;
      setBusy(false);
      if (mines.includes(cellIndex)) {
        setPhase('busted');
        vibrate(HAPTIC.ERROR);
        toast.error('Boum ! Mine touchée.');
        return;
      }
      const newRevealed = [...revealed, cellIndex];
      setRevealed(newRevealed);
      setMultiplier(multiplierAfterReveals(lockedMineCount, newRevealed.length));
      vibrate(HAPTIC.SUCCESS);
    }
  };

  const handleCashout = async () => {
    if (busy || phase !== 'active' || revealed.length === 0) return;
    setBusy(true);
    vibrate(HAPTIC.MEDIUM);

    if (user && roundId) {
      const res = await fetch('/api/casino/mines/cashout', {
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
    } else {
      const payout = Math.round(lockedAmount * multiplier);
      creditLocal('mines', payout, multiplier);
      setBusy(false);
      setPhase('cashed');
      vibrate(HAPTIC.SUCCESS);
      toast.success(`Encaissé +${payout} ₶`);
    }
  };

  const handleReset = () => {
    setPhase('idle');
    setRevealed([]);
    setMinePositions(null);
    setMultiplier(1);
    setRoundId(null);
  };

  const gameHistory = history.filter((h) => h.game_slug === 'mines').slice(0, 12);
  const potentialPayout = Math.round(lockedAmount * multiplier);

  return (
    <main className="min-h-screen bg-transparent text-tx-base p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/casino')} className="h-12 w-12 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-display text-2xl md:text-3xl font-black">Frenly Mines</h1>
          </div>
          <div className="h-12 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
            <Coins className="h-5 w-5 text-accent-primary" />
            <span className="font-display font-black text-lg tabular-nums">{isLoaded ? balance.toLocaleString('fr-FR') : '...'}</span>
            <span className="text-tx-secondary font-bold">₶</span>
            {isLocal && <span className="ml-1 text-[9px] font-black uppercase bg-brand-card border border-brand-border px-1.5 py-0.5 rounded text-tx-muted">Local</span>}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* GRID */}
          <div className="flex flex-col items-center justify-center bg-brand-card border-4 border-brand-border rounded-[32px] p-6">
            <div className="grid grid-cols-5 gap-1.5 w-full max-w-[280px]">
              {Array.from({ length: MINES_TOTAL_CELLS }, (_, i) => {
                const isRevealed = revealed.includes(i);
                const isMine = phase === 'busted' && minePositions?.includes(i);
                const isPlayable = phase === 'active';
                return (
                  <button
                    key={i}
                    onClick={() => handleReveal(i)}
                    disabled={!isPlayable || isRevealed || busy}
                    className={cn(
                      'aspect-square rounded-lg border-2 flex items-center justify-center transition-all focus:outline-none',
                      isMine ? 'border-accent-secondary bg-accent-secondary/20' :
                      isRevealed ? 'border-accent-success bg-accent-success/15' :
                      'border-brand-border bg-brand-inner',
                      isPlayable && !isRevealed && 'hover:border-accent-primary'
                    )}
                  >
                    {isMine ? <Bomb className="w-4 h-4 text-accent-secondary" /> : isRevealed ? <Gem className="w-4 h-4 text-accent-success" /> : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className="font-display font-black text-xl">x{multiplier}</span>
              {phase === 'active' && revealed.length > 0 && <span className="text-xs text-tx-secondary">Encaisser = +{potentialPayout} ₶</span>}
            </div>

            <div className="mt-2 h-10 flex items-center">
              {phase === 'busted' && (
                <div className="px-4 py-2 rounded-xl border-2 border-accent-secondary text-accent-secondary bg-accent-secondary/10 font-bold text-sm animate-in fade-in duration-200">
                  Boum ! Perdu.
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

                <div>
                  <label className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Nombre de mines: {mineCount}</label>
                  <input
                    type="range"
                    min={MINES_MIN_COUNT}
                    max={MINES_MAX_COUNT}
                    value={mineCount}
                    onChange={(e) => setMineCount(Number(e.target.value))}
                    className="w-full accent-accent-primary"
                  />
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
                  Mise verrouillée: <span className="font-bold text-tx-base">{lockedAmount} ₶</span> · {lockedMineCount} mines. Révèle des cases sûres pour monter le multiplicateur, ou encaisse.
                </p>
                <button
                  onClick={handleCashout}
                  disabled={busy || revealed.length === 0}
                  className={cn('h-16 rounded-2xl font-display text-xl font-black tracking-wider border-4 border-brand-border transition-colors shadow-brutal', (busy || revealed.length === 0) ? 'bg-brand-inner text-tx-muted cursor-not-allowed' : 'bg-accent-success text-brand-bg hover:bg-brand-inner hover:text-accent-success')}
                >
                  ENCAISSER {revealed.length > 0 ? `(+${potentialPayout} ₶)` : ''}
                </button>
                <p className="text-xs text-tx-muted">{revealed.length}/{maxSafeReveals} cases sûres révélées</p>
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
