'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useCasinoWallet, type GenericBetResult } from '@/hooks/useCasinoWallet';
import { flipCoin, resolveCoinflip, COINFLIP_PAYOUT, CASINO_MIN_BET, type CoinSide } from '@/lib/casino/coinflip';

const PRESPIN_SPEED = 900; // deg/sec while waiting on the result
const SETTLE_DURATION_MS = 1400;
const SETTLE_EXTRA_TURNS = 4;

export default function CoinflipPage() {
  const router = useRouter();
  const { balance, isLoaded, isLocal, maxBet, placeBet, history } = useCasinoWallet();

  const [choice, setChoice] = useState<CoinSide>('pile');
  const [amount, setAmount] = useState(10);
  const [flipping, setFlipping] = useState(false);
  const [lastResult, setLastResult] = useState<(GenericBetResult & { landed: CoinSide }) | null>(null);

  const coinRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const clampAmount = (v: number) => Math.max(CASINO_MIN_BET, Math.min(maxBet, Math.floor(v)));

  const startPreSpin = () => {
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      angleRef.current += PRESPIN_SPEED * dt;
      if (coinRef.current) {
        coinRef.current.style.transition = 'none';
        coinRef.current.style.transform = `rotateY(${angleRef.current}deg)`;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const settleOnFace = (landed: CoinSide) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const desiredMod = landed === 'pile' ? 0 : 180;
    const currentMod = ((angleRef.current % 360) + 360) % 360;
    let delta = desiredMod - currentMod;
    if (delta < 0) delta += 360;
    const target = angleRef.current + delta + SETTLE_EXTRA_TURNS * 360;
    angleRef.current = target;
    if (coinRef.current) {
      coinRef.current.style.transition = `transform ${SETTLE_DURATION_MS}ms cubic-bezier(0.15, 0.65, 0.1, 1)`;
      coinRef.current.style.transform = `rotateY(${target}deg)`;
    }
  };

  const handleFlip = async () => {
    if (flipping) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }
    if (amount > maxBet) { toast.error(`Mise max: ${maxBet} ₶ (50% du solde).`); return; }

    setFlipping(true);
    setLastResult(null);
    vibrate(HAPTIC.MEDIUM);
    startPreSpin();

    const result = await placeBet('coinflip', amount, { choice }, () => {
      const landed = flipCoin();
      const r = resolveCoinflip(landed, choice);
      return { ...r, meta: { landed, choice } };
    });

    if ('error' in result) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      toast.error(result.error);
      setFlipping(false);
      return;
    }

    const landed: CoinSide = result.meta.landed;
    settleOnFace(landed);

    setTimeout(() => {
      setLastResult({ ...result, landed });
      setFlipping(false);
      if (result.won) {
        vibrate(HAPTIC.SUCCESS);
        toast.success(`${landed === 'pile' ? 'Pile' : 'Face'} ! Gain: +${result.payout} ₶`);
      } else {
        vibrate(HAPTIC.ERROR);
        toast.error(`${landed === 'pile' ? 'Pile' : 'Face'}. Perdu.`);
      }
    }, SETTLE_DURATION_MS);
  };

  const coinHistory = history.filter((h) => h.game_slug === 'coinflip').slice(0, 12);

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
            <h1 className="font-display text-2xl md:text-3xl font-black">Frenly Coinflip</h1>
          </div>

          <div className="h-12 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
            <Coins className="h-5 w-5 text-accent-primary" />
            <span className="font-display font-black text-lg tabular-nums">{isLoaded ? balance.toLocaleString('fr-FR') : '...'}</span>
            <span className="text-tx-secondary font-bold">₶</span>
            {isLocal && <span className="ml-1 text-[9px] font-black uppercase bg-brand-card border border-brand-border px-1.5 py-0.5 rounded text-tx-muted">Local</span>}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* COIN */}
          <div className="flex flex-col items-center justify-center bg-brand-card border-4 border-brand-border rounded-[32px] p-6">
            <div className="relative w-48 h-48" style={{ perspective: '800px' }}>
              <div
                ref={coinRef}
                className="relative w-full h-full"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div
                  className="absolute inset-0 rounded-full border-4 border-brand-border bg-accent-primary flex items-center justify-center font-display font-black text-3xl text-brand-bg"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  PILE
                </div>
                <div
                  className="absolute inset-0 rounded-full border-4 border-brand-border bg-tx-base flex items-center justify-center font-display font-black text-3xl text-brand-bg"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                >
                  FACE
                </div>
              </div>
            </div>

            <div className="mt-6 h-10 flex items-center">
              {lastResult && !flipping && (
                <div className={cn('px-4 py-2 rounded-xl border-2 font-bold text-sm animate-in fade-in duration-200', lastResult.won ? 'border-accent-success text-accent-success bg-accent-success/10' : 'border-accent-secondary text-accent-secondary bg-accent-secondary/10')}>
                  {lastResult.won ? `Gagné +${lastResult.payout} ₶` : 'Perdu'}
                </div>
              )}
            </div>
          </div>

          {/* BETTING */}
          <div className="flex flex-col gap-6 bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal">
            <div>
              <label className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Ton choix</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setChoice('pile'); vibrate(HAPTIC.SOFT); }}
                  className={cn('h-14 rounded-lg font-display font-black border-2 transition-all focus:outline-none', choice === 'pile' ? 'bg-accent-primary text-brand-bg border-accent-primary' : 'bg-brand-inner text-tx-secondary border-brand-border')}
                >
                  PILE
                </button>
                <button
                  onClick={() => { setChoice('face'); vibrate(HAPTIC.SOFT); }}
                  className={cn('h-14 rounded-lg font-display font-black border-2 transition-all focus:outline-none', choice === 'face' ? 'bg-tx-base text-brand-bg border-tx-base' : 'bg-brand-inner text-tx-secondary border-brand-border')}
                >
                  FACE
                </button>
              </div>
            </div>

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

            <button
              onClick={handleFlip}
              disabled={flipping || !isLoaded || amount < CASINO_MIN_BET}
              className={cn(
                'h-16 rounded-2xl font-display text-xl font-black tracking-wider border-4 border-brand-border transition-colors shadow-brutal',
                flipping ? 'bg-brand-inner text-tx-muted cursor-not-allowed' : 'bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary'
              )}
            >
              {flipping ? 'ÇA TOURNE...' : `MISER ${amount} ₶ (x${COINFLIP_PAYOUT})`}
            </button>

            {coinHistory.length > 0 && (
              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Derniers flips</span>
                <div className="flex flex-wrap gap-2">
                  {coinHistory.map((h) => (
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
