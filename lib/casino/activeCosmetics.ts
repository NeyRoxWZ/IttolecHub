'use client';

import type { Cosmetic, CosmeticSlot } from './cosmetics';

/**
 * The loadout of the game currently on screen, published as a module-level
 * value so the pieces that react to it — the confetti burst, the loss
 * overlay, the sound pack — don't have to be threaded through twenty game
 * components by hand.
 */

export type ActiveLoadout = Partial<Record<CosmeticSlot, Cosmetic>>;

let active: ActiveLoadout = {};

export function setActiveCosmetics(loadout: ActiveLoadout) {
  active = loadout;
}

export function getActiveCosmetics(): ActiveLoadout {
  return active;
}

/* ------------------------------------------------------------------ */
/* Win / loss bus                                                      */
/* ------------------------------------------------------------------ */

export type GameOutcome = 'win' | 'lose';

const listeners = new Set<(outcome: GameOutcome) => void>();

/** Fired by the sound effects, which every game already calls. */
export function emitOutcome(outcome: GameOutcome) {
  listeners.forEach((l) => l(outcome));
}

export function subscribeOutcome(cb: (outcome: GameOutcome) => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
