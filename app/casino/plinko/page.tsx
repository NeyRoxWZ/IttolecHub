'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Minus, Plus, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { dropBall, resolvePlinko, PLINKO_MULTIPLIERS, CASINO_MIN_BET } from '@/lib/casino/plinko';

const DROP_MS = 1400;

type PlinkoResult = GenericBetResult & { bucket: number };

export default function PlinkoPage() {
  const router = useRouter();
  const { balance, isLoaded, isLocal, maxBet, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [dropping, setDropping] = useState(false);
  const [lastResult, setLastResult] = useState<PlinkoResult | null>(null);

  const clampAmount = (v: number) => Math.max(CASINO_MIN_BET, Math.min(maxBet, Math.floor(v)));

  const handleDrop = async () => {
    if (dropping) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }
    if (amount > maxBet) { toast.error(`Mise max: ${maxBet} ₶ (50% du solde).`); return; }

    setDropping(true);
    setLastResult(null);
    vibrate(HAPTIC.MEDIUM);

    const [result] = await Promise.all([
      placeBet('plinko', amount, {}, () => {
        const { bucket, multiplier } = dropBall();
        const r = resolvePlinko(multiplier);
        return { ...r, meta: { bucket } };
      }),
      new Promise((r) => setTimeout(r, DROP_MS)),
    ]);

    setDropping(false);

    if ('error' in result) {
      toast.error(result.error);
      return;
    }

    const full: PlinkoResult = { ...result, bucket: result.meta.bucket };
    setLastResult(full);

    if (full.won) {
      vibrate(HAPTIC.SUCCESS);
      toast.success(`Case x${full.multiplier} ! Gain: +${full.payout} ₶`);
    } else {
      vibrate(HAPTIC.ERROR);
      toast.error(`Case x${full.multiplier}. Perdu.`);
    }
  };

  const gameHistory = history.filter((h) => h.game_slug === 'plinko').slice(0, 12);

  return (
    <main className="min-h-screen bg-transparent text-tx-base p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/casino')} className="h-12 w-12 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-display text-2xl md:text-3xl font-black">Frenly Plinko</h1>
          </div>
          <div className="h-12 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
            <Coins className="h-5 w-5 text-accent-primary" />
            <span className="font-display font-black text-lg tabular-nums">{isLoaded ? balance.toLocaleString('fr-FR') : '...'}</span>
            <span className="text-tx-secondary font-bold">₶</span>
            {isLocal && <span className="ml-1 text-[9px] font-black uppercase bg-brand-card border border-brand-border px-1.5 py-0.5 rounded text-tx-muted">Local</span>}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col items-center justify-center bg-brand-card border-4 border-brand-border rounded-[32px] p-6">
            <div className="relative w-full h-40 flex items-start justify-center overflow-hidden">
              <Circle
                className={cn('w-6 h-6 fill-accent-primary text-accent-primary absolute top-0', dropping && 'animate-bounce')}
                style={{
                  left: lastResult && !dropping ? `${(lastResult.bucket / (PLINKO_MULTIPLIERS.length - 1)) * 90 + 5}%` : '50%',
                  transform: 'translateX(-50%)',
                  transition: 'left 1.2s cubic-bezier(0.3,0.6,0.2,1), top 1.2s ease-in',
                  top: dropping || lastResult ? '85%' : '0%',
                }}
              />
            </div>
            <div className="flex w-full gap-1 mt-2">
              {PLINKO_MULTIPLIERS.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex-1 h-10 rounded-md border-2 flex items-center justify-center text-[10px] sm:text-xs font-bold transition-colors',
                    lastResult && !dropping && lastResult.bucket === i ? 'border-accent-primary bg-accent-primary text-brand-bg' : 'border-brand-border bg-brand-inner text-tx-secondary'
                  )}
                >
                  x{m}
                </div>
              ))}
            </div>

            <div className="mt-6 h-10 flex items-center">
              {lastResult && !dropping && (
                <div className={cn('px-4 py-2 rounded-xl border-2 font-bold text-sm animate-in fade-in duration-200', lastResult.won ? 'border-accent-success text-accent-success bg-accent-success/10' : 'border-accent-secondary text-accent-secondary bg-accent-secondary/10')}>
                  {lastResult.won ? `Gagné +${lastResult.payout} ₶` : 'Perdu'}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6 bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal">
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
              onClick={handleDrop}
              disabled={dropping || !isLoaded || amount < CASINO_MIN_BET}
              className={cn('h-16 rounded-2xl font-display text-xl font-black tracking-wider border-4 border-brand-border transition-colors shadow-brutal', dropping ? 'bg-brand-inner text-tx-muted cursor-not-allowed' : 'bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary')}
            >
              {dropping ? 'ÇA TOMBE...' : `LÂCHER LA BILLE (${amount} ₶)`}
            </button>

            {gameHistory.length > 0 && (
              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Derniers drops</span>
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
