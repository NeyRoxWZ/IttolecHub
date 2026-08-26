/**
 * Crates.
 *
 * One crate, one cosmetic. What you buy is not a bigger handful — it's better
 * odds on a single pull, which is the only thing that makes the expensive
 * crate meaningful rather than just "more stuff".
 */

import type { Rarity } from './cosmetics';

export interface CrateDef {
  id: string;
  name: string;
  description: string;
  price: number;
  /** Chance of each rarity on the single pull. Must sum to 1. */
  odds: Record<Rarity, number>;
}

export const CRATES: CrateDef[] = [
  {
    id: 'crate_wood',
    name: 'Caisse en bois',
    description: 'Surtout du commun. Le légendaire existe, mais il se fait attendre.',
    price: 500,
    odds: { commun: 0.70, rare: 0.255, epique: 0.04, legendaire: 0.005 },
  },
  {
    id: 'crate_silver',
    name: 'Caisse d’argent',
    description: 'Une fois sur cinq, de l’épique ou mieux.',
    price: 1_800,
    odds: { commun: 0.45, rare: 0.35, epique: 0.17, legendaire: 0.03 },
  },
  {
    id: 'crate_gold',
    name: 'Caisse d’or',
    description: 'Presque une sur deux sort en épique ou en légendaire.',
    price: 6_000,
    odds: { commun: 0.20, rare: 0.35, epique: 0.33, legendaire: 0.12 },
  },
  {
    id: 'crate_legendary',
    name: 'Caisse légendaire',
    description: 'Jamais de commun. Trois sur dix sortent en légendaire.',
    price: 18_000,
    odds: { commun: 0, rare: 0.25, epique: 0.45, legendaire: 0.30 },
  },
];

export const RARITY_ORDER: Rarity[] = ['commun', 'rare', 'epique', 'legendaire'];

export function crateById(id: string): CrateDef | undefined {
  return CRATES.find((c) => c.id === id);
}

export function isCrate(id: string): boolean {
  return CRATES.some((c) => c.id === id);
}

/** Coins paid instead, when nothing of that rarity is left to collect. */
export const COINS_BY_RARITY: Record<Rarity, number> = {
  commun: 400,
  rare: 1_400,
  epique: 5_000,
  legendaire: 20_000,
};

export interface CrateReward {
  kind: 'cosmetic' | 'coins';
  rarity: Rarity;
  cosmeticId?: string;
  amount?: number;
  /** True when the piece was already owned and got converted to coins. */
  duplicate?: boolean;
}

export interface CrateOpening {
  crateId: string;
  reward: CrateReward;
  /** Coins credited by this crate, when the pull converted. */
  coins: number;
}

/** Pick an index from a weight table using a uniform value in [0,1). */
export function pickWeighted(weights: number[], roll: number): number {
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (roll < acc) return i;
  }
  return weights.length - 1;
}
