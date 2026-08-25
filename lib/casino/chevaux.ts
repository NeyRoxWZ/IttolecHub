export * from './core';
import { secureRandomInt, type BetResolution } from './core';

// 5 horses, fixed odds. Every horse resolves to the exact same 94% RTP by
// construction (payout = 0.94 / probability) — like real fixed-odds racing.
export interface Horse {
  id: number;
  name: string;
  probability: number;
  payout: number;
}

export const HORSES: Horse[] = [
  { id: 0, name: 'Frenly Éclair', probability: 0.40, payout: 2.35 },
  { id: 1, name: 'Tornade Dorée', probability: 0.25, payout: 3.76 },
  { id: 2, name: 'Ombre Rapide', probability: 0.18, payout: 5.22 },
  { id: 3, name: 'Vent du Nord', probability: 0.12, payout: 7.83 },
  { id: 4, name: 'Longshot', probability: 0.05, payout: 18.8 },
];

export function runRace(): number {
  const roll = secureRandomInt(1_000_000) / 1_000_000;
  let cumulative = 0;
  for (const h of HORSES) {
    cumulative += h.probability;
    if (roll < cumulative) return h.id;
  }
  return HORSES[HORSES.length - 1].id;
}

export function resolveChevaux(winnerId: number, betHorseId: number): BetResolution {
  const won = winnerId === betHorseId;
  const horse = HORSES.find((h) => h.id === betHorseId)!;
  return { won, multiplier: won ? horse.payout : 0 };
}
