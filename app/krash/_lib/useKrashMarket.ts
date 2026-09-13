'use client';

import { useEffect, useRef, useState } from 'react';
import { KRASH_TICK, type MarketId } from '@/lib/krash/assets';
import type { KrashNews } from '@/lib/krash/newsMeta';

export interface MarketAsset {
  id: string;
  price: number;
  prev: number;
  hourAgo: number;
}

export interface MarketSnapshot {
  at: number;
  market: MarketId;
  assets: MarketAsset[];
  news: KrashNews[];
  /** The KRACH or BULL RUN of the last quarter hour, if any. */
  event: KrashNews | null;
  /** The announced result waiting to be revealed, if any. */
  upcoming?: KrashNews | null;
}

/** Live points kept per asset for the chart: fifteen minutes at one per tick. */
const LIVE_POINTS = 450;

let clockOffset = 0;
let clockSynced: Promise<void> | null = null;

/**
 * The server's clock, measured once per page load. The market only answers
 * for ticks that have happened, so asking by the local clock of a phone set
 * a few seconds fast would just get refused.
 */
function syncClock(): Promise<void> {
  if (!clockSynced) {
    clockSynced = (async () => {
      try {
        const start = Date.now();
        const data = await fetch('/api/time', { cache: 'no-store' }).then((r) => r.json());
        const latency = (Date.now() - start) / 2;
        clockOffset = data.time + latency - Date.now();
      } catch {
        clockOffset = 0;
      }
    })();
  }
  return clockSynced;
}

export function serverNow(): number {
  return (Date.now() + clockOffset) / 1000;
}

/**
 * Polls one market, tick by tick. Each request names a tick that has already
 * passed, so every player asking for the same tick shares one cached answer.
 */
export function useKrashMarket(market: MarketId, enabled = true) {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const live = useRef(new Map<string, [number, number][]>());

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let lastAt = 0;
    let inFlight = false;
    live.current = new Map();
    setSnapshot(null);

    const poll = async () => {
      if (inFlight) return;
      await syncClock();
      // One tick behind the server's now, so the tick has surely closed.
      const at = Math.floor(serverNow() / KRASH_TICK) * KRASH_TICK - KRASH_TICK;
      if (at <= lastAt) return;
      inFlight = true;
      try {
        const res = await fetch(`/api/krash/market?m=${market}&at=${at}`);
        if (!res.ok || stopped) return;
        const data: MarketSnapshot = await res.json();
        if (data.at <= lastAt) return;
        lastAt = data.at;
        for (const a of data.assets) {
          const series = live.current.get(a.id) ?? [];
          series.push([data.at, a.price]);
          if (series.length > LIVE_POINTS) series.splice(0, series.length - LIVE_POINTS);
          live.current.set(a.id, series);
        }
        setSnapshot(data);
      } catch {
        // A missed tick is not worth a message; the next one fills the gap.
      } finally {
        inFlight = false;
      }
    };

    void poll();
    const id = setInterval(poll, 700);
    return () => { stopped = true; clearInterval(id); };
  }, [market, enabled]);

  return { snapshot, live: live.current };
}
