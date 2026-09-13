'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Zap, Flame, Crown, Package, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { useActiveEffects } from '@/hooks/useActiveEffects';
import { styleOf } from '@/lib/casino/effectStyle';
import { streakBonus, streakLabel, prestigeWinBonus } from '@/lib/casino/progression';
import { CASINO_MAX_BET_PERCENT } from '@/lib/casino/core';

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function remaining(expiresAt: string | null, usesLeft: number | null, now: number): string {
  if (expiresAt) {
    const left = Math.max(0, new Date(expiresAt).getTime() - now);
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    return m > 0 ? `${m} min ${String(s).padStart(2, '0')}s` : `${s}s`;
  }
  if (usesLeft !== null) return `${usesLeft} mise${usesLeft > 1 ? 's' : ''}`;
  return 'actif';
}

const pct = (n: number) => `${(n * 100).toFixed(n < 0.1 && n > 0 ? 1 : 0)}%`;

/**
 * Everything in force, and what it adds up to.
 *
 * Bonuses stack — a streak, an item and prestige all lift the same profit —
 * and nowhere said what the combined number actually was. This is the sum,
 * with the parts that make it.
 */
export default function ActiveEffectsPanel({ onClose }: { onClose: () => void }) {
  const { stats, balance } = useCasinoWallet();
  const effects = useActiveEffects();
  const now = useNow();

  const streakPct = streakBonus(stats.currentStreak);
  const prestigePct = prestigeWinBonus(stats.prestigeCount);
  const itemPct = effects.win_bonus?.magnitude ?? 0;
  const totalWinBonus = streakPct + prestigePct + itemPct;

  const betPct = effects.max_bet_pct?.magnitude ?? CASINO_MAX_BET_PERCENT;
  const maxBet = Math.max(1, Math.floor(balance * betPct));

  const parts = [
    { label: 'Série', icon: Flame, value: streakPct, detail: streakLabel(stats.currentStreak) || `${stats.currentStreak} victoire${stats.currentStreak > 1 ? 's' : ''}` },
    { label: 'Prestige', icon: Crown, value: prestigePct, detail: `Prestige ${stats.prestigeCount}` },
    { label: 'Objet', icon: Package, value: itemPct, detail: effects.win_bonus ? 'bonus de gain actif' : 'aucun objet' },
  ];

  const running = Object.values(effects);

  return (
    <div className="fixed inset-0 z-[230] bg-[#05061A]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-[0_8px_0_#05061A] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-3xl leading-none flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent-success" /> Ce qui est actif
            </h2>
            <p className="text-xs font-bold text-tx-secondary mt-2">Les bonus se cumulent : voici le total.</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="h-11 w-11 shrink-0 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A] active:translate-y-[2px] flex items-center justify-center focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* The headline: what a win is actually worth right now. */}
        <div className={cn(
          'rounded-2xl border-[3px] border-brand-border p-4 mb-3',
          totalWinBonus > 0 ? 'bg-[#16503A]' : 'bg-brand-inner'
        )}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className={cn('h-4 w-4', totalWinBonus > 0 ? 'text-accent-success' : 'text-tx-muted')} />
            <span className="text-[10px] font-black uppercase tracking-widest text-tx-muted">
              Bonus total sur le bénéfice
            </span>
          </div>
          <div className={cn(
            'font-display text-5xl leading-none tabular-nums',
            totalWinBonus > 0 ? 'text-accent-success' : 'text-tx-secondary'
          )}>
            +{pct(totalWinBonus)}
          </div>

          <div className="mt-3 space-y-1.5">
            {parts.map((p) => (
              <div key={p.label} className="flex items-center gap-2 text-[11px]">
                <p.icon className={cn('h-3 w-3 shrink-0', p.value > 0 ? 'text-accent-success' : 'text-tx-muted')} />
                <span className="font-bold text-tx-secondary">{p.label}</span>
                <span className="text-tx-muted truncate">{p.detail}</span>
                <span className={cn('ml-auto font-black tabular-nums', p.value > 0 ? 'text-accent-success' : 'text-tx-muted')}>
                  +{pct(p.value)}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-tx-muted mt-2 leading-snug">
            Le bonus s&apos;applique au bénéfice seul, jamais à la mise rendue.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-tx-muted">Mise maximum</div>
            <div className="font-display text-xl leading-tight tabular-nums">{maxBet.toLocaleString('en-US')} ₶</div>
            <div className="text-[10px] text-tx-muted">{pct(betPct)} du solde</div>
          </div>
          <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-tx-muted">XP par mise</div>
            <div className="font-display text-xl leading-tight tabular-nums">
              ×{effects.xp_multiplier?.magnitude ?? 1}
            </div>
            <div className="text-[10px] text-tx-muted">
              {effects.xp_multiplier ? 'objet actif' : 'aucun multiplicateur'}
            </div>
          </div>
        </div>

        <div className="font-display text-lg leading-none mb-2">
          Objets en cours
        </div>

        {running.length === 0 ? (
          <p className="text-sm text-tx-secondary mb-4">
            Aucun objet actif. Ils s&apos;activent depuis ton inventaire, et plusieurs peuvent
            tourner en même temps.
          </p>
        ) : (
          <div className="space-y-2 mb-4">
            {running.map((e) => {
              const style = styleOf(e.effect);
              return (
                <div
                  key={e.effect}
                  className="rounded-2xl border-[3px] p-3 flex items-center gap-3"
                  style={{ borderColor: style.color, background: `${style.color}10` }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-display font-black text-[12px]" style={{ color: style.color }}>
                      {style.label}
                    </div>
                    <div className="text-[11px] text-tx-secondary truncate">
                      {style.summary(e.magnitude)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-black text-tx-muted uppercase tracking-widest">Reste</div>
                    <div className="font-display font-black text-[12px] tabular-nums">
                      {remaining(e.expires_at, e.uses_left, now)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Link
          href="/casino/inventaire"
          onClick={onClose}
          className="w-full h-14 rounded-2xl border-4 border-brand-border font-display text-xl flex items-center justify-center transition-transform focus:outline-none bg-accent-primary text-brand-bg shadow-[inset_0_-6px_0_#D98E00,0_5px_0_#05061A] active:translate-y-[4px]"
        >
          Ouvrir l&apos;inventaire
        </Link>
      </div>
    </div>
  );
}
