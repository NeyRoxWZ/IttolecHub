'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { sfx } from '@/lib/casino/sfx';

/**
 * The Krash balance, shared by every component on the page. Separate from the
 * casino wallet: same FrenlyCoins name, different pile.
 */

export interface KrashWalletState {
  balance: number;
  canRefill: boolean;
  refillBlocked: 'positions' | 'cooldown' | null;
  nextRefillAt: string | null;
}

interface Store extends KrashWalletState { loaded: boolean; userId: string | null }

let store: Store = {
  balance: 0, canRefill: false, refillBlocked: null, nextRefillAt: null, loaded: false, userId: null,
};
const listeners = new Set<() => void>();

function emit(next: Partial<Store>) {
  store = { ...store, ...next };
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => store;

/** Called by the positions hook, which gets the wallet with every refresh. */
export function applyKrashWallet(state: KrashWalletState | null | undefined) {
  if (state) emit({ ...state, loaded: true });
}

export function setKrashBalance(balance: number) {
  emit({ balance, loaded: true });
}

export function useKrashWallet() {
  const { user } = useAuth();
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/krash/wallet?user_id=${user.id}`, { cache: 'no-store' });
      if (res.ok) emit({ ...(await res.json()), loaded: true, userId: user.id });
    } catch {}
  }, [user]);

  useEffect(() => {
    if (user && (store.userId !== user.id || !store.loaded)) void refresh();
  }, [user, refresh]);

  const refill = useCallback(async () => {
    if (!user) return;
    const res = await fetch('/api/krash/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id }),
    });
    const data = await res.json().catch(() => ({ error: 'Erreur réseau' }));
    if (!res.ok) { toast.error(data.error ?? 'Renflouement impossible'); void refresh(); return; }
    emit({ ...data, loaded: true });
    sfx.coin();
    toast.success(`Portefeuille renfloué : ${data.balance.toLocaleString('fr-FR')} ₶`);
  }, [user, refresh]);

  return { ...state, refresh, refill };
}
