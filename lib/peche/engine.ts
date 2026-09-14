/**
 * Pêche — formulas. Pure functions shared by the server (which decides)
 * and the client (which displays costs, odds and previews).
 */

import {
  BOSSES, COSMETICS, PACK_ODDS, PASS_COSMETICS, PASS_TIERS, RARITIES, RARITY_POINTS, SHOP_ITEMS, VARIANTS, VARIANT_POINTS, WEATHER, ZONES, getSpecies, speciesOfZone,
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

/**
 * Base price of a common, average-weight fish in a spot. Each spot pays about
 * half as much again as the previous one (it used to be seven times, which let
 * a player reach ten Marées and 10^16 coins in an afternoon).
 */
export function zoneBase(zone: number): number {
  return 10 * Math.pow(1.55, zone);
}

export function isActive(effects: Effects | undefined, id: EffectId, now = Date.now()): boolean {
  return Number(effects?.[id] || 0) > now;
}

/** Multiplier on every sale: prestige tree, Marées done, "Criée VIP". */
export function saleMultiplier(tree: TreeLevels, maree: number, effects?: Effects, now = Date.now()): number {
  return (1 + 0.1 * lvl(tree, 'vente')) * (1 + 0.2 * maree) * (isActive(effects, 'criee', now) ? 2 : 1);
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
  const value = zoneBase(zone) * RARITIES[rarity].mult * (weight / avg) * (1 + 0.08 * rod) * VARIANTS[variant].mult * mods.value;

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
  const tier = Math.min(6, rarity + (variant === 'or' ? 2 : variant === 'chroma' ? 1 : 0));
  const ease = (1 + 0.04 * reel) * (oiled ? 1.35 : 1);
  // A real step between tiers: a common is a formality, a mythic a fight.
  const GREEN = [0.44, 0.3, 0.21, 0.14, 0.1, 0.085, 0.07];
  const SPEED = [0.14, 0.34, 0.56, 0.8, 1.05, 1.25, 1.45];
  const FILL = [0.3, 0.23, 0.18, 0.14, 0.11, 0.1, 0.09];
  const DRAIN = [0.08, 0.17, 0.27, 0.38, 0.5, 0.58, 0.66];
  return {
    /** Share of the bar that counts as "in the zone". */
    green: Math.max(0.06, Math.min(0.6, GREEN[tier] * Math.min(1.6, ease))),
    /** How hard the fish pulls the zone around. */
    speed: Math.max(0.08, SPEED[tier] / ease),
    /** Meter gained per second in the zone, lost per second outside. */
    fill: FILL[tier],
    drain: Math.max(0.05, DRAIN[tier] / ease),
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
  // Every solo catch brings something, so the link between fishing and gear is obvious.
  if (!Object.keys(out).length) out.fil = qty(1);
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
        // Grows faster than a spot's value (x1.9 vs x1.55): each new spot takes a few more catches than the last.
        coins: 600 * Math.pow(1.9, L),
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
  // The auto rod helps, but playing by hand must stay clearly better.
  const base = Math.max(4, (18 * Math.pow(0.93, L - 1)) / (1 + 0.08 * lvl(tree, 'auto')));
  return isActive(effects, 'turbo', now) ? Math.max(2, base / 2) : base;
}

export function autoEfficiency(gear: GearLevels, tree: TreeLevels): number {
  const L = lvl(gear, 'auto');
  return Math.min(0.6, 0.25 + 0.02 * L + 0.02 * lvl(tree, 'auto'));
}

export const AUTO_MAX_CATCHES_PER_CALL = 20;
export const AUTO_MAX_GAP_MS = 10 * 60 * 1000;

/* ---- Marées ---- */

/**
 * What a run must earn before the next Marée: about 800 average catches' worth
 * at the spot this Marée asks to reach (spot 4 for the first, two further for
 * each one after). Marées come often, each one a little deeper.
 */
export function mareeTargetZone(maree: number): number {
  return 4 + 2 * maree;
}

export function mareeThreshold(maree: number): number {
  return Math.ceil(800 * zoneBase(mareeTargetZone(maree)));
}

/** Pearls for a Marée: steady, with at most double for overshooting the target. */
export function perlesFor(maree: number, runEarned: number): number {
  const t = mareeThreshold(maree);
  if (runEarned < t) return 0;
  return Math.floor((3 + maree) * Math.min(2, Math.sqrt(runEarned / t)));
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
  const pool = COSMETICS.filter((c) => c.rarity === rarity && !c.passOnly);
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

/* ---- V3: points, pass, boss, jackpot, shoals ---- */

export function catchPoints(rarity: number, variant: string): number {
  return (RARITY_POINTS[rarity] ?? 1) * (VARIANT_POINTS[variant] ?? 1);
}

export function monthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

/** Points needed for one pass tier, a little more each tier. */
export function passTierCost(tier: number): number {
  return 60 + tier * 6;
}

export function passLevel(xp: number): { tier: number; into: number; needed: number } {
  let tier = 0;
  let left = xp;
  while (tier < PASS_TIERS && left >= passTierCost(tier + 1)) { left -= passTierCost(tier + 1); tier++; }
  return { tier, into: left, needed: tier >= PASS_TIERS ? 0 : passTierCost(tier + 1) };
}

export function passReward(tier: number, boat: number): { coins: number; packs: number; perles: number } {
  return {
    coins: Math.ceil(zoneBase(boat) * (40 + tier * 6)),
    packs: tier === PASS_TIERS ? 2 : tier % 10 === 0 ? 1 : 0,
    perles: tier % 10 === 0 ? 2 : 0,
  };
}

/** The premium track: more of everything, and an exclusive cosmetic every ten tiers. */
export function passPremiumReward(tier: number, boat: number): { coins: number; packs: number; perles: number; cosmeticId: string | null } {
  return {
    coins: Math.ceil(zoneBase(boat) * (100 + tier * 15)),
    packs: tier === PASS_TIERS ? 5 : tier % 3 === 0 ? 1 : 0,
    perles: tier % 5 === 0 ? 3 : 0,
    cosmeticId: tier % 10 === 0 ? PASS_COSMETICS[tier / 10 - 1] ?? null : null,
  };
}

/** Unlocking the premium track for the month, priced on progress with a floor. */
export function passPremiumPrice(boat: number): number {
  return Math.max(50_000, Math.ceil(zoneBase(boat) * 6000));
}

/**
 * Where you fish. Solo is for progress: catches bring materials. The public
 * port is for money: no materials, but every catch is worth half as much again.
 */
export type FishingMode = 'solo' | 'public';
export const PUBLIC_VALUE_MULT = 1.5;

export function bossFor(week = weekKey()): { name: string; maxHp: number } {
  return { name: BOSSES[hash(`boss:${week}`) % BOSSES.length], maxHp: 20_000 };
}

export function bossReward(boat: number): { coins: number; packs: number; perles: number } {
  return { coins: Math.ceil(zoneBase(boat) * 800), packs: 2, perles: 2 };
}

/** Share of every sale that feeds the golden-fish jackpot, in "zone base" units. */
export const JACKPOT_RATE = 0.02;

export const SHOAL_SLOT_MS = 10 * 60 * 1000;

/** A shoal passes through one hand-made spot at a time: catches there are worth ×2. */
export function shoalAt(now = Date.now()): { zone: number; endsAt: number; mult: number } {
  const slot = Math.floor(now / SHOAL_SLOT_MS);
  return { zone: hash(`shoal:${slot}`) % ZONES.length, endsAt: (slot + 1) * SHOAL_SLOT_MS, mult: 2 };
}
