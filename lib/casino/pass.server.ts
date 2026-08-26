import { supabase } from '@/lib/supabase/server';
import {
  PASS_TIERS, PASS_PREMIUM_PRICE, PASS_TRACK, PASS_DAILY_XP_CAP, PASS_DAILY_BET_XP_CAP,
  tierFromPassXp, weekKey,
  type PassReward,
} from './pass';
import { dayKey } from './missions';
import { addToInventory } from './inventory.server';

export interface PassRow {
  week_key: string;
  xp: number;
  tier: number;
  premium: boolean;
  swept?: boolean;
  day_key?: string | null;
  day_xp?: number;
  day_bet_xp?: number;
}

/** Where a bit of pass XP came from — bets are the only capped source. */
export type PassXpSource = 'bet' | 'activity';

export type PassTrack = 'free' | 'premium';

export interface GrantedReward extends PassReward {
  tier: number;
  track: PassTrack;
}

export interface PassProgress {
  tier: number;
  tiersGained: number;
  xp: number;
  /** Tiers newly reached and now waiting to be claimed. */
  unlocked: number[];
}

const EMPTY_PROGRESS: PassProgress = { tier: 0, tiersGained: 0, xp: 0, unlocked: [] };

/* ------------------------------------------------------------------ */
/* Granting                                                            */
/* ------------------------------------------------------------------ */

async function grantRewards(userId: string, rewards: GrantedReward[]) {
  if (rewards.length === 0) return;

  let coins = 0;
  const cosmetics: { user_id: string; item_id: string; quantity: number }[] = [];

  for (const reward of rewards) {
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
        balance_after: newBalance, meta: { kind: 'pass', tiers: rewards.length },
      });
    }
  }
}

function rewardAt(tier: number, track: PassTrack): PassReward | null {
  const def = PASS_TRACK[tier - 1];
  if (!def) return null;
  return track === 'free' ? def.free : def.premium;
}

/* ------------------------------------------------------------------ */
/* Weekly row                                                          */
/* ------------------------------------------------------------------ */

/**
 * Anything still unclaimed when the week turns over is swept into the
 * account rather than lost. Claiming by hand is the good part; being punished
 * for not connecting on Sunday night is not.
 */
async function sweepPreviousWeeks(userId: string, currentWeek: string) {
  const { data: stale } = await supabase.from('casino_pass')
    .select('*').eq('user_id', userId).eq('swept', false).neq('week_key', currentWeek);

  for (const row of (stale || []) as PassRow[]) {
    const { data: claims } = await supabase.from('casino_pass_claims')
      .select('track, tier').eq('user_id', userId).eq('week_key', row.week_key);
    const taken = new Set((claims || []).map((c) => `${c.track}:${c.tier}`));

    const pending: GrantedReward[] = [];
    for (let t = 1; t <= row.tier; t++) {
      for (const track of ['free', 'premium'] as PassTrack[]) {
        if (track === 'premium' && !row.premium) continue;
        if (taken.has(`${track}:${t}`)) continue;
        const reward = rewardAt(t, track);
        if (reward) pending.push({ ...reward, tier: t, track });
      }
    }

    await grantRewards(userId, pending);
    await supabase.from('casino_pass').update({ swept: true }).eq('user_id', userId).eq('week_key', row.week_key);
  }
}

export async function ensurePass(userId: string): Promise<PassRow | null> {
  const week = weekKey();
  const { data } = await supabase.from('casino_pass').select('*').eq('user_id', userId).eq('week_key', week).maybeSingle();
  if (data) return data as PassRow;

  await sweepPreviousWeeks(userId, week);
  await supabase.from('casino_pass').insert({ user_id: userId, week_key: week });
  const { data: created } = await supabase.from('casino_pass').select('*').eq('user_id', userId).eq('week_key', week).maybeSingle();
  return (created as PassRow) ?? null;
}

