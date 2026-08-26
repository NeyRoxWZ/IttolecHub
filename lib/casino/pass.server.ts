import { supabase } from '@/lib/supabase/server';
import {
  PASS_TIERS, PASS_PREMIUM_PRICE, PASS_TRACK, tierFromPassXp, weekKey,
  type PassReward,
} from './pass';
import { addToInventory } from './inventory.server';

export interface PassRow {
  week_key: string;
  xp: number;
  tier: number;
  premium: boolean;
  claimed_free: number;
  claimed_premium: number;
}

export interface GrantedReward extends PassReward {
  tier: number;
  track: 'free' | 'premium';
}

export interface PassProgress {
  tier: number;
  tiersGained: number;
  xp: number;
  granted: GrantedReward[];
}

const EMPTY_PROGRESS: PassProgress = { tier: 0, tiersGained: 0, xp: 0, granted: [] };

/** Read this week's pass row, creating it on first touch. */
export async function ensurePass(userId: string): Promise<PassRow | null> {
  const week = weekKey();
  const { data } = await supabase.from('casino_pass').select('*').eq('user_id', userId).eq('week_key', week).maybeSingle();
  if (data) return data as PassRow;

  await supabase.from('casino_pass').insert({ user_id: userId, week_key: week });
  const { data: created } = await supabase.from('casino_pass').select('*').eq('user_id', userId).eq('week_key', week).maybeSingle();
  return (created as PassRow) ?? null;
}

/**
 * Hand out every reward between `from` (exclusive) and `to` (inclusive) on one
 * track. Rewards are granted automatically — the player never loses a tier by
 * failing to press a button before the Monday reset; the pass page is a recap
 * of what already landed, not a to-do list.
 */
async function grantRange(userId: string, from: number, to: number, track: 'free' | 'premium'): Promise<GrantedReward[]> {
  const granted: GrantedReward[] = [];
  let coins = 0;
  const cosmetics: { user_id: string; item_id: string; quantity: number }[] = [];

  for (let t = from + 1; t <= to; t++) {
    const def = PASS_TRACK[t - 1];
    if (!def) continue;
    const reward = track === 'free' ? def.free : def.premium;
    granted.push({ ...reward, tier: t, track });

    if (reward.kind === 'coins') coins += reward.amount || 0;
    else if (reward.kind === 'cosmetic' && reward.cosmeticId) {
      cosmetics.push({ user_id: userId, item_id: reward.cosmeticId, quantity: 1 });
    } else if (reward.kind === 'item' && reward.itemId) {
      // Items land in the inventory like a purchase would, so the player
      // chooses when to spend them.
      await addToInventory(userId, reward.itemId);
    }
  }

  if (cosmetics.length) {
    await supabase.from('casino_inventory').upsert(cosmetics, { onConflict: 'user_id,item_id' });
  }

  if (coins > 0) {
    const { data: wallet } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
    if (wallet) {
      const newBalance = wallet.balance + coins;
      await supabase.from('casino_wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', userId);
      await supabase.from('casino_transactions').insert({
        user_id: userId, game_slug: 'casino', type: 'bonus', amount: coins,
        balance_after: newBalance, meta: { kind: 'pass', track, upTo: to },
      });
    }
  }

  return granted;
}

/** Add pass XP and pay out any tier it crossed. */
export async function advancePass(userId: string, xp: number): Promise<PassProgress> {
  if (xp <= 0) return EMPTY_PROGRESS;
  const row = await ensurePass(userId);
  if (!row) return EMPTY_PROGRESS;

  const newXp = row.xp + xp;
  const { tier } = tierFromPassXp(newXp);
  const capped = Math.min(PASS_TIERS, tier);

  const granted: GrantedReward[] = [];
  if (capped > row.claimed_free) granted.push(...await grantRange(userId, row.claimed_free, capped, 'free'));
  if (row.premium && capped > row.claimed_premium) granted.push(...await grantRange(userId, row.claimed_premium, capped, 'premium'));

  const tiersGained = Math.max(0, capped - row.tier);
  if (tiersGained > 0) {
    const { data: w } = await supabase.from('casino_wallets').select('pass_tiers_total').eq('user_id', userId).maybeSingle();
    if (w) {
      await supabase.from('casino_wallets')
        .update({ pass_tiers_total: Number(w.pass_tiers_total || 0) + tiersGained })
        .eq('user_id', userId);
    }
  }

  await supabase.from('casino_pass').update({
    xp: newXp,
    tier: capped,
    claimed_free: Math.max(row.claimed_free, capped),
    claimed_premium: row.premium ? Math.max(row.claimed_premium, capped) : row.claimed_premium,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('week_key', row.week_key);

  return { tier: capped, tiersGained, xp: newXp, granted };
}

/**
 * Unlock the premium track for the current week. Buying late is not a
 * punishment: every premium reward up to the tier already reached is granted
 * on the spot.
 */
export async function buyPassPremium(userId: string) {
  const row = await ensurePass(userId);
  if (!row) return { ok: false as const, status: 404, error: 'Passe introuvable' };
  if (row.premium) return { ok: false as const, status: 400, error: 'Voie premium déjà débloquée cette semaine.' };

  const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
  if (!wallet) return { ok: false as const, status: 404, error: 'Portefeuille introuvable' };
  if (wallet.balance < PASS_PREMIUM_PRICE) return { ok: false as const, status: 400, error: 'Solde insuffisant' };

  const afterCost = wallet.balance - PASS_PREMIUM_PRICE;
  const { data: charged } = await supabase.from('casino_wallets')
    .update({ balance: afterCost, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('balance', wallet.balance)
    .select().maybeSingle();
  if (!charged) return { ok: false as const, status: 409, error: 'Conflit, réessaye.' };

  await supabase.from('casino_transactions').insert({
    user_id: userId, game_slug: 'casino', type: 'shop', amount: -PASS_PREMIUM_PRICE,
    balance_after: afterCost, meta: { kind: 'pass_premium', week: row.week_key },
  });

  await supabase.from('casino_pass').update({ premium: true }).eq('user_id', userId).eq('week_key', row.week_key);

  const granted = row.tier > 0 ? await grantRange(userId, 0, row.tier, 'premium') : [];
  if (granted.length) {
    await supabase.from('casino_pass').update({ claimed_premium: row.tier }).eq('user_id', userId).eq('week_key', row.week_key);
  }

  const { data: fresh } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
  return { ok: true as const, granted, newBalance: fresh?.balance ?? afterCost };
}
