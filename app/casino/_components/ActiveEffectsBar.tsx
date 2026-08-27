'use client';

import { useEffect, useState } from 'react';
import { Zap, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { useActiveEffects } from '@/hooks/useActiveEffects';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { styleOf } from '@/lib/casino/effectStyle';
import { streakBonus, prestigeWinBonus } from '@/lib/casino/progression';
import ActiveEffectsPanel from './ActiveEffectsPanel';

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** What's left: a countdown for timed items, a bet count for the others. */
function remaining(expiresAt: string | null, usesLeft: number | null, now: number): string {
  if (expiresAt) {
    const left = Math.max(0, new Date(expiresAt).getTime() - now);
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
  }
  if (usesLeft !== null) return `${usesLeft} mise${usesLeft > 1 ? 's' : ''}`;
  return 'actif';
}

/**
 * The items running right now, on every casino screen, and the combined bonus
 * they add up to. Tapping it opens the full breakdown — several effects stack
 * and the total is the number that actually matters.
 */
export default function ActiveEffectsBar({ className }: { className?: string }) {
  const effects = useActiveEffects();
  const { stats } = useCasinoWallet();
  const now = useNow();
  const [open, setOpen] = useState(false);

  const entries = Object.values(effects);
  const total = streakBonus(stats.currentStreak)
    + prestigeWinBonus(stats.prestigeCount)
    + (effects.win_bonus?.magnitude ?? 0);

  // Nothing running and no bonus: no reason to take up a line.
  if (entries.length === 0 && total <= 0) return null;

  return (
    <>
      {open && <ActiveEffectsPanel onClose={() => setOpen(false)} />}

      <button
        onClick={() => { sfx.click(); setOpen(true); }}
        className={cn(
          'w-full flex items-center gap-1.5 overflow-x-auto pb-0.5 focus:outline-none text-left',
          className
        )}
      >
        <Zap className="h-3 w-3 shrink-0 text-accent-success" />

        {total > 0 && (
          <span className="shrink-0 h-7 px-2.5 rounded-lg border-2 border-accent-success bg-accent-success/15 flex items-center gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-accent-success">Bonus</span>
            <span className="font-display font-black text-[11px] text-accent-success tabular-nums">
              +{Math.round(total * 100)}%
            </span>
          </span>
        )}

        {entries.map((e) => {
          const style = styleOf(e.effect);
          const soon = e.uses_left !== null
            ? e.uses_left <= 1
            : e.expires_at
              ? new Date(e.expires_at).getTime() - now < 60_000
              : false;

          return (
            <span
              key={e.effect}
              title={style.summary(e.magnitude)}
              className={cn(
                'shrink-0 h-7 pl-2 pr-2.5 rounded-lg border-2 flex items-center gap-1.5',
                soon && 'animate-pulse'
              )}
              style={{ borderColor: style.color, background: `${style.color}14` }}
            >
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: style.color }}>
                {style.label}
              </span>
              <span className="text-[10px] font-bold text-tx-secondary tabular-nums">
                {remaining(e.expires_at, e.uses_left, now)}
              </span>
            </span>
          );
        })}

        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-tx-muted" />
      </button>
    </>
  );
}
