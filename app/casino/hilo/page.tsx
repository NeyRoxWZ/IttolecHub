'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Minus, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { drawCard, resolveHilo, getHiloPayout, CASINO_MIN_BET, type HiloDirection } from '@/lib/casino/hilo';

const CARD_LABEL = (n: number) => (n === 1 ? 'A' : n === 11 ? 'J' : n === 12 ? 'Q' : n === 13 ? 'K' : String(n));
const REVEAL_MS = 900;

type HiloResult = GenericBetResult & { currentCard: number; nextCard: number; direction: HiloDirection; push: boolean };

export default function HiloPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { balance, isLoaded, isLocal, maxBet, placeBet, history } = useCasinoWallet();

  const [amount, setAmount] = useState(10);
  const [card, setCard] = useState<number | null>(null);
  const [token, setToken] = useState<string>('');
  const [playing, setPlaying] = useState(false);
  const [lastResult, setLastResult] = useState<HiloResult | null>(null);

  const dealCard = useCallback(async () => {
    if (user) {
      const res = await fetch('/api/casino/hilo/deal');
      const data = await res.json();
      setCard(data.card);
      setToken(data.token);
    } else {
      setCard(drawCard());
      setToken('');
    }
  }, [user]);

  useEffect(() => { dealCard(); }, [dealCard]);

  const clampAmount = (v: number) => Math.max(CASINO_MIN_BET, Math.min(maxBet, Math.floor(v)));

  const higherPayout = card ? getHiloPayout(card, 'higher') : null;
  const lowerPayout = card ? getHiloPayout(card, 'lower') : null;

  const handleGuess = async (direction: HiloDirection) => {
    if (playing || card === null) return;
    const payout = direction === 'higher' ? higherPayout : lowerPayout;
    if (payout === null) { toast.error('Pari impossible sur cette carte.'); return; }
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }
    if (amount > maxBet) { toast.error(`Mise max: ${maxBet} ₶ (50% du solde).`); return; }

    setPlaying(true);
    setLastResult(null);
    vibrate(HAPTIC.MEDIUM);

    const currentCard = card;
    const [result] = await Promise.all([
      placeBet('hilo', amount, { card: currentCard, token, direction }, () => {
        const nextCard = drawCard();
        const r = resolveHilo(currentCard, nextCard, direction);
        return { won: r.won, multiplier: r.multiplier, meta: { currentCard, nextCard, direction, push: r.push } };
      }),
      new Promise((r) => setTimeout(r, REVEAL_MS)),
    ]);

    setPlaying(false);

    if ('error' in result) {
      toast.error(result.error);
      await dealCard();
      return;
    }

    const full: HiloResult = { ...result, currentCard: result.meta.currentCard, nextCard: result.meta.nextCard, direction: result.meta.direction, push: result.meta.push };
    setLastResult(full);

    if (full.push) {
      vibrate(HAPTIC.WARNING);
      toast.info(`Égalité (${CARD_LABEL(full.nextCard)}) — remboursé.`);
    } else if (full.won) {
      vibrate(HAPTIC.SUCCESS);
      toast.success(`${CARD_LABEL(full.nextCard)} ! Gain: +${full.payout} ₶`);
    } else {
      vibrate(HAPTIC.ERROR);
      toast.error(`${CARD_LABEL(full.nextCard)}. Perdu.`);
    }

    setCard(full.nextCard);
    await dealCard();
  };

  const gameHistory = history.filter((h) => h.game_slug === 'hilo').slice(0, 12);

  return (
    <main className="min-h-screen bg-transparent text-tx-base p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/casino')} className="h-12 w-12 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-display text-2xl md:text-3xl font-black">Frenly HiLo</h1>
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
            <div className={cn('w-24 h-32 rounded-2xl border-4 border-brand-border bg-brand-inner flex items-center justify-center font-display font-black text-4xl', playing && 'animate-pulse')}>
              {card !== null ? CARD_LABEL(card) : '?'}
            </div>
            <div className="mt-6 h-10 flex items-center">
              {lastResult && !playing && (
                <div className={cn(
                  'px-4 py-2 rounded-xl border-2 font-bold text-sm animate-in fade-in duration-200',
                  lastResult.push ? 'border-tx-secondary text-tx-secondary bg-brand-inner' :
                  lastResult.won ? 'border-accent-success text-accent-success bg-accent-success/10' :
                  'border-accent-secondary text-accent-secondary bg-accent-secondary/10'
                )}>
                  {lastResult.push ? 'Égalité — remboursé' : lastResult.won ? `Gagné +${lastResult.payout} ₶` : 'Perdu'}
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

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleGuess('higher')}
                disabled={playing || !isLoaded || amount < CASINO_MIN_BET || higherPayout === null}
                className={cn('h-20 rounded-2xl border-4 border-brand-border bg-brand-inner flex flex-col items-center justify-center gap-1 font-bold transition-colors focus:outline-none', (playing || higherPayout === null) ? 'opacity-40 cursor-not-allowed' : 'hover:bg-tx-base hover:text-brand-bg hover:border-tx-base')}
              >
                <ChevronUp className="w-6 h-6" />
                <span className="text-sm">Plus haut</span>
                <span className="text-xs text-tx-secondary">{higherPayout ? `x${higherPayout}` : '—'}</span>
              </button>
              <button
                onClick={() => handleGuess('lower')}
                disabled={playing || !isLoaded || amount < CASINO_MIN_BET || lowerPayout === null}
                className={cn('h-20 rounded-2xl border-4 border-brand-border bg-brand-inner flex flex-col items-center justify-center gap-1 font-bold transition-colors focus:outline-none', (playing || lowerPayout === null) ? 'opacity-40 cursor-not-allowed' : 'hover:bg-tx-base hover:text-brand-bg hover:border-tx-base')}
              >
                <ChevronDown className="w-6 h-6" />
                <span className="text-sm">Plus bas</span>
                <span className="text-xs text-tx-secondary">{lowerPayout ? `x${lowerPayout}` : '—'}</span>
              </button>
            </div>

            <p className="text-xs text-tx-muted">Égalité (même valeur) = mise remboursée.</p>

            {gameHistory.length > 0 && (
              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Dernières parties</span>
                <div className="flex flex-wrap gap-2">
                  {gameHistory.map((h) => (
                    <span key={h.id} className={cn('text-xs font-bold px-2 py-1 rounded-md border-2', h.amount > 0 ? 'border-accent-success text-accent-success' : h.amount === 0 ? 'border-tx-secondary text-tx-secondary' : 'border-accent-secondary text-accent-secondary')}>
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
