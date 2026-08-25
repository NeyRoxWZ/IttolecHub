export * from './core';
import { secureRandomInt, type BetResolution } from './core';

// 5 crates, 1 hides the jackpot. RTP = (1/5) * 4.65 = 93%.
export const CAISSES_COUNT = 5;
export const CAISSES_PAYOUT = 4.65;

export function hideJackpot(): number {
  return secureRandomInt(CAISSES_COUNT);
}

export function resolveCaisses(jackpotCrate: number, chosenCrate: number): BetResolution {
  const won = jackpotCrate === chosenCrate;
  return { won, multiplier: won ? CAISSES_PAYOUT : 0 };
}
