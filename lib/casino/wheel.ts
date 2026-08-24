// Frenly Wheel — simplified single-zero European roulette.
// 37 pockets (0-36), one green zero. Same house edge on every bet type
// (RTP ~97.3%), just like real roulette — no per-bet-type balancing needed.

export * from './core';
import { secureRandomInt } from './core';

export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
export const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

// Physical order of pockets on a real European roulette wheel (cosmetic only,
// used to lay out/animate the spin — has no effect on probability).
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export type WheelBetType = 'color' | 'dozen' | 'number';
export type WheelColorValue = 'red' | 'black';
export type WheelDozenValue = 1 | 2 | 3; // 1-12 / 13-24 / 25-36

export interface WheelBet {
  type: WheelBetType;
  value: WheelColorValue | WheelDozenValue | number;
}

// Total-return multiplier (includes the original stake). All three bet
// types resolve to the same ~97.3% RTP because they all key off the same
// 37-pocket wheel with a single green zero.
export const WHEEL_PAYOUTS: Record<WheelBetType, number> = {
  color: 2,
  dozen: 3,
  number: 36,
};

export function getPocketColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
}

export function getPocketDozen(n: number): WheelDozenValue | null {
  if (n === 0) return null;
  if (n <= 12) return 1;
  if (n <= 24) return 2;
  return 3;
}

export function spinWheel(): number {
  return secureRandomInt(37);
}

export function resolveWheelBet(landedNumber: number, bet: WheelBet): { won: boolean; multiplier: number } {
  let won = false;
  if (bet.type === 'color') {
    won = getPocketColor(landedNumber) === bet.value;
  } else if (bet.type === 'dozen') {
    won = getPocketDozen(landedNumber) === bet.value;
  } else if (bet.type === 'number') {
    won = landedNumber === bet.value;
  }
  return { won, multiplier: won ? WHEEL_PAYOUTS[bet.type] : 0 };
}
