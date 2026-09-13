/**
 * The Krash shop: the casino's model — a fixed catalogue, five items on sale
 * each day, the same for everyone — with items that act on trading.
 */

export type KrashItemCategory = 'protection' | 'gain' | 'trading' | 'xp' | 'economie';

export type KrashItemEffect =
  // held as an active effect and spent by trades
  | 'fee_free'            // no fees on the next trades
  | 'loss_refund'         // magnitude = share of a losing trade's loss returned
  | 'liquidation_shield'  // magnitude = share of a liquidated stake returned
  | 'profit_boost'        // magnitude = extra share of a winning trade's profit
  | 'flash_boost'         // magnitude = extra share on flash bet odds
  | 'max_stake'           // magnitude = stake cap as a share of the balance
  | 'leverage_unlock'     // every leverage available, whatever the trade count
  | 'xp_multiplier'       // magnitude = pass XP multiplier
  | 'chest_freeze'        // a missed day does not break the chest streak
  // applied on use
  | 'grant_xp'
  | 'mystery_coins'
  | 'interest';

export interface KrashShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: KrashItemCategory;
  effect: KrashItemEffect;
  magnitude?: number;
  /** How many trades (or bets) it covers. */
  uses?: number;
  /** How long it lasts once used, in minutes. */
  durationMin?: number;
}

export const KRASH_SHOP_ITEMS: KrashShopItem[] = [
  /* ---- protection ---- */
  { id: 'k_refund_full', name: 'Stop-loss magique', description: 'Ton prochain trade perdant t’est entièrement remboursé.', price: 1200, category: 'protection', effect: 'loss_refund', magnitude: 1, uses: 1 },
  { id: 'k_refund_half', name: 'Assurance trader', description: 'La moitié de la perte te revient sur tes 3 prochains trades perdants.', price: 900, category: 'protection', effect: 'loss_refund', magnitude: 0.5, uses: 3 },
  { id: 'k_liq_shield', name: 'Parachute', description: 'Si ta prochaine position est liquidée, la moitié de la mise te revient.', price: 800, category: 'protection', effect: 'liquidation_shield', magnitude: 0.5, uses: 1 },
  { id: 'k_liq_shield_big', name: 'Parachute doré', description: 'Tes 2 prochaines liquidations te rendent 80 % de la mise.', price: 1800, category: 'protection', effect: 'liquidation_shield', magnitude: 0.8, uses: 2 },
  { id: 'k_chest_freeze', name: 'Réveil-matin', description: 'Un jour d’absence ne casse pas ta série du coffre Krash.', price: 1000, category: 'protection', effect: 'chest_freeze', uses: 1 },

  /* ---- gain ---- */
  { id: 'k_profit_10', name: 'Coup de pouce', description: '+10 % de profit sur tes 10 prochains trades gagnants.', price: 900, category: 'gain', effect: 'profit_boost', magnitude: 0.10, uses: 10 },
  { id: 'k_profit_25', name: 'Main chaude', description: '+25 % de profit sur tes 5 prochains trades gagnants.', price: 1500, category: 'gain', effect: 'profit_boost', magnitude: 0.25, uses: 5 },
  { id: 'k_profit_50', name: 'Délit d’initié', description: '+50 % de profit, mais seulement sur 2 trades gagnants.', price: 2200, category: 'gain', effect: 'profit_boost', magnitude: 0.50, uses: 2 },
  { id: 'k_flash_boost', name: 'Réflexes éclair', description: 'Cotes des paris flash +20 % sur tes 5 prochains paris.', price: 700, category: 'gain', effect: 'flash_boost', magnitude: 0.20, uses: 5 },

  /* ---- trading ---- */
  { id: 'k_fee_free', name: 'Zéro frais', description: 'Aucun frais sur tes 5 prochains trades.', price: 400, category: 'trading', effect: 'fee_free', uses: 5 },
  { id: 'k_fee_free_big', name: 'Courtier ami', description: 'Aucun frais sur tes 15 prochains trades.', price: 1000, category: 'trading', effect: 'fee_free', uses: 15 },
  { id: 'k_max_stake', name: 'Gros bras', description: 'Mise max portée à 75 % de ton solde pendant 20 minutes.', price: 900, category: 'trading', effect: 'max_stake', magnitude: 0.75, durationMin: 20 },
  { id: 'k_leverage', name: 'Licence de levier', description: 'Tous les leviers (jusqu’à x10) disponibles pendant 30 minutes.', price: 700, category: 'trading', effect: 'leverage_unlock', durationMin: 30 },

  /* ---- xp ---- */
  { id: 'k_xp_double', name: 'Double XP', description: 'XP du pass doublée pendant 30 minutes.', price: 500, category: 'xp', effect: 'xp_multiplier', magnitude: 2, durationMin: 30 },
  { id: 'k_xp_triple', name: 'Triple XP', description: 'XP du pass triplée pendant 15 minutes.', price: 800, category: 'xp', effect: 'xp_multiplier', magnitude: 3, durationMin: 15 },
  { id: 'k_xp_small', name: 'Coffre XP', description: '+400 XP de pass immédiatement.', price: 350, category: 'xp', effect: 'grant_xp', magnitude: 400 },
  { id: 'k_xp_big', name: 'Coffre XP majeur', description: '+2 000 XP de pass immédiatement.', price: 1400, category: 'xp', effect: 'grant_xp', magnitude: 2000 },

  /* ---- économie ---- */
  { id: 'k_mystery', name: 'Sac mystère', description: 'Contient entre ×0,4 et ×3 son prix. À tes risques.', price: 800, category: 'economie', effect: 'mystery_coins' },
  { id: 'k_mystery_xl', name: 'Sac mystère XL', description: 'Entre ×0,4 et ×3 son prix, mais la mise est plus grosse.', price: 3000, category: 'economie', effect: 'mystery_coins' },
  { id: 'k_interest', name: 'Livret A', description: '+2 % de ton solde immédiatement (jusqu’à 3 000 ₶).', price: 2500, category: 'economie', effect: 'interest', magnitude: 0.02 },
];

export const KRASH_SHOP_SLOTS = 5;

export function krashItemById(id: string): KrashShopItem | undefined {
  return KRASH_SHOP_ITEMS.find((i) => i.id === id);
}

function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
}

export function krashShopDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Five items for the day, spread across categories, never two with the same effect. */
export function krashDailyShop(day = krashShopDay()): KrashShopItem[] {
  const rand = seeded(`krash-shop:${day}`);
  const pool = [...KRASH_SHOP_ITEMS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked: KrashShopItem[] = [];
  const categories = new Set<KrashItemCategory>();
  for (const item of pool) {
    if (picked.length >= KRASH_SHOP_SLOTS) break;
    if (categories.has(item.category)) continue;
    picked.push(item);
    categories.add(item.category);
  }
  for (const item of pool) {
    if (picked.length >= KRASH_SHOP_SLOTS) break;
    if (picked.some((p) => p.id === item.id || p.effect === item.effect)) continue;
    picked.push(item);
  }
  return picked.sort((a, b) => a.price - b.price);
}

export function secondsUntilShopRotation(now = new Date()): number {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
}
