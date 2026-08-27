'use client';

import type { Cosmetic, CosmeticSlot } from './cosmetics';

/**
 * The cosmetics in force right now, published as a module value so the pieces
 * that react to them — the confetti burst, the loss overlay, the sound pack,
 * the page background — don't have to be threaded through every component.
 *
 * Two layers: the general set applies everywhere, and the game currently on
 * screen overrides it slot by slot. Without the split, leaving a game left its
 * skin behind on the hub.
 */

export type ActiveLoadout = Partial<Record<CosmeticSlot, Cosmetic>>;

let globalLayer: ActiveLoadout = {};
let gameLayer: ActiveLoadout = {};
let merged: ActiveLoadout = {};

const listeners = new Set<() => void>();

function recompute() {
  merged = { ...globalLayer, ...gameLayer };
  listeners.forEach((l) => l());
}

/** The general set: applies to every game and every screen. */
export function setGlobalCosmetics(loadout: ActiveLoadout) {
  globalLayer = loadout;
  recompute();
}

/** The game on screen. Pass an empty object when leaving it. */
export function setGameCosmetics(loadout: ActiveLoadout) {
  gameLayer = loadout;
  recompute();
}

export function getActiveCosmetics(): ActiveLoadout {
  return merged;
}

export function getGlobalCosmetics(): ActiveLoadout {
  return globalLayer;
}

export function subscribeCosmetics(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/* ------------------------------------------------------------------ */
/* Screen skinning preference                                          */
/* ------------------------------------------------------------------ */

const SCREENS_KEY = 'itollec_casino_skin_screens';

let screensEnabled = true;
if (typeof window !== 'undefined') {
  try { screensEnabled = localStorage.getItem(SCREENS_KEY) !== '0'; } catch {}
}

/** Whether the general set also paints the pages, not just the games. */
export function screensSkinned(): boolean {
  return screensEnabled;
}

export function setScreensSkinned(value: boolean) {
  screensEnabled = value;
  try { localStorage.setItem(SCREENS_KEY, value ? '1' : '0'); } catch {}
  recompute();
}

/* ------------------------------------------------------------------ */
/* Win / loss bus                                                      */
/* ------------------------------------------------------------------ */

export type GameOutcome = 'win' | 'lose';

const outcomeListeners = new Set<(outcome: GameOutcome) => void>();

/** Fired by the sound effects, which every game already calls. */
export function emitOutcome(outcome: GameOutcome) {
  outcomeListeners.forEach((l) => l(outcome));
}

export function subscribeOutcome(cb: (outcome: GameOutcome) => void) {
  outcomeListeners.add(cb);
  return () => { outcomeListeners.delete(cb); };
}
