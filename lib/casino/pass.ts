/**
 * Frenly Pass — a 100-tier track that resets every Monday.
 *
 * Progress is driven by *actions*, never by stake size. A player betting
 * 5 ₶ climbs at exactly the same speed as one betting 5 000 ₶: the pass is
 * about coming back, not about how deep your pockets are. Calibrated so a
 * regular session on five days out of seven reaches tier 100.
 */

import { DROPPABLE_COSMETICS, cosmeticById } from './cosmetics';
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

/** Cost of climbing from `tier` to `tier + 1`. */
export function passXpForTier(tier: number): number {
  return Math.round(30 + tier * 0.6);
}

/** Total pass XP to reach `tier` from zero. */
export function totalPassXp(tier: number): number {
  let total = 0;
  for (let t = 0; t < tier; t++) total += passXpForTier(t);
  return total;
}

export function tierFromPassXp(xp: number): { tier: number; intoTier: number; needed: number } {
  let tier = 0;
  let remaining = xp;
  while (tier < PASS_TIERS && remaining >= passXpForTier(tier)) {
    remaining -= passXpForTier(tier);
    tier++;
  }
  const needed = tier >= PASS_TIERS ? 0 : passXpForTier(tier);
  return { tier, intoTier: tier >= PASS_TIERS ? 0 : remaining, needed };
}

/** Price of the premium track, re-bought every week. */
export const PASS_PREMIUM_PRICE = 25_000;

/* ------------------------------------------------------------------ */
/* Weekly window                                                       */
/* ------------------------------------------------------------------ */

/** ISO-ish key for the week a date falls in, weeks starting Monday 00:00 UTC. */
export function weekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // getUTCDay: 0 = Sunday, so shift so Monday is 0.
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

export function weekStart(date: Date = new Date()): Date {
  return new Date(`${weekKey(date)}T00:00:00.000Z`);
}

export function weekEnd(date: Date = new Date()): Date {
  return new Date(weekStart(date).getTime() + 7 * 24 * 60 * 60 * 1000);
}

/** Seconds until the pass resets, for the countdown in the UI. */
export function secondsUntilReset(now: Date = new Date()): number {
  return Math.max(0, Math.floor((weekEnd(now).getTime() - now.getTime()) / 1000));
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

function buildTrack(): PassTier[] {
  // 160 cosmetics over 200 slots: the premium column carries one per tier,
  // the free column carries the remaining 60 and fills the rest with coins
  // and consumables.
  const pool = shuffled(DROPPABLE_COSMETICS.map((c) => c.id), 'frenly-pass-v1');
  const premiumPool = pool.slice(0, PASS_TIERS);
  const freePool = pool.slice(PASS_TIERS);

  let freeCursor = 0;
  let itemCursor = 0;
  const tiers: PassTier[] = [];

  for (let t = 1; t <= PASS_TIERS; t++) {
    const milestone = t % 25 === 0;
    const mod = t % 5;

    let free: PassReward;
    if (mod === 0 || mod === 1) {
      // Coin tiers scale with depth so the back half is worth pushing for.
      free = mod === 0
        ? { kind: 'coins', amount: (milestone ? 4000 : 800) + t * 40 }
        : { kind: 'item', itemId: PASS_ITEM_POOL[itemCursor++ % PASS_ITEM_POOL.length] };
    } else {
      free = { kind: 'cosmetic', cosmeticId: freePool[freeCursor++ % freePool.length] };
    }

    tiers.push({
      tier: t,
      free,
      premium: { kind: 'cosmetic', cosmeticId: premiumPool[t - 1] },
      milestone,
    });
  }

  return tiers;
}

export const PASS_TRACK: PassTier[] = buildTrack();

export function passTier(tier: number): PassTier | undefined {
  return PASS_TRACK[tier - 1];
}

/** Human label for a reward, shared by the pass UI and the claim toasts. */
export function rewardLabel(reward: PassReward): string {
  if (reward.kind === 'coins') return `${(reward.amount || 0).toLocaleString('fr-FR')} ₶`;
  if (reward.kind === 'item') {
    return SHOP_ITEMS.find((i) => i.id === reward.itemId)?.name
      || crateById(reward.itemId || '')?.name
      || 'Objet';
  }
  return cosmeticById(reward.cosmeticId || '')?.name || 'Cosmétique';
}
