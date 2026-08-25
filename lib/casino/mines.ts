export * from './core';
import { secureRandomInt } from './core';

// Standard provably-fair-style Mines math: after k safe reveals with M
// mines among T cells, fair multiplier = Π_{i=0}^{k-1} (T-i)/(T-M-i).
// Apply a fixed house edge on top for the actual payout.
export const MINES_TOTAL_CELLS = 25; // 5x5
export const MINES_HOUSE_EDGE = 0.96;
export const MINES_MIN_COUNT = 1;
export const MINES_MAX_COUNT = 24;

export function generateMinePositions(mineCount: number): number[] {
  const cells = Array.from({ length: MINES_TOTAL_CELLS }, (_, i) => i);
  const mines: number[] = [];
  for (let i = 0; i < mineCount; i++) {
    const idx = secureRandomInt(cells.length);
    mines.push(cells.splice(idx, 1)[0]);
  }
  return mines;
}

export function multiplierAfterReveals(mineCount: number, safeReveals: number): number {
  let fair = 1;
  for (let i = 0; i < safeReveals; i++) {
    fair *= (MINES_TOTAL_CELLS - i) / (MINES_TOTAL_CELLS - mineCount - i);
  }
  return Math.round(fair * MINES_HOUSE_EDGE * 100) / 100;
}
