/**
 * The shop: a fixed catalogue of 30 items, 5 of which are on sale each day.
 * The daily selection is derived from the date alone, so every player sees
 * the same shop and it rolls over at midnight UTC with no scheduled job.
 */

export type ItemCategory = 'protection' | 'gain' | 'xp' | 'mise' | 'mission' | 'economie';

export type ItemEffect =
  // consumables resolved during a bet settlement
  | 'loss_refund'        // magnitude = share of the stake returned on a loss
  | 'streak_shield'      // a loss doesn't reset the win streak
  | 'win_bonus'          // magnitude = extra share of the profit
  | 'jackpot_boost'      // magnitude = multiplier on jackpot odds
  | 'xp_multiplier'      // magnitude = XP multiplier, time-based
  | 'max_bet_pct'        // magnitude = new bet cap as a share of balance
  // one-shot, applied at purchase
  | 'grant_xp'
  | 'grant_level'
  | 'mystery_coins'
  | 'interest'
  | 'cashback_boost'
  | 'mission_reroll'
  | 'mission_complete'
  | 'grant_scratch';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ItemCategory;
  effect: ItemEffect;
  /** Strength of the effect (share, multiplier, or flat amount). */
  magnitude?: number;
  /** Consumable: how many bets it covers. */
  uses?: number;
  /** Consumable: how long it lasts, in minutes. */
  durationMin?: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  /* ---- protection ---- */
  { id: 'lucky_token', name: 'Jeton porte-bonheur', description: 'Ta prochaine mise perdue t’est intégralement remboursée.', price: 900, category: 'protection', effect: 'loss_refund', magnitude: 1, uses: 1 },
  { id: 'insurance', name: 'Assurance', description: 'La moitié de ta mise te revient sur tes 3 prochaines défaites.', price: 700, category: 'protection', effect: 'loss_refund', magnitude: 0.5, uses: 3 },
  { id: 'streak_shield', name: 'Bouclier de série', description: 'Ta prochaine défaite ne casse pas ta série de victoires.', price: 1200, category: 'protection', effect: 'streak_shield', uses: 1 },
  { id: 'safety_net_plus', name: 'Filet renforcé', description: 'Tes 5 prochaines défaites te rendent 25% de la mise.', price: 550, category: 'protection', effect: 'loss_refund', magnitude: 0.25, uses: 5 },

  /* ---- gain ---- */
  { id: 'win_boost_10', name: 'Coup de pouce', description: '+10% sur tes gains pendant 10 mises.', price: 800, category: 'gain', effect: 'win_bonus', magnitude: 0.10, uses: 10 },
  { id: 'win_boost_25', name: 'Main chaude', description: '+25% sur tes gains pendant 5 mises.', price: 1500, category: 'gain', effect: 'win_bonus', magnitude: 0.25, uses: 5 },
  { id: 'win_boost_50', name: 'Veine insolente', description: '+50% sur tes gains, mais seulement 2 mises.', price: 2400, category: 'gain', effect: 'win_bonus', magnitude: 0.50, uses: 2 },
  { id: 'jackpot_ticket', name: 'Ticket jackpot', description: 'Tes chances de rafler le jackpot sont doublées pendant 20 mises.', price: 2000, category: 'gain', effect: 'jackpot_boost', magnitude: 2, uses: 20 },
  { id: 'jackpot_ticket_gold', name: 'Ticket jackpot doré', description: 'Chances de jackpot ×5 pendant 10 mises.', price: 5000, category: 'gain', effect: 'jackpot_boost', magnitude: 5, uses: 10 },

  /* ---- xp ---- */
  { id: 'xp_double', name: 'Double XP', description: 'XP doublée pendant 30 minutes.', price: 600, category: 'xp', effect: 'xp_multiplier', magnitude: 2, durationMin: 30 },
  { id: 'xp_triple', name: 'Triple XP', description: 'XP triplée pendant 15 minutes.', price: 1000, category: 'xp', effect: 'xp_multiplier', magnitude: 3, durationMin: 15 },
  { id: 'xp_pack_small', name: 'Coffre XP', description: '+500 XP immédiatement.', price: 400, category: 'xp', effect: 'grant_xp', magnitude: 500 },
  { id: 'xp_pack_big', name: 'Coffre XP majeur', description: '+2 500 XP immédiatement.', price: 1800, category: 'xp', effect: 'grant_xp', magnitude: 2500 },
  { id: 'level_skip', name: 'Avance de niveau', description: 'Monte d’un niveau sur-le-champ, coffre compris.', price: 2500, category: 'xp', effect: 'grant_level', magnitude: 1 },

  /* ---- mise ---- */
  { id: 'high_roller', name: 'Gros bras', description: 'Plafond de mise porté à 75% de ton solde pendant 20 minutes.', price: 1100, category: 'mise', effect: 'max_bet_pct', magnitude: 0.75, durationMin: 20 },
  { id: 'all_in_pass', name: 'Permis tout-ou-rien', description: 'Plafond de mise à 90% du solde pendant 10 minutes.', price: 2600, category: 'mise', effect: 'max_bet_pct', magnitude: 0.90, durationMin: 10 },
  { id: 'scratch_pack', name: 'Carnet de grattage', description: '3 tickets de grattage offerts, crédités en ₶.', price: 150, category: 'mise', effect: 'grant_scratch', magnitude: 3 },

  /* ---- missions ---- */
  { id: 'mission_reroll', name: 'Nouvelles missions', description: 'Remplace tes 3 missions du jour par 3 autres.', price: 500, category: 'mission', effect: 'mission_reroll' },
  { id: 'mission_skip', name: 'Mission validée', description: 'Termine instantanément ta mission la plus avancée.', price: 2200, category: 'mission', effect: 'mission_complete' },

  /* ---- économie ---- */
  { id: 'mystery_bag', name: 'Sac mystère', description: 'Contient entre ×0,4 et ×3 son prix. À tes risques.', price: 1000, category: 'economie', effect: 'mystery_coins' },
  { id: 'mystery_bag_xl', name: 'Sac mystère XL', description: 'Entre ×0,4 et ×3 son prix, mais la mise est plus grosse.', price: 4000, category: 'economie', effect: 'mystery_coins' },
  { id: 'interest', name: 'Placement', description: '+2% de ton solde immédiatement (jusqu’à 5 000 ₶).', price: 3000, category: 'economie', effect: 'interest', magnitude: 0.02 },
  { id: 'cashback_boost', name: 'Cashback doublé', description: 'Ton prochain cashback passe de 5% à 10% de tes pertes.', price: 1400, category: 'economie', effect: 'cashback_boost', uses: 1 },
  { id: 'second_wind', name: 'Second souffle', description: 'Tes 2 prochaines défaites te rendent 75% de la mise.', price: 1100, category: 'protection', effect: 'loss_refund', magnitude: 0.75, uses: 2 },
  { id: 'xp_marathon', name: 'Marathon XP', description: 'XP ×1,5 pendant 90 minutes.', price: 900, category: 'xp', effect: 'xp_multiplier', magnitude: 1.5, durationMin: 90 },
  { id: 'jackpot_seed', name: 'Amorce de jackpot', description: 'Chances de jackpot ×3 pendant 15 mises.', price: 3200, category: 'gain', effect: 'jackpot_boost', magnitude: 3, uses: 15 },

];

