export * from './core';
import { secureRandomInt, type BetResolution } from './core';

export type RpsMove = 'pierre' | 'feuille' | 'ciseaux';

const BEATS: Record<RpsMove, RpsMove> = {
  pierre: 'ciseaux',
  feuille: 'pierre',
  ciseaux: 'feuille',
};

// Ties push (bet fully refunded, no house edge taken that round).
// On a real win: RTP = P(win) * multiplier = (1/3) extra on top of the
// (1/3) refund from ties -> overall RTP ~96%, matches a Stake-Original-style RPS.
export const RPS_PAYOUT = 1.88;

export function houseMove(): RpsMove {
  const moves: RpsMove[] = ['pierre', 'feuille', 'ciseaux'];
  return moves[secureRandomInt(3)];
}

export function resolveRps(playerMove: RpsMove, house: RpsMove): BetResolution & { outcome: 'win' | 'lose' | 'tie' } {
  if (playerMove === house) return { won: false, multiplier: 1, outcome: 'tie' }; // push: stake returned
  const win = BEATS[playerMove] === house;
  return { won: win, multiplier: win ? RPS_PAYOUT : 0, outcome: win ? 'win' : 'lose' };
}
