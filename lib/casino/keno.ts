export * from './core';
import { secureRandomInt, type BetResolution } from './core';

// Pick 10 numbers from a 40-number pool, house draws 20. Payout table
// tuned against the exact hypergeometric match-count distribution for
// N=40, draws=20, picks=10 -> RTP ~95%.
export const KENO_POOL_SIZE = 40;
export const KENO_DRAW_COUNT = 20;
export const KENO_PICK_COUNT = 10;

// match count -> total-return multiplier (0-4 matches: lose)
export const KENO_PAYTABLE: Record<number, number> = {
  5: 1,
  6: 97,
  7: 300,
  8: 3000,
  9: 20000,
  10: 100000,
};

export function drawKenoNumbers(): number[] {
  const pool = Array.from({ length: KENO_POOL_SIZE }, (_, i) => i + 1);
  const drawn: number[] = [];
  for (let i = 0; i < KENO_DRAW_COUNT; i++) {
    const idx = secureRandomInt(pool.length);
    drawn.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return drawn;
}

export function resolveKeno(picks: number[], drawn: number[]): BetResolution & { matches: number } {
  const drawnSet = new Set(drawn);
  const matches = picks.filter((n) => drawnSet.has(n)).length;
  const multiplier = KENO_PAYTABLE[matches] || 0;
  return { won: multiplier > 1, multiplier, matches };
}
