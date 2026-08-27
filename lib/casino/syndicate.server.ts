import { supabase } from '@/lib/supabase/server';
import {
  SYNDICATE_MIN_PLAYERS, SYNDICATE_MAX_PLAYERS, SYNDICATE_ROUND_MS,
  SYNDICATE_MIN_BUY_IN, SYNDICATE_MAX_BUY_IN, SYNDICATE_DURATIONS,
  roundsFor, rollSyndicateRound, memberPayout, generateCode,
} from './syndicate';

/**
 * The syndicate, server side.
 *
 * There is no scheduled job anywhere in this casino, so a running pot does not
 * advance on its own: whoever reads the state plays out every round the clock
 * says should have happened by now. Each round is drawn from a seed made of
 * the syndicate id and the round index, so two players catching up at the same
 * instant compute the same sequence and the writes are idempotent.
 */

function roundRoll(syndicateId: string, idx: number): number {
  const seed = `${syndicateId}:${idx}`;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

type Row = Record<string, any>;

async function membersOf(syndicateId: string): Promise<Row[]> {
  const { data } = await supabase.from('casino_syndicate_members')
    .select('*').eq('syndicate_id', syndicateId).order('contribution', { ascending: false });
  return data || [];
}

/* ------------------------------------------------------------------ */
/* Advancing a running pot                                             */
/* ------------------------------------------------------------------ */

/**
 * Plays out every round due since the last one recorded, then settles if the
 * pot is empty or the clock ran out. Returns the up-to-date row.
 */
async function catchUp(syn: Row): Promise<Row> {
  if (syn.status !== 'running') return syn;

  const startedAt = new Date(syn.started_at).getTime();
  const elapsed = Date.now() - startedAt;
  const due = Math.min(syn.rounds, Math.floor(elapsed / SYNDICATE_ROUND_MS));

  const { data: last } = await supabase.from('casino_syndicate_rounds')
    .select('idx, pot_after').eq('syndicate_id', syn.id)
    .order('idx', { ascending: false }).limit(1).maybeSingle();

  let idx = last ? Number(last.idx) : 0;
  let pot = last ? Number(last.pot_after) : Number(syn.seed_pot);
  const seedPot = Number(syn.seed_pot);

  const pending: Row[] = [];
  let bust = false;

  while (idx < due && !bust) {
    idx += 1;
    const out = rollSyndicateRound(pot, seedPot, roundRoll(syn.id, idx));
    pot = out.pot;
    bust = out.bust;
    pending.push({
      syndicate_id: syn.id, idx,
      stake: out.stake, payout: out.payout,
      multiplier: out.multiplier, pot_after: out.pot,
    });
  }

  if (pending.length) {
    // Another reader may have written the same rounds a moment ago; the unique
    // (syndicate_id, idx) makes that a no-op rather than a double count.
    await supabase.from('casino_syndicate_rounds')
      .upsert(pending, { onConflict: 'syndicate_id,idx', ignoreDuplicates: true });
    await supabase.from('casino_syndicate').update({ pot }).eq('id', syn.id);
    syn = { ...syn, pot };
  }

  const finished = bust || idx >= syn.rounds || new Date(syn.ends_at) <= new Date();
  if (finished) return settle({ ...syn, pot });

  return syn;
}

/** Pays every member their share of what is left and closes the run. */
async function settle(syn: Row): Promise<Row> {
  // Claiming the row is what makes the payout single-shot: two readers racing
  // to settle, only one flips the status and only that one pays.
  const { data: claimed } = await supabase.from('casino_syndicate')
    .update({ status: 'done', settled_at: new Date().toISOString(), pot: syn.pot })
    .eq('id', syn.id).eq('status', 'running')
    .select().maybeSingle();
  if (!claimed) {
    const { data: fresh } = await supabase.from('casino_syndicate').select('*').eq('id', syn.id).maybeSingle();
    return fresh || syn;
  }

  const members = await membersOf(syn.id);
  const seedPot = Number(syn.seed_pot);

  for (const m of members) {
    const share = memberPayout(Number(syn.pot), Number(m.contribution), seedPot);
    await supabase.from('casino_syndicate_members')
      .update({ payout: share })
      .eq('syndicate_id', syn.id).eq('user_id', m.user_id);

    if (share <= 0) continue;

    const { data: wallet } = await supabase.from('casino_wallets')
      .select('balance').eq('user_id', m.user_id).maybeSingle();
    if (!wallet) continue;

    const newBalance = Number(wallet.balance) + share;
    await supabase.from('casino_wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', m.user_id);
    await supabase.from('casino_transactions').insert({
      user_id: m.user_id, game_slug: 'casino', type: 'syndicate',
      amount: share, balance_after: newBalance,
      meta: { kind: 'syndicate_payout', code: syn.code, contribution: Number(m.contribution) },
    });
  }

  return claimed;
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface SyndicateState {
  syndicate: Row | null;
  members: Row[];
  rounds: Row[];
  you: Row | null;
}

async function stateOf(syn: Row | null, userId: string | null): Promise<SyndicateState> {
  if (!syn) return { syndicate: null, members: [], rounds: [], you: null };

  const fresh = await catchUp(syn);
  const members = await membersOf(fresh.id);

  // Only the tail is worth sending: the ticker shows the last handful and the
  // full list of a 20-minute run is 300 rows.
  const { data: rounds } = await supabase.from('casino_syndicate_rounds')
    .select('idx, stake, payout, multiplier, pot_after')
    .eq('syndicate_id', fresh.id)
    .order('idx', { ascending: false }).limit(30);

  return {
    syndicate: fresh,
    members,
    rounds: (rounds || []).reverse(),
    you: userId ? members.find((m) => m.user_id === userId) || null : null,
  };
}

/** The run this player is in, whatever its state, or nothing. */
export async function mySyndicate(userId: string | null): Promise<SyndicateState> {
  if (!userId) return { syndicate: null, members: [], rounds: [], you: null };

  const { data: membership } = await supabase.from('casino_syndicate_members')
    .select('syndicate_id').eq('user_id', userId);
  const ids = (membership || []).map((m) => m.syndicate_id);
  if (!ids.length) return { syndicate: null, members: [], rounds: [], you: null };

  const { data: syn } = await supabase.from('casino_syndicate')
    .select('*').in('id', ids).in('status', ['open', 'running'])
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (syn) return stateOf(syn, userId);

  // Nothing live: show the last finished run so the payout is readable once.
  const { data: last } = await supabase.from('casino_syndicate')
    .select('*').in('id', ids).eq('status', 'done')
    .order('settled_at', { ascending: false }).limit(1).maybeSingle();

  return stateOf(last || null, userId);
}

export async function syndicateByCode(code: string, userId: string | null): Promise<SyndicateState> {
  const { data } = await supabase.from('casino_syndicate')
    .select('*').eq('code', code.toUpperCase()).maybeSingle();
  return stateOf(data || null, userId);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string; status: number };

async function alreadyEngaged(userId: string): Promise<boolean> {
  const { data } = await supabase.from('casino_syndicate_members')
    .select('syndicate_id').eq('user_id', userId);
  const ids = (data || []).map((m) => m.syndicate_id);
  if (!ids.length) return false;
  const { count } = await supabase.from('casino_syndicate')
    .select('id', { count: 'exact', head: true })
    .in('id', ids).in('status', ['open', 'running']);
  return (count || 0) > 0;
}

/** Takes the buy-in out of a wallet under an optimistic lock. */
async function charge(userId: string, amount: number, code: string): Promise<Result<{ newBalance: number }>> {
  const { data: wallet } = await supabase.from('casino_wallets')
    .select('balance').eq('user_id', userId).maybeSingle();
  if (!wallet) return { ok: false, error: 'Portefeuille introuvable', status: 404 };
  if (Number(wallet.balance) < amount) return { ok: false, error: 'Solde insuffisant', status: 400 };

  const newBalance = Number(wallet.balance) - amount;
  const { data: charged } = await supabase.from('casino_wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('balance', wallet.balance)
    .select().maybeSingle();
  if (!charged) return { ok: false, error: 'Conflit, réessaye.', status: 409 };

  await supabase.from('casino_transactions').insert({
    user_id: userId, game_slug: 'casino', type: 'syndicate',
    amount: -amount, balance_after: newBalance,
    meta: { kind: 'syndicate_buy_in', code },
  });
  return { ok: true, newBalance };
}

async function pseudoOf(userId: string): Promise<string> {
  const { data } = await supabase.from('users').select('pseudo').eq('id', userId).maybeSingle();
  return data?.pseudo || 'Joueur';
}

export async function createSyndicate(
  userId: string, durationMin: number, minBuyIn: number, contribution: number
): Promise<Result<{ code: string; newBalance: number }>> {
  if (!SYNDICATE_DURATIONS.includes(durationMin as never)) {
    return { ok: false, error: 'Durée invalide', status: 400 };
  }
  const min = Math.max(SYNDICATE_MIN_BUY_IN, Math.floor(minBuyIn) || SYNDICATE_MIN_BUY_IN);
  const stake = Math.floor(contribution);
  if (stake < min) return { ok: false, error: `Minimum ${min.toLocaleString('en-US')} ₶.`, status: 400 };
  if (stake > SYNDICATE_MAX_BUY_IN) return { ok: false, error: 'Mise trop grosse.', status: 400 };
  if (await alreadyEngaged(userId)) return { ok: false, error: 'Tu es déjà dans une cagnotte.', status: 400 };

  const code = generateCode();
  const charged = await charge(userId, stake, code);
  if (!charged.ok) return charged;

  const { data: syn, error } = await supabase.from('casino_syndicate').insert({
    code, host_id: userId, status: 'open',
    duration_min: durationMin, min_buy_in: min,
    seed_pot: stake, pot: stake, rounds: roundsFor(durationMin),
  }).select().maybeSingle();

  if (error || !syn) return { ok: false, error: 'Création impossible', status: 500 };

  await supabase.from('casino_syndicate_members').insert({
    syndicate_id: syn.id, user_id: userId,
    pseudo: await pseudoOf(userId), contribution: stake,
  });

  return { ok: true, code, newBalance: charged.newBalance };
}

export async function joinSyndicate(
  userId: string, code: string, contribution: number
): Promise<Result<{ newBalance: number }>> {
  const { data: syn } = await supabase.from('casino_syndicate')
    .select('*').eq('code', code.toUpperCase()).maybeSingle();
  if (!syn) return { ok: false, error: 'Code inconnu', status: 404 };
  if (syn.status !== 'open') return { ok: false, error: 'Cette cagnotte est déjà lancée.', status: 400 };

  const members = await membersOf(syn.id);
  if (members.some((m) => m.user_id === userId)) {
    return { ok: false, error: 'Tu es déjà dedans.', status: 400 };
  }
  if (members.length >= SYNDICATE_MAX_PLAYERS) {
    return { ok: false, error: 'Cagnotte complète.', status: 400 };
  }
  if (await alreadyEngaged(userId)) return { ok: false, error: 'Tu es déjà dans une cagnotte.', status: 400 };

  const stake = Math.floor(contribution);
  if (stake < syn.min_buy_in) {
    return { ok: false, error: `Minimum ${Number(syn.min_buy_in).toLocaleString('en-US')} ₶.`, status: 400 };
  }
  if (stake > SYNDICATE_MAX_BUY_IN) return { ok: false, error: 'Mise trop grosse.', status: 400 };

  const charged = await charge(userId, stake, syn.code);
  if (!charged.ok) return charged;

  await supabase.from('casino_syndicate_members').insert({
    syndicate_id: syn.id, user_id: userId,
    pseudo: await pseudoOf(userId), contribution: stake,
  });
  const seed = Number(syn.seed_pot) + stake;
  await supabase.from('casino_syndicate').update({ seed_pot: seed, pot: seed }).eq('id', syn.id);

  return { ok: true, newBalance: charged.newBalance };
}

/** Adds more to a pot that has not started yet. */
export async function topUpSyndicate(
  userId: string, amount: number
): Promise<Result<{ newBalance: number }>> {
  const state = await mySyndicate(userId);
  const syn = state.syndicate;
  if (!syn || syn.status !== 'open') return { ok: false, error: 'Aucune cagnotte ouverte.', status: 400 };
  if (!state.you) return { ok: false, error: 'Tu n’es pas dedans.', status: 400 };

  const stake = Math.floor(amount);
  if (stake <= 0) return { ok: false, error: 'Montant invalide', status: 400 };
  if (Number(state.you.contribution) + stake > SYNDICATE_MAX_BUY_IN) {
    return { ok: false, error: 'Mise trop grosse.', status: 400 };
  }

  const charged = await charge(userId, stake, syn.code);
  if (!charged.ok) return charged;

  await supabase.from('casino_syndicate_members')
    .update({ contribution: Number(state.you.contribution) + stake })
    .eq('syndicate_id', syn.id).eq('user_id', userId);
  const seed = Number(syn.seed_pot) + stake;
  await supabase.from('casino_syndicate').update({ seed_pot: seed, pot: seed }).eq('id', syn.id);

  return { ok: true, newBalance: charged.newBalance };
}

export async function startSyndicate(userId: string): Promise<Result> {
  const state = await mySyndicate(userId);
  const syn = state.syndicate;
  if (!syn || syn.status !== 'open') return { ok: false, error: 'Aucune cagnotte à lancer.', status: 400 };
  if (syn.host_id !== userId) return { ok: false, error: 'Seul l’hôte peut lancer.', status: 403 };
  if (state.members.length < SYNDICATE_MIN_PLAYERS) {
    return { ok: false, error: `Il faut ${SYNDICATE_MIN_PLAYERS} joueurs minimum.`, status: 400 };
  }

  const now = new Date();
  const ends = new Date(now.getTime() + syn.duration_min * 60_000);
  const { data: started } = await supabase.from('casino_syndicate')
    .update({ status: 'running', started_at: now.toISOString(), ends_at: ends.toISOString() })
    .eq('id', syn.id).eq('status', 'open')
    .select().maybeSingle();
  if (!started) return { ok: false, error: 'Déjà lancée.', status: 409 };

  return { ok: true };
}

/** Cancels a pot that never started and refunds everyone. */
export async function cancelSyndicate(userId: string): Promise<Result<{ refund: number }>> {
  const state = await mySyndicate(userId);
  const syn = state.syndicate;
  if (!syn || syn.status !== 'open') return { ok: false, error: 'Rien à annuler.', status: 400 };
  if (syn.host_id !== userId) return { ok: false, error: 'Seul l’hôte peut annuler.', status: 403 };

  const { data: claimed } = await supabase.from('casino_syndicate')
    .update({ status: 'done', settled_at: new Date().toISOString() })
    .eq('id', syn.id).eq('status', 'open')
    .select().maybeSingle();
  if (!claimed) return { ok: false, error: 'Déjà lancée.', status: 409 };

  let mine = 0;
  for (const m of state.members) {
    const back = Number(m.contribution);
    const { data: wallet } = await supabase.from('casino_wallets')
      .select('balance').eq('user_id', m.user_id).maybeSingle();
    if (!wallet) continue;
    const newBalance = Number(wallet.balance) + back;
    await supabase.from('casino_wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', m.user_id);
    await supabase.from('casino_syndicate_members')
      .update({ payout: back }).eq('syndicate_id', syn.id).eq('user_id', m.user_id);
    await supabase.from('casino_transactions').insert({
      user_id: m.user_id, game_slug: 'casino', type: 'syndicate',
      amount: back, balance_after: newBalance,
      meta: { kind: 'syndicate_refund', code: syn.code },
    });
    if (m.user_id === userId) mine = back;
  }

  return { ok: true, refund: mine };
}
