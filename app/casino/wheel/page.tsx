'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Info, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useCasinoWallet, type WheelSpinResult } from '@/hooks/useCasinoWallet';
import {
  WHEEL_ORDER,
  WHEEL_PAYOUTS,
  getPocketColor,
  CASINO_MIN_BET,
  type WheelBet,
  type WheelBetType,
} from '@/lib/casino/wheel';

const SEGMENT_ANGLE = 360 / WHEEL_ORDER.length;
const PRESPIN_SPEED = 640; // deg/sec while waiting on the result
const SETTLE_DURATION_MS = 2200;
const SETTLE_EXTRA_SPINS = 3;

const COLOR_HEX: Record<'red' | 'black' | 'green', string> = {
  red: '#FF2A55',
  black: '#0A0A0F',
  green: '#0F9D58',
};

export default function FrenlyWheelPage() {
  const router = useRouter();
  const { balance, isLoaded, isLocal, maxBet, spinWheelBet, history } = useCasinoWallet();

  const [betType, setBetType] = useState<WheelBetType>('color');
  const [betValue, setBetValue] = useState<any>('red');
  const [amount, setAmount] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<WheelSpinResult | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const wheelRef = useRef<HTMLDivElement>(null);
  const currentAngleRef = useRef(0);
  const preSpinRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => { if (preSpinRafRef.current) cancelAnimationFrame(preSpinRafRef.current); };
  }, []);

  const wheelGradient = useMemo(() => {
    const stops: string[] = [];
    WHEEL_ORDER.forEach((num, i) => {
      const color = COLOR_HEX[getPocketColor(num)];
      const start = (i * SEGMENT_ANGLE).toFixed(3);
      const end = ((i + 1) * SEGMENT_ANGLE).toFixed(3);
      stops.push(`${color} ${start}deg ${end}deg`);
    });
    return `conic-gradient(${stops.join(', ')})`;
  }, []);

  // Thin dividers between pockets so segments read as distinct slices
  // instead of blurring into one dark mass.
  const separatorGradient = useMemo(() => {
    const stops: string[] = [];
    const lineWidth = 0.45;
    for (let i = 1; i < WHEEL_ORDER.length; i++) {
      const boundary = i * SEGMENT_ANGLE;
      stops.push(
        `transparent ${(boundary - lineWidth).toFixed(2)}deg`,
        `rgba(0,0,0,0.6) ${(boundary - lineWidth).toFixed(2)}deg`,
        `rgba(0,0,0,0.6) ${(boundary + lineWidth).toFixed(2)}deg`,
        `transparent ${(boundary + lineWidth).toFixed(2)}deg`
      );
    }
    return `conic-gradient(${stops.join(', ')})`;
  }, []);

  const clampAmount = (v: number) => Math.max(CASINO_MIN_BET, Math.min(maxBet, Math.floor(v)));

  const startPreSpin = () => {
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      currentAngleRef.current += PRESPIN_SPEED * dt;
      if (wheelRef.current) {
        wheelRef.current.style.transition = 'none';
        wheelRef.current.style.transform = `rotate(${currentAngleRef.current}deg)`;
      }
      preSpinRafRef.current = requestAnimationFrame(loop);
    };
    preSpinRafRef.current = requestAnimationFrame(loop);
  };

  const settleOnNumber = (landedNumber: number) => {
    if (preSpinRafRef.current) cancelAnimationFrame(preSpinRafRef.current);

    const index = WHEEL_ORDER.indexOf(landedNumber);
    const targetSegmentCenter = index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
    const desiredMod = (360 - targetSegmentCenter + 360) % 360;
    const currentMod = ((currentAngleRef.current % 360) + 360) % 360;
    let delta = desiredMod - currentMod;
    if (delta < 0) delta += 360;

    const target = currentAngleRef.current + delta + SETTLE_EXTRA_SPINS * 360;
    currentAngleRef.current = target;

    if (wheelRef.current) {
      wheelRef.current.style.transition = `transform ${SETTLE_DURATION_MS}ms cubic-bezier(0.12, 0.67, 0.1, 0.99)`;
      wheelRef.current.style.transform = `rotate(${target}deg)`;
    }
  };

  const handleSpin = async () => {
    if (spinning) return;
    if (amount > balance) { toast.error('Solde insuffisant.'); return; }
    if (amount > maxBet) { toast.error(`Mise max: ${maxBet} ₶ (50% du solde).`); return; }

    setSpinning(true);
    setLastResult(null);
    vibrate(HAPTIC.MEDIUM);
    startPreSpin();

    const bet: WheelBet = { type: betType, value: betValue };
    const result = await spinWheelBet(bet, amount);

    if ('error' in result) {
      if (preSpinRafRef.current) cancelAnimationFrame(preSpinRafRef.current);
      toast.error(result.error);
      setSpinning(false);
      return;
    }

    settleOnNumber(result.landedNumber);

    setTimeout(() => {
      setLastResult(result);
      setSpinning(false);
      if (result.won) {
        vibrate(HAPTIC.SUCCESS);
        toast.success(`Numéro ${result.landedNumber} ! Gain: +${result.payout} ₶`);
      } else {
        vibrate(HAPTIC.ERROR);
        toast.error(`Numéro ${result.landedNumber}. Perdu.`);
      }
    }, SETTLE_DURATION_MS);
  };

  const wheelHistory = history.filter((h) => h.game_slug === 'wheel').slice(0, 12);

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
            <h1 className="font-display text-2xl md:text-3xl font-black">Frenly Wheel</h1>
            <button
              onClick={() => setShowInfo(true)}
              className="h-10 w-10 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors"
              title="Probabilités & RTP"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          <div className="h-12 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
            <Coins className="h-5 w-5 text-accent-primary" />
            <span className="font-display font-black text-lg tabular-nums">{isLoaded ? balance.toLocaleString('fr-FR') : '...'}</span>
            <span className="text-tx-secondary font-bold">₶</span>
            {isLocal && <span className="ml-1 text-[9px] font-black uppercase bg-brand-card border border-brand-border px-1.5 py-0.5 rounded text-tx-muted">Local</span>}
          </div>
        </header>

        {showInfo && (
          <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowInfo(false)}>
            <div className="w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-display text-xl font-black mb-4">Probabilités</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-brand-border pb-2">
                  <span className="text-tx-secondary">Couleur (rouge/noir)</span>
                  <span className="font-bold">18/37 · paie x2 · RTP 97.3%</span>
                </div>
                <div className="flex justify-between border-b border-brand-border pb-2">
                  <span className="text-tx-secondary">Douzaine</span>
                  <span className="font-bold">12/37 · paie x3 · RTP 97.3%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-tx-secondary">Numéro précis</span>
                  <span className="font-bold">1/37 · paie x36 · RTP 97.3%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* WHEEL */}
          <div className="flex flex-col items-center justify-center bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal">
            <div className="relative w-64 h-64 sm:w-80 sm:h-80">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[16px] border-t-accent-primary drop-shadow-md" />

              <div
                ref={wheelRef}
                className="relative w-full h-full rounded-full border-4 border-brand-border"
                style={{
                  background: wheelGradient,
                  boxShadow: '0 0 0 6px rgba(0,0,0,0.35), 0 18px 40px -12px rgba(0,0,0,0.75)',
                }}
              >
                {/* separators */}
                <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: separatorGradient }} />

                {/* numbers, radial like a real wheel */}
                {WHEEL_ORDER.map((num, i) => {
                  const angle = i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
                  return (
                    <div key={num} className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
                      <span
                        className="absolute left-1/2 top-1.5 sm:top-2 -translate-x-1/2 text-[9px] sm:text-[11px] font-bold text-white select-none"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
                      >
                        {num}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="w-16 h-16 rounded-full bg-brand-card border-4 border-brand-border shadow-brutal flex items-center justify-center font-display font-black text-lg">
                  {lastResult ? lastResult.landedNumber : '?'}
                </div>
              </div>
            </div>

            {/* Fixed-height slot so the badge appearing doesn't re-center (and visibly shift) the wheel above it */}
            <div className="mt-6 h-10 flex items-center">
              {lastResult && !spinning && (
                <div className={cn('px-4 py-2 rounded-xl border-2 font-bold text-sm animate-in fade-in duration-200', lastResult.won ? 'border-accent-success text-accent-success bg-accent-success/10' : 'border-accent-secondary text-accent-secondary bg-accent-secondary/10')}>
                  {lastResult.won ? `Gagné +${lastResult.payout} ₶` : 'Perdu'}
                </div>
              )}
            </div>
          </div>

          {/* BETTING */}
          <div className="flex flex-col gap-6 bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal">
            <div>
              <label className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Type de mise</label>
              <div className="grid grid-cols-3 gap-2">
                {(['color', 'dozen', 'number'] as WheelBetType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setBetType(t);
                      setBetValue(t === 'color' ? 'red' : t === 'dozen' ? 1 : 0);
                      vibrate(HAPTIC.SOFT);
                    }}
                    className={cn(
                      'h-11 rounded-lg font-bold text-sm border-2 transition-colors',
                      betType === t ? 'bg-brand-inner text-tx-base border-accent-primary' : 'bg-transparent text-tx-secondary border-brand-border hover:border-tx-base/50'
                    )}
                  >
                    {t === 'color' ? 'Couleur' : t === 'dozen' ? 'Douzaine' : 'Numéro'}
                  </button>
                ))}
              </div>
            </div>

            {betType === 'color' && (
              <div className="grid grid-cols-2 gap-2">
                {(['red', 'black'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => { setBetValue(c); vibrate(HAPTIC.SOFT); }}
                    className={cn('h-14 rounded-lg font-display font-black border-2 transition-all', betValue === c && 'ring-2 ring-accent-primary')}
                    style={{ backgroundColor: COLOR_HEX[c], color: '#fff', borderColor: '#000' }}
                  >
                    {c === 'red' ? 'ROUGE' : 'NOIR'}
                  </button>
                ))}
              </div>
            )}

            {betType === 'dozen' && (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((d) => (
                  <button
                    key={d}
                    onClick={() => { setBetValue(d); vibrate(HAPTIC.SOFT); }}
                    className={cn('h-14 rounded-lg font-bold text-sm border-2', betValue === d ? 'bg-brand-inner border-accent-primary' : 'bg-transparent border-brand-border text-tx-secondary')}
                  >
                    {d === 1 ? '1-12' : d === 2 ? '13-24' : '25-36'}
                  </button>
                ))}
              </div>
            )}

            {betType === 'number' && (
              <div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto custom-scrollbar p-1">
                {Array.from({ length: 37 }, (_, n) => n).map((n) => (
                  <button
                    key={n}
                    onClick={() => { setBetValue(n); vibrate(HAPTIC.SOFT); }}
                    className={cn(
                      'h-9 rounded-md font-bold text-xs border-2 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50',
                      betValue === n && 'ring-2 ring-accent-primary'
                    )}
                    style={{ backgroundColor: COLOR_HEX[getPocketColor(n)], color: '#fff', borderColor: '#000' }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}

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
              onClick={handleSpin}
              disabled={spinning || !isLoaded || amount < CASINO_MIN_BET}
              className={cn(
                'h-16 rounded-2xl font-display text-xl font-black tracking-wider border-4 border-brand-border transition-colors shadow-brutal',
                spinning ? 'bg-brand-inner text-tx-muted cursor-not-allowed' : 'bg-accent-primary text-brand-bg hover:bg-brand-inner hover:text-accent-primary'
              )}
            >
              {spinning ? 'ÇA TOURNE...' : `MISER ${amount} ₶ (x${WHEEL_PAYOUTS[betType]})`}
            </button>

            {wheelHistory.length > 0 && (
              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-tx-secondary mb-2 block">Derniers spins</span>
                <div className="flex flex-wrap gap-2">
                  {wheelHistory.map((h) => (
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
