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
