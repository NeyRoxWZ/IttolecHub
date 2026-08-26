'use client';

/**
 * Celebrations worth stopping the screen for.
 *
 * A level-up used to be a toast in the corner, indistinguishable from
 * "mission terminée" — nothing about it felt like a reward. Anything routed
 * through here gets a full overlay instead.
 */

export type Celebration =
  | { kind: 'level'; level: number; reward: number }
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
