export * from './core';
import { secureRandomInt, type BetResolution } from './core';

// 8-row Plinko board -> 9 buckets, binomial distribution (each peg is a
// fair 50/50 left/right). Multipliers U-shaped like a real Plinko board.
// RTP ~97% (computed from the exact binomial probabilities below).
export const PLINKO_ROWS = 8;
export const PLINKO_MULTIPLIERS = [11, 2, 1.3, 0.9, 0.3, 0.9, 1.3, 2, 11];

export function dropBall(): { bucket: number; path: ('L' | 'R')[]; multiplier: number } {
  const path: ('L' | 'R')[] = [];
  let rights = 0;
  for (let i = 0; i < PLINKO_ROWS; i++) {
    const goRight = secureRandomInt(2) === 1;
    path.push(goRight ? 'R' : 'L');
    if (goRight) rights++;
  }
  return { bucket: rights, path, multiplier: PLINKO_MULTIPLIERS[rights] };
}

export function resolvePlinko(multiplier: number): BetResolution {
  return { won: multiplier > 1, multiplier };
}
