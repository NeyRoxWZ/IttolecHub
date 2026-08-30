/**
 * Everything that only makes sense because other people are playing.
 *
 * Referrals, gifts and the chat share one rule: none of them may create coins
 * out of nothing. A referral pays both sides once and only after the newcomer
 * has actually played; a gift costs the giver more than the receiver gets,
 * except on shop items where generosity is the point and the discount is the
 * reward.
 */

/* ------------------------------------------------------------------ */
/* Referral                                                            */
/* ------------------------------------------------------------------ */

/** What the newcomer must wager before either side is paid. */
export const REFERRAL_WAGER_GOAL = 10_000;

export const REFERRAL_REWARD_INVITER = 15_000;
export const REFERRAL_REWARD_NEWCOMER = 7_500;

/** Six characters, no ambiguous glyphs — it gets read out loud. */
export function makeReferralCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/* ------------------------------------------------------------------ */
/* Gifts                                                               */
/* ------------------------------------------------------------------ */

/**
 * Sending coins costs more than what lands. Without a fee a group could pass
 * the same pile around to farm anything that counts money moving, and a gift
 * that costs nothing means nothing.
 */
export const GIFT_COIN_FEE = 0.15;

/** Gifting a shop item is cheaper than buying the same one for yourself. */
export const GIFT_ITEM_DISCOUNT = 0.25;

export const GIFT_MIN = 500;
export const GIFT_MAX = 100_000;
export const GIFT_DAILY_LIMIT = 3;

export function giftCoinCost(amount: number): number {
  return Math.ceil(amount * (1 + GIFT_COIN_FEE));
}

export function giftItemPrice(price: number): number {
  return Math.ceil(price * (1 - GIFT_ITEM_DISCOUNT));
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

export const CHAT_MAX_LENGTH = 300;
export const CHAT_HISTORY = 60;
/** Minimum gap between two messages from the same player. */
export const CHAT_COOLDOWN_MS = 1_500;

/* ------------------------------------------------------------------ */
/* Showcase                                                            */
/* ------------------------------------------------------------------ */

/** How many pieces a player may put on display on their profile. */
export const SHOWCASE_SLOTS = 6;
