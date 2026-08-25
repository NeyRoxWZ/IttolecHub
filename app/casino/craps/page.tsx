'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Minus, Plus, Dice5 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { playPassLine, resolveCraps, CRAPS_PAYOUT, CASINO_MIN_BET, type DiceRoll } from '@/lib/casino/craps';

type CrapsResult = GenericBetResult & { rolls: DiceRoll[]; point: number | null };

export default function CrapsPage() {
  const router = useRouter();
  const { balance, isLoaded, isLocal, maxBet, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [rolling, setRolling] = useState(false);
  const [lastResult, setLastResult] = useState<CrapsResult | null>(null);

  const clampAmount = (v: number) => Math.max(CASINO_MIN_BET, Math.min(maxBet, Math.floor(v)));

  const handleRoll = async () => {
    if (rolling) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }
    if (amount > maxBet) { toast.error(`Mise max: ${maxBet} ₶ (50% du solde).`); return; }

    setRolling(true);
    setLastResult(null);
    vibrate(HAPTIC.MEDIUM);

    const result = await placeBet('craps', amount, {}, () => {
      const { won, rolls, point } = playPassLine();
      const r = resolveCraps(won);
      return { ...r, meta: { rolls, point } };
    });

    if ('error' in result) {
      toast.error(result.error);
      setRolling(false);
      return;
    }

    const rolls: DiceRoll[] = result.meta.rolls;
    // Replay the (already-determined) rolls one by one for a bit of drama.
    const perRoll = Math.min(500, Math.max(250, 2200 / rolls.length));
    rolls.forEach((_, i) => {
      setTimeout(() => setLastResult((prev) => ({ ...result, rolls: rolls.slice(0, i + 1), point: result.meta.point } as CrapsResult)), i * perRoll);
    });

    setTimeout(() => {
      setRolling(false);
      if (result.won) {
        vibrate(HAPTIC.SUCCESS);
        toast.success(`Ça passe ! Gain: +${result.payout} ₶`);
      } else {
        vibrate(HAPTIC.ERROR);
        toast.error('Ça casse. Perdu.');
      }
    }, rolls.length * perRoll + 200);
  };

  const gameHistory = history.filter((h) => h.game_slug === 'craps').slice(0, 12);
  const displayedRolls = lastResult?.rolls || [];

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
            <h1 className="font-display text-2xl md:text-3xl font-black">Frenly Craps Express</h1>
          </div>

          <div className="h-12 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
            <Coins className="h-5 w-5 text-accent-primary" />
            <span className="font-display font-black text-lg tabular-nums">{isLoaded ? balance.toLocaleString('fr-FR') : '...'}</span>
            <span className="text-tx-secondary font-bold">₶</span>
            {isLocal && <span className="ml-1 text-[9px] font-black uppercase bg-brand-card border border-brand-border px-1.5 py-0.5 rounded text-tx-muted">Local</span>}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* TABLE */}
          <div className="flex flex-col items-center justify-center bg-brand-card border-4 border-brand-border rounded-[32px] p-6">
            <div className="flex items-center gap-3">
              {displayedRolls.length === 0 ? (
                <>
                  <div className={cn('w-16 h-16 rounded-xl border-4 border-brand-border bg-brand-inner flex items-center justify-center', rolling && 'animate-bounce')}>
                    <Dice5 className="w-8 h-8 text-tx-muted opacity-40" />
                  </div>
                  <div className={cn('w-16 h-16 rounded-xl border-4 border-brand-border bg-brand-inner flex items-center justify-center', rolling && 'animate-bounce')} style={{ animationDelay: '0.1s' }}>
                    <Dice5 className="w-8 h-8 text-tx-muted opacity-40" />
                  </div>
                </>
              ) : (
                (() => {
                  const last = displayedRolls[displayedRolls.length - 1];
                  return (
                    <>
                      <div className="w-16 h-16 rounded-xl border-4 border-brand-border bg-brand-inner flex items-center justify-center font-display font-black text-2xl text-accent-primary animate-in zoom-in duration-200">
                        {last.d1}
                      </div>
                      <div className="w-16 h-16 rounded-xl border-4 border-brand-border bg-brand-inner flex items-center justify-center font-display font-black text-2xl text-accent-primary animate-in zoom-in duration-200">
                        {last.d2}
                      </div>
                    </>
                  );
                })()
              )}
            </div>

            {displayedRolls.length > 0 && (
              <p className="mt-4 text-xs text-tx-secondary font-bold uppercase tracking-widest">
                {displayedRolls.map((r) => r.sum).join(' → ')}
                {lastResult?.point && ` (point: ${lastResult.point})`}
              </p>
            )}

            <div className="mt-6 h-10 flex items-center">
              {lastResult && !rolling && (
                <div className={cn('px-4 py-2 rounded-xl border-2 font-bold text-sm animate-in fade-in duration-200', lastResult.won ? 'border-accent-success text-accent-success bg-accent-success/10' : 'border-accent-secondary text-accent-secondary bg-accent-secondary/10')}>
                  {lastResult.won ? `Ça passe ! +${lastResult.payout} ₶` : 'Ça casse — perdu'}
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

            <p className="text-sm text-tx-secondary">
              7 ou 11 au 1er lancer = gagné direct. 2, 3 ou 12 = perdu direct. Sinon le nombre devient le point,
              on relance jusqu&apos;à le retrouver (gagné) ou tomber sur 7 (perdu).
            </p>

            <button
              onClick={handleRoll}
              disabled={rolling || !isLoaded || amount < CASINO_MIN_BET}
              className={cn(
                'h-16 rounded-2xl font-display text-xl font-black tracking-wider border-4 border-brand-border transition-colors shadow-brutal',
                rolling ? 'bg-brand-inner text-tx-muted cursor-not-allowed' : 'bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary'
              )}
            >
              {rolling ? 'ÇA LANCE...' : `MISER ${amount} ₶ — ÇA PASSE (x${CRAPS_PAYOUT})`}
            </button>

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
