'use client';

import { useEffect, useState } from 'react';
import { Radio } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface FeedEntry {
  id: string;
  pseudo: string;
  game_slug: string;
  amount: number;
  multiplier: number;
  pinned?: boolean;
  created_at: string;
}

const GAME_NAMES: Record<string, string> = {
  slots: 'Slots', blackjack: '21', wheel: 'Wheel', rocket: 'Rocket', mines: 'Mines',
  plinko: 'Plinko', hilo: 'HiLo', grattage: 'Grattage', poulet: 'Poulet', tower: 'Tower',
  keno: 'Keno', caisses: 'Caisses', coinflip: 'Coinflip', dino: 'Dino', chevaux: 'Chevaux',
  bonneteau: 'Bonneteau', stade: 'Stade', baccarat: 'Baccarat', rps: 'PFC', craps: 'Craps',
};

/** "il y a 3 min" — the feed is only interesting if you know how fresh it is. */
function relativeTime(iso: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

/**
 * Big wins from everyone, as a corner overlay rather than a strip in the
 * layout: it's ambient information, it shouldn't cost the games any height.
 */
export default function FeedTicker() {
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    fetch('/api/casino/feed?limit=20')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.feed) setFeed(d.feed); })
      .catch(() => {});

    const channel = supabase.channel('casino_feed_ticker')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'casino_feed' }, (p) => {
        setFeed((prev) => [p.new as FeedEntry, ...prev].slice(0, 20));
        setIndex(0);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (feed.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % feed.length), 4500);
    return () => clearInterval(t);
  }, [feed.length]);

  if (feed.length === 0) return null;
  const entry = feed[index];

  return (
    <div className="fixed bottom-3 left-3 z-40 pointer-events-none max-w-[min(300px,calc(100vw-24px))]">
      <div
        key={entry.id}
        className={cn(
          'rounded-xl border-2 bg-brand-card/95 backdrop-blur px-3 py-2 shadow-brutal',
          'animate-in slide-in-from-left-3 fade-in duration-300',
          entry.pinned ? 'border-accent-primary' : 'border-brand-border'
        )}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <Radio className={cn('h-3 w-3 shrink-0', entry.pinned ? 'text-accent-primary animate-pulse' : 'text-accent-secondary')} />
          <span className="text-[9px] font-black uppercase tracking-widest text-tx-muted">
            {entry.pinned ? 'Jackpot' : 'Gros gain'}
          </span>
          <span className="ml-auto text-[9px] font-bold text-tx-muted tabular-nums">
            {relativeTime(entry.created_at, now)}
          </span>
        </div>

        <div className="flex items-baseline gap-1.5 text-[11px] leading-tight">
          <span className="font-black truncate max-w-[110px]">{entry.pseudo}</span>
          <span className="text-tx-muted">sur</span>
          <span className="font-bold text-tx-secondary truncate">{GAME_NAMES[entry.game_slug] || entry.game_slug}</span>
        </div>

        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="font-display font-black text-sm text-accent-success tabular-nums">
            +{Number(entry.amount).toLocaleString('fr-FR')} ₶
          </span>
          {Number(entry.multiplier) > 1 && (
            <span className="font-display font-black text-[11px] text-accent-primary tabular-nums">
              ×{Number(entry.multiplier)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
