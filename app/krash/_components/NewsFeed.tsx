'use client';

import { useEffect, useRef, useState } from 'react';
import { Info, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORIES, CERTAINTY, type KrashNews, type NewsCategory, type Certainty } from '@/lib/krash/newsMeta';
import type { MarketId } from '@/lib/krash/assets';

function ago(seconds: number): string {
  if (seconds < 45) return 'à l’instant';
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `il y a ${minutes} min` : `il y a ${Math.round(minutes / 60)} h`;
}

/** "↑ Luxe 88 %" — which way the headline probably pushes, and how sure it is. */
function HintChip({ label, up, certainty }: { label: string; up: number; certainty: Certainty }) {
  if (certainty === 'pile' || up === 0.5) {
    return <span className="px-1.5 py-0.5 rounded-md border border-brand-border text-[10px] font-bold text-tx-secondary">↕ {label} 50/50</span>;
  }
  const rising = up > 0.5;
  const pct = Math.round((rising ? up : 1 - up) * 100);
  return (
    <span className={cn(
      'px-1.5 py-0.5 rounded-md border text-[10px] font-bold',
      rising ? 'border-accent-success/50 text-accent-success' : 'border-rose-500/50 text-rose-400'
    )}>
      {rising ? '↑' : '↓'} {label} {pct} %
    </span>
  );
}

/**
 * The headlines. Each one is coloured by kind, says how sure its effect is,
 * and shows the likely direction per target. Headlines about the other market
 * stay visible but dimmed: a war moves oil stocks and bitcoin alike, so the
 * whole feed is worth a glance.
 */
export default function NewsFeed({
  news, market, now, className,
}: { news: KrashNews[]; market: MarketId; now: number; className?: string }) {
  const [legend, setLegend] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  // Flash what arrives after the page is open, not the backlog.
  useEffect(() => {
    if (!news.length) return;
    if (seen.current === null) {
      seen.current = new Set(news.map((n) => n.id));
      return;
    }
    const arrived = news.filter((n) => !seen.current!.has(n.id)).map((n) => n.id);
    if (!arrived.length) return;
    arrived.forEach((id) => seen.current!.add(id));
    setFresh((prev) => new Set([...Array.from(prev), ...arrived]));
    const timer = setTimeout(() => {
      setFresh((prev) => {
        const next = new Set(prev);
        arrived.forEach((id) => next.delete(id));
        return next;
      });
    }, 6000);
    return () => clearTimeout(timer);
  }, [news]);

  return (
    <section className={cn('bg-brand-card border-4 border-brand-border rounded-[24px] shadow-brutal flex flex-col min-h-0', className)}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Newspaper className="h-4 w-4 text-rose-400" />
        <h2 className="font-display font-black tracking-wider uppercase">News en direct</h2>
        <button
          onClick={() => setLegend((v) => !v)}
          className={cn(
            'ml-auto h-8 px-2.5 rounded-lg border-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest',
            legend ? 'border-tx-base text-tx-base' : 'border-brand-border text-tx-muted hover:text-tx-base'
          )}
        >
          <Info className="h-3.5 w-3.5" /> Légende
        </button>
      </div>

      {legend && (
        <div className="mx-4 mb-3 rounded-xl border-2 border-brand-border bg-brand-inner p-3 space-y-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {(Object.keys(CATEGORIES) as NewsCategory[]).map((c) => (
              <span key={c} className="flex items-center gap-1.5 text-[11px] text-tx-secondary">
                <span className={cn('h-2.5 w-2.5 rounded-sm', CATEGORIES[c].dot)} /> {CATEGORIES[c].label}
              </span>
            ))}
          </div>
          <div className="space-y-1 border-t border-brand-border pt-2">
            {(Object.keys(CERTAINTY) as Certainty[]).map((c) => (
              <div key={c} className="text-[11px] leading-snug">
                <span className="font-black text-tx-base">{CERTAINTY[c].label}</span>
                <span className="text-tx-muted"> — {CERTAINTY[c].hint}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-tx-muted leading-snug border-t border-brand-border pt-2">
            « ↑ Luxe 88 % » : 88 % de chances que le luxe monte. Le marché sent venir la news, une partie du mouvement est déjà faite quand elle tombe.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 min-h-0">
        {news.length === 0 && <p className="text-tx-muted text-sm text-center py-8">Le fil se charge…</p>}
        {news.map((n) => {
          const meta = CATEGORIES[n.category];
          const relevant = n.markets.includes(market);
          return (
            <article
              key={n.id}
              className={cn(
                'rounded-xl border-2 border-brand-border border-l-[6px] bg-brand-inner px-3 py-2.5 transition-all duration-700',
                meta.border,
                !relevant && 'opacity-55',
                fresh.has(n.id) && 'ring-2 ring-rose-400 animate-in slide-in-from-top-2 fade-in duration-500'
              )}
            >
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                <span className={meta.text}>{meta.label}</span>
                <span className="text-tx-muted">· {CERTAINTY[n.certainty].label}</span>
                {fresh.has(n.id) && <span className="text-rose-400">· Nouveau</span>}
                <span className="ml-auto text-tx-muted normal-case tracking-normal font-bold">{ago(now - n.at)}</span>
              </div>
              <p className="text-[13px] font-bold leading-snug mt-1">{n.text}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {n.hints.map((h, i) => <HintChip key={i} label={h.label} up={h.up} certainty={n.certainty} />)}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
