/**
 * Frenly Pêche — formulas. Pure functions shared by the server (which decides)
 * and the client (which displays costs, odds and previews).
 */

import {
  COSMETICS, PACK_ODDS, RARITIES, SHOP_ITEMS, VARIANTS, WEATHER, ZONES, getSpecies, speciesOfZone,
  type Cosmetic, type EffectId, type GearId, type MaterialId, type MissionType, type RarityIndex,
  type ShopItem, type Species, type TreeId, type Variant, type WeatherId,
} from './data';

export type GearLevels = Partial<Record<GearId, number>>;
export type TreeLevels = Partial<Record<TreeId, number>>;
export type Materials = Partial<Record<MaterialId, number>>;
/** Effect id → expiry timestamp (ms). */
export type Effects = Partial<Record<EffectId, number>>;

export const lvl = (map: Record<string, number | undefined> | undefined, key: string) => Math.max(0, Math.floor(Number(map?.[key] || 0)));

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

/** A seeded random stream, for things everyone must see the same way. */
export function seeded(seed: string): () => number {
  let x = hash(seed) || 1;
  return () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return ((x >>> 0) % 1_000_000) / 1_000_000;
  };
}

export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function weekKey(d = new Date()): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

/* ---- values ---- */

/** Base price of a common, average-weight fish in a spot. */
export function zoneBase(zone: number): number {
  return 5 * Math.pow(7, zone);
}

export function isActive(effects: Effects | undefined, id: EffectId, now = Date.now()): boolean {
  return Number(effects?.[id] || 0) > now;
}

/** Multiplier on every sale: prestige tree, Marées done, "Criée VIP". */
export function saleMultiplier(tree: TreeLevels, maree: number, effects?: Effects, now = Date.now()): number {
  return (1 + 0.25 * lvl(tree, 'vente')) * (1 + 0.5 * maree) * (isActive(effects, 'criee', now) ? 2 : 1);
}

/* ---- weather ---- */

export const WEATHER_SLOT_MS = 15 * 60 * 1000;

export function weatherAt(now = Date.now()): { id: WeatherId; endsAt: number } {
  const slot = Math.floor(now / WEATHER_SLOT_MS);
  const ids = Object.keys(WEATHER) as WeatherId[];
  const total = ids.reduce((s, id) => s + WEATHER[id].weight, 0);
  let roll = seeded(`weather:${slot}`)() * total;
  let id: WeatherId = 'soleil';
  for (const w of ids) { roll -= WEATHER[w].weight; if (roll <= 0) { id = w; break; } }
  return { id, endsAt: (slot + 1) * WEATHER_SLOT_MS };
}

export interface CatchMods { luck: number; variants: number; tide: number; value: number }

export function catchMods(effects: Effects | undefined, now = Date.now()): CatchMods {
  const w = WEATHER[weatherAt(now).id];
  const boussole = isActive(effects, 'boussole', now) ? 3 : 1;
  return {
    luck: w.luck * (isActive(effects, 'appat', now) ? 1.5 : 1),
    variants: w.variants * boussole,
    tide: w.tide * boussole,
    value: w.value,
  };
}

/* ---- catching ---- */

export function rarityWeights(gear: GearLevels, tree: TreeLevels, luckMult = 1): number[] {
  const luck = (1 + 0.08 * lvl(gear, 'hamecon') + 0.06 * lvl(tree, 'chance')) * luckMult;
  return RARITIES.map((r, i) => (i === 0 ? r.weight : r.weight * Math.pow(luck, i)));
}

export function rarityOdds(gear: GearLevels, tree: TreeLevels, luckMult = 1): number[] {
  const w = rarityWeights(gear, tree, luckMult);
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
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
  zone: number, gear: GearLevels, tree: TreeLevels, maree: number,
  mods: CatchMods = { luck: 1, variants: 1, tide: 1, value: 1 }, rng: () => number = Math.random,
): Catch {
  const weights = rarityWeights(gear, tree, mods.luck);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  let rarity = 0 as RarityIndex;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) { rarity = i as RarityIndex; break; }
  }

  const all = speciesOfZone(zone);
  const pool = all.filter((s) => s.rarity === rarity && !s.tide);
  let species: Species = pool[Math.floor(rng() * pool.length) % pool.length];
  // Tide species share the mythic slot once the player has done enough Marées.
  const tideNeeded = Math.min(zone + 1, 40);
  if (rarity === 4 && maree >= tideNeeded && rng() < Math.min(0.9, 0.35 * mods.tide)) {
    species = all.find((s) => s.tide) || species;
  }

  const rod = lvl(gear, 'canne');
  const skew = Math.pow(rng(), 1 / (1 + rod * 0.06));
  const weight = species.minKg + (species.maxKg - species.minKg) * skew;

  const v = rng();
  const variant: Variant = v < 0.001 * mods.variants ? 'or' : v < 0.006 * mods.variants ? 'chroma' : '';

  const avg = (species.minKg + species.maxKg) / 2;
  const value = zoneBase(zone) * RARITIES[rarity].mult * (weight / avg) * (1 + 0.12 * rod) * VARIANTS[variant].mult * mods.value;

  return { speciesId: species.id, rarity, weight, variant, value };
}

