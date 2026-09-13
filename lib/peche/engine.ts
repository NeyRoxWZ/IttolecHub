/**
 * Frenly Pêche — formulas. Pure functions shared by the server (which decides)
 * and the client (which displays costs, odds and previews).
 */

import {
  RARITIES, SPECIES, VARIANTS, ZONES,
  type GearId, type MaterialId, type RarityIndex, type Species, type TreeId, type Variant,
} from './data';

export type GearLevels = Partial<Record<GearId, number>>;
export type TreeLevels = Partial<Record<TreeId, number>>;
export type Materials = Partial<Record<MaterialId, number>>;

export const lvl = (map: Record<string, number | undefined> | undefined, key: string) => Math.max(0, Math.floor(Number(map?.[key] || 0)));

/* ---- values ---- */

/** Base price of a common, average-weight fish in a spot. */
export function zoneBase(zone: number): number {
  return 5 * Math.pow(7, zone);
}

/** Multiplier on every sale: prestige tree and Marées done. */
export function saleMultiplier(tree: TreeLevels, maree: number): number {
  return (1 + 0.25 * lvl(tree, 'vente')) * (1 + 0.5 * maree);
}

/* ---- catching ---- */

export function rarityWeights(gear: GearLevels, tree: TreeLevels): number[] {
  const luck = 1 + 0.08 * lvl(gear, 'hamecon') + 0.06 * lvl(tree, 'chance');
  // Luck lifts every tier above common, more for the rarer ones.
  return RARITIES.map((r, i) => (i === 0 ? r.weight : r.weight * Math.pow(luck, i)));
}

export function rarityOdds(gear: GearLevels, tree: TreeLevels): number[] {
  const w = rarityWeights(gear, tree);
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
}

function pick<T>(list: T[], rng: () => number): T {
  return list[Math.floor(rng() * list.length) % list.length];
}

export interface Catch {
  speciesId: string;
  rarity: RarityIndex;
  weight: number;
  variant: Variant;
  /** Value before sale multipliers and catch quality. */
  value: number;
}

export function rollCatch(
  zone: number, gear: GearLevels, tree: TreeLevels, maree: number, rng: () => number = Math.random,
): Catch {
  const weights = rarityWeights(gear, tree);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  let rarity = 0 as RarityIndex;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { rarity = i as RarityIndex; break; }
  }

  const pool = SPECIES.filter((s) => s.zone === zone && s.rarity === rarity && !s.tide);
  let species: Species = pick(pool, rng);
  // Tide species share the mythic slot once the player has done enough Marées.
  if (rarity === 4 && maree >= zone + 1 && rng() < 0.35) {
    species = SPECIES.find((s) => s.zone === zone && s.tide) || species;
  }

  // Heavier fish lean toward the top of the range as the rod improves.
  const rod = lvl(gear, 'canne');
  const skew = Math.pow(rng(), 1 / (1 + rod * 0.06));
  const weight = species.minKg + (species.maxKg - species.minKg) * skew;

  const v = rng();
  const variant: Variant = v < 0.001 ? 'or' : v < 0.006 ? 'chroma' : '';

  const avg = (species.minKg + species.maxKg) / 2;
  const value = zoneBase(zone) * RARITIES[rarity].mult * (weight / avg) * (1 + 0.12 * rod) * VARIANTS[variant].mult;

  return { speciesId: species.id, rarity, weight, variant, value };
}

/** How hard the reeling gauge is for a rarity. */
export function gaugeFor(rarity: number, gear: GearLevels) {
  const reel = lvl(gear, 'moulinet');
  return {
    /** Share of the bar that counts as "in the zone". */
    green: Math.max(0.12, Math.min(0.45, 0.34 - 0.045 * rarity + 0.012 * reel)),
    /** How fast the fish drags the zone around, bar heights per second. */
    speed: 0.3 + 0.16 * rarity,
  };
}

export const QUALITY = { perfect: 1.5, good: 1 } as const;
export type Quality = keyof typeof QUALITY | 'fail';

/** Minimum time between a cast and its reel: the bite plus a real struggle. */
export const MIN_REEL_MS = 1600;

/* ---- materials ---- */

export function rollMaterials(zone: number, rarity: number, tree: TreeLevels, rng: () => number = Math.random): Materials {
  const boost = 1 + 0.2 * lvl(tree, 'materiaux');
  const qty = (base: number) => Math.max(1, Math.round((base + zone * 0.5) * boost));
  const out: Materials = {};
  if (rng() < 0.45) out.fil = qty(1);
  if (rng() < 0.3) out.bois = qty(1);
  if (zone >= 2 && rng() < 0.2) out.metal = qty(0.5);
  if (rng() < 0.03 * (rarity + 1)) out.ecaille = Math.max(1, Math.round(boost));
  return out;
}

