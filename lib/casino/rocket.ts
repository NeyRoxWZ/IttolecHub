export * from './core';
import { secureRandomInt } from './core';

// Standard provably-fair crash-game math: P(crashPoint <= m) = 1 - houseEdge/m
// for m>=1. This keeps the EV of cashing out at ANY multiplier constant at
// exactly `houseEdge`, same property as the ladder games. Below the
// houseEdge probability mass, the round crashes instantly at 1.00x.
export const ROCKET_HOUSE_EDGE = 0.95;
export const ROCKET_GROWTH_TAU = 8; // seconds — multiplier(t) = e^(t/TAU)

export function generateCrashPoint(): number {
  const U = secureRandomInt(1_000_000) / 1_000_000;
  if (U < 1 - ROCKET_HOUSE_EDGE) return 1.0;
  const raw = ROCKET_HOUSE_EDGE / (1 - U);
  return Math.floor(raw * 100) / 100;
}

/** Inverse of `multiplierAtElapsed` — where on the curve a crash happened. */
export function elapsedForMultiplier(multiplier: number): number {
  return Math.max(0, Math.log(Math.max(1, multiplier)) * ROCKET_GROWTH_TAU * 1000);
}

export function multiplierAtElapsed(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs) / 1000;
  return Math.round(Math.exp(t / ROCKET_GROWTH_TAU) * 100) / 100;
}