export const SHOP_SLOTS_PER_DAY = 5;

export function itemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}

/** Everything in the catalogue is a consumable; crates live in `crates.ts`. */
export const CONSUMABLES = SHOP_ITEMS;

function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
}

export function shopDayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Five items for the day, spread across categories so the shop never shows
 * five near-identical boosters at once, and never two items that share an
 * effect+magnitude.
 */
export function dailyShop(day: string = shopDayKey()): ShopItem[] {
  const rand = seeded(`shop:${day}`);
  const pool = [...SHOP_ITEMS];
  // Fisher-Yates with the seeded generator.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const picked: ShopItem[] = [];
  const usedCategories = new Set<ItemCategory>();

  // First pass: one per category for variety.
  for (const item of pool) {
    if (picked.length >= SHOP_SLOTS_PER_DAY) break;
    if (usedCategories.has(item.category)) continue;
    picked.push(item);
    usedCategories.add(item.category);
  }
  // Second pass: fill remaining slots, still avoiding duplicate effects.
  for (const item of pool) {
    if (picked.length >= SHOP_SLOTS_PER_DAY) break;
    if (picked.some((p) => p.id === item.id)) continue;
    if (picked.some((p) => p.effect === item.effect && p.magnitude === item.magnitude)) continue;
    picked.push(item);
  }

  return picked.sort((a, b) => a.price - b.price);
}

/** Seconds until the shop rotates, for the countdown in the UI. */
export function secondsUntilRotation(now: Date = new Date()): number {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
}
