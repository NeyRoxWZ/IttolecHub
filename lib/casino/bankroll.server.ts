import { supabase } from '@/lib/supabase/server';

/**
 * Where a player's money comes from right now.
 *
 * Normally their own wallet. But while they are in a running syndicate every
 * bet is played with the group's pot instead: the stake leaves the pot, the
 * win goes back into the pot, and nothing touches their personal balance until
 * the run is settled and the pot is split.
 *
 * Every path that moves coins during play goes through here, so the twenty
 * games did not have to learn about syndicates one by one.
 */

export interface Bankroll {
  kind: 'wallet' | 'syndicate';
  /** The number the player is betting against — their balance, or the pot. */
  balance: number;
  /** The wallet row, always loaded: stats and effects live on it either way. */
  wallet: Record<string, any>;
  syndicateId?: string;
  syndicateCode?: string;
  endsAt?: string;
  /** Copied off the membership row so the pot's ledger can name who bet. */
  pseudo?: string;
}

/** The run this player is in, if it is still going. */
export async function runningSyndicate(userId: string) {
  const { data: membership } = await supabase.from('casino_syndicate_members')
    .select('syndicate_id').eq('user_id', userId);
  const ids = (membership || []).map((m) => m.syndicate_id);
  if (!ids.length) return null;

  const { data } = await supabase.from('casino_syndicate')
    .select('*').in('id', ids).eq('status', 'running')
    .order('started_at', { ascending: false }).limit(1).maybeSingle();

  if (!data) return null;
  // The clock is authoritative: a run whose time is up is over even if nobody
  // has read it yet, so it must not keep taking bets.
  if (new Date(data.ends_at) <= new Date()) return null;
  return data;
}

export async function loadBankroll(userId: string): Promise<Bankroll | null> {
  const [{ data: wallet }, syn] = await Promise.all([
    supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle(),
    runningSyndicate(userId),
  ]);
  if (!wallet) return null;

  if (syn) {
    const { data: me } = await supabase.from('casino_syndicate_members')
      .select('pseudo').eq('syndicate_id', syn.id).eq('user_id', userId).maybeSingle();

    return {
      kind: 'syndicate',
      balance: Number(syn.pot),
      wallet,
      syndicateId: syn.id,
      syndicateCode: syn.code,
      endsAt: syn.ends_at,
      pseudo: me?.pseudo ?? undefined,
    };
  }

  return { kind: 'wallet', balance: Number(wallet.balance), wallet };
}

export interface ApplyResult {
  ok: boolean;
  newBalance: number;
  /** The pot ran out: the run is over whatever the clock says. */
  drained?: boolean;
}

/**
 * Moves `delta` coins. `expected` is the balance the caller read, used as an
 * optimistic lock on a personal wallet; a pot ignores it and relies on the
 * database doing the arithmetic atomically instead.
 */
export async function applyDelta(
  bank: Bankroll, userId: string, delta: number, expected: number
): Promise<ApplyResult> {
  if (bank.kind === 'syndicate') {
    const { data, error } = await supabase.rpc('casino_syndicate_apply', {
      p_id: bank.syndicateId, p_delta: delta,
    });
    if (error || data === null || data === undefined) return { ok: false, newBalance: expected };
    const pot = Number(data);
    return { ok: true, newBalance: pot, drained: pot <= 0 };
  }

  const newBalance = expected + delta;
  const { data: updated } = await supabase.from('casino_wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('balance', expected)
    .select().maybeSingle();

  if (!updated) return { ok: false, newBalance: expected };
  return { ok: true, newBalance };
}

/**
 * The pot's own ledger line.
 *
 * Pooled bets must never reach casino_transactions: that table is what the
 * player's balance curve is drawn from, and a bet made with the group's money
 * would show as their own balance collapsing to the pot's value and bouncing
 * back. The pot is a separate pile of money and keeps a separate book.
 */
export async function logPotMove(
  bank: Bankroll, userId: string, gameSlug: string,
  stake: number, payout: number, multiplier: number, potAfter: number
): Promise<void> {
  await supabase.from('casino_syndicate_rounds').insert({
    syndicate_id: bank.syndicateId,
    user_id: userId,
    pseudo: bank.pseudo ?? null,
    game_slug: gameSlug,
    stake, payout,
    multiplier: Math.round(multiplier * 100) / 100,
    pot_after: potAfter,
  });
}
