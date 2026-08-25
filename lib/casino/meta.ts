export * from './core';
import { secureRandomInt } from './core';

export const PRESTIGE_THRESHOLD = 1_000_000;
export const JACKPOT_CONTRIBUTION_RATE = 0.01; // 1% of every net loss feeds the shared pot
export const JACKPOT_HIT_CHANCE = 1 / 3000; // independent roll on every settled bet
export const JACKPOT_SEED = 5000;

export interface WalletStats {
  balance: number;
  totalWagered: number;
  totalWon: number;
  currentStreak: number;
  bestStreak: number;
  prestigeCount: number;
  biggestMultiplier: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  check: (s: WalletStats) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_bet', name: 'Premier pas', description: 'Place ta première mise.', check: (s) => s.totalWagered > 0 },
  { id: 'first_win', name: 'Premier sang', description: 'Remporte ton premier gain.', check: (s) => s.totalWon > 0 },
  { id: 'streak_3', name: 'Sur une lancée', description: "3 victoires d'affilée.", check: (s) => s.bestStreak >= 3 },
  { id: 'streak_5', name: 'Chaud bouillant', description: "5 victoires d'affilée.", check: (s) => s.bestStreak >= 5 },
  { id: 'streak_10', name: 'Intouchable', description: "10 victoires d'affilée.", check: (s) => s.bestStreak >= 10 },
  { id: 'wagered_1k', name: 'Petit joueur', description: '1 000 ₶ misés au total.', check: (s) => s.totalWagered >= 1_000 },
  { id: 'wagered_100k', name: 'Habitué', description: '100 000 ₶ misés au total.', check: (s) => s.totalWagered >= 100_000 },
  { id: 'wagered_1m', name: 'Pilier du casino', description: '1 000 000 ₶ misés au total.', check: (s) => s.totalWagered >= 1_000_000 },
  { id: 'big_win_10x', name: 'Joli coup', description: 'Gain à x10 ou plus en une mise.', check: (s) => s.biggestMultiplier >= 10 },
  { id: 'big_win_50x', name: 'Jackpot personnel', description: 'Gain à x50 ou plus en une mise.', check: (s) => s.biggestMultiplier >= 50 },
  { id: 'big_win_500x', name: 'Coup de folie', description: 'Gain à x500 ou plus en une mise.', check: (s) => s.biggestMultiplier >= 500 },
  { id: 'balance_10k', name: 'En route', description: 'Atteins 10 000 ₶.', check: (s) => s.balance >= 10_000 },
  { id: 'balance_100k', name: 'Riche', description: 'Atteins 100 000 ₶.', check: (s) => s.balance >= 100_000 },
  { id: 'balance_1m', name: 'Millionnaire', description: 'Atteins 1 000 000 ₶.', check: (s) => s.balance >= 1_000_000 },
  { id: 'prestige_1', name: 'Renaissance', description: 'Prestige pour la première fois.', check: (s) => s.prestigeCount >= 1 },
  { id: 'prestige_5', name: 'Légende du casino', description: '5 prestiges.', check: (s) => s.prestigeCount >= 5 },
];

export function getPrestigeTitle(prestigeCount: number): string | null {
  if (prestigeCount <= 0) return null;
  if (prestigeCount < 3) return `Prestige ${prestigeCount}`;
  if (prestigeCount < 5) return `Vétéran ★${prestigeCount}`;
  if (prestigeCount < 10) return `Légende ★${prestigeCount}`;
  return `Mythique ★${prestigeCount}`;
}

// Free daily gift, not a bet — weighted tiers like the other games, but no
// house edge concept applies since nothing is wagered.
export function rollDailyBonus(): number {
  const roll = secureRandomInt(1_000_000) / 1_000_000;
  if (roll < 0.55) return 250;
  if (roll < 0.85) return 500;
  if (roll < 0.97) return 2000;
  return 10_000;
}

// Free daily wheel spin — different (higher-variance) segment table than the
// login bonus, for a distinct "special event" feel.
export const WHEEL_OF_FORTUNE_SEGMENTS = [100, 250, 500, 1000, 2500, 10_000];
const WHEEL_OF_FORTUNE_WEIGHTS = [0.30, 0.28, 0.22, 0.12, 0.06, 0.02];

export function rollWheelOfFortune(): number {
  const roll = secureRandomInt(1_000_000) / 1_000_000;
  let cumulative = 0;
  for (let i = 0; i < WHEEL_OF_FORTUNE_SEGMENTS.length; i++) {
    cumulative += WHEEL_OF_FORTUNE_WEIGHTS[i];
    if (roll < cumulative) return WHEEL_OF_FORTUNE_SEGMENTS[i];
  }
  return WHEEL_OF_FORTUNE_SEGMENTS[0];
}

export function seasonKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
