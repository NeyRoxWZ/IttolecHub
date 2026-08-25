export * from './core';
import { secureRandomInt, type BetResolution } from './core';

// Cheap ticket, frequent small wins, rare big one. RTP = 90% exactly by
// construction (sum(P)=1, sum(P*mult)=0.90).
export type GrattageTier = 'lose' | 'small' | 'medium' | 'big' | 'jackpot';

const TIERS: { tier: GrattageTier; p: number; mult: number }[] = [
  { tier: 'lose', p: 0.60, mult: 0 },
  { tier: 'small', p: 0.32, mult: 1 },
  { tier: 'medium', p: 0.06, mult: 3 },
  { tier: 'big', p: 0.015, mult: 15 },
  { tier: 'jackpot', p: 0.005, mult: 35 },
];

export function scratchTicket(): { tier: GrattageTier; multiplier: number } {
  const roll = secureRandomInt(1_000_000) / 1_000_000;
  let cumulative = 0;
  for (const t of TIERS) {
    cumulative += t.p;
    if (roll < cumulative) return { tier: t.tier, multiplier: t.mult };
  }
  return { tier: 'lose', multiplier: 0 };
}

export function resolveGrattage(multiplier: number): BetResolution {
  return { won: multiplier > 1, multiplier };
}
