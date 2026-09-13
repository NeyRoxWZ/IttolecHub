import type { Rarity } from '@/lib/casino/cosmetics';
import { RARITY_ORDER, pickWeighted, type CrateDef, type CrateOpening, type CrateReward } from '@/lib/casino/crates';

/**
 * Krash crates: the casino's crate rules, priced for Krash's smaller economy
 * and filled with Krash cosmetics.
 */

export { RARITY_ORDER, pickWeighted };
export type { CrateDef, CrateOpening, CrateReward };

export const KRASH_CRATES: CrateDef[] = [
  {
    id: 'kcrate_wood',
    name: 'Caisse en bois',
    description: 'Surtout du commun. Le légendaire existe, mais il se fait attendre.',
    price: 300,
    odds: { commun: 0.70, rare: 0.255, epique: 0.04, legendaire: 0.005 },
  },
  {
    id: 'kcrate_silver',
    name: 'Caisse d’argent',
    description: 'Une fois sur cinq, de l’épique ou mieux.',
    price: 1_000,
    odds: { commun: 0.45, rare: 0.35, epique: 0.17, legendaire: 0.03 },
  },
  {
    id: 'kcrate_gold',
    name: 'Caisse d’or',
    description: 'Presque une sur deux sort en épique ou en légendaire.',
    price: 3_500,
    odds: { commun: 0.20, rare: 0.35, epique: 0.33, legendaire: 0.12 },
  },
  {
    id: 'kcrate_legendary',
    name: 'Caisse légendaire',
    description: 'Jamais de commun. Trois sur dix sortent en légendaire.',
    price: 10_000,
    odds: { commun: 0, rare: 0.25, epique: 0.45, legendaire: 0.30 },
  },
];

export function krashCrateById(id: string): CrateDef | undefined {
  return KRASH_CRATES.find((c) => c.id === id);
}

export function isKrashCrate(id: string): boolean {
  return KRASH_CRATES.some((c) => c.id === id);
}

/** Paid instead when nothing of that rarity is left to collect. */
export const KRASH_COINS_BY_RARITY: Record<Rarity, number> = {
  commun: 200,
  rare: 700,
  epique: 2_500,
  legendaire: 8_000,
};
