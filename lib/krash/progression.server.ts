import { supabase } from '@/lib/supabase/server';
import { chestReward, dayKey, missionsOfDay, type ClosedTrade } from './progression';
import { KRASH_PASS_XP } from './pass';
import { advancePass, consumeEffect, loadEffects, walletMove } from './meta.server';

/**
 * The Krash chest and daily missions. The pass, cosmetics and shop live in
 * meta.server. Every claim is guarded in SQL (a unique row or a date check),
 * so a double click cannot pay twice.
 */

type Result<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };

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

  return {
    day,
    missions,
    chest: {
      canClaim: !claimedToday,
      streak: currentStreak,
      reward: chestReward(currentStreak + 1),
    },
  };
}

export async function claimChest(userId: string): Promise<Result<{ streak: number; coins: number; balance: number | null; frozen: boolean }>> {
  // A Réveil-matin keeps a broken streak alive: the missed day is treated as
  // claimed, so today's claim continues the run.
  let frozen = false;
  const row = await progressRow(userId);
  if (row?.chest_claimed_at && Number(row.chest_streak) > 0) {
    const last = dayKey(new Date(row.chest_claimed_at));
    const yesterday = dayKey(new Date(Date.now() - 86400_000));
    if (last < yesterday) {
      const effects = await loadEffects(userId);
      if (effects.chest_freeze) {
        await supabase.from('krash_progress')
          .update({ chest_claimed_at: `${yesterday}T12:00:00.000Z` }).eq('user_id', userId);
        await consumeEffect(userId, effects, 'chest_freeze');
        frozen = true;
      }
    }
  }

  const { data, error } = await supabase.rpc('krash_claim_chest', { p_user: userId });
  if (error) return { ok: false, status: 500, error: 'Erreur interne' };
  if (data === null || data === undefined) return { ok: false, status: 409, error: 'Coffre déjà ouvert aujourd’hui' };
  const streak = Number(data);
  const coins = chestReward(streak);
  const [balance] = await Promise.all([
    walletMove(userId, coins, 'coffre', { streak }),
    advancePass(userId, KRASH_PASS_XP.chest, 'activity'),
  ]);
  return { ok: true, streak, coins, balance, frozen };
}

export async function claimMission(userId: string, missionId: string): Promise<Result<{ coins: number; balance: number | null }>> {
  const day = dayKey();
  const mission = missionsOfDay(day).find((m) => m.id === missionId);
  if (!mission) return { ok: false, status: 400, error: 'Mission inconnue aujourd’hui' };

  const trades = await todaysTrades(userId);
  if (mission.measure(trades) < mission.goal) return { ok: false, status: 400, error: 'Mission pas encore terminée' };

  const { error } = await supabase.from('krash_mission_claims').insert({ user_id: userId, day, mission_id: missionId });
  if (error) return { ok: false, status: 409, error: 'Récompense déjà récupérée' };

  const [balance] = await Promise.all([
    walletMove(userId, mission.reward, 'mission', { mission: missionId }),
    advancePass(userId, KRASH_PASS_XP.mission, 'activity'),
  ]);
  return { ok: true, coins: mission.reward, balance };
}
