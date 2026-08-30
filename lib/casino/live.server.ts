import { supabase } from '@/lib/supabase/server';

/**
 * The public running tape of every settled bet.
 *
 * `casino_transactions` cannot serve this: it has no read policy and carries
 * the full per-player ledger, so a spectator page would either leak
 * everything or need the service key. This writes only what a spectator sees.
 */

/** Pseudo lookups are the expensive part; one per instance is enough. */
const pseudoCache = new Map<string, string>();

async function pseudoOf(userId: string): Promise<string | null> {
  const hit = pseudoCache.get(userId);
  if (hit) return hit;

  const { data } = await supabase.from('users').select('pseudo').eq('id', userId).maybeSingle();
  if (!data?.pseudo) return null;
  pseudoCache.set(userId, data.pseudo);
  return data.pseudo;
}

/** Rows older than this are dropped, so the table stays a tape and not an archive. */
const KEEP_ROWS = 500;
let sinceLastPrune = 0;

export async function pushLive(
  userId: string,
  gameSlug: string,
  netChange: number,
  multiplier: number,
) {
  const pseudo = await pseudoOf(userId);
  if (!pseudo) return;

  await supabase.from('casino_live').insert({
    user_id: userId,
    pseudo,
    game_slug: gameSlug,
    amount: Math.round(netChange),
    multiplier: Math.round(multiplier * 100) / 100,
  });

  // Trim occasionally rather than on every write.
  if (++sinceLastPrune < 50) return;
  sinceLastPrune = 0;

  const { data: cutoff } = await supabase
    .from('casino_live')
    .select('id')
    .order('created_at', { ascending: false })
    .range(KEEP_ROWS, KEEP_ROWS)
    .maybeSingle();

  if (cutoff?.id) {
    await supabase.from('casino_live').delete().lt('id', cutoff.id);
  }
}

/** The set of reactions the feed offers. Short, and readable at a glance. */
export const LIVE_EMOJI = ['🔥', '😂', '😱', '💀', '👏'] as const;

/**
 * Reactions on a feed entry.
 *
 * One per player per entry, enforced by the primary key rather than by a read
 * followed by a write: several people react to the same big win at the same
 * moment, and a check-then-insert would let duplicates through.
 */
export async function reactToLive(userId: string, liveId: number, emoji: string) {
  if (!LIVE_EMOJI.includes(emoji as (typeof LIVE_EMOJI)[number])) {
    return { ok: false as const, status: 400, error: 'Réaction inconnue' };
  }

  const { data: existing } = await supabase.from('casino_live_reactions')
    .select('emoji').eq('live_id', liveId).eq('user_id', userId).maybeSingle();

  // Tapping the same one again takes it back; a different one replaces it.
  if (existing?.emoji === emoji) {
    await supabase.from('casino_live_reactions')
      .delete().eq('live_id', liveId).eq('user_id', userId);
    return { ok: true as const, emoji: null };
  }

  await supabase.from('casino_live_reactions')
    .upsert({ live_id: liveId, user_id: userId, emoji }, { onConflict: 'live_id,user_id' });
  return { ok: true as const, emoji };
}

/** Counts per entry, plus what this player picked. */
export async function reactionsFor(liveIds: number[], userId: string | null) {
  if (!liveIds.length) return {};
  const { data } = await supabase.from('casino_live_reactions')
    .select('live_id, user_id, emoji').in('live_id', liveIds);

  const out: Record<number, { counts: Record<string, number>; mine: string | null }> = {};
  for (const r of data || []) {
    const entry = (out[r.live_id] ||= { counts: {}, mine: null });
    entry.counts[r.emoji] = (entry.counts[r.emoji] || 0) + 1;
    if (userId && r.user_id === userId) entry.mine = r.emoji;
  }
  return out;
}
