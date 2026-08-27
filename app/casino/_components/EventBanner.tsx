'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Flame, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  gameOfTheDay, happyHourCountdown, isHappyHour,
  GAME_OF_DAY_BONUS, HAPPY_HOUR_BONUS,
} from '@/lib/casino/events';
import { GAME_LABELS } from '@/lib/casino/cosmetics';

function format(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
  if (m > 0) return `${m} min ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/**
 * The two bonuses that come from the clock: today's featured game, and the
 * hour where everything pays more. Both are derived from the date, so the
 * countdown can run entirely client-side.
 */
export default function EventBanner({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  // Rendered on the client only: the server has a different clock and the
  // mismatch would flash the wrong countdown.
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) return null;

  const game = gameOfTheDay(now);
  const happy = isHappyHour(now);
  const countdown = happyHourCountdown(now);

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Link
        href={`/casino/${game}`}
        prefetch
        className="h-11 px-3 rounded-xl border-2 border-accent-primary/60 bg-accent-primary/5 flex items-center gap-2 hover:bg-accent-primary/10 transition-colors focus:outline-none"
      >
        <Star className="h-4 w-4 shrink-0 text-accent-primary" />
        <div className="leading-tight">
          <div className="font-display font-black text-[12px]">
            {GAME_LABELS[game] || game}
          </div>
          <div className="text-[9px] font-bold text-accent-primary">
            Jeu du jour · +{Math.round(GAME_OF_DAY_BONUS * 100)}%
          </div>
        </div>
      </Link>

      <div
        className={cn(
          'h-11 px-3 rounded-xl border-2 flex items-center gap-2',
          happy
            ? 'border-accent-secondary bg-accent-secondary text-white animate-pulse'
            : 'border-brand-border bg-brand-card'
        )}
      >
        {happy ? <Flame className="h-4 w-4 shrink-0" /> : <Clock className="h-4 w-4 shrink-0 text-tx-muted" />}
        <div className="leading-tight">
          <div className={cn('font-display font-black text-[12px]', !happy && 'text-tx-secondary')}>
            {happy ? `HEURE CHAUDE +${Math.round(HAPPY_HOUR_BONUS * 100)}%` : 'Heure chaude'}
          </div>
          <div className={cn('text-[9px] font-bold tabular-nums', happy ? 'text-white/75' : 'text-tx-muted')}>
            {happy ? `encore ${format(countdown.seconds)}` : `dans ${format(countdown.seconds)}`}
          </div>
        </div>
      </div>
    </div>
  );
}
