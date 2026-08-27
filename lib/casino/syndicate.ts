/**
 * The syndicate: a bankroll several players build together and then play out
 * of, side by side, for a fixed run.
 *
 * It is not a machine that plays itself. Once the host starts it, the pot
 * becomes the balance every member bets against in the ordinary games: stakes
 * leave it, wins go back into it, and everyone watches the same number move.
 * When the clock runs out the pot is split by what each of them put in; if it
 * reaches zero the run stops there and nobody gets anything back.
 *
 * That means the odds need no tuning of their own â the twenty games already
 * pay back 93 % to 98 %, so a pot drifts down slowly and a good streak can
 * carry it up. The only real knob is how long the group decides to play.
 */

export const SYNDICATE_MIN_PLAYERS = 2;
export const SYNDICATE_MAX_PLAYERS = 8;

/** How long the pot is in play. */
export const SYNDICATE_DURATIONS = [5, 10, 20] as const;
export type SyndicateDuration = (typeof SYNDICATE_DURATIONS)[number];

export const SYNDICATE_MIN_BUY_IN = 500;
export const SYNDICATE_MAX_BUY_IN = 250_000;

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
