'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { drawKenoNumbers, resolveKeno, KENO_PAYTABLE, KENO_PICK_COUNT, KENO_POOL_SIZE, CASINO_MIN_BET } from '@/lib/casino/keno';

const DRAW_MS = 1200;

type KenoResult = GenericBetResult & { drawn: number[]; matches: number; picks: number[] };

export default function KenoPage() {
  const router = useRouter();
  const { balance, isLoaded, isLocal, maxBet, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [picks, setPicks] = useState<number[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [lastResult, setLastResult] = useState<KenoResult | null>(null);

  const clampAmount = (v: number) => Math.max(CASINO_MIN_BET, Math.min(maxBet, Math.floor(v)));

  const togglePick = (n: number) => {
    if (drawing) return;
    setPicks((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= KENO_PICK_COUNT) {
        toast.error(`Maximum ${KENO_PICK_COUNT} numéros.`);
        return prev;
      }
      vibrate(HAPTIC.SOFT);
      return [...prev, n];
    });
  };

  const quickPick = () => {
    const pool = Array.from({ length: KENO_POOL_SIZE }, (_, i) => i + 1);
    const picked: number[] = [];
    while (picked.length < KENO_PICK_COUNT) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    setPicks(picked);
    vibrate(HAPTIC.SOFT);
  };

  const handleDraw = async () => {
    if (drawing) return;
    if (picks.length !== KENO_PICK_COUNT) { toast.error(`Choisis ${KENO_PICK_COUNT} numéros.`); return; }
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }
    if (amount > maxBet) { toast.error(`Mise max: ${maxBet} ₶ (50% du solde).`); return; }

    setDrawing(true);
    setLastResult(null);
    vibrate(HAPTIC.MEDIUM);

    const [result] = await Promise.all([
      placeBet('keno', amount, { picks }, () => {
        const drawn = drawKenoNumbers();
        const r = resolveKeno(picks, drawn);
        return { won: r.won, multiplier: r.multiplier, meta: { drawn, matches: r.matches, picks } };
      }),
      new Promise((r) => setTimeout(r, DRAW_MS)),
    ]);

    setDrawing(false);

    if ('error' in result) {
      toast.error(result.error);
      return;
    }

    const full: KenoResult = { ...result, drawn: result.meta.drawn, matches: result.meta.matches, picks: result.meta.picks };
    setLastResult(full);

    if (full.won) {
      vibrate(HAPTIC.SUCCESS);
      toast.success(`${full.matches} bons numéros ! Gain: +${full.payout} ₶`);
    } else {
      vibrate(HAPTIC.ERROR);
      toast.error(`${full.matches} bons numéros. Perdu.`);
    }
  };

  const gameHistory = history.filter((h) => h.game_slug === 'keno').slice(0, 12);

  return (
    <main className="min-h-screen bg-transparent text-tx-base p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/casino')} className="h-12 w-12 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-display text-2xl md:text-3xl font-black">Frenly Keno</h1>
          </div>
          <div className="h-12 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
            <Coins className="h-5 w-5 text-accent-primary" />
            <span className="font-display font-black text-lg tabular-nums">{isLoaded ? balance.toLocaleString('fr-FR') : '...'}</span>
            <span className="text-tx-secondary font-bold">₶</span>
            {isLocal && <span className="ml-1 text-[9px] font-black uppercase bg-brand-card border border-brand-border px-1.5 py-0.5 rounded text-tx-muted">Local</span>}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col bg-brand-card border-4 border-brand-border rounded-[32px] p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-tx-secondary">{picks.length}/{KENO_PICK_COUNT} choisis</span>
              <button onClick={quickPick} disabled={drawing} className="text-xs font-bold px-3 py-1.5 rounded-lg border-2 border-brand-border bg-brand-inner hover:border-tx-base focus:outline-none">
                Auto
              </button>
            </div>
            <div className="grid grid-cols-8 gap-1 p-1">
              {Array.from({ length: KENO_POOL_SIZE }, (_, i) => i + 1).map((n) => {
                const isPicked = picks.includes(n);
                const isDrawn = lastResult?.drawn.includes(n);
                const isMatch = isPicked && isDrawn;
                return (
                  <button
                    key={n}
                    onClick={() => togglePick(n)}
                    disabled={drawing}
                    className={cn(
                      'h-8 rounded-md border-2 text-[10px] font-bold flex items-center justify-center transition-colors focus:outline-none',
                      isMatch ? 'bg-accent-success border-accent-success text-brand-bg' :
                      isDrawn ? 'bg-accent-secondary/30 border-accent-secondary text-tx-base' :
                      isPicked ? 'bg-accent-primary border-accent-primary text-brand-bg' :
                      'bg-brand-inner border-brand-border text-tx-secondary hover:border-tx-base/50'
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 h-10 flex items-center justify-center">
              {lastResult && !drawing && (
                <div className={cn('px-4 py-2 rounded-xl border-2 font-bold text-sm animate-in fade-in duration-200', lastResult.won ? 'border-accent-success text-accent-success bg-accent-success/10' : 'border-accent-secondary text-accent-secondary bg-accent-secondary/10')}>
                  {lastResult.won ? `${lastResult.matches} bons — +${lastResult.payout} ₶` : `${lastResult.matches} bons — perdu`}
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

            <div className="text-xs text-tx-secondary space-y-1">
              {Object.entries(KENO_PAYTABLE).map(([k, m]) => (
                <div key={k} className="flex justify-between border-b border-brand-border pb-1">
                  <span>{k} bons numéros</span>
                  <span className="font-bold text-tx-base">x{m}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleDraw}
              disabled={drawing || !isLoaded || amount < CASINO_MIN_BET || picks.length !== KENO_PICK_COUNT}
              className={cn('h-16 rounded-2xl font-display text-xl font-black tracking-wider border-4 border-brand-border transition-colors shadow-brutal', drawing || picks.length !== KENO_PICK_COUNT ? 'bg-brand-inner text-tx-muted cursor-not-allowed' : 'bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary')}
            >
              {drawing ? 'TIRAGE...' : `MISER ${amount} ₶`}
            </button>

            {gameHistory.length > 0 && (
              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Derniers tirages</span>
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
