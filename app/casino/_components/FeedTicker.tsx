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

/**
 * One-line ticker of the big wins across all players. It's the only place the
 * solo casino feels populated, so it's live rather than polled.
 */
export default function FeedTicker() {
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [index, setIndex] = useState(0);

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
    if (feed.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % feed.length), 4000);
    return () => clearInterval(t);
  }, [feed.length]);

  if (feed.length === 0) return null;
  const entry = feed[index];

  return (
    <div className="h-8 shrink-0 mb-3 rounded-lg border-2 border-brand-border bg-brand-card px-3 flex items-center gap-2 overflow-hidden">
      <Radio className={cn('h-3.5 w-3.5 shrink-0', entry.pinned ? 'text-accent-primary animate-pulse' : 'text-accent-secondary')} />
      <div key={entry.id} className="min-w-0 flex items-center gap-1.5 text-[11px] animate-in slide-in-from-bottom-2 fade-in duration-300">
        <span className="font-black truncate max-w-[120px]">{entry.pseudo}</span>
        <span className="text-tx-muted">
          {entry.pinned ? 'a raflé le jackpot sur' : 'a gagné sur'}
        </span>
        <span className="font-bold text-tx-secondary">{GAME_NAMES[entry.game_slug] || entry.game_slug}</span>
        <span className="font-black text-accent-success tabular-nums">+{Number(entry.amount).toLocaleString('fr-FR')} ₶</span>
        {Number(entry.multiplier) > 1 && (
          <span className="font-black text-accent-primary tabular-nums">×{Number(entry.multiplier)}</span>
        )}
      </div>
    </div>
  );
}
