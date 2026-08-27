'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActiveEffects } from '@/hooks/useActiveEffects';
import { styleOf } from '@/lib/casino/effectStyle';

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
 * The items currently running, on every casino screen. Nothing used to say
 * whether an insurance was still covering you, so it was bought and then
 * forgotten.
 */
export default function ActiveEffectsBar({ className }: { className?: string }) {
  const effects = useActiveEffects();
  const now = useNow();
  const entries = Object.values(effects);

  if (entries.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-1.5 overflow-x-auto pb-0.5', className)}>
      <Zap className="h-3 w-3 shrink-0 text-accent-success" />
      {entries.map((e) => {
        const style = styleOf(e.effect);
        const soon = e.uses_left !== null
          ? e.uses_left <= 1
          : e.expires_at
            ? new Date(e.expires_at).getTime() - now < 60_000
            : false;

        return (
          <Link
            key={e.effect}
            href="/casino/inventaire"
            title={style.summary(e.magnitude)}
            className={cn(
              'shrink-0 h-7 pl-2 pr-2.5 rounded-lg border-2 flex items-center gap-1.5 transition-colors',
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
          </Link>
        );
      })}
    </div>
  );
}
