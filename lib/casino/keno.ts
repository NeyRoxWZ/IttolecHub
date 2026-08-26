export * from './core';
import { secureRandomInt, type BetResolution } from './core';

// Pick 10 numbers from a 40-number pool, house draws 20.
//
// With 20 of 40 numbers drawn, the match count is symmetric around 5 and very
// flat: 6 matches lands 22% of the time and 7 lands 10%. The paytable is
// weighted against that exact hypergeometric distribution
//   P(k) = C(20,k)·C(20,10-k) / C(40,10)
// so the expected return is
//   0.2215·1 + 0.1043·2 + 0.0282·8 + 0.0040·40 + 0.000218·600 ≈ 0.945.
export const KENO_POOL_SIZE = 40;
export const KENO_DRAW_COUNT = 20;
export const KENO_PICK_COUNT = 10;

// match count -> total-return multiplier (0-5 matches: lose, 6: stake back)
export const KENO_PAYTABLE: Record<number, number> = {
  6: 1,
  7: 2,
  8: 8,
  9: 40,
  10: 600,
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
