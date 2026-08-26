'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  cosmeticById, COSMETIC_SLOTS, GLOBAL_SLUG,
  type Cosmetic, type CosmeticSlot,
} from '@/lib/casino/cosmetics';

/**
 * The equipped loadout, loaded once per session and shared by every game —
 * a game page must not spend a round-trip on cosmetics before it can render.
 */

export type Loadout = Partial<Record<CosmeticSlot, Cosmetic>>;

interface Snapshot {
  /** { [gameSlug]: { [slot]: cosmeticId } } as stored server-side. */
  equipped: Record<string, Record<string, string>>;
  loaded: boolean;
}

let snapshot: Snapshot = { equipped: {}, loaded: false };
const listeners = new Set<() => void>();

function setSnapshot(next: Snapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

const getSnapshot = () => snapshot;

/** Refetch after equipping something, so the game picks it up immediately. */
export async function refreshCosmetics(userId: string) {
  const res = await fetch(`/api/casino/cosmetics?user_id=${userId}`);
  if (!res.ok) return;
  const data = await res.json();
  setSnapshot({ equipped: data.equipped || {}, loaded: true });
}

export function useGameCosmetics(gameSlug: string): Loadout {
  const { user } = useAuth();
  const store = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!user || store.loaded) return;
    void refreshCosmetics(user.id);
  }, [user, store.loaded]);

  const resolve = useCallback((): Loadout => {
    const global = store.equipped[GLOBAL_SLUG] || {};
    const local = store.equipped[gameSlug] || {};
    const out: Loadout = {};
    for (const slot of COSMETIC_SLOTS) {
      // A piece bought for this game beats the general set.
      const id = local[slot] || global[slot];
      if (!id) continue;
      const c = cosmeticById(id);
      if (c) out[slot] = c;
    }
    return out;
  }, [store, gameSlug]);

  return resolve();
}
