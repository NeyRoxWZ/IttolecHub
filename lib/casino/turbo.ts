'use client';

import { useSyncExternalStore } from 'react';

/**
 * Turbo mode shortens every animation in every game. It's a single shared
 * flag rather than per-game state so the choice follows the player around,
 * and it's persisted so it survives a reload.
 */

const KEY = 'itollec_casino_turbo';
const TURBO_FACTOR = 0.35;

let turbo = false;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  try { turbo = localStorage.getItem(KEY) === '1'; } catch {}
}

export function isTurbo(): boolean {
  return turbo;
}

export function setTurbo(next: boolean) {
  turbo = next;
  try { localStorage.setItem(KEY, next ? '1' : '0'); } catch {}
  listeners.forEach((l) => l());
}

/** Scale an animation delay by the current turbo setting. */
export function tempo(ms: number): number {
  return turbo ? Math.max(20, Math.round(ms * TURBO_FACTOR)) : ms;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useTurbo(): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(subscribe, () => turbo, () => false);
  return [value, setTurbo];
}
