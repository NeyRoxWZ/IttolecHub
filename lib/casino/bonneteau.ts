export * from './core';
import { secureRandomInt, type BetResolution } from './core';

// 3 cups, 1 hides the ball. RTP = (1/3) * 2.79 = 93%.
export const BONNETEAU_CUPS = 3;
export const BONNETEAU_PAYOUT = 2.79;

export function hideBall(): number {
  return secureRandomInt(BONNETEAU_CUPS);
}

export function resolveBonneteau(ballCup: number, chosenCup: number): BetResolution {
  const won = ballCup === chosenCup;
  return { won, multiplier: won ? BONNETEAU_PAYOUT : 0 };
}
