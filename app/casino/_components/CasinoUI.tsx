'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Minus, Plus, HelpCircle, X, Volume2, VolumeX, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx, isMuted, setMuted } from '@/lib/casino/sfx';
import { CASINO_MIN_BET } from '@/lib/casino/core';

/* ------------------------------------------------------------------ */
/* Animated number                                                      */
/* ------------------------------------------------------------------ */

export function CountUp({ value, className, duration = 550 }: { value: number; className?: string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return <span className={cn('tabular-nums', className)}>{display.toLocaleString('fr-FR')}</span>;
}

/* ------------------------------------------------------------------ */
/* Rules modal — every game gets one                                    */
/* ------------------------------------------------------------------ */

export interface RulesSpec {
  howTo: string[];
  payouts?: { label: string; value: string }[];
  rtp: string;
}

export function RulesModal({ title, rules, onClose }: { title: string; rules: RulesSpec; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <h2 className="font-display text-xl font-black">Comment jouer — {title}</h2>
          <button onClick={onClose} className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        <ol className="space-y-2.5 mb-5">
          {rules.howTo.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="shrink-0 w-6 h-6 rounded-full bg-accent-primary text-brand-bg font-black text-xs flex items-center justify-center">{i + 1}</span>
              <span className="text-tx-secondary leading-relaxed pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        {rules.payouts && rules.payouts.length > 0 && (
          <>
            <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2">Gains</div>
            <div className="space-y-1 mb-5">
              {rules.payouts.map((p) => (
                <div key={p.label} className="flex justify-between text-sm border-b border-brand-border/60 pb-1">
                  <span className="text-tx-secondary">{p.label}</span>
                  <span className="font-bold">{p.value}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="text-xs text-tx-muted">
          Redistribution moyenne : <span className="font-bold text-tx-secondary">{rules.rtp}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bet controls — one implementation for all 20 games                   */
/* ------------------------------------------------------------------ */

export function BetControls({
  amount, setAmount, maxBet, disabled, step = 5,
}: {
  amount: number; setAmount: (v: number) => void; maxBet: number; disabled?: boolean; step?: number;
}) {
  const clamp = (v: number) => Math.max(CASINO_MIN_BET, Math.min(maxBet, Math.floor(v || 0)));
  const bump = (delta: number) => { sfx.click(); vibrate(HAPTIC.SOFT); setAmount(clamp(amount + delta)); };
  const setTo = (v: number) => { sfx.click(); vibrate(HAPTIC.SOFT); setAmount(clamp(v)); };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[10px] font-black tracking-widest uppercase text-tx-muted">Ta mise</label>
        <span className="text-[10px] font-bold text-tx-muted">max {maxBet.toLocaleString('fr-FR')} ₶</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => bump(-step)} disabled={disabled} className="h-12 w-12 shrink-0 rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base disabled:opacity-40 focus:outline-none active:scale-95 transition-transform">
          <Minus className="h-4 w-4" />
        </button>
        <div className="flex-1 relative">
          <input
            type="number"
            value={amount}
            disabled={disabled}
            onChange={(e) => setAmount(clamp(Number(e.target.value)))}
            className="w-full h-12 bg-brand-inner border-2 border-brand-border rounded-xl pl-3 pr-7 text-center font-display font-black text-lg focus:outline-none focus:border-accent-primary disabled:opacity-40"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tx-muted font-bold pointer-events-none">₶</span>
        </div>
        <button onClick={() => bump(step)} disabled={disabled} className="h-12 w-12 shrink-0 rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base disabled:opacity-40 focus:outline-none active:scale-95 transition-transform">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-2">
        {[
          { label: '½', value: Math.floor(amount / 2) },
          { label: '×2', value: amount * 2 },
          { label: '25%', value: Math.floor(maxBet / 2) },
          { label: 'MAX', value: maxBet },
        ].map((q) => (
          <button
            key={q.label}
            onClick={() => setTo(q.value)}
            disabled={disabled}
            className="h-9 rounded-lg border-2 border-brand-border bg-brand-inner text-xs font-bold hover:border-accent-primary disabled:opacity-40 focus:outline-none active:scale-95 transition-transform"
          >
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Primary action button                                                */
/* ------------------------------------------------------------------ */

export function PlayButton({
  onClick, disabled, loading, children, variant = 'primary', className,
}: {
  onClick: () => void; disabled?: boolean; loading?: boolean; children: ReactNode;
  variant?: 'primary' | 'success' | 'danger'; className?: string;
}) {
  const palette = {
    primary: 'bg-accent-primary text-brand-bg hover:brightness-110',
    success: 'bg-accent-success text-brand-bg hover:brightness-110',
    danger: 'bg-accent-secondary text-white hover:brightness-110',
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'h-16 w-full rounded-2xl font-display text-lg font-black tracking-wider border-4 border-brand-border shadow-brutal',
        'transition-all active:translate-y-1 active:shadow-none focus:outline-none',
        disabled || loading ? 'bg-brand-inner text-tx-muted cursor-not-allowed shadow-none' : palette,
        className
      )}
    >
      {loading ? '···' : children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Result banner — fixed slot so the stage never jumps                  */
/* ------------------------------------------------------------------ */

export function ResultBanner({ state, children }: { state: 'idle' | 'win' | 'lose' | 'push'; children?: ReactNode }) {
  return (
    <div className="h-12 flex items-center justify-center">
      {state !== 'idle' && (
        <div
          className={cn(
            'px-5 py-2.5 rounded-xl border-2 font-display font-black text-sm animate-in zoom-in-95 fade-in duration-200',
            state === 'win' && 'border-accent-success text-accent-success bg-accent-success/15',
            state === 'lose' && 'border-accent-secondary text-accent-secondary bg-accent-secondary/15',
            state === 'push' && 'border-tx-secondary text-tx-secondary bg-brand-inner'
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Playing card                                                         */
/* ------------------------------------------------------------------ */

const SUITS = ['♠', '♥', '♦', '♣'];

export function rankLabel(rank: number): string {
  return rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank);
}

/**
 * The game logic uses suit-less ranks (infinite-deck model), so the suit here
 * is purely decorative — derived from the card's slot so it stays stable
 * across re-renders instead of flickering.
 */
export function PlayingCard({
  rank, hidden, index = 0, size = 'md', highlight,
}: {
  rank?: number; hidden?: boolean; index?: number; size?: 'sm' | 'md' | 'lg'; highlight?: boolean;
}) {
  const dims = { sm: 'w-10 h-14 text-base', md: 'w-14 h-20 text-xl', lg: 'w-20 h-28 text-3xl' }[size];
  const suit = SUITS[(index * 3 + (rank ?? 0)) % 4];
  const red = suit === '♥' || suit === '♦';

  if (hidden || rank === undefined) {
    return (
      <div className={cn(dims, 'rounded-lg border-2 border-brand-border shrink-0 flex items-center justify-center animate-in fade-in duration-200')}
        style={{ background: 'repeating-linear-gradient(45deg, #1E1E28, #1E1E28 5px, #2A2A38 5px, #2A2A38 10px)' }}>
        <span className="text-tx-muted font-black opacity-50">?</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        dims,
        'rounded-lg border-2 bg-white shrink-0 relative flex items-center justify-center font-display font-black',
        'animate-in zoom-in-90 slide-in-from-bottom-2 duration-200',
        highlight ? 'border-accent-primary ring-2 ring-accent-primary' : 'border-brand-border'
      )}
      style={{ color: red ? '#D32F2F' : '#111', boxShadow: '0 2px 6px rgba(0,0,0,0.45)' }}
    >
      <span className="absolute top-1 left-1.5 text-[10px] leading-none">{rankLabel(rank)}</span>
      <span>{suit}</span>
      <span className="absolute bottom-1 right-1.5 text-[10px] leading-none rotate-180">{rankLabel(rank)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Game shell — header, balance, rules, mute, layout                    */
/* ------------------------------------------------------------------ */

export function GameShell({
  title, rules, balance, isLoaded, isLocal, streak, stage, panel,
}: {
  title: string;
  rules: RulesSpec;
  balance: number;
  isLoaded: boolean;
  isLocal: boolean;
  streak?: number;
  stage: ReactNode;
  panel: ReactNode;
}) {
  const router = useRouter();
  const [showRules, setShowRules] = useState(false);
  const [mutedState, setMutedState] = useState(false);

  useEffect(() => { setMutedState(isMuted()); }, []);

  const toggleMute = () => {
    const next = !mutedState;
    setMutedState(next);
    setMuted(next);
    if (!next) sfx.click();
  };

  return (
    // Locked to the viewport on desktop so the whole game fits without any
    // scrolling; on narrow screens the page itself scrolls (unavoidable when
    // the two columns stack) but nothing scrolls *inside* it.
    <main className="lg:h-[100dvh] lg:overflow-hidden bg-transparent text-tx-base p-3 sm:p-4 flex flex-col">
      {showRules && <RulesModal title={title} rules={rules} onClose={() => setShowRules(false)} />}

      <div className="max-w-5xl w-full mx-auto flex flex-col flex-1 min-h-0">
        <header className="flex items-center justify-between gap-3 mb-3 flex-wrap shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/casino')}
              className="h-11 w-11 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors focus:outline-none"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-black">{title}</h1>
            <button
              onClick={() => { sfx.click(); setShowRules(true); }}
              className="h-9 px-3 flex items-center gap-1.5 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-accent-primary hover:border-accent-primary transition-colors focus:outline-none"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="text-xs font-bold hidden sm:inline">Règles</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {streak !== undefined && streak > 1 && (
              <div className="h-11 flex items-center gap-1.5 px-3 rounded-xl border-2 border-accent-secondary bg-accent-secondary/10">
                <Flame className="h-4 w-4 text-accent-secondary" />
                <span className="font-display font-black text-sm text-accent-secondary">{streak}</span>
              </div>
            )}
            <button onClick={toggleMute} className="h-11 w-11 rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center text-tx-secondary hover:text-tx-base focus:outline-none">
              {mutedState ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <div className="h-11 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-4 rounded-xl shadow-brutal">
              <Coins className="h-4 w-4 text-accent-primary" />
              {isLoaded ? <CountUp value={balance} className="font-display font-black text-base" /> : <span className="font-display font-black">···</span>}
              <span className="text-tx-secondary font-bold text-sm">₶</span>
              {isLocal && <span className="text-[8px] font-black uppercase bg-brand-card border border-brand-border px-1 py-0.5 rounded text-tx-muted">Local</span>}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 flex-1 min-h-0">
          <div className="bg-brand-card border-4 border-brand-border rounded-[24px] p-4 flex flex-col items-center justify-center min-h-[300px] lg:min-h-0 overflow-hidden">
            {stage}
          </div>
          <div className="bg-brand-card border-4 border-brand-border rounded-[24px] p-4 shadow-brutal flex flex-col gap-3 min-h-0 overflow-hidden">
            {panel}
          </div>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Recent results strip                                                 */
/* ------------------------------------------------------------------ */

export function HistoryStrip({ history }: { history: { id: string; amount: number }[] }) {
  if (history.length === 0) return null;
  return (
    <div className="mt-auto shrink-0">
      <div className="text-[10px] font-black tracking-widest uppercase text-tx-muted mb-1.5">Dernières parties</div>
      <div className="flex gap-1.5 overflow-hidden">
        {history.slice(0, 6).map((h) => (
          <span
            key={h.id}
            className={cn(
              'text-[11px] font-bold px-2 py-1 rounded-md border tabular-nums',
              h.amount > 0 ? 'border-accent-success/60 text-accent-success bg-accent-success/10'
                : h.amount === 0 ? 'border-tx-secondary/50 text-tx-secondary'
                : 'border-accent-secondary/60 text-accent-secondary bg-accent-secondary/10'
            )}
          >
            {h.amount > 0 ? '+' : ''}{h.amount.toLocaleString('fr-FR')}
          </span>
        ))}
      </div>
    </div>
  );
}
