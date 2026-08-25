export * from './core';
import { secureRandomInt } from './core';

// Shared math for every "N sequential steps, fixed survive-chance per step,
// cash out anytime" game (Tower, Poulet, Dino — reskins of the same shape).
// multiplier(n) = houseEdge / survivalProb^n. This keeps the EV of cashing
// out at ANY step constant at exactly `houseEdge` (provably-fair standard
// approach): P(reach n) * multiplier(n) = p^n * houseEdge/p^n = houseEdge.
export interface LadderConfig {
  totalSteps: number;
  survivalProb: number; // 0-1, chance a given step is safe
  houseEdge: number; // e.g. 0.96 for 96% RTP
}

export const LADDER_CONFIGS: Record<'tower' | 'poulet' | 'dino', LadderConfig> = {
  tower: { totalSteps: 8, survivalProb: 0.75, houseEdge: 0.96 },
  poulet: { totalSteps: 10, survivalProb: 0.80, houseEdge: 0.96 },
  dino: { totalSteps: 12, survivalProb: 0.85, houseEdge: 0.95 },
};

export function multiplierAtStep(config: LadderConfig, step: number): number {
  return Math.round((config.houseEdge / Math.pow(config.survivalProb, step)) * 100) / 100;
}

export function stepOutcome(config: LadderConfig): boolean {
  const roll = secureRandomInt(1_000_000) / 1_000_000;
  return roll < config.survivalProb; // true = survived
}
