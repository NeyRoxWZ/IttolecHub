'use client';

import Link from 'next/link';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Coins, Minus, Plus, HelpCircle, X, Volume2, VolumeX, Flame, Zap, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { sfx, isMuted, setMuted } from '@/lib/casino/sfx';
import { CASINO_MIN_BET } from '@/lib/casino/core';
import { useTurbo, tempo } from '@/lib/casino/turbo';
import { streakLabel, streakBonus, nextStreakTier } from '@/lib/casino/progression';
import { JACKPOT_CONTRIBUTION_RATE, JACKPOT_HIT_CHANCE } from '@/lib/casino/meta';

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

        {/* Identical in every game, so it lives here rather than in 20 RulesSpec. */}
        <div className="mt-4 pt-4 border-t border-brand-border/60 space-y-2 text-[11px] text-tx-muted leading-relaxed">
          <p>
            <span className="font-black text-tx-secondary">Série de victoires :</span> à partir de 3 victoires
            d&apos;affilée, un bonus s&apos;ajoute à ton bénéfice (+5%, puis +10% à 5, +20% à 7, +35% à 10).
            Il ne s&apos;applique qu&apos;au gain, jamais à la mise rendue. Une défaite remet la série à zéro.
          </p>
          <p>
            <span className="font-black text-tx-secondary">Jackpot commun :</span> chaque mise perdue verse
            {' '}{Math.round(JACKPOT_CONTRIBUTION_RATE * 100)}% à la cagnotte partagée, et chaque mise réglée
            tire 1 chance sur {Math.round(1 / JACKPOT_HIT_CHANCE).toLocaleString('fr-FR')} de la rafler
            entièrement — le montant misé n&apos;y change rien.
          </p>
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
/* Play button + auto-replay                                            */
/* ------------------------------------------------------------------ */

/**
 * One press starts the round; pressing AUTO keeps replaying the same stake
 * until you stop it, run out, or touch the bet. Chaining rounds by hand was
 * the slowest part of a session.
 */
