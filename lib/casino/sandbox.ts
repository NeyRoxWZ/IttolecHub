'use client';

/**
 * The tutorial's play money.
 *
 * The tour explained the casino in paragraphs and nobody read them. These are
 * the same mechanics, played for real gestures — except nothing here touches
 * the wallet: the sandbox has its own balance, and it is discarded when the
 * tour closes. No bet is sent to the server, so nothing can be won or lost.
 */

export const SANDBOX_START = 1_000;
export const SANDBOX_BET = 100;

export interface SandboxState {
  balance: number;
  streak: number;
  level: number;
  xp: number;
  bets: number;
  wins: number;
}

export const INITIAL_SANDBOX: SandboxState = {
  balance: SANDBOX_START,
  streak: 0,
  level: 1,
  xp: 0,
  bets: 0,
  wins: 0,
};

export const SANDBOX_XP_PER_BET = 40;
export const SANDBOX_XP_PER_LEVEL = 100;

export interface SandboxSpin {
  symbols: string[];
  won: boolean;
  multiplier: number;
  payout: number;
  /** Two of three: the near miss the tour talks about. */
  nearMiss: boolean;
}

const SYMBOLS = ['cherry', 'bell', 'star', 'diamond', 'lemon', 'seven'];

/**
 * A rigged reel, and deliberately so: a tutorial that can lose isn't teaching
 * anything, it's just a slot machine. Two thirds land on a win, the rest on a
 * near miss so the tour can point at it.
 */
export function sandboxSpin(bets: number): SandboxSpin {
  const win = bets % 3 !== 2;

  if (win) {
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const multiplier = symbol === 'seven' ? 12 : symbol === 'diamond' ? 6 : 3;
    return {
      symbols: [symbol, symbol, symbol],
      won: true,
      multiplier,
      payout: SANDBOX_BET * multiplier,
      nearMiss: false,
    };
  }

  const pair = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  let odd = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  while (odd === pair) odd = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

  return { symbols: [pair, pair, odd], won: false, multiplier: 0, payout: 0, nearMiss: true };
}

/** Apply a spin to the sandbox. The stake comes back on a loss: it's a demo. */
export function applySpin(state: SandboxState, spin: SandboxSpin): SandboxState {
  const xp = state.xp + SANDBOX_XP_PER_BET;
  const gained = Math.floor(xp / SANDBOX_XP_PER_LEVEL);

  return {
    // Losing costs nothing here — the point is the gesture, not the money.
    balance: state.balance + spin.payout,
    streak: spin.won ? state.streak + 1 : 0,
    xp: xp % SANDBOX_XP_PER_LEVEL,
    level: state.level + gained,
    bets: state.bets + 1,
    wins: state.wins + (spin.won ? 1 : 0),
  };
}

/** Streak bonus, mirrored from the real table so the tour can't drift. */
export function sandboxStreakBonus(streak: number): number {
  if (streak >= 10) return 0.35;
  if (streak >= 7) return 0.20;
  if (streak >= 5) return 0.10;
  if (streak >= 3) return 0.05;
  return 0;
}
