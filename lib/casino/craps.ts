export * from './core';
import { secureRandomInt, type BetResolution } from './core';

// Frenly Craps Express — single "Pass Line" bet, real craps rules and odds
// (authentic ~98.6% RTP, no need to fudge probabilities like the abstracted
// games): 7/11 on the come-out roll wins immediately, 2/3/12 loses
// immediately, anything else becomes the "point" and re-rolls until it
// repeats (win) or a 7 shows (loss).
export const CRAPS_PAYOUT = 2; // 1:1, total return 2x

export interface DiceRoll { d1: number; d2: number; sum: number }

function rollDice(): DiceRoll {
  const d1 = secureRandomInt(6) + 1;
  const d2 = secureRandomInt(6) + 1;
  return { d1, d2, sum: d1 + d2 };
}

const MAX_ROLLS_SAFETY = 200; // resolves with probability 1 in real math; hard cap just in case

export function playPassLine(): { won: boolean; rolls: DiceRoll[]; point: number | null } {
  const rolls: DiceRoll[] = [];
  const comeOut = rollDice();
  rolls.push(comeOut);

  if (comeOut.sum === 7 || comeOut.sum === 11) return { won: true, rolls, point: null };
  if (comeOut.sum === 2 || comeOut.sum === 3 || comeOut.sum === 12) return { won: false, rolls, point: null };

  const point = comeOut.sum;
  for (let i = 0; i < MAX_ROLLS_SAFETY; i++) {
    const r = rollDice();
    rolls.push(r);
    if (r.sum === point) return { won: true, rolls, point };
    if (r.sum === 7) return { won: false, rolls, point };
  }
  // Astronomically unlikely; treat as a loss rather than hang.
  return { won: false, rolls, point };
}

export function resolveCraps(won: boolean): BetResolution {
  return { won, multiplier: won ? CRAPS_PAYOUT : 0 };
}
