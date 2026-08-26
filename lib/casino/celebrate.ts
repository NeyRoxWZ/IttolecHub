'use client';

/**
 * Moments worth announcing. Only the jackpot stops the screen; a level is a
 * pass tier and slides in from the top so the run can continue underneath.
 */

export type Celebration =
  /** A level, i.e. a pass tier — shown as a banner, never blocking. */
  | { kind: 'pass_tier'; tiers: number[] }
  | { kind: 'jackpot'; amount: number };

const queue: Celebration[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function celebrate(event: Celebration) {
  queue.push(event);
  emit();
}

export function peekCelebration(): Celebration | null {
  return queue[0] ?? null;
}

export function dismissCelebration() {
  queue.shift();
  emit();
}

export function subscribeCelebrations(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
