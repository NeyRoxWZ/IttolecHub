/**
 * Krash progression rules, shared by the server (which pays) and the page
 * (which shows progress). Everything here is separate from the casino's
 * chest, missions and pass.
 */

/* ------------------------------------------------------------------ */
/* Experience                                                           */
/* ------------------------------------------------------------------ */

export const KRASH_XP = {
  /** Any trade that ends, win or loss: playing moves the pass. */
  trade: 10,
  /** On top, for a trade closed in profit. */
  win: 10,
  mission: 60,
  chest: 30,
};

/** The pass runs by calendar month (UTC). */
export function krashPeriodKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function krashPeriodEnd(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

/* ------------------------------------------------------------------ */
/* Cosmetics                                                            */
/* ------------------------------------------------------------------ */

export type CosmeticKind = 'title' | 'skin';

export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  label: string;
  description: string;
}

export const COSMETICS: Record<string, Cosmetic> = {
  'title-stagiaire': { id: 'title-stagiaire', kind: 'title', label: 'Stagiaire de la corbeille', description: 'Titre affiché au classement.' },
  'skin-neon': { id: 'skin-neon', kind: 'skin', label: 'Courbe néon', description: 'Cyan quand ça monte, magenta quand ça baisse.' },
  'title-trader': { id: 'title-trader', kind: 'title', label: 'Trader fou', description: 'Titre affiché au classement.' },
  'skin-or': { id: 'skin-or', kind: 'skin', label: 'Courbe dorée', description: 'Une courbe en or massif.' },
  'skin-matrix': { id: 'skin-matrix', kind: 'skin', label: 'Courbe Matrix', description: 'Vert terminal, pour les initiés.' },
  'title-loup': { id: 'title-loup', kind: 'title', label: 'Loup de la Bourse', description: 'Le titre du dernier palier.' },
};

/** Chart colours per skin: rising, falling. */
export const CHART_SKINS: Record<string, { up: string; down: string; label: string }> = {
  classic: { up: '#00FF94', down: '#FF4D6D', label: 'Classique' },
  'skin-neon': { up: '#22d3ee', down: '#e879f9', label: 'Néon' },
  'skin-or': { up: '#FFD000', down: '#d97706', label: 'Or' },
  'skin-matrix': { up: '#4ade80', down: '#15803d', label: 'Matrix' },
};

/* ------------------------------------------------------------------ */
/* Pass Krash                                                           */
/* ------------------------------------------------------------------ */

export const PASS_TIERS = 30;
export const XP_PER_TIER = 150;

export interface TierReward {
  coins?: number;
  item?: string;
}

const TIER_ITEMS: Record<number, string> = {
  5: 'title-stagiaire',
  10: 'skin-neon',
  15: 'title-trader',
  20: 'skin-or',
  25: 'skin-matrix',
  30: 'title-loup',
};

export function tierReward(tier: number): TierReward {
  const item = TIER_ITEMS[tier];
  return item ? { item, coins: 250 } : { coins: 100 + tier * 20 };
}

export function xpForTier(tier: number): number {
  return tier * XP_PER_TIER;
}

export function tierFromXp(xp: number): number {
  return Math.min(PASS_TIERS, Math.floor(xp / XP_PER_TIER));
}

/* ------------------------------------------------------------------ */
/* Daily chest                                                          */
/* ------------------------------------------------------------------ */

/** Grows with the streak and caps at a week. */
export function chestReward(streak: number): number {
  return 150 + 50 * Math.min(Math.max(streak, 1) - 1, 6);
}

/* ------------------------------------------------------------------ */
/* Daily missions                                                       */
/* ------------------------------------------------------------------ */

export interface ClosedTrade {
  market: string;
  side: 'long' | 'short';
  leverage: number;
  stake: number;
  fee: number;
  payout: number | null;
  status: 'open' | 'closed' | 'liquidated';
  opened_at: string;
  closed_at: string | null;
}

export interface MissionDef {
  id: string;
  label: string;
  goal: number;
  reward: number;
  /** How far today's trades go towards the goal. */
  measure: (trades: ClosedTrade[]) => number;
}

const pnl = (t: ClosedTrade) => (t.payout ?? 0) - t.stake - t.fee;

export const MISSIONS: MissionDef[] = [
  { id: 'trades5', label: 'Ferme 5 trades', goal: 5, reward: 150, measure: (ts) => ts.length },
  { id: 'wins3', label: 'Gagne 3 trades', goal: 3, reward: 200, measure: (ts) => ts.filter((t) => pnl(t) > 0).length },
  { id: 'lev5', label: 'Ferme un trade en x5 ou plus', goal: 1, reward: 150, measure: (ts) => ts.filter((t) => t.leverage >= 5).length },
  { id: 'markets3', label: 'Trade sur 3 marchés différents', goal: 3, reward: 200, measure: (ts) => new Set(ts.map((t) => t.market)).size },
  { id: 'profit500', label: 'Gagne 500 ₶ au total', goal: 500, reward: 250, measure: (ts) => Math.max(0, ts.reduce((s, t) => s + pnl(t), 0)) },
  { id: 'short2', label: 'Gagne 2 ventes à découvert', goal: 2, reward: 200, measure: (ts) => ts.filter((t) => t.side === 'short' && pnl(t) > 0).length },
  { id: 'meme1', label: 'Ferme un trade sur un memecoin du marché Meme', goal: 1, reward: 120, measure: (ts) => ts.filter((t) => t.market === 'meme').length },
  { id: 'matiere1', label: 'Ferme un trade sur une matière première', goal: 1, reward: 120, measure: (ts) => ts.filter((t) => t.market === 'matieres').length },
  {
    id: 'hold10', label: 'Garde une position au moins 10 minutes', goal: 1, reward: 150,
    measure: (ts) => ts.filter((t) => t.status === 'closed' && t.closed_at
      && new Date(t.closed_at).getTime() - new Date(t.opened_at).getTime() >= 600_000).length,
  },
  { id: 'volume5k', label: 'Engage 5 000 ₶ de volume (levier compris)', goal: 5000, reward: 200, measure: (ts) => ts.reduce((s, t) => s + t.stake * t.leverage, 0) },
  { id: 'bigwin', label: 'Réussis un trade à +50 % ou plus', goal: 1, reward: 300, measure: (ts) => ts.filter((t) => pnl(t) >= t.stake * 0.5).length },
];

export const MISSIONS_PER_DAY = 3;

export function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Today's three missions, the same for everyone. */
export function missionsOfDay(day = dayKey()): MissionDef[] {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) { h ^= day.charCodeAt(i); h = Math.imul(h, 16777619); }
  const pool = [...MISSIONS];
  const picked: MissionDef[] = [];
  while (picked.length < MISSIONS_PER_DAY && pool.length) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    picked.push(pool.splice(h % pool.length, 1)[0]);
  }
  return picked;
}
