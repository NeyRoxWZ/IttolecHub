export * from './core';
import { secureRandomInt, type BetResolution } from './core';

// Single-guess Hi-Lo. Card values 1 (Ace) .. 13 (King), uniform, no suits,
// drawn with replacement (infinite-deck model). Payout is computed live
// from the current card so it's always mathematically fair for a 96% RTP,
// exactly like a real dynamic-odds Hi-Lo.
export const HILO_RTP = 0.96;
export type HiloDirection = 'higher' | 'lower';

export function drawCard(): number {
  return secureRandomInt(13) + 1;
}

export function getHiloPayout(currentCard: number, direction: HiloDirection): number | null {
  const count = direction === 'higher' ? 13 - currentCard : currentCard - 1;
  if (count <= 0) return null; // impossible guess (e.g. "higher" on a King)
  return Math.round((HILO_RTP * 13 / count) * 100) / 100;
}

export function resolveHilo(currentCard: number, nextCard: number, direction: HiloDirection): BetResolution & { push: boolean } {
  if (nextCard === currentCard) return { won: false, multiplier: 1, push: true };
  const actual: HiloDirection = nextCard > currentCard ? 'higher' : 'lower';
  if (actual !== direction) return { won: false, multiplier: 0, push: false };
  const payout = getHiloPayout(currentCard, direction);
  return { won: true, multiplier: payout ?? 0, push: false };
}
