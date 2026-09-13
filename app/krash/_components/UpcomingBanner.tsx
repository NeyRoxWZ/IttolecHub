'use client';

import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { ASSET_BY_ID } from '@/lib/krash/assets';
import type { KrashNews } from '@/lib/krash/newsMeta';
import { serverNow } from '../_lib/useKrashMarket';

/**
 * The announced result counting down. Waiting is the point: the banner is the
 * reason to pick a side now rather than after the fact.
 */
export default function UpcomingBanner({
  upcoming, selected, onPick,
}: { upcoming: KrashNews; selected: boolean; onPick: (assetId: string) => void }) {
  const scheduled = upcoming.scheduled!;
  const asset = ASSET_BY_ID.get(scheduled.asset);
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, scheduled.resolveAt - now);
  const m = Math.floor(left / 60);
  const s = Math.floor(left % 60);
  const urgent = left <= 30;

  useEffect(() => {
    if (left <= 10 && left > 0 && Math.abs(left - Math.round(left)) < 0.13) sfx.tick();
  }, [left]);

  if (!asset || left <= 0) return null;

  return (
    <div className={cn(
      'mb-4 rounded-[20px] border-4 bg-brand-card px-4 py-3 shadow-brutal flex flex-wrap items-center gap-x-4 gap-y-2',
      urgent ? 'border-accent-primary animate-pulse' : 'border-accent-primary/60'
    )}>
      <div className="flex items-center gap-2">
        <Timer className="h-6 w-6 text-accent-primary" />
        <span className="font-display text-3xl font-black tabular-nums text-accent-primary">{m}:{String(s).padStart(2, '0')}</span>
      </div>
      <div className="flex-1 min-w-[200px]">
        <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Résultat annoncé</div>
        <div className="font-bold text-sm leading-snug">{upcoming.text}</div>
        <div className="text-[11px] text-tx-muted">Personne ne connaît le sens. Place-toi avant la révélation.</div>
      </div>
      {!selected && (
        <button
          onClick={() => { sfx.select(); onPick(asset.id); }}
          className="h-11 px-4 rounded-xl bg-accent-primary text-brand-bg border-2 border-brand-border font-display font-black tracking-wider"
        >
          PARIER SUR {asset.name.toUpperCase()}
        </button>
      )}
    </div>
  );
}
