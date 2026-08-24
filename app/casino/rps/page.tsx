'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Minus, Plus, Hand as HandIcon, Scroll, Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { houseMove, resolveRps, RPS_PAYOUT, CASINO_MIN_BET, type RpsMove } from '@/lib/casino/rps';

const MOVES: { value: RpsMove; label: string; icon: any }[] = [
  { value: 'pierre', label: 'Pierre', icon: HandIcon },
  { value: 'feuille', label: 'Feuille', icon: Scroll },
  { value: 'ciseaux', label: 'Ciseaux', icon: Scissors },
];

const REVEAL_SUSPENSE_MS = 900;

type RpsResult = GenericBetResult & { outcome: 'win' | 'lose' | 'tie'; house: RpsMove; playerMove: RpsMove };

export default function RpsPage() {
  const router = useRouter();
  const { balance, isLoaded, isLocal, maxBet, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [playing, setPlaying] = useState(false);
  const [lastResult, setLastResult] = useState<RpsResult | null>(null);

  const clampAmount = (v: number) => Math.max(CASINO_MIN_BET, Math.min(maxBet, Math.floor(v)));

  const handlePlay = async (move: RpsMove) => {
    if (playing) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }
    if (amount > maxBet) { toast.error(`Mise max: ${maxBet} ₶ (50% du solde).`); return; }

    setPlaying(true);
    setLastResult(null);
    vibrate(HAPTIC.MEDIUM);

    const [result] = await Promise.all([
      placeBet('rps', amount, { move }, () => {
        const house = houseMove();
        const r = resolveRps(move, house);
        return { won: r.won, multiplier: r.multiplier, meta: { house, playerMove: move, outcome: r.outcome } };
      }),
      new Promise((r) => setTimeout(r, REVEAL_SUSPENSE_MS)), // brief suspense, not a dead wait — feedback (pulsing hand) plays during it
    ]);

    setPlaying(false);

    if ('error' in result) {
      toast.error(result.error);
      return;
    }

    const full: RpsResult = { ...result, outcome: result.meta.outcome, house: result.meta.house, playerMove: result.meta.playerMove };
    setLastResult(full);

    if (full.outcome === 'win') {
      vibrate(HAPTIC.SUCCESS);
      toast.success(`${full.house} battu ! Gain: +${full.payout} ₶`);
    } else if (full.outcome === 'tie') {
      vibrate(HAPTIC.WARNING);
      toast.info('Égalité, mise remboursée.');
    } else {
      vibrate(HAPTIC.ERROR);
      toast.error(`La maison joue ${full.house}. Perdu.`);
    }
  };

  const rpsHistory = history.filter((h) => h.game_slug === 'rps').slice(0, 12);
  const moveIcon = (m: RpsMove) => MOVES.find((x) => x.value === m)?.icon;

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
            <h1 className="font-display text-2xl md:text-3xl font-black">Pierre-Feuille-Ciseaux</h1>
          </div>

          <div className="h-12 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
            <Coins className="h-5 w-5 text-accent-primary" />
            <span className="font-display font-black text-lg tabular-nums">{isLoaded ? balance.toLocaleString('fr-FR') : '...'}</span>
            <span className="text-tx-secondary font-bold">₶</span>
            {isLocal && <span className="ml-1 text-[9px] font-black uppercase bg-brand-card border border-brand-border px-1.5 py-0.5 rounded text-tx-muted">Local</span>}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ARENA */}
          <div className="flex flex-col items-center justify-center bg-brand-card border-4 border-brand-border rounded-[32px] p-6">
            <div className="flex items-center justify-center gap-8">
              <div className="flex flex-col items-center gap-2">
                <div className={cn('w-24 h-24 rounded-2xl border-4 border-brand-border bg-brand-inner flex items-center justify-center', playing && 'animate-pulse')}>
                  {lastResult ? (
                    (() => { const Icon = moveIcon(lastResult.playerMove)!; return <Icon className="w-10 h-10 text-accent-primary" />; })()
                  ) : (
                    <HandIcon className="w-10 h-10 text-tx-muted opacity-40" />
                  )}
                </div>
                <span className="text-xs font-bold text-tx-secondary uppercase tracking-widest">Toi</span>
              </div>

              <span className="font-display text-2xl font-black text-tx-muted">VS</span>

              <div className="flex flex-col items-center gap-2">
                <div className={cn('w-24 h-24 rounded-2xl border-4 border-brand-border bg-brand-inner flex items-center justify-center', playing && 'animate-pulse')}>
                  {lastResult ? (
                    (() => { const Icon = moveIcon(lastResult.house)!; return <Icon className="w-10 h-10 text-accent-secondary" />; })()
                  ) : (
                    <HandIcon className="w-10 h-10 text-tx-muted opacity-40" />
                  )}
                </div>
                <span className="text-xs font-bold text-tx-secondary uppercase tracking-widest">Maison</span>
              </div>
            </div>

            <div className="mt-6 h-10 flex items-center">
              {lastResult && !playing && (
                <div className={cn(
                  'px-4 py-2 rounded-xl border-2 font-bold text-sm animate-in fade-in duration-200',
                  lastResult.outcome === 'win' ? 'border-accent-success text-accent-success bg-accent-success/10' :
                  lastResult.outcome === 'tie' ? 'border-tx-secondary text-tx-secondary bg-brand-inner' :
                  'border-accent-secondary text-accent-secondary bg-accent-secondary/10'
                )}>
                  {lastResult.outcome === 'win' ? `Gagné +${lastResult.payout} ₶` : lastResult.outcome === 'tie' ? 'Égalité — remboursé' : 'Perdu'}
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
              <label className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">
                Choisis (x{RPS_PAYOUT} si victoire, égalité = remboursé)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {MOVES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => handlePlay(value)}
                    disabled={playing || !isLoaded || amount < CASINO_MIN_BET}
                    className={cn(
                      'h-24 rounded-2xl border-4 border-brand-border bg-brand-inner flex flex-col items-center justify-center gap-2 font-bold text-sm transition-colors focus:outline-none',
                      playing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                    )}
                  >
                    <Icon className="w-8 h-8" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {rpsHistory.length > 0 && (
              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Dernières parties</span>
                <div className="flex flex-wrap gap-2">
                  {rpsHistory.map((h) => (
                    <span
                      key={h.id}
                      className={cn(
                        'text-xs font-bold px-2 py-1 rounded-md border-2',
                        h.amount > 0 ? 'border-accent-success text-accent-success' : h.amount === 0 ? 'border-tx-secondary text-tx-secondary' : 'border-accent-secondary text-accent-secondary'
                      )}
                    >
                      {h.amount > 0 ? '+' : ''}{h.amount}
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
