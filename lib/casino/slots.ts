export * from './core';
import { secureRandomInt, type BetResolution } from './core';

// Abstracted outcome (tier-based) instead of literal independent-reel math —
// true 3-independent-reels-must-match slots need brutal win frequencies to
// reach a sane RTP. Tiers give the same guaranteed RTP with a much better
// (and tunable) win-frequency feel, dressed up as 3 reel symbols.
export type SlotTier = 'lose' | 'cherry' | 'bell' | 'star' | 'diamond';

/** Symbol keys — the client maps these to drawn artwork. */
export type SlotSymbol = 'cherry' | 'bell' | 'star' | 'diamond' | 'lemon' | 'seven';

export const SLOT_SYMBOL: Record<SlotTier, SlotSymbol | ''> = {
  lose: '',
  cherry: 'cherry',
  bell: 'bell',
  star: 'star',
  diamond: 'diamond',
};

// P, multiplier — sum(P)=1, sum(P*mult)=0.94 (RTP 94%)
const TIERS: { tier: SlotTier; p: number; mult: number }[] = [
  { tier: 'lose', p: 0.70, mult: 0 },
  { tier: 'cherry', p: 0.20, mult: 1 },
  { tier: 'bell', p: 0.07, mult: 4 },
  { tier: 'star', p: 0.025, mult: 10 },
  { tier: 'diamond', p: 0.005, mult: 42 },
];

const ALL_SYMBOLS: SlotSymbol[] = ['cherry', 'bell', 'star', 'diamond', 'lemon', 'seven'];

/** A losing spin must never show three of a kind. */
function losingReels(): SlotSymbol[] {
  const a = ALL_SYMBOLS[secureRandomInt(ALL_SYMBOLS.length)];
  let b = ALL_SYMBOLS[secureRandomInt(ALL_SYMBOLS.length)];
  while (b === a) b = ALL_SYMBOLS[secureRandomInt(ALL_SYMBOLS.length)];
  const c = ALL_SYMBOLS[secureRandomInt(ALL_SYMBOLS.length)];
  const reels = [a, b, c];
  // Shuffle so the odd one out isn't always in the same slot.
  for (let i = reels.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [reels[i], reels[j]] = [reels[j], reels[i]];
  }
  return reels;
}

export function spinSlots(): { tier: SlotTier; multiplier: number; reels: SlotSymbol[] } {
  const roll = secureRandomInt(1_000_000) / 1_000_000;
  let cumulative = 0;
  for (const t of TIERS) {
    cumulative += t.p;
    if (roll < cumulative) {
      if (t.tier === 'lose') return { tier: t.tier, multiplier: t.mult, reels: losingReels() };
      const s = SLOT_SYMBOL[t.tier] as SlotSymbol;
      return { tier: t.tier, multiplier: t.mult, reels: [s, s, s] };
    }
  }
  return { tier: 'lose', multiplier: 0, reels: losingReels() };
}

export function resolveSlots(multiplier: number): BetResolution {
  return { won: multiplier > 0, multiplier };
}
