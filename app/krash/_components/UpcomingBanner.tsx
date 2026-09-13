'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { ASSET_BY_ID } from '@/lib/krash/assets';
import type { ResultCycle } from '@/lib/krash/newsMeta';
import { serverNow } from '../_lib/useKrashMarket';

const clock = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The announced-results loop, always on screen: a quiet countdown to the
 * next announcement, then the announced company with the time left to pick a
 * side, then what the reveal did to its price.
 */
export default function UpcomingBanner({
  cycle, selected, onPick,
}: { cycle: ResultCycle; selected: string; onPick: (assetId: string) => void }) {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(id);
  }, []);

  const lastTick = useRef(0);
  const left = cycle.phase === 'announced' ? (cycle.news.scheduled?.resolveAt ?? now) - now : 0;
  useEffect(() => {
    if (cycle.phase !== 'announced') return;
    const s = Math.ceil(left);
    if (s <= 10 && s > 0 && s !== lastTick.current) { lastTick.current = s; sfx.tick(); }
  }, [cycle.phase, left]);

  if (cycle.phase === 'waiting') {
    return (
      <div className="mb-4 rounded-xl border-2 border-brand-border bg-brand-card px-4 py-2 flex items-center gap-2 text-[12px] text-tx-muted">
        <Timer className="h-4 w-4" />
        Prochain résultat d’entreprise annoncé dans <b className="tabular-nums text-tx-base">{clock(cycle.announceAt - now)}</b>
        <span className="hidden sm:inline">· tu auras 2 min 30 pour parier dessus.</span>
      </div>
    );
  }

  const assetId = cycle.news.scheduled?.asset ?? '';
  const asset = ASSET_BY_ID.get(assetId);
  if (!asset) return null;
  const pickButton = assetId !== selected && (
    <button
      onClick={() => { sfx.select(); onPick(assetId); }}
      className="h-10 px-4 rounded-xl bg-accent-primary text-brand-bg border-2 border-brand-border font-display font-black text-sm tracking-wider"
    >
      VOIR {asset.name.toUpperCase()}
    </button>
  );

  if (cycle.phase === 'revealed') {
    const up = cycle.move >= 0;
    return (
      <div className={cn(
        'mb-4 rounded-[20px] border-4 px-4 py-3 shadow-brutal flex flex-wrap items-center gap-x-4 gap-y-2',
        up ? 'border-accent-success bg-accent-success/10' : 'border-rose-500 bg-rose-500/10'
      )}>
        <div className={cn('flex items-center gap-2 font-display text-3xl font-black tabular-nums', up ? 'text-accent-success' : 'text-rose-400')}>
          {up ? <TrendingUp className="h-7 w-7" /> : <TrendingDown className="h-7 w-7" />}
          {up ? '+' : ''}{(cycle.move * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Résultat tombé · {asset.name}</div>
          <div className="font-bold text-sm leading-snug">{cycle.news.text}</div>
        </div>
        {pickButton}
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-[20px] border-4 border-accent-primary bg-brand-card px-4 py-3 shadow-brutal flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <Timer className="h-6 w-6 text-accent-primary" />
        <span className={cn('font-display text-3xl font-black tabular-nums text-accent-primary', left <= 30 && 'animate-pulse')}>{clock(left)}</span>
      </div>
      <div className="flex-1 min-w-[200px]">
        <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Résultat annoncé · {asset.name}</div>
        <div className="font-bold text-sm leading-snug">{cycle.news.text}</div>
        <div className="text-[11px] text-tx-muted">Personne ne sait si ce sera bon ou mauvais. Ça montera ou baissera fort d’un coup : choisis ton camp avant la fin.</div>
      </div>
      {pickButton}
    </div>
  );
}
