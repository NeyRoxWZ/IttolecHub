'use client';

import { useEffect, useState } from 'react';
import type { MarketId } from '@/lib/krash/assets';
import { serverNow } from './useKrashMarket';

export interface KrashMover {
  id: string;
  market: MarketId;
  price: number;
  prev: number;
  hourAgo: number;
  /** Percent change over the last fifteen minutes. */
  change: number;
}

const EVERY = 10;

/**
 * The simple view's list, every ten seconds. Asking on a ten-second grid means
 * every player shares the same cached answer.
 */
export function useKrashMovers(enabled: boolean) {
  const [movers, setMovers] = useState<KrashMover[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const load = async () => {
      const at = Math.floor((serverNow() - 2) / EVERY) * EVERY;
      try {
        const res = await fetch(`/api/krash/movers?at=${at}`);
        if (!res.ok || stopped) return;
        const data = await res.json();
        setMovers(data.movers);
      } catch {}
    };
    void load();
    const id = setInterval(load, EVERY * 1000);
    return () => { stopped = true; clearInterval(id); };
  }, [enabled]);

  return movers;
}
