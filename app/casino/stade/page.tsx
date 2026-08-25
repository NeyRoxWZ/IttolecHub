'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Minus, Plus, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { drawStadeOutcome, resolveStade, STADE_PAYOUTS, CASINO_MIN_BET, type StadeBet, type StadeOutcome } from '@/lib/casino/stade';

const REVEAL_SUSPENSE_MS = 1000;

const BETS: { value: StadeBet; label: string }[] = [
  { value: 'home', label: 'Domicile' },
  { value: 'away', label: 'Extérieur' },
  { value: 'draw', label: 'Match nul' },
];

const OUTCOME_LABEL: Record<StadeOutcome, string> = { home: 'Domicile', away: 'Extérieur', draw: 'Match nul' };

type StadeResult = GenericBetResult & { outcome: StadeOutcome; bet: StadeBet };

export default function StadePage() {
  const router = useRouter();
  const { balance, isLoaded, isLocal, maxBet, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [playing, setPlaying] = useState(false);
  const [lastResult, setLastResult] = useState<StadeResult | null>(null);

  const clampAmount = (v: number) => Math.max(CASINO_MIN_BET, Math.min(maxBet, Math.floor(v)));

  const handlePlay = async (bet: StadeBet) => {
    if (playing) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }
    if (amount > maxBet) { toast.error(`Mise max: ${maxBet} ₶ (50% du solde).`); return; }

    setPlaying(true);
    setLastResult(null);
    vibrate(HAPTIC.MEDIUM);

    const [result] = await Promise.all([
      placeBet('stade', amount, { bet }, () => {
        const outcome = drawStadeOutcome();
        const r = resolveStade(outcome, bet);
        return { ...r, meta: { outcome, bet } };
      }),
      new Promise((r) => setTimeout(r, REVEAL_SUSPENSE_MS)),
    ]);

    setPlaying(false);

    if ('error' in result) {
      toast.error(result.error);
      return;
    }

    const full: StadeResult = { ...result, outcome: result.meta.outcome, bet: result.meta.bet };
    setLastResult(full);

    if (full.won) {
      vibrate(HAPTIC.SUCCESS);
      toast.success(`${OUTCOME_LABEL[full.outcome]} ! Gain: +${full.payout} ₶`);
    } else {
      vibrate(HAPTIC.ERROR);
      toast.error(`${OUTCOME_LABEL[full.outcome]}. Perdu.`);
    }
  };

  const gameHistory = history.filter((h) => h.game_slug === 'stade').slice(0, 12);

  return (
    <main className="min-h-screen bg-transparent text-tx-base p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/casino')}
              className="h-12 w-12 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-display text-2xl md:text-3xl font-black">Frenly Stade</h1>
          </div>

          <div className="h-12 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
            <Coins className="h-5 w-5 text-accent-primary" />
            <span className="font-display font-black text-lg tabular-nums">{isLoaded ? balance.toLocaleString('fr-FR') : '...'}</span>
            <span className="text-tx-secondary font-bold">₶</span>
            {isLocal && <span className="ml-1 text-[9px] font-black uppercase bg-brand-card border border-brand-border px-1.5 py-0.5 rounded text-tx-muted">Local</span>}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* SCOREBOARD */}
          <div className="flex flex-col items-center justify-center bg-brand-card border-4 border-brand-border rounded-[32px] p-6">
            <div className={cn('w-full max-w-xs h-28 rounded-2xl border-4 border-brand-border bg-brand-inner flex items-center justify-center', playing && 'animate-pulse')}>
              {lastResult ? (
                <span className="font-display font-black text-2xl text-accent-primary">{OUTCOME_LABEL[lastResult.outcome]}</span>
              ) : (
                <LayoutGrid className="w-10 h-10 text-tx-muted opacity-40" />
              )}
            </div>

            <div className="mt-6 h-10 flex items-center">
              {lastResult && !playing && (
                <div className={cn('px-4 py-2 rounded-xl border-2 font-bold text-sm animate-in fade-in duration-200', lastResult.won ? 'border-accent-success text-accent-success bg-accent-success/10' : 'border-accent-secondary text-accent-secondary bg-accent-secondary/10')}>
                  {lastResult.won ? `Gagné +${lastResult.payout} ₶` : 'Perdu'}
                </div>
              )}
            </div>
          </div>

          {/* BETTING */}
          <div className="flex flex-col gap-6 bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal">
            <div>
              <label className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">
                Mise (max {maxBet} ₶)
              </label>
              <div className="flex items-center gap-2">
                <button onClick={() => setAmount((a) => clampAmount(a - 5))} className="h-11 w-11 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base">
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(clampAmount(Number(e.target.value) || 0))}
                  className="flex-1 h-11 bg-brand-inner border-2 border-brand-border rounded-lg px-3 text-center font-display font-black"
                />
                <button onClick={() => setAmount((a) => clampAmount(a + 5))} className="h-11 w-11 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base">
                  <Plus className="h-4 w-4" />
                </button>
                <button onClick={() => setAmount(maxBet)} className="h-11 px-3 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner text-xs font-bold hover:border-tx-base">
                  MAX
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Ton pari</label>
              <div className="grid grid-cols-1 gap-2">
                {BETS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => handlePlay(value)}
                    disabled={playing || !isLoaded || amount < CASINO_MIN_BET}
                    className={cn(
                      'h-14 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-between px-5 font-bold transition-colors focus:outline-none',
                      playing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                    )}
                  >
                    <span>{label}</span>
                    <span className="text-sm text-tx-secondary">x{STADE_PAYOUTS[value]}</span>
                  </button>
                ))}
              </div>
            </div>

            {gameHistory.length > 0 && (
              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Dernières parties</span>
                <div className="flex flex-wrap gap-2">
                  {gameHistory.map((h) => (
                    <span
                      key={h.id}
                      className={cn(
                        'text-xs font-bold px-2 py-1 rounded-md border-2',
                        h.amount >= 0 ? 'border-accent-success text-accent-success' : 'border-accent-secondary text-accent-secondary'
                      )}
                    >
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
