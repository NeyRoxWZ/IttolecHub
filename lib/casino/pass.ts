/**
 * Frenly Pass — a 100-tier track that resets on the first of every month.
 *
 * Progress is driven by *actions*, never by stake size. A player betting
 * 5 ₶ climbs at exactly the same speed as one betting 5 000 ₶: the pass is
 * about coming back, not about how deep your pockets are. Calibrated so a
 * regular session on about twenty days of the month reaches tier 100.
 */

import {
  passCosmeticsForSeason, cosmeticById, PASS_SEASONS, PASS_COSMETICS_PER_SEASON,
} from './cosmetics';
import { SHOP_ITEMS } from './shop';
import { CRATES, crateById } from './crates';

export const PASS_TIERS = 100;

/** Pass XP awarded per event. Flat on purpose — see the note above. */
export const PASS_XP = {
  bet: 10,
  win: 5,          // on top of the bet award
  mission: 150,
  dailyBonus: 200,
  dailyWheel: 100,
  levelUp: 120,
};

/**
 * Every tier costs the same. A rising cost with a flat daily budget front-
 * loads the whole thing — twenty tiers on day one, three on day five — which
 * is exactly the "it goes way too fast" feeling.
 */
export const PASS_TIER_COST = 260;

/**
 * The day's budget, and how much of it bets alone may fill. Without this an
 * auto-player bought a third of the pass in ten minutes; the remainder has to
 * come from the daily bonus, the wheel and the missions, which are time-gated
 * by construction.
 *
 * Sized for a month: 26 000 XP at 1 300 a day is twenty full days, so the
 * track lasts the period instead of being finished by the first weekend. The
 * bet share stays at 60 %, same as when the pass ran by the week.
 */
export const PASS_DAILY_XP_CAP = 1_300;
export const PASS_DAILY_BET_XP_CAP = 780;

/** Tiers reachable in one perfect day, and days needed for the full pass. */
export const PASS_TIERS_PER_DAY = PASS_DAILY_XP_CAP / PASS_TIER_COST;

export function passXpForTier(_tier: number): number {
  return PASS_TIER_COST;
}

/** Total pass XP to reach `tier` from zero. */
export function totalPassXp(tier: number): number {
  return tier * PASS_TIER_COST;
}

export function tierFromPassXp(xp: number): { tier: number; intoTier: number; needed: number } {
  const tier = Math.min(PASS_TIERS, Math.floor(xp / PASS_TIER_COST));
  const intoTier = tier >= PASS_TIERS ? 0 : xp - tier * PASS_TIER_COST;
  return { tier, intoTier, needed: tier >= PASS_TIERS ? 0 : PASS_TIER_COST };
}

/**
 * Price of the premium track, re-bought every month. Left as it was when the
 * pass ran weekly: it still unlocks the same hundred rewards, so the price per
 * reward has not moved.
 */
export const PASS_PREMIUM_PRICE = 25_000;

/* ------------------------------------------------------------------ */
/* Monthly window                                                      */
/* ------------------------------------------------------------------ */

/**
 * Monday key of the week a date falls in. The pass no longer runs by the
 * week; this survives only so rows written under the old weekly keys can be
 * recognised and carried over onto the month.
 */
export function weekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // getUTCDay: 0 = Sunday, so shift so Monday is 0.
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

/**
 * Key of the pass period a date falls in: the first of its UTC month. A week
 * was too short to get anywhere near tier 100 without grinding every evening.
 * Stored in the `week_key` column, whose name predates the switch.
 */
