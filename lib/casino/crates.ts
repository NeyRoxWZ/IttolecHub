/**
 * Crates.
 *
 * The tension is in the *count*: a crate opens on three, four or five
 * rewards, and the count itself tells you how good the pull is before you
 * even read it. Three rewards means nothing rare is inside, four opens the
 * door to rare, five is where épique and légendaire live. Better crates
 * don't hand out better items directly — they shift the odds of rolling a
 * bigger count.
 */

import type { Rarity } from './cosmetics';

export interface CrateDef {
  id: string;
  name: string;
  description: string;
  price: number;
  /** Odds of opening on 3 / 4 / 5 rewards. Must sum to 1. */
  countWeights: [number, number, number];
}

export const CRATES: CrateDef[] = [
  {
    id: 'crate_wood',
    name: 'Caisse en bois',
    description: '3 à 5 objets. Rarement plus de trois — mais ça arrive.',
    price: 800,
    countWeights: [0.80, 0.18, 0.02],
  },
  {
    id: 'crate_silver',
    name: 'Caisse d’argent',
    description: 'Une chance sur trois d’ouvrir sur quatre objets ou plus.',
    price: 2_500,
    countWeights: [0.55, 0.35, 0.10],
  },
  {
    id: 'crate_gold',
    name: 'Caisse d’or',
    description: 'Trois fois sur quatre, elle s’ouvre sur quatre objets ou cinq.',
    price: 7_000,
    countWeights: [0.25, 0.45, 0.30],
  },
  {
    id: 'crate_legendary',
    name: 'Caisse légendaire',
    description: 'Jamais moins de quatre objets, et plus d’une fois sur deux : cinq.',
    price: 20_000,
    countWeights: [0, 0.45, 0.55],
  },
];

export function crateById(id: string): CrateDef | undefined {
  return CRATES.find((c) => c.id === id);
}

export function isCrate(id: string): boolean {
  return CRATES.some((c) => c.id === id);
}

/**
 * Rarity odds for each opened count. Three rewards can never contain
 * anything rare — that's the whole point of the count telling you something.
 */
export const RARITY_BY_COUNT: Record<3 | 4 | 5, Record<Rarity, number>> = {
  3: { commun: 1, rare: 0, epique: 0, legendaire: 0 },
  4: { commun: 0.70, rare: 0.30, epique: 0, legendaire: 0 },
  5: { commun: 0.30, rare: 0.40, epique: 0.25, legendaire: 0.05 },
};

/** Coin fallback when no unowned cosmetic of that rarity is left. */
export const COINS_BY_RARITY: Record<Rarity, number> = {
  commun: 350,
  rare: 1_200,
  epique: 4_000,
  legendaire: 15_000,
};

export interface CrateReward {
  kind: 'cosmetic' | 'coins' | 'item';
  rarity: Rarity;
  cosmeticId?: string;
  itemId?: string;
  amount?: number;
  /** True when the piece was already owned and got converted to coins. */
  duplicate?: boolean;
}

export interface CrateOpening {
  crateId: string;
  count: 3 | 4 | 5;
  rewards: CrateReward[];
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