/**
 * How hard the reeling gauge is. A common fish is gentle; the rarer and the
 * more valuable the fish, the smaller the zone, the faster it moves and the
 * quicker the meter drains. Variants count as one tier (chromatic) or two
 * (golden) harder. The reel and the "Moulinet huilé" boost soften all of it.
 */
export function gaugeFor(rarity: number, gear: GearLevels, effects?: Effects, now = Date.now(), variant: Variant = '') {
  const reel = lvl(gear, 'moulinet');
  const oiled = isActive(effects, 'moulinet', now);
  const tier = rarity + (variant === 'or' ? 2 : variant === 'chroma' ? 1 : 0);
  const ease = (1 + 0.04 * reel) * (oiled ? 1.35 : 1);
  return {
    /** Share of the bar that counts as "in the zone". */
    green: Math.max(0.12, Math.min(0.6, (0.44 - 0.055 * tier) * Math.min(1.6, ease))),
    /** How hard the fish pulls the zone around. */
    speed: Math.max(0.08, (0.14 + 0.11 * tier) / ease),
    /** Meter gained per second in the zone, lost per second outside. */
    fill: Math.max(0.12, 0.3 - 0.03 * tier),
    drain: Math.max(0.05, (0.08 + 0.045 * tier) / ease),
  };
}

export const QUALITY = { perfect: 1.5, good: 1 } as const;
export type Quality = keyof typeof QUALITY | 'fail';

/** Minimum time between a cast and its reel: the bite plus a real struggle. */
export const MIN_REEL_MS = 1600;

/* ---- materials ---- */

export function rollMaterials(zone: number, rarity: number, tree: TreeLevels, rng: () => number = Math.random): Materials {
  const boost = 1 + 0.2 * lvl(tree, 'materiaux');
  const qty = (base: number) => Math.max(1, Math.round((base + Math.min(zone, 60) * 0.5) * boost));
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
      return { coins: 40 * Math.pow(1.55, L), mats: { fil: Math.ceil(2 * Math.pow(1.3, Math.min(L, 60))) } };
    case 'moulinet':
      return { coins: 60 * Math.pow(1.6, L), mats: { bois: Math.ceil(2 * Math.pow(1.3, Math.min(L, 60))) } };
    case 'hamecon':
      return {
        coins: 80 * Math.pow(1.65, L),
        mats: L < 5 ? { fil: Math.ceil(3 * Math.pow(1.3, L)), bois: 2 + L } : { metal: Math.ceil(2 * Math.pow(1.3, Math.min(L - 5, 60))) },
      };
    case 'bateau':
      return {
        coins: 1500 * Math.pow(9, L),
        mats: {
          bois: Math.ceil(10 * Math.pow(1.6, Math.min(L, 40))),
          ...(L >= 2 ? { metal: Math.ceil(4 * Math.pow(1.6, Math.min(L - 2, 40))) } : {}),
          ...(L >= 5 ? { ecaille: Math.min(L - 3, 60) } : {}),
        },
      };
    case 'auto':
      return {
        coins: 500 * Math.pow(1.75, L),
        mats: L < 3 ? { fil: 6 + 4 * L, bois: 4 + 2 * L } : { metal: Math.ceil(3 * Math.pow(1.35, Math.min(L - 3, 60))) },
      };
  }
}

/** The boat goes as deep as numbers allow; everything else has no cap. */
export function maxGearLevel(gear: GearId): number {
  return gear === 'bateau' ? 300 : Infinity;
}

/* ---- auto rod ---- */

export function autoInterval(gear: GearLevels, tree: TreeLevels, effects?: Effects, now = Date.now()): number {
  const L = lvl(gear, 'auto');
  if (L <= 0) return Infinity;
  const base = Math.max(2, (14 * Math.pow(0.9, L - 1)) / (1 + 0.1 * lvl(tree, 'auto')));
  return isActive(effects, 'turbo', now) ? Math.max(1, base / 2) : base;
}

export function autoEfficiency(gear: GearLevels, tree: TreeLevels): number {
  const L = lvl(gear, 'auto');
  return Math.min(0.85, 0.35 + 0.03 * L + 0.03 * lvl(tree, 'auto'));
}

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

export interface MarketDeal { speciesId: string; mult: number }

/** "La criée du jour": the same for everyone, one deal per band of spots. */
export function dailyMarket(key = dayKey()): { deals: MarketDeal[]; zone: number; zoneMult: number } {
  const bands = [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9, 10, 11, 12, 13, 14], ZONES.slice(15).map((z) => z.id)];
  const mults = [2, 2.5, 3];
  const deals = bands.map((zones, i) => {
    const pool = zones.flatMap((z) => speciesOfZone(z)).filter((s) => !s.tide && s.rarity <= 2);
    return { speciesId: pool[hash(`${key}:${i}`) % pool.length].id, mult: mults[i] };
  });
  return { deals, zone: hash(`${key}:zone`) % ZONES.length, zoneMult: 1.5 };
}

