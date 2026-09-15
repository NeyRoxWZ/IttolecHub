import { useSyncExternalStore } from 'react';

/**
 * What the casino's tab bar needs from the hub. The bar lives in the casino
 * layout, so it stays put between pages; the hub already knows the counts and
 * owns the modals, so it publishes the one and listens for the other.
 */

export type CasinoOpen = 'missions' | 'jackpot' | 'prestige' | 'guide';
export const CASINO_OPEN_EVENT = 'itollec:casino-open';

type Badges = { missions: number; pass: number };
const EMPTY: Badges = { missions: 0, pass: 0 };
let badges: Badges = EMPTY;
const listeners = new Set<() => void>();

export function setNavBadges(next: Partial<Badges>) {
  const merged = { ...badges, ...next };
  if (merged.missions === badges.missions && merged.pass === badges.pass) return;
  badges = merged;
  listeners.forEach((l) => l());
}

export function useNavBadges(): Badges {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => badges,
    () => EMPTY,
  );
}
