'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * The items currently running, shared by every page.
 *
 * They used to be visible only inside the shop's inventory panel, so nothing
 * on a game screen said whether your insurance was still covering you or how
 * many bets your win bonus had left.
 */

export interface ActiveEffect {
  effect: string;
  magnitude: number;
  uses_left: number | null;
  expires_at: string | null;
}

export type EffectMap = Record<string, ActiveEffect>;

let effects: EffectMap = {};
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

const getSnapshot = () => effects;

export async function refreshActiveEffects(userId: string) {
  const res = await fetch(`/api/casino/inventory?user_id=${userId}`);
  if (!res.ok) return;
  const data = await res.json();
  effects = data.effects || {};
  loaded = true;
  emit();
}

/** Drop a use locally so the counter moves with the bet, not a refetch later. */
export function consumeEffectLocally(name: string) {
  const current = effects[name];
  if (!current || current.uses_left === null) return;

  const left = current.uses_left - 1;
  const next = { ...effects };
  if (left <= 0) delete next[name];
  else next[name] = { ...current, uses_left: left };
  effects = next;
  emit();
}

export function useActiveEffects(): EffectMap {
  const { user } = useAuth();
  const store = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const load = useCallback(() => {
    if (!user) return;
    void refreshActiveEffects(user.id);
  }, [user]);

  useEffect(() => {
    if (!user || loaded) return;
    load();
  }, [user, load]);

  // Time-based items expire on their own; re-read every so often so an
  // expired one leaves the bar without a page change.
  useEffect(() => {
    if (!user) return;
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [user, load]);

  return store;
}
