import { supabase } from '@/lib/supabase/server';
import {
  COSMETICS, KRASH_XP, PASS_TIERS, chestReward, dayKey, krashPeriodEnd, krashPeriodKey,
  missionsOfDay, tierFromXp, tierReward, xpForTier, type ClosedTrade,
} from './progression';

/**
 * Paying out the Krash chest, missions and pass. Every claim is guarded in
 * SQL (a unique row, an array check or a date check), so a double click
 * cannot pay twice.
 */

type Result<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };

async function credit(userId: string, coins: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('krash_wallet_apply', { p_user: userId, p_delta: coins });
  if (error || data === null || data === undefined) return null;
  return Number(data);
}

export async function addXp(userId: string, xp: number): Promise<void> {
  if (xp <= 0) return;
  await supabase.rpc('krash_add_xp', { p_user: userId, p_period: krashPeriodKey(), p_xp: xp });
}

function todayStartIso(): string {
  return `${dayKey()}T00:00:00.000Z`;
}

async function todaysTrades(userId: string): Promise<ClosedTrade[]> {
  const { data } = await supabase.from('krash_positions')
    .select('market, side, leverage, stake, fee, payout, status, opened_at, closed_at')
    .eq('user_id', userId).neq('status', 'open').gte('closed_at', todayStartIso())
    .limit(1000);
  return (data || []) as ClosedTrade[];
}

async function progressRow(userId: string) {
  const { data } = await supabase.from('krash_progress').select('*').eq('user_id', userId).maybeSingle();
  return data;
}

export async function loadProgression(userId: string) {
  const day = dayKey();
  const period = krashPeriodKey();
  const [row, trades, { data: claims }] = await Promise.all([
    progressRow(userId),
    todaysTrades(userId),
    supabase.from('krash_mission_claims').select('mission_id').eq('user_id', userId).eq('day', day),
  ]);

  const claimed = new Set((claims || []).map((c) => c.mission_id));
  const missions = missionsOfDay(day).map((m) => {
    const progress = Math.min(m.goal, m.measure(trades));
    return { id: m.id, label: m.label, goal: m.goal, reward: m.reward, progress, done: progress >= m.goal, claimed: claimed.has(m.id) };
  });

  const lastChest = row?.chest_claimed_at ? new Date(row.chest_claimed_at) : null;
  const claimedToday = !!lastChest && dayKey(lastChest) === day;
  const yesterday = dayKey(new Date(Date.now() - 86400_000));
  const streakAlive = !!lastChest && (claimedToday || dayKey(lastChest) === yesterday);
  const currentStreak = streakAlive ? Number(row?.chest_streak ?? 0) : 0;
  const nextStreak = claimedToday ? currentStreak + 1 : currentStreak + 1;

  const samePeriod = row?.pass_period === period;
  const xp = samePeriod ? Number(row?.pass_xp ?? 0) : 0;

  return {
    day,
    missions,
    chest: {
      canClaim: !claimedToday,
      streak: currentStreak,
      reward: chestReward(nextStreak),
    },
    pass: {
      period,
      endsAt: krashPeriodEnd().toISOString(),
      xp,
      tier: tierFromXp(xp),
      tiers: PASS_TIERS,
      claimed: samePeriod ? ((row?.pass_claimed as number[]) ?? []) : [],
    },
    cosmetics: {
      unlocked: (row?.unlocked as string[]) ?? [],
      title: row?.title ?? null,
      chartSkin: row?.chart_skin ?? null,
    },
  };
}

export async function claimChest(userId: string): Promise<Result<{ streak: number; coins: number; balance: number | null }>> {
  const { data, error } = await supabase.rpc('krash_claim_chest', { p_user: userId });
  if (error) return { ok: false, status: 500, error: 'Erreur interne' };
  if (data === null || data === undefined) return { ok: false, status: 409, error: 'Coffre déjà ouvert aujourd’hui' };
  const streak = Number(data);
  const coins = chestReward(streak);
  const [balance] = await Promise.all([credit(userId, coins), addXp(userId, KRASH_XP.chest)]);
  return { ok: true, streak, coins, balance };
}

export async function claimMission(userId: string, missionId: string): Promise<Result<{ coins: number; balance: number | null }>> {
  const day = dayKey();
  const mission = missionsOfDay(day).find((m) => m.id === missionId);
  if (!mission) return { ok: false, status: 400, error: 'Mission inconnue aujourd’hui' };

  const trades = await todaysTrades(userId);
  if (mission.measure(trades) < mission.goal) return { ok: false, status: 400, error: 'Mission pas encore terminée' };

  const { error } = await supabase.from('krash_mission_claims').insert({ user_id: userId, day, mission_id: missionId });
  if (error) return { ok: false, status: 409, error: 'Récompense déjà récupérée' };

  const [balance] = await Promise.all([credit(userId, mission.reward), addXp(userId, KRASH_XP.mission)]);
  return { ok: true, coins: mission.reward, balance };
}

export async function claimTier(userId: string, tier: number): Promise<Result<{ coins: number; item: string | null; balance: number | null }>> {
  if (!Number.isInteger(tier) || tier < 1 || tier > PASS_TIERS) return { ok: false, status: 400, error: 'Palier invalide' };
  const { data: ok, error } = await supabase.rpc('krash_claim_tier', {
    p_user: userId, p_period: krashPeriodKey(), p_tier: tier, p_xp_needed: xpForTier(tier),
  });
  if (error) return { ok: false, status: 500, error: 'Erreur interne' };
  if (!ok) return { ok: false, status: 400, error: 'Palier pas atteint ou déjà récupéré' };

  const reward = tierReward(tier);
  const [balance] = await Promise.all([
    reward.coins ? credit(userId, reward.coins) : Promise.resolve(null),
    reward.item ? supabase.rpc('krash_unlock', { p_user: userId, p_item: reward.item }) : Promise.resolve(null),
  ]);
  return { ok: true, coins: reward.coins ?? 0, item: reward.item ?? null, balance };
}

export async function equip(userId: string, kind: 'title' | 'skin', item: string | null): Promise<Result<object>> {
  if (item !== null) {
    const cosmetic = COSMETICS[item];
    if (!cosmetic || cosmetic.kind !== kind) return { ok: false, status: 400, error: 'Objet invalide' };
    const row = await progressRow(userId);
    if (!((row?.unlocked as string[]) ?? []).includes(item)) return { ok: false, status: 403, error: 'Objet pas encore débloqué' };
  }
  const { error } = await supabase.from('krash_progress')
    .update({ [kind === 'title' ? 'title' : 'chart_skin']: item, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) return { ok: false, status: 500, error: 'Erreur interne' };
  return { ok: true };
}
