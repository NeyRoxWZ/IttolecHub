export * from './core';
import { secureRandomInt, type BetResolution } from './core';

export type CoinSide = 'pile' | 'face';

// Fair 50/50 coin, house edge lives in the payout (not in the coin) —
// same approach real "original" casino coinflips use.
// RTP = 0.5 * 1.94 = 97%.
export const COINFLIP_PAYOUT = 1.94;

export function flipCoin(): CoinSide {
  return secureRandomInt(2) === 0 ? 'pile' : 'face';
}

export function resolveCoinflip(landed: CoinSide, choice: CoinSide): BetResolution {
  const won = landed === choice;
  return { won, multiplier: won ? COINFLIP_PAYOUT : 0 };
}
