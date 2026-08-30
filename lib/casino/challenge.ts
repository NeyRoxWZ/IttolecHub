/**
 * The daily challenge.
 *
 * Everyone gets the same twenty draws, in the same order, on the same game.
 * Nobody can be luckier than anybody else: what separates two players is how
 * much they staked on each round and when they walked away. It is the only
 * board in the casino where the ranking means something, because it is the
 * only one luck cannot decide.
 *
 * The sequence comes out of the date, so it needs no table and no scheduled
 * job, and it cannot be rerolled by refreshing.
 */

export const CHALLENGE_ROUNDS = 20;
export const CHALLENGE_STAKE = 10_000;
/** The most you may put on a single round, as a share of what you hold. */
export const CHALLENGE_MAX_BET_PCT = 0.5;

export const CHALLENGE_GAMES = ['slots', 'plinko', 'grattage', 'coinflip', 'wheel'] as const;
export type ChallengeGame = (typeof CHALLENGE_GAMES)[number];

export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function challengeGame(day: string = dayKey()): ChallengeGame {
  return CHALLENGE_GAMES[Math.floor(seeded(`chal:game:${day}`) * CHALLENGE_GAMES.length)];
}

/**
 * The multipliers for the day, in order.
 *
 * Deliberately drawn from one ladder rather than from each game's own table:
 * the challenge is a decision exercise, and it has to be comparable from one
 * day to the next whatever game happens to be showing.
 *
 * The expected multiplier sits a hair above 1 on purpose. Much higher and
 * staking the maximum every round dominates, which leaves nothing to decide;
 * much lower and the whole board simply bleeds out. Half the draws paying
 * nothing is what keeps that thin edge from being free money.
 */
const LADDER: { chance: number; multiplier: number }[] = [
  { chance: 0.500, multiplier: 0 },
  { chance: 0.240, multiplier: 1.4 },
  { chance: 0.160, multiplier: 2 },
  { chance: 0.070, multiplier: 3 },
  { chance: 0.025, multiplier: 5 },
  { chance: 0.005, multiplier: 12 },
];

export function challengeRounds(day: string = dayKey()): number[] {
  const out: number[] = [];
  for (let i = 0; i < CHALLENGE_ROUNDS; i++) {
    const roll = seeded(`chal:${day}:${i}`);
    let acc = 0;
    let multiplier = 0;
    for (const t of LADDER) {
      acc += t.chance;
      if (roll < acc) { multiplier = t.multiplier; break; }
    }
    out.push(multiplier);
  }
  return out;
}

/** Seconds until the next challenge, so the page can count down. */
export function secondsUntilNextChallenge(now: Date = new Date()): number {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
}