/* ---- gear ---- */

export interface Cost { coins: number; mats: Materials }

export function gearCost(gear: GearId, level: number): Cost {
  const L = level;
  switch (gear) {
    case 'canne':
      return { coins: 40 * Math.pow(1.55, L), mats: { fil: Math.ceil(2 * Math.pow(1.3, L)) } };
    case 'moulinet':
      return { coins: 60 * Math.pow(1.6, L), mats: { bois: Math.ceil(2 * Math.pow(1.3, L)) } };
    case 'hamecon':
      return {
        coins: 80 * Math.pow(1.65, L),
        mats: L < 5 ? { fil: Math.ceil(3 * Math.pow(1.3, L)), bois: 2 + L } : { metal: Math.ceil(2 * Math.pow(1.3, L - 5)) },
      };
    case 'bateau':
      return {
        coins: 1500 * Math.pow(9, L),
        mats: {
          bois: Math.ceil(10 * Math.pow(2, L)),
          ...(L >= 2 ? { metal: Math.ceil(4 * Math.pow(2, L - 2)) } : {}),
          ...(L >= 5 ? { ecaille: L - 3 } : {}),
        },
      };
    case 'auto':
      return {
        coins: 500 * Math.pow(1.75, L),
        mats: L < 3 ? { fil: 6 + 4 * L, bois: 4 + 2 * L } : { metal: Math.ceil(3 * Math.pow(1.35, L - 3)) },
      };
  }
}

export function maxGearLevel(gear: GearId): number {
  return gear === 'bateau' ? ZONES.length - 1 : Infinity;
}

/* ---- auto rod ---- */

export function autoInterval(gear: GearLevels, tree: TreeLevels): number {
  const L = lvl(gear, 'auto');
  if (L <= 0) return Infinity;
  return Math.max(2, (14 * Math.pow(0.9, L - 1)) / (1 + 0.1 * lvl(tree, 'auto')));
}

export function autoEfficiency(gear: GearLevels, tree: TreeLevels): number {
  const L = lvl(gear, 'auto');
  return Math.min(0.85, 0.35 + 0.03 * L + 0.03 * lvl(tree, 'auto'));
}

/** Catch-up is capped: throttled background tabs are fine, days away are not. */
export const AUTO_MAX_CATCHES_PER_CALL = 20;
export const AUTO_MAX_GAP_MS = 10 * 60 * 1000;

/* ---- Marées ---- */

export function mareeThreshold(maree: number): number {
  return 1e6 * Math.pow(8, maree);
}

export function perlesFor(maree: number, runEarned: number): number {
  const t = mareeThreshold(maree);
  if (runEarned < t) return 0;
  return Math.floor(5 * (maree + 1) * Math.sqrt(runEarned / t));
}

export function treeCost(node: TreeId, level: number): number {
  const base = node === 'depart' ? 8 : 3;
  return Math.ceil(base * Math.pow(1.8, level));
}

/* ---- daily market ---- */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export interface MarketDeal { speciesId: string; mult: number }

/**
 * "La criée du jour": a few species sell for more today, the same for
 * everyone, one per band of spots so every player has something in reach.
 */
export function dailyMarket(key = dayKey()): { deals: MarketDeal[]; zone: number; zoneMult: number } {
  const bands = [[0, 1, 2], [3, 4, 5], [6, 7, 8, 9]];
  const mults = [2, 2.5, 3];
  const deals = bands.map((zones, i) => {
    const pool = SPECIES.filter((s) => zones.includes(s.zone) && !s.tide && s.rarity <= 2);
    return { speciesId: pool[hash(`${key}:${i}`) % pool.length].id, mult: mults[i] };
  });
  return { deals, zone: hash(`${key}:zone`) % ZONES.length, zoneMult: 1.5 };
}

export function marketMultiplier(speciesId: string, key = dayKey()): number {
  const m = dailyMarket(key);
  const deal = m.deals.find((d) => d.speciesId === speciesId);
  const zone = SPECIES.find((s) => s.id === speciesId)?.zone;
  return (deal?.mult ?? 1) * (zone === m.zone ? m.zoneMult : 1);
}

/* ---- level ---- */

export function xpForCatch(zone: number, rarity: number): number {
  return (rarity + 1) * (zone + 1);
}

export function levelFromXp(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let remaining = xp;
  let need = 20;
  while (remaining >= need && level < 10_000) {
    remaining -= need;
    level++;
    need = Math.round(20 * Math.pow(level, 1.6));
  }
  return { level, into: remaining, needed: need };
}