export function PlayRow({
  onClick, loading, disabled, children, betKey, blocked, variant = 'primary',
}: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
  /** Anything that identifies the current bet; changing it stops auto-replay. */
  betKey?: string | number;
  /** The game telling us a next round is impossible (no funds, no pick…). */
  blocked?: boolean;
  variant?: 'primary' | 'success' | 'danger';
}) {
  const [auto, setAuto] = useState(false);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;

  const ready = !loading && !disabled && !blocked;

  // Changing the stake is the natural "stop" gesture.
  useEffect(() => { setAuto(false); }, [betKey]);
  useEffect(() => { if (auto && (disabled || blocked)) setAuto(false); }, [auto, disabled, blocked]);

  useEffect(() => {
    if (!auto || !ready) return;
    const t = setTimeout(() => clickRef.current(), tempo(450));
    return () => clearTimeout(t);
  }, [auto, ready]);

  return (
    <div className="flex gap-2">
      <PlayButton onClick={onClick} loading={loading} disabled={disabled} variant={variant} className="flex-1">
        {children}
      </PlayButton>
      <button
        onClick={() => { sfx.click(); vibrate(HAPTIC.SOFT); setAuto((a) => !a); }}
        disabled={disabled}
        title="Rejoue la même mise en boucle jusqu'à ce que tu l'arrêtes"
        className={cn(
          'h-16 w-16 shrink-0 rounded-2xl border-4 border-brand-border font-display font-black text-[11px] tracking-wider',
          'flex flex-col items-center justify-center gap-0.5 transition-all active:translate-y-1 focus:outline-none disabled:opacity-40',
          auto ? 'bg-accent-secondary text-white shadow-none translate-y-0.5' : 'bg-brand-inner text-tx-secondary shadow-brutal hover:text-tx-base'
        )}
      >
        <RotateCcw className={cn('h-4 w-4', auto && 'animate-spin')} style={auto ? { animationDuration: '1.6s' } : undefined} />
        {auto ? 'STOP' : 'AUTO'}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Result banner — fixed slot so the stage never jumps                  */
/* ------------------------------------------------------------------ */

export function ResultBanner({
  state, children, nearMiss,
}: {
  state: 'idle' | 'win' | 'lose' | 'push';
  children?: ReactNode;
  /** A loss that came within a hair of paying — worth pointing out. */
  nearMiss?: ReactNode;
}) {
  return (
    <div className="h-12 flex items-center justify-center">
      {state !== 'idle' && (
        <div
          className={cn(
            'px-5 py-2.5 rounded-xl border-2 font-display font-black text-sm animate-in zoom-in-95 fade-in duration-200',
            state === 'win' && 'border-accent-success text-accent-success bg-accent-success/15',
            state === 'lose' && !nearMiss && 'border-accent-secondary text-accent-secondary bg-accent-secondary/15',
            state === 'lose' && nearMiss && 'border-accent-primary text-accent-primary bg-accent-primary/15 animate-pulse',
            state === 'push' && 'border-tx-secondary text-tx-secondary bg-brand-inner'
          )}
        >
          {state === 'lose' && nearMiss ? nearMiss : children}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Win-streak meter                                                     */
/* ------------------------------------------------------------------ */

/** Shows the current streak, what it's worth, and the next tier to chase. */
export function StreakMeter({ streak }: { streak: number }) {
  const label = streakLabel(streak);
  const bonus = streakBonus(streak);
  const next = nextStreakTier(streak);

  return (
    <div className="shrink-0 rounded-xl border-2 border-brand-border bg-brand-inner px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Flame className={cn('h-4 w-4', bonus > 0 ? 'text-accent-secondary' : 'text-tx-muted')} />
          <span className="font-display font-black text-sm">{streak}</span>
          {label && <span className="text-[10px] font-black tracking-widest text-accent-secondary">{label}</span>}
        </div>
        {bonus > 0 && (
          <span className="text-[11px] font-bold text-accent-success">+{Math.round(bonus * 100)}% de gain</span>
        )}
      </div>
      {next && (
        <div className="text-[10px] text-tx-muted mt-1">
          {next.min - streak} victoire{next.min - streak > 1 ? 's' : ''} avant {next.label} (+{Math.round(next.bonus * 100)}%)
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Level bar                                                            */
/* ------------------------------------------------------------------ */

export function LevelBar({ level, into, needed }: { level: number; into: number; needed: number }) {
  const pct = needed > 0 ? Math.min(100, (into / needed) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[130px]">
      <span className="text-[10px] font-black tracking-widest text-tx-muted shrink-0">NIV {level}</span>
      <div className="flex-1 h-2 rounded-full bg-brand-inner border border-brand-border overflow-hidden">
        <div className="h-full bg-accent-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
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
  const dims = { sm: 'w-12 h-16 text-lg', md: 'w-[72px] h-[104px] text-3xl', lg: 'w-[104px] h-[148px] text-5xl' }[size];
  const corner = { sm: 'text-[11px]', md: 'text-sm', lg: 'text-lg' }[size];
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
      <span className={cn('absolute top-1.5 left-2 leading-none', corner)}>{rankLabel(rank)}</span>
      <span>{suit}</span>
      <span className={cn('absolute bottom-1.5 right-2 leading-none rotate-180', corner)}>{rankLabel(rank)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Game shell — header, balance, rules, mute, layout                    */
/* ------------------------------------------------------------------ */

export function GameShell({
  title, rules, balance, isLoaded, isLocal, streak, level, xpIntoLevel, xpForNext, stage, panel,
}: {
  title: string;
  rules: RulesSpec;
  balance: number;
  isLoaded: boolean;
  isLocal: boolean;
  streak?: number;
  level?: number;
  xpIntoLevel?: number;
  xpForNext?: number;
  stage: ReactNode;
  panel: ReactNode;
}) {
  const router = useRouter();
  const [showRules, setShowRules] = useState(false);
  const [mutedState, setMutedState] = useState(false);
  const [turbo, setTurboMode] = useTurbo();

  useEffect(() => { setMutedState(isMuted()); }, []);

  const toggleMute = () => {
    const next = !mutedState;
    setMutedState(next);
    setMuted(next);
    if (!next) sfx.click();
  };

  return (
    // Locked to the viewport on desktop so the whole game fits without any
    // scrolling. The min-height guard matters: on a short window we let the
    // page scroll instead of clipping the game off the bottom. On narrow
    // screens the columns stack and the page scrolls, but nothing ever
    // scrolls *inside* the game.
    <main className="lg:[@media(min-height:700px)]:h-[100dvh] lg:[@media(min-height:700px)]:overflow-hidden bg-transparent text-tx-base p-3 sm:p-4 flex flex-col">
      {showRules && <RulesModal title={title} rules={rules} onClose={() => setShowRules(false)} />}

      <div className="max-w-[1500px] w-full mx-auto flex flex-col flex-1 min-h-0">
        <header className="flex items-center justify-between gap-3 mb-3 flex-wrap shrink-0">
          <div className="flex items-center gap-3">
            <Link
              href="/casino"
              prefetch
              className="h-11 w-11 flex items-center justify-center rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base transition-colors focus:outline-none"
            >
              <ArrowLeft className="h-5 w-5" />
              </Link>
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
            {level !== undefined && (
              <div className="h-11 hidden sm:flex items-center px-3 rounded-xl border-2 border-brand-border bg-brand-inner">
                <LevelBar level={level} into={xpIntoLevel ?? 0} needed={xpForNext ?? 1} />
              </div>
            )}
            <button
              onClick={() => { sfx.click(); vibrate(HAPTIC.SOFT); setTurboMode(!turbo); }}
              title="Mode turbo : animations accélérées"
              className={cn(
                'h-11 w-11 rounded-xl border-2 flex items-center justify-center focus:outline-none transition-colors',
                turbo ? 'border-accent-primary bg-accent-primary/15 text-accent-primary' : 'border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base'
              )}
            >
              <Zap className="h-4 w-4" />
            </button>
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

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 flex-1 min-h-0">
          <div className="bg-brand-card border-4 border-brand-border rounded-[24px] p-4 sm:p-6 flex flex-col items-center justify-center min-h-[380px] lg:min-h-0">
            {stage}
          </div>
          <div className="bg-brand-card border-4 border-brand-border rounded-[24px] p-4 sm:p-5 shadow-brutal flex flex-col gap-4 min-h-0">
            {streak !== undefined && <StreakMeter streak={streak} />}
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
