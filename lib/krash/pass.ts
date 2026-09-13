import { KRASH_CRATES, krashCrateById } from './crates';
import { KRASH_SHOP_ITEMS, krashItemById } from './shop';
import { krashCosmeticById, krashPassCosmetics, krashSeason } from './cosmetics';

/**
 * Pass Krash — the Frenly Pass's logic on Krash: 100 tiers a month, a free
 * track and a premium track bought for the month, progress driven by actions
 * rather than stake size, and a daily XP budget so a marathon session cannot
 * finish the month in an evening.
 */

export const KRASH_PASS_TIERS = 100;
export const KRASH_TIER_COST = 200;

export const KRASH_PASS_XP = {
  trade: 10,
  win: 5,
  flash: 3,
  mission: 150,
  chest: 120,
};

/** Twenty full days fill the pass; trades alone may fill 60 % of a day. */
export const KRASH_DAILY_XP_CAP = 1_000;
export const KRASH_DAILY_TRADE_XP_CAP = 600;

export const KRASH_PREMIUM_PRICE = 4_000;

export function krashPassPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function krashPassEnd(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export function krashTierFromXp(xp: number): { tier: number; intoTier: number; needed: number } {
  const tier = Math.min(KRASH_PASS_TIERS, Math.floor(xp / KRASH_TIER_COST));
  return {
    tier,
    intoTier: tier >= KRASH_PASS_TIERS ? 0 : xp - tier * KRASH_TIER_COST,
    needed: tier >= KRASH_PASS_TIERS ? 0 : KRASH_TIER_COST,
  };
}

export type KrashRewardKind = 'coins' | 'cosmetic' | 'item';

export interface KrashPassReward {
  kind: KrashRewardKind;
  amount?: number;
  cosmeticId?: string;
  itemId?: string;
}

export interface KrashPassTier {
  tier: number;
  free: KrashPassReward;
  premium: KrashPassReward;
  milestone: boolean;
}

function shuffled<T>(list: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rand = () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const ITEM_POOL = [...KRASH_SHOP_ITEMS.map((i) => i.id), ...KRASH_CRATES.map((c) => c.id)];

function buildTrack(season: number): KrashPassTier[] {
  const pool = shuffled(krashPassCosmetics(season).map((c) => c.id), `krash-pass-s${season}`);
  const half = Math.floor(pool.length / 2);
  const freeCosmetics = pool.slice(half);
  const premiumCosmetics = pool.slice(0, half);
  let free = 0, premium = 0, item = 0;
  const tiers: KrashPassTier[] = [];

  for (let t = 1; t <= KRASH_PASS_TIERS; t++) {
    const milestone = t % 25 === 0;
    const crate = KRASH_CRATES[Math.min(KRASH_CRATES.length - 1, Math.floor(t / 30))].id;

    // Cosmetics spread across the whole month rather than front-loaded.
    let freeReward: KrashPassReward;
    if (t % 16 === 0 && free < freeCosmetics.length) freeReward = { kind: 'cosmetic', cosmeticId: freeCosmetics[free++] };
    else if (t % 5 === 1) freeReward = { kind: 'item', itemId: ITEM_POOL[item++ % ITEM_POOL.length] };
    else if (t % 5 === 3) freeReward = { kind: 'item', itemId: crate };
    else freeReward = { kind: 'coins', amount: (milestone ? 1500 : 150) + t * 8 };

    let premiumReward: KrashPassReward;
    if (t % 16 === 8 && premium < premiumCosmetics.length) premiumReward = { kind: 'cosmetic', cosmeticId: premiumCosmetics[premium++] };
    else if (t % 4 === 0) premiumReward = { kind: 'item', itemId: KRASH_CRATES[Math.min(KRASH_CRATES.length - 1, Math.floor(t / 25))].id };
    else premiumReward = { kind: 'coins', amount: 400 + t * 40 };

    tiers.push({ tier: t, free: freeReward, premium: premiumReward, milestone });
  }

  // Whatever cosmetics did not fit on their beat go on the last tiers, so
  // none of the season's pieces is left out.
  for (let t = KRASH_PASS_TIERS; free < freeCosmetics.length && t > 0; t -= 3) {
    if (tiers[t - 1].free.kind !== 'cosmetic') tiers[t - 1].free = { kind: 'cosmetic', cosmeticId: freeCosmetics[free++] };
  }
  for (let t = KRASH_PASS_TIERS - 1; premium < premiumCosmetics.length && t > 0; t -= 3) {
    if (tiers[t - 1].premium.kind !== 'cosmetic') tiers[t - 1].premium = { kind: 'cosmetic', cosmeticId: premiumCosmetics[premium++] };
  }
  return tiers;
}

const TRACKS = new Map<number, KrashPassTier[]>();

export function krashPassTrack(season = krashSeason()): KrashPassTier[] {
  let track = TRACKS.get(season);
  if (!track) { track = buildTrack(season); TRACKS.set(season, track); }
  return track;
}

export function krashRewardLabel(reward: KrashPassReward): string {
  if (reward.kind === 'coins') return `${(reward.amount ?? 0).toLocaleString('fr-FR')} ₶`;
  if (reward.kind === 'item') return krashItemById(reward.itemId ?? '')?.name ?? krashCrateById(reward.itemId ?? '')?.name ?? 'Objet';
  return krashCosmeticById(reward.cosmeticId ?? '')?.name ?? 'Cosmétique';
}
