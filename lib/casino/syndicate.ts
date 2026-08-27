/**
 * The syndicate: a pot several players build together, which then plays
 * itself for a fixed run.
 *
 * The maths matter more here than anywhere else in the casino. A shared
 * bankroll that trends upward is a money printer that scales with the number
 * of players, so this one sits a fraction under break-even. The shape was
 * picked from a simulation rather than by feel:
 *
 *    5 min  median x0.86   mean x0.99   ruin 0.0%   above buy-in 39%
 *   10 min  median x0.76   mean x0.98   ruin 0.4%   above buy-in 34%
 *   20 min  median x0.59   mean x0.95   ruin 6.3%   above buy-in 29%
 *
 * So a short run mostly comes back near what went in, a long one is a real
 * gamble that can genuinely end at nothing, and no length is worth farming.
 */

export const SYNDICATE_MIN_PLAYERS = 2;
export const SYNDICATE_MAX_PLAYERS = 8;

/** How long the pot plays for, and how many rounds that buys. */
export const SYNDICATE_DURATIONS = [5, 10, 20] as const;
export type SyndicateDuration = (typeof SYNDICATE_DURATIONS)[number];

export const SYNDICATE_ROUND_MS = 4_000;

export function roundsFor(durationMin: number): number {
  return Math.round((durationMin * 60_000) / SYNDICATE_ROUND_MS);
}

/** Share of the pot staked on each round. */
export const SYNDICATE_STAKE_PCT = 0.08;

/**
 * A stake floor, as a share of what the group put in at the start. Without it
 * a percentage stake only ever shrinks the pot geometrically and can never
 * reach zero, so a losing run would just fade instead of busting. The floor is
 * what makes "you can end at nothing, and at nothing the run stops" true.
 */
export const SYNDICATE_MIN_STAKE_PCT = 0.025;

/** Expected return per round. Under 1 on purpose. */
export const SYNDICATE_RTP = 0.998;

export const SYNDICATE_MIN_BUY_IN = 500;
export const SYNDICATE_MAX_BUY_IN = 250_000;

/**
 * The prize ladder. Deliberately tight: mostly small moves either way with one
 * rare spike. A fatter tail pushes the mean around without changing what most
 * groups actually see, which is a pot that bleeds while one run in a thousand
 * explodes — bad viewing for something everyone watches together.
 */
const LADDER: { chance: number; multiplier: number }[] = [
  { chance: 0.250, multiplier: 0 },
  { chance: 0.450, multiplier: 1.3 },
  { chance: 0.220, multiplier: 1.8 },
  { chance: 0.070, multiplier: 2.6 },
  { chance: 0.010, multiplier: 6 },
];

const LADDER_RAW = LADDER.reduce((sum, t) => sum + t.chance * t.multiplier, 0);
const LADDER_SCALE = SYNDICATE_RTP / LADDER_RAW;

/** The multipliers as players actually see them, for the rules panel. */
export const SYNDICATE_LADDER = LADDER.map((t) => ({
  chance: t.chance,
  multiplier: Math.round(t.multiplier * LADDER_SCALE * 100) / 100,
}));

export interface SyndicateOutcome {
  multiplier: number;
  stake: number;
  payout: number;
  pot: number;
  /** The pot is empty: the run stops here whatever the clock says. */
  bust: boolean;
}

/** One automatic round. `seedPot` is what the group put in at the start. */
export function rollSyndicateRound(pot: number, seedPot: number, roll: number): SyndicateOutcome {
  const floor = Math.max(1, Math.round(seedPot * SYNDICATE_MIN_STAKE_PCT));
  const stake = Math.min(pot, Math.max(floor, Math.round(pot * SYNDICATE_STAKE_PCT)));

  let acc = 0;
  let multiplier = 0;
  for (const t of LADDER) {
    acc += t.chance;
    if (roll < acc) { multiplier = t.multiplier * LADDER_SCALE; break; }
  }

  const payout = Math.round(stake * multiplier);
  const after = pot - stake + payout;

  return {
    multiplier: Math.round(multiplier * 100) / 100,
    stake,
    payout,
    pot: Math.max(0, after),
    bust: after <= 0,
  };
}

/** What one member gets back: their share of whatever is left. */
export function memberPayout(pot: number, contribution: number, seedPot: number): number {
  if (seedPot <= 0) return 0;
  return Math.floor(pot * (contribution / seedPot));
}

/** Six characters, no ambiguous ones, for saying a code out loud. */
export function generateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
