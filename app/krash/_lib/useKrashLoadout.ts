'use client';

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { sfx } from '@/lib/casino/sfx';
import { KRASH_SLOTS, krashCosmeticById, type KrashCosmetic, type KrashSlot } from '@/lib/krash/cosmetics';

/** Owned and equipped Krash cosmetics, shared by every page and the skin layer. */

interface Store {
  owned: string[];
  equipped: Partial<Record<KrashSlot, string>>;
  loaded: boolean;
  userId: string | null;
}

let store: Store = { owned: [], equipped: {}, loaded: false, userId: null };
const listeners = new Set<() => void>();
const emit = (next: Partial<Store>) => { store = { ...store, ...next }; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => store;

export async function refreshKrashLoadout(userId: string) {
  try {
    const res = await fetch(`/api/krash/cosmetics?user_id=${userId}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      emit({ owned: data.owned, equipped: data.equipped, loaded: true, userId });
    }
  } catch {}
}

export function useKrashLoadout() {
  const { user } = useAuth();
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);

  useEffect(() => {
    if (user && (state.userId !== user.id || !state.loaded)) void refreshKrashLoadout(user.id);
  }, [user, state.userId, state.loaded]);

  const cosmetics = useMemo(() => {
    const out: Partial<Record<KrashSlot, KrashCosmetic>> = {};
    for (const slot of KRASH_SLOTS) {
      const id = state.equipped[slot];
      const c = id ? krashCosmeticById(id) : undefined;
      if (c) out[slot] = c;
    }
    return out;
  }, [state.equipped]);

  const equip = useCallback(async (slot: KrashSlot, cosmeticId: string | null) => {
    if (!user) return false;
    const res = await fetch('/api/krash/cosmetics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, slot, cosmetic_id: cosmeticId }),
    });
    const data = await res.json().catch(() => ({ error: 'Erreur réseau' }));
    if (!res.ok) { toast.error(data.error ?? 'Impossible d’équiper'); return false; }
    sfx.select();
    emit({ owned: data.owned, equipped: data.equipped, loaded: true, userId: user.id });
    return true;
  }, [user]);

  return { ...state, cosmetics, equip, refresh: () => (user ? refreshKrashLoadout(user.id) : Promise.resolve()) };
}
