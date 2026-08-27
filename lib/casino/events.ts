/**
 * The clock-driven bonuses: a game of the day and an hour where everything
 * pays more.
 *
 * Both are derived from the date alone — same for every player, no scheduled
 * job, and impossible to reroll by refreshing.
 */

import { GAME_SLUGS } from './missions';

function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Game of the day                                                     */
/* ------------------------------------------------------------------ */

export const GAME_OF_DAY_BONUS = 0.15;

/** Today's featured game. Rotates at midnight, same one for everybody. */
export function gameOfTheDay(date: Date = new Date()): string {
  return GAME_SLUGS[seeded(`gotd:${dayKey(date)}`) % GAME_SLUGS.length];
}

export function isGameOfTheDay(slug: string, date?: Date): boolean {
  return gameOfTheDay(date) === slug;
}

/* ------------------------------------------------------------------ */
/* Happy hour                                                          */
/* ------------------------------------------------------------------ */

export const HAPPY_HOUR_BONUS = 0.20;
export const HAPPY_HOUR_LENGTH_MIN = 60;

/**
 * The hour it starts, in UTC. Kept between 15:00 and 22:00 so it lands in the
 * evening for the people who actually play, rather than at four in the morning.
 */
export function happyHourStart(date: Date = new Date()): number {
  return 15 + (seeded(`happy:${dayKey(date)}`) % 8);
}

export function happyHourWindow(date: Date = new Date()): { start: Date; end: Date } {
  const hour = happyHourStart(date);
  const start = new Date(Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, 0, 0, 0,
  ));
  return { start, end: new Date(start.getTime() + HAPPY_HOUR_LENGTH_MIN * 60_000) };
}

export function isHappyHour(date: Date = new Date()): boolean {
  const { start, end } = happyHourWindow(date);
  return date >= start && date < end;
}

/** Seconds until it starts, or until it ends when it's already running. */
export function happyHourCountdown(date: Date = new Date()): { running: boolean; seconds: number } {
  const { start, end } = happyHourWindow(date);
  if (date < start) return { running: false, seconds: Math.floor((start.getTime() - date.getTime()) / 1000) };
  if (date < end) return { running: true, seconds: Math.floor((end.getTime() - date.getTime()) / 1000) };
  // Past today's window: point at tomorrow's.
  const tomorrow = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const next = happyHourWindow(tomorrow).start;
  return { running: false, seconds: Math.floor((next.getTime() - date.getTime()) / 1000) };
}

/** Everything the clock adds to a win's profit right now. */
export function timedWinBonus(gameSlug: string, date: Date = new Date()): number {
  return (isGameOfTheDay(gameSlug, date) ? GAME_OF_DAY_BONUS : 0)
    + (isHappyHour(date) ? HAPPY_HOUR_BONUS : 0);
}

/* ------------------------------------------------------------------ */
/* Seven-day chest                                                     */
/* ------------------------------------------------------------------ */

/** What each case of the chest holds. The seventh is the reason to come back. */
export const CHEST_DAYS = [
  { day: 1, coins: 500, crate: null as string | null },
  { day: 2, coins: 1_000, crate: null },
  { day: 3, coins: 0, crate: 'crate_wood' },
  { day: 4, coins: 2_500, crate: null },
  { day: 5, coins: 0, crate: 'crate_silver' },
  { day: 6, coins: 5_000, crate: null },
  { day: 7, coins: 15_000, crate: 'crate_gold' },
];

export const CHEST_LENGTH = CHEST_DAYS.length;

export function chestRewardFor(day: number) {
  return CHEST_DAYS[Math.min(CHEST_LENGTH, Math.max(1, day)) - 1];
}

/* ------------------------------------------------------------------ */
/* Vault                                                               */
/* ------------------------------------------------------------------ */

export const VAULT_LOCK_HOURS = 24;
export const VAULT_INTEREST = 0.10;
export const VAULT_MIN = 500;

export function vaultPayout(amount: number): number {
  return amount + Math.round(amount * VAULT_INTEREST);
}
