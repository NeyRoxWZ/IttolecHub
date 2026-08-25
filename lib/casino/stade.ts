export * from './core';
import { secureRandomInt, type BetResolution } from './core';

// Frenly Stade — inspired by Football Studio: two cards drawn, higher wins.
// Abstracted outcome (not a literal card sim) tuned for a clean uniform
// 96% RTP across all three bet types.
export type StadeBet = 'home' | 'away' | 'draw';
export type StadeOutcome = 'home' | 'away' | 'draw';

const P_DRAW = 0.04;
const P_HOME = 0.48;
// P_AWAY = 0.48

export const STADE_PAYOUTS: Record<StadeBet, number> = {
  home: 2,
  away: 2,
  draw: 24,
};

export function drawStadeOutcome(): StadeOutcome {
  const roll = secureRandomInt(1_000_000) / 1_000_000;
  if (roll < P_DRAW) return 'draw';
  if (roll < P_DRAW + P_HOME) return 'home';
  return 'away';
}

export function resolveStade(outcome: StadeOutcome, bet: StadeBet): BetResolution {
  const won = outcome === bet;
  return { won, multiplier: won ? STADE_PAYOUTS[bet] : 0 };
}
