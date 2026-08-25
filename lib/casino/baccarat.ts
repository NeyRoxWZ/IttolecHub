export * from './core';
import { secureRandomInt, type BetResolution } from './core';

export type BaccaratBet = 'player' | 'banker' | 'tie';
export type BaccaratOutcome = 'player' | 'banker' | 'tie';

// Standard 8-deck baccarat odds (well documented): Banker 45.86%,
// Player 44.62%, Tie 9.52%. Ties push Player/Banker bets (stake returned),
// only the Tie bet wins on a tie — same as real casino rules.
const P_BANKER = 0.4586;
const P_PLAYER = 0.4462;
// remaining ~0.0952 is Tie

export const BACCARAT_PAYOUTS: Record<BaccaratBet, number> = {
  banker: 1.95, // 5% commission on banker wins
  player: 2,
  tie: 9,
};

export function drawBaccaratOutcome(): BaccaratOutcome {
  const roll = secureRandomInt(1_000_000) / 1_000_000;
  if (roll < P_BANKER) return 'banker';
  if (roll < P_BANKER + P_PLAYER) return 'player';
  return 'tie';
}

export function resolveBaccarat(outcome: BaccaratOutcome, bet: BaccaratBet): BetResolution {
  if (bet === 'tie') {
    const won = outcome === 'tie';
    return { won, multiplier: won ? BACCARAT_PAYOUTS.tie : 0 };
  }
  // Player/Banker bets push on a tie (stake returned, no win/loss).
  if (outcome === 'tie') return { won: false, multiplier: 1 };
  const won = outcome === bet;
  return { won, multiplier: won ? BACCARAT_PAYOUTS[bet] : 0 };
}
