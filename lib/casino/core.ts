// Shared constants/helpers used by every casino game.

export const CASINO_STARTING_BALANCE = 250;
export const CASINO_MIN_BET = 1;
export const CASINO_MAX_BET_ABS = 500;
export const CASINO_MAX_BET_PERCENT = 0.5; // can't bet more than 50% of balance in one go
export const CASINO_SAFETY_NET_THRESHOLD = 10;
export const CASINO_SAFETY_NET_AMOUNT = 50;

export function getMaxBet(balance: number): number {
  return Math.max(CASINO_MIN_BET, Math.min(CASINO_MAX_BET_ABS, Math.floor(balance * CASINO_MAX_BET_PERCENT)));
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
