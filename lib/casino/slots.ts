export * from './core';
import { secureRandomInt, type BetResolution } from './core';

// Abstracted outcome (tier-based) instead of literal independent-reel math —
// true 3-independent-reels-must-match slots need brutal win frequencies to
// reach a sane RTP. Tiers give the same guaranteed RTP with a much better
// (and tunable) win-frequency feel, dressed up as 3 reel symbols.
export type SlotTier = 'lose' | 'cherry' | 'bell' | 'star' | 'diamond';

export const SLOT_SYMBOL: Record<SlotTier, string> = {
  lose: '',
  cherry: '🍒',
  bell: '🔔',
  star: '⭐',
  diamond: '💎',
};

// P, multiplier — sum(P)=1, sum(P*mult)=0.94 (RTP 94%)
const TIERS: { tier: SlotTier; p: number; mult: number }[] = [
  { tier: 'lose', p: 0.70, mult: 0 },
  { tier: 'cherry', p: 0.20, mult: 1 },
  { tier: 'bell', p: 0.07, mult: 4 },
  { tier: 'star', p: 0.025, mult: 10 },
  { tier: 'diamond', p: 0.005, mult: 42 },
];

const LOSE_SYMBOLS = ['🍒', '🔔', '⭐', '💎', '🍋', '🍇'];

export function spinSlots(): { tier: SlotTier; multiplier: number; reels: string[] } {
  const roll = secureRandomInt(1_000_000) / 1_000_000;
  let cumulative = 0;
  for (const t of TIERS) {
    cumulative += t.p;
    if (roll < cumulative) {
      const reels = t.tier === 'lose'
        ? Array.from({ length: 3 }, () => LOSE_SYMBOLS[secureRandomInt(LOSE_SYMBOLS.length)])
        : [SLOT_SYMBOL[t.tier], SLOT_SYMBOL[t.tier], SLOT_SYMBOL[t.tier]];
      return { tier: t.tier, multiplier: t.mult, reels };
    }
  }
  return { tier: 'lose', multiplier: 0, reels: LOSE_SYMBOLS.slice(0, 3) };
}

export function resolveSlots(multiplier: number): BetResolution {
  return { won: multiplier > 0, multiplier };
}