export async function passClaims(userId: string): Promise<{ free: number[]; premium: number[] }> {
  const { data } = await supabase.from('casino_pass_claims')
    .select('track, tier').eq('user_id', userId).eq('week_key', weekKey());
  const out = { free: [] as number[], premium: [] as number[] };
  for (const row of data || []) {
    (row.track === 'premium' ? out.premium : out.free).push(row.tier);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Progression                                                         */
/* ------------------------------------------------------------------ */

/**
 * Add pass XP, clamped by the day's remaining budget. Rewards are not handed
 * out here — they're claimed by hand.
 */
export async function advancePass(userId: string, xp: number, source: PassXpSource = 'bet'): Promise<PassProgress> {
  if (xp <= 0) return EMPTY_PROGRESS;
  const row = await ensurePass(userId);
  if (!row) return EMPTY_PROGRESS;

  const today = dayKey();
  const sameDay = row.day_key === today;
  const dayXp = sameDay ? Number(row.day_xp || 0) : 0;
  const dayBetXp = sameDay ? Number(row.day_bet_xp || 0) : 0;

  let allowed = Math.max(0, PASS_DAILY_XP_CAP - dayXp);
  if (source === 'bet') allowed = Math.min(allowed, Math.max(0, PASS_DAILY_BET_XP_CAP - dayBetXp));

  const granted = Math.min(xp, allowed);
  if (granted <= 0) {
    return { tier: row.tier, tiersGained: 0, xp: row.xp, unlocked: [] };
  }
  xp = granted;

  const newXp = row.xp + xp;
  const { tier } = tierFromPassXp(newXp);
  const capped = Math.min(PASS_TIERS, tier);
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
    day_key: today,
    day_xp: dayXp + xp,
    day_bet_xp: dayBetXp + (source === 'bet' ? xp : 0),
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId).eq('week_key', row.week_key);

  const unlocked: number[] = [];
  for (let t = row.tier + 1; t <= capped; t++) unlocked.push(t);

  return { tier: capped, tiersGained, xp: newXp, unlocked };
}

/* ------------------------------------------------------------------ */
/* Claiming                                                            */
/* ------------------------------------------------------------------ */

export async function claimPassTier(userId: string, tier: number, track: PassTrack) {
  const row = await ensurePass(userId);
  if (!row) return { ok: false as const, status: 404, error: 'Passe introuvable' };
  if (!Number.isInteger(tier) || tier < 1 || tier > PASS_TIERS) {
    return { ok: false as const, status: 400, error: 'Palier invalide' };
  }
  if (tier > row.tier) return { ok: false as const, status: 400, error: 'Palier pas encore atteint.' };
  if (track === 'premium' && !row.premium) {
    return { ok: false as const, status: 400, error: 'Voie premium non débloquée.' };
  }

  const reward = rewardAt(tier, track);
  if (!reward) return { ok: false as const, status: 404, error: 'Récompense introuvable' };

  // The primary key is the lock: a second claim fails at the insert.
  const { error } = await supabase.from('casino_pass_claims')
    .insert({ user_id: userId, week_key: row.week_key, track, tier });
  if (error) return { ok: false as const, status: 400, error: 'Palier déjà réclamé.' };

  await grantRewards(userId, [{ ...reward, tier, track }]);

  const { data: wallet } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
  return { ok: true as const, reward, tier, track, newBalance: wallet?.balance ?? 0 };
}

/** Take everything currently claimable in one go. */
export async function claimAllPass(userId: string) {
  const row = await ensurePass(userId);
  if (!row) return { ok: false as const, status: 404, error: 'Passe introuvable' };

  const claims = await passClaims(userId);
  const takenFree = new Set(claims.free);
  const takenPremium = new Set(claims.premium);

  const pending: GrantedReward[] = [];
  const rows: { user_id: string; week_key: string; track: PassTrack; tier: number }[] = [];

  for (let t = 1; t <= row.tier; t++) {
    if (!takenFree.has(t)) {
      const reward = rewardAt(t, 'free');
      if (reward) {
        pending.push({ ...reward, tier: t, track: 'free' });
        rows.push({ user_id: userId, week_key: row.week_key, track: 'free', tier: t });
      }
    }
    if (row.premium && !takenPremium.has(t)) {
      const reward = rewardAt(t, 'premium');
      if (reward) {
        pending.push({ ...reward, tier: t, track: 'premium' });
        rows.push({ user_id: userId, week_key: row.week_key, track: 'premium', tier: t });
      }
    }
  }

  if (rows.length === 0) return { ok: false as const, status: 400, error: 'Rien à réclamer.' };

  const { error } = await supabase.from('casino_pass_claims').insert(rows);
  if (error) return { ok: false as const, status: 409, error: 'Conflit, réessaye.' };

  await grantRewards(userId, pending);

  const { data: wallet } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
  return { ok: true as const, granted: pending, newBalance: wallet?.balance ?? 0 };
}

/* ------------------------------------------------------------------ */
/* Premium                                                             */
/* ------------------------------------------------------------------ */

/**
 * Unlock the premium track for the current week. Buying late is not a
 * punishment: every premium tier already reached becomes claimable at once.
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

  await Promise.all([
    supabase.from('casino_transactions').insert({
      user_id: userId, game_slug: 'casino', type: 'shop', amount: -PASS_PREMIUM_PRICE,
      balance_after: afterCost, meta: { kind: 'pass_premium', week: row.week_key },
    }),
    supabase.from('casino_pass').update({ premium: true }).eq('user_id', userId).eq('week_key', row.week_key),
  ]);

  return { ok: true as const, unlockedTiers: row.tier, newBalance: afterCost };
}
