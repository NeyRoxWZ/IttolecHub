// Shared constants/helpers used by every casino game.

export const CASINO_STARTING_BALANCE = 250;
export const CASINO_MIN_BET = 1;
// The cap is purely proportional: a flat ceiling made every big balance
// unplayable, while the percentage is what actually prevents a one-click
// all-in. A player with 2 000 000 can stake 1 000 000, not 500.
export const CASINO_MAX_BET_PERCENT = 0.5;
export const CASINO_SAFETY_NET_THRESHOLD = 10;
export const CASINO_SAFETY_NET_AMOUNT = 50;

export function getMaxBet(balance: number): number {
  return Math.max(CASINO_MIN_BET, Math.floor(balance * CASINO_MAX_BET_PERCENT));
}

export function secureRandomInt(maxExclusive: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % maxExclusive;
}

export interface BetResolution {
  won: boolean;
  multiplier: number; // total-return multiplier (0 on loss, includes stake on win)
  meta?: any;
}
