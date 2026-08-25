/**
 * Player level + win-streak bonus.
 *
 * The point of XP is that it advances on every bet regardless of outcome —
 * a losing session still moves something forward, which is what the casino
 * was missing.
 */

/** XP granted for a bet, driven by the stake only (never by the result). */
export function xpForWager(amount: number): number {
  return Math.max(1, Math.floor(amount / 2));
}

/** XP needed to go from `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  return 200 + (level - 1) * 150;
}

/** Total XP needed to reach `level` from scratch. */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForNextLevel(l);
  return total;
}

export function levelFromXp(xp: number): { level: number; intoLevel: number; needed: number } {
  let level = 1;
  let remaining = xp;
  while (remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level);
    level++;
  }
  return { level, intoLevel: remaining, needed: xpForNextLevel(level) };
}

/** Coins handed out by the crate you get on each level-up. */
export function levelUpReward(level: number): number {
  return 250 + level * 120;
}

/* ------------------------------------------------------------------ */
/* Win streak                                                          */
/* ------------------------------------------------------------------ */

export interface StreakTier { min: number; bonus: number; label: string }

/**
 * Bonus applied to the *profit* of a win (never to the returned stake), so a
 * push or a refund is unaffected. Capped at 10 so it can't run away: long
 * streaks are rare enough that the overall RTP lift stays a couple of points,
 * and it's disclosed in each game's rules.
 */
export const STREAK_TIERS: StreakTier[] = [
  { min: 10, bonus: 0.35, label: 'EN FEU' },
  { min: 7, bonus: 0.20, label: 'BRÛLANT' },
  { min: 5, bonus: 0.10, label: 'CHAUD' },
  { min: 3, bonus: 0.05, label: 'LANCÉ' },
];

export function streakBonus(streak: number): number {
  for (const t of STREAK_TIERS) if (streak >= t.min) return t.bonus;
  return 0;
}

export function streakLabel(streak: number): string | null {
  for (const t of STREAK_TIERS) if (streak >= t.min) return t.label;
  return null;
}

/** Next tier the player is working toward, for the "keep going" nudge. */
export function nextStreakTier(streak: number): StreakTier | null {
  const ascending = [...STREAK_TIERS].reverse();
  for (const t of ascending) if (streak < t.min) return t;
  return null;
}

/* ------------------------------------------------------------------ */
/* Win celebration tiers                                               */
/* ------------------------------------------------------------------ */

export type CelebrationTier = 'none' | 'small' | 'big' | 'huge' | 'monster';

export function celebrationFor(multiplier: number): CelebrationTier {
  if (multiplier >= 100) return 'monster';
  if (multiplier >= 20) return 'huge';
  if (multiplier >= 5) return 'big';
  if (multiplier > 1) return 'small';
  return 'none';
}

/** A win worth telling everyone about. */
export const FEED_MIN_PAYOUT = 2000;
export const FEED_MIN_MULTIPLIER = 10;

export function isFeedWorthy(payout: number, multiplier: number): boolean {
  return payout >= FEED_MIN_PAYOUT || multiplier >= FEED_MIN_MULTIPLIER;
}

/* ------------------------------------------------------------------ */
/* Cashback                                                            */
/* ------------------------------------------------------------------ */

export const CASHBACK_RATE = 0.05;
export const CASHBACK_BOOSTED_RATE = 0.10;
export const CASHBACK_MIN = 10;

/** Login-streak multiplier on the daily bonus. */
export function dailyStreakMultiplier(streak: number): number {
  if (streak >= 14) return 3;
  if (streak >= 7) return 2;
  if (streak >= 3) return 1.5;
  return 1;
}