export function marketMultiplier(speciesId: string, key = dayKey()): number {
  const m = dailyMarket(key);
  const deal = m.deals.find((d) => d.speciesId === speciesId);
  const zone = getSpecies(speciesId)?.zone;
  return (deal?.mult ?? 1) * (zone === m.zone ? m.zoneMult : 1);
}

/* ---- level ---- */

export function xpForCatch(zone: number, rarity: number): number {
  return (rarity + 1) * (Math.min(zone, 200) + 1);
}

export function levelFromXp(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let remaining = xp;
  let need = 20;
  while (remaining >= need && level < 100_000) {
    remaining -= need;
    level++;
    need = Math.round(20 * Math.pow(level, 1.6));
  }
  return { level, into: remaining, needed: need };
}

/* ---- shop ---- */

export function shopOffer(key = dayKey()): { items: ShopItem[]; promo: string } {
  const rng = seeded(`shop:${key}`);
  const pool = [...SHOP_ITEMS];
  const items: ShopItem[] = [];
  while (items.length < 4 && pool.length) items.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return { items, promo: items[Math.floor(rng() * items.length)].id };
}

export const PROMO_DISCOUNT = 0.4;

export function itemPrice(item: ShopItem, boat: number, promo: boolean): number {
  return Math.ceil(zoneBase(boat) * item.price * (promo ? 1 - PROMO_DISCOUNT : 1));
}

export function packPrice(boat: number): number {
  return Math.ceil(zoneBase(boat) * 150);
}

export function rollCosmetic(rng: () => number = Math.random): Cosmetic {
  const total = PACK_ODDS.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  let rarity = 0;
  for (let i = 0; i < PACK_ODDS.length; i++) { roll -= PACK_ODDS[i]; if (roll <= 0) { rarity = i; break; } }
  const pool = COSMETICS.filter((c) => c.rarity === rarity);
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

/* ---- missions ---- */

export interface Mission {
  type: MissionType;
  target: number;
  progress: number;
  claimed: boolean;
}

export interface MissionSet { day: string; week: string; daily: Mission[]; weekly: Mission[] }

const DAILY_POOL: [MissionType, number][] = [['catch', 40], ['rare', 12], ['epic', 3], ['perfect', 15], ['sell', 1], ['market', 3], ['orders', 2]];
const WEEKLY_POOL: [MissionType, number][] = [['catch', 400], ['rare', 120], ['epic', 30], ['perfect', 150], ['sell', 1], ['market', 25], ['orders', 20]];

/** Sell targets follow progress; everything else is a count. */
export function sellTarget(boat: number, weekly: boolean): number {
  return Math.ceil(zoneBase(boat) * (weekly ? 5000 : 400));
}

export function missionsFor(userId: string, boat: number, day = dayKey(), week = weekKey()): MissionSet {
  const pick = (pool: [MissionType, number][], seed: string, weekly: boolean) => {
    const rng = seeded(seed);
    const bag = [...pool];
    const out: Mission[] = [];
    while (out.length < 3) {
      const [type, n] = bag.splice(Math.floor(rng() * bag.length), 1)[0];
      out.push({ type, target: type === 'sell' ? sellTarget(boat, weekly) : n, progress: 0, claimed: false });
    }
    return out;
  };
  return { day, week, daily: pick(DAILY_POOL, `${userId}:d:${day}`, false), weekly: pick(WEEKLY_POOL, `${userId}:w:${week}`, true) };
}

export function missionReward(boat: number, weekly: boolean): { coins: number; packs: number } {
  return weekly ? { coins: Math.ceil(zoneBase(boat) * 1500), packs: 1 } : { coins: Math.ceil(zoneBase(boat) * 120), packs: 0 };
}

/* ---- orders (commandes de la criée) ---- */

export interface Order { id: string; speciesId: string; count: number }

export function newOrder(boat: number, rng: () => number = Math.random): Order {
  const zone = Math.floor(rng() * (Math.min(boat, 300) + 1));
  const pool = speciesOfZone(zone).filter((s) => !s.tide && s.rarity <= 1);
  const species = pool[Math.floor(rng() * pool.length) % pool.length];
  const count = species.rarity === 0 ? 3 + Math.floor(rng() * 4) : 1 + Math.floor(rng() * 3);
  return { id: `${Date.now().toString(36)}${Math.floor(rng() * 1e6).toString(36)}`, speciesId: species.id, count };
}

/** An order pays three times what the fish would fetch at the stall. */
export const ORDER_BONUS = 3;

/* ---- daily chest, 7 days ---- */

export const CHEST_DAYS = 7;

export function chestReward(day: number, boat: number): { coins: number; packs: number } {
  const units = [80, 120, 180, 260, 360, 480, 900][Math.max(0, Math.min(CHEST_DAYS, day) - 1)];
  return { coins: Math.ceil(zoneBase(boat) * units), packs: day >= CHEST_DAYS ? 2 : 0 };
}