export function passPeriodKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function passPeriodEnd(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

/* ------------------------------------------------------------------ */
/* Seasons                                                             */
/* ------------------------------------------------------------------ */

/**
 * The month season 1 counts from. Set so numbering carries straight on from
 * the three weekly seasons already played: September 2026 is season 3, and
 * each calendar month after it is the next. Anchoring on the real first month
 * would have rewound September to season 2 and handed back a catalogue
 * players had already collected.
 */
export const SEASON_ANCHOR_MONTH = '2026-07-01';

/**
 * Which season is live. Clamped to the last one written: running past the
 * planned seasons repeats the final catalogue rather than handing out
 * nothing, and the stock page is what warns that it's time to write more.
 */
export function currentSeason(date: Date = new Date()): number {
  const anchor = new Date(`${SEASON_ANCHOR_MONTH}T00:00:00.000Z`);
  const months = (date.getUTCFullYear() - anchor.getUTCFullYear()) * 12
    + (date.getUTCMonth() - anchor.getUTCMonth());
  return Math.min(PASS_SEASONS, Math.max(1, months + 1));
}

/** Seasons still holding unseen cosmetics. */
export function seasonsRemaining(date: Date = new Date()): number {
  return Math.max(0, PASS_SEASONS - currentSeason(date));
}

/** Seconds until the pass resets, for the countdown in the UI. */
export function secondsUntilReset(now: Date = new Date()): number {
  return Math.max(0, Math.floor((passPeriodEnd(now).getTime() - now.getTime()) / 1000));
}

/* ------------------------------------------------------------------ */
/* Reward track                                                        */
/* ------------------------------------------------------------------ */

export type PassRewardKind = 'coins' | 'cosmetic' | 'item';

export interface PassReward {
  kind: PassRewardKind;
  /** coins */
  amount?: number;
  /** cosmetic */
  cosmeticId?: string;
  /** item */
  itemId?: string;
}

export interface PassTier {
  tier: number;
  free: PassReward;
  premium: PassReward;
  /** Every 25th tier is a headline reward the UI calls out. */
  milestone: boolean;
}

/** Fixed-seed shuffle: the track must be identical for every player, forever. */
function shuffled<T>(list: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const rand = () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Consumables and crates — cosmetics come from the cosmetic pool instead. */
const PASS_ITEM_POOL = [...SHOP_ITEMS.map((i) => i.id), ...CRATES.map((c) => c.id)];

/**
 * The track of one season. Its forty cosmetics are that season's own, so ten
 * weeks in a row never hand out the same piece; the remaining slots pay coins,
 * consumables and crates.
 */
function buildTrack(season: number): PassTier[] {
  const pool = shuffled(passCosmeticsForSeason(season).map((c) => c.id), `pass-track-s${season}`);
  const half = Math.floor(pool.length / 2);
  const premiumCosmetics = pool.slice(0, half);
  const freeCosmetics = pool.slice(half);

  let freeCursor = 0;
  let premiumCursor = 0;
  let itemCursor = 0;
  const tiers: PassTier[] = [];

  for (let t = 1; t <= PASS_TIERS; t++) {
    const milestone = t % 25 === 0;
    const mod = t % 5;

    // Cosmetics land every fifth tier on the free track, and on the premium
    // one wherever the season's pool still reaches.
    let free: PassReward;
    if (mod === 0 && freeCursor < freeCosmetics.length) {
      free = { kind: 'cosmetic', cosmeticId: freeCosmetics[freeCursor++] };
    } else if (mod === 1) {
      free = { kind: 'item', itemId: PASS_ITEM_POOL[itemCursor++ % PASS_ITEM_POOL.length] };
    } else if (mod === 3) {
      free = { kind: 'item', itemId: CRATES[Math.min(CRATES.length - 1, Math.floor(t / 30))].id };
    } else {
      free = { kind: 'coins', amount: (milestone ? 4000 : 800) + t * 40 };
    }

    const premium: PassReward = premiumCursor < premiumCosmetics.length && t % 2 === 1
      ? { kind: 'cosmetic', cosmeticId: premiumCosmetics[premiumCursor++] }
      : t % 4 === 0
        ? { kind: 'item', itemId: CRATES[Math.min(CRATES.length - 1, Math.floor(t / 25))].id }
        : { kind: 'coins', amount: 3000 + t * 300 };

    tiers.push({ tier: t, free, premium, milestone });
  }

  return tiers;
}

const TRACK_CACHE = new Map<number, PassTier[]>();

/** The reward track for a season, built once and kept. */
export function passTrack(season: number = currentSeason()): PassTier[] {
  const key = Math.min(PASS_SEASONS, Math.max(1, season));
  let track = TRACK_CACHE.get(key);
  if (!track) {
    track = buildTrack(key);
    TRACK_CACHE.set(key, track);
  }
  return track;
}

export const COSMETICS_PER_SEASON = PASS_COSMETICS_PER_SEASON;

export function passTier(tier: number, season: number = currentSeason()): PassTier | undefined {
  return passTrack(season)[tier - 1];
}

/** Human label for a reward, shared by the pass UI and the claim toasts. */
export function rewardLabel(reward: PassReward): string {
  if (reward.kind === 'coins') return `${(reward.amount || 0).toLocaleString('en-US')} ₶`;
  if (reward.kind === 'item') {
    return SHOP_ITEMS.find((i) => i.id === reward.itemId)?.name
      || crateById(reward.itemId || '')?.name
      || 'Objet';
  }
  return cosmeticById(reward.cosmeticId || '')?.name || 'Cosmétique';
}
