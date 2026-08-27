import { supabase } from '@/lib/supabase/server';
import {
  currentQuest, communityPeriod, contributorReward, questById,
  type CommunityQuest,
} from './community';

/**
 * The shared goal, server side.
 *
 * Progress goes through a database function rather than a read-modify-write:
 * several players settle in the same instant, and app-side arithmetic would
 * quietly drop contributions.
 */

const pseudoCache = new Map<string, string>();

async function pseudoOf(userId: string): Promise<string | null> {
  const hit = pseudoCache.get(userId);
  if (hit) return hit;
  const { data } = await supabase.from('users').select('pseudo').eq('id', userId).maybeSingle();
  if (!data?.pseudo) return null;
  pseudoCache.set(userId, data.pseudo);
  return data.pseudo;
}

export interface CommunityProgress {
  progress: number;
  target: number;
  completed: boolean;
}

/** Push whatever this settlement contributed to the week's goal. */
export async function advanceCommunity(
  userId: string,
  contribution: { wagered: number; plays: number; won: number; crates: number },
): Promise<CommunityProgress | null> {
  const period = communityPeriod();
  const quest = currentQuest(period);

  const amount =
    quest.kind === 'wager_total' ? contribution.wagered
    : quest.kind === 'play_count' ? contribution.plays
    : quest.kind === 'win_total' ? contribution.won
    : contribution.crates;

  if (amount <= 0) return null;

  const pseudo = await pseudoOf(userId);
  if (!pseudo) return null;

  const { data, error } = await supabase.rpc('casino_community_add', {
    p_period: period,
    p_quest: quest.id,
    p_target: quest.target,
    p_user: userId,
    p_pseudo: pseudo,
    p_amount: Math.round(amount),
  });

  if (error || !data || data.length === 0) return null;
  const row = data[0] as { progress: number; target: number; completed: boolean };
  return { progress: Number(row.progress), target: Number(row.target), completed: row.completed };
}

export interface CommunityState {
  quest: CommunityQuest;
  period: string;
  progress: number;
  target: number;
  completed: boolean;
  contributors: number;
  top: { pseudo: string; contribution: number }[];
  you: { contribution: number; claimed: boolean; reward: number } | null;
}

export async function communityState(userId?: string | null): Promise<CommunityState> {
  const period = communityPeriod();
  const quest = currentQuest(period);

  const [{ data: row }, { data: top }] = await Promise.all([
    supabase.from('casino_community').select('*').eq('period_key', period).maybeSingle(),
    supabase.from('casino_community_contrib')
      .select('pseudo, contribution')
      .eq('period_key', period)
      .order('contribution', { ascending: false })
      .limit(10),
  ]);

  const progress = Number(row?.progress || 0);
  const completed = !!row?.completed_at;

  let you: CommunityState['you'] = null;
  let contributors = (top || []).length;

  if (userId) {
    const [{ data: mine }, { count }] = await Promise.all([
      supabase.from('casino_community_contrib')
        .select('contribution, claimed').eq('period_key', period).eq('user_id', userId).maybeSingle(),
      supabase.from('casino_community_contrib')
        .select('user_id', { count: 'exact', head: true }).eq('period_key', period),
    ]);

    contributors = count ?? contributors;
    if (mine) {
      you = {
        contribution: Number(mine.contribution),
        claimed: mine.claimed,
        reward: contributorReward(quest, Number(mine.contribution), progress),
      };
    }
  }

  return {
    quest,
    period,
    progress,
    target: Number(row?.target || quest.target),
    completed,
    contributors,
    top: (top || []).map((t) => ({ pseudo: t.pseudo, contribution: Number(t.contribution) })),
    you,
  };
}

/** Collect the shared reward, once the bar is full and once per player. */
export async function claimCommunity(userId: string) {
  const period = communityPeriod();

  const { data: row } = await supabase.from('casino_community').select('*').eq('period_key', period).maybeSingle();
  if (!row?.completed_at) return { ok: false as const, status: 400, error: 'L’objectif n’est pas encore atteint.' };

  const quest = questById(row.quest_id) ?? currentQuest(period);

  // Flip the flag first: the filter makes a second claim a no-op.
  const { data: locked } = await supabase.from('casino_community_contrib')
    .update({ claimed: true })
    .eq('period_key', period).eq('user_id', userId).eq('claimed', false)
    .select().maybeSingle();

  if (!locked) return { ok: false as const, status: 400, error: 'Rien à réclamer.' };

  const reward = contributorReward(quest, Number(locked.contribution), Number(row.progress));
  if (reward <= 0) return { ok: false as const, status: 400, error: 'Rien à réclamer.' };

  const { data: wallet } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
  if (!wallet) return { ok: false as const, status: 404, error: 'Portefeuille introuvable' };

  const newBalance = wallet.balance + reward;
  await supabase.from('casino_wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  await supabase.from('casino_transactions').insert({
    user_id: userId, game_slug: 'casino', type: 'bonus', amount: reward,
    balance_after: newBalance, meta: { kind: 'community', quest: quest.id, period },
  });

  return { ok: true as const, reward, newBalance };
}
