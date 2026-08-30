import { supabase } from '@/lib/supabase/server';
import { itemById } from './shop';
import { addToInventory } from './inventory.server';
import {
  REFERRAL_WAGER_GOAL, REFERRAL_REWARD_INVITER, REFERRAL_REWARD_NEWCOMER, makeReferralCode,
  GIFT_MIN, GIFT_MAX, GIFT_DAILY_LIMIT, GIFT_COIN_FEE, giftCoinCost, giftItemPrice,
  CHAT_MAX_LENGTH, CHAT_HISTORY, CHAT_COOLDOWN_MS,
} from './social';

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string; status: number };

async function pseudoOf(userId: string): Promise<string> {
  const { data } = await supabase.from('users').select('pseudo').eq('id', userId).maybeSingle();
  return data?.pseudo || 'Joueur';
}

/** Credits a wallet and files the matching ledger line. */
async function credit(userId: string, amount: number, kind: string, meta: Record<string, unknown> = {}) {
  const { data: w } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
  if (!w) return null;
  const newBalance = Number(w.balance) + amount;
  await supabase.from('casino_wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  await supabase.from('casino_transactions').insert({
    user_id: userId, game_slug: 'casino', type: 'gift',
    amount, balance_after: newBalance, meta: { kind, ...meta },
  });
  return newBalance;
}

/* ------------------------------------------------------------------ */
/* Referral                                                            */
/* ------------------------------------------------------------------ */

/** Everyone's code, minted on first look rather than at signup. */
export async function referralState(userId: string) {
  const { data: wallet } = await supabase.from('casino_wallets')
    .select('referral_code, referred_by, referral_claimed_at, total_wagered')
    .eq('user_id', userId).maybeSingle();
  if (!wallet) return null;

  let code: string = wallet.referral_code;
  if (!code) {
    // Collisions are vanishingly rare, and the unique index is the real
    // guard — a second attempt is enough.
    for (let i = 0; i < 5 && !code; i++) {
      const candidate = makeReferralCode();
      const { data } = await supabase.from('casino_wallets')
        .update({ referral_code: candidate }).eq('user_id', userId)
        .is('referral_code', null).select('referral_code').maybeSingle();
      if (data?.referral_code) code = data.referral_code;
    }
  }

  const { data: invited } = await supabase.from('casino_wallets')
    .select('user_id, total_wagered, referral_claimed_at').eq('referred_by', userId);

  const rows = await Promise.all((invited || []).map(async (r) => ({
    pseudo: await pseudoOf(r.user_id),
    wagered: Number(r.total_wagered || 0),
    goal: REFERRAL_WAGER_GOAL,
    paid: !!r.referral_claimed_at,
  })));

  return {
    code,
    referredBy: wallet.referred_by,
    invited: rows,
    goal: REFERRAL_WAGER_GOAL,
    rewardInviter: REFERRAL_REWARD_INVITER,
    rewardNewcomer: REFERRAL_REWARD_NEWCOMER,
    /** Ready to collect: the newcomer has played enough and nobody was paid. */
    claimable: !wallet.referral_claimed_at
      && !!wallet.referred_by
      && Number(wallet.total_wagered || 0) >= REFERRAL_WAGER_GOAL,
  };
}

export async function applyReferralCode(userId: string, code: string): Promise<Result> {
  const clean = code.trim().toUpperCase();
  if (clean.length !== 6) return { ok: false, error: 'Code invalide', status: 400 };

  const { data: me } = await supabase.from('casino_wallets')
    .select('referred_by, referral_code').eq('user_id', userId).maybeSingle();
  if (!me) return { ok: false, error: 'Portefeuille introuvable', status: 404 };
  if (me.referred_by) return { ok: false, error: 'Tu as déjà un parrain.', status: 400 };
  if (me.referral_code === clean) return { ok: false, error: 'C’est ton propre code.', status: 400 };

  const { data: inviter } = await supabase.from('casino_wallets')
    .select('user_id').eq('referral_code', clean).maybeSingle();
  if (!inviter) return { ok: false, error: 'Code inconnu', status: 404 };
  if (inviter.user_id === userId) return { ok: false, error: 'C’est ton propre code.', status: 400 };

  // Only bind if still unbound: two tabs must not each claim a parrain.
  const { data: bound } = await supabase.from('casino_wallets')
    .update({ referred_by: inviter.user_id })
    .eq('user_id', userId).is('referred_by', null)
    .select('referred_by').maybeSingle();
  if (!bound) return { ok: false, error: 'Tu as déjà un parrain.', status: 409 };

  return { ok: true };
}

/** Pays both sides, once the newcomer has wagered enough. */
export async function claimReferral(userId: string): Promise<Result<{ reward: number; newBalance: number }>> {
  const { data: me } = await supabase.from('casino_wallets')
    .select('referred_by, referral_claimed_at, total_wagered')
    .eq('user_id', userId).maybeSingle();
  if (!me) return { ok: false, error: 'Portefeuille introuvable', status: 404 };
  if (!me.referred_by) return { ok: false, error: 'Aucun parrain.', status: 400 };
  if (me.referral_claimed_at) return { ok: false, error: 'Déjà réclamé.', status: 400 };
  if (Number(me.total_wagered || 0) < REFERRAL_WAGER_GOAL) {
    return { ok: false, error: `Mise encore ${(REFERRAL_WAGER_GOAL - Number(me.total_wagered || 0)).toLocaleString('en-US')} ₶.`, status: 400 };
  }

  // Stamping first is what makes the pair of payouts single-shot.
  const { data: stamped } = await supabase.from('casino_wallets')
    .update({ referral_claimed_at: new Date().toISOString() })
    .eq('user_id', userId).is('referral_claimed_at', null)
    .select('user_id').maybeSingle();
  if (!stamped) return { ok: false, error: 'Déjà réclamé.', status: 409 };

  const newBalance = await credit(userId, REFERRAL_REWARD_NEWCOMER, 'referral_newcomer');
  await credit(me.referred_by, REFERRAL_REWARD_INVITER, 'referral_inviter', { filleul: await pseudoOf(userId) });

  return { ok: true, reward: REFERRAL_REWARD_NEWCOMER, newBalance: newBalance ?? 0 };
}

/* ------------------------------------------------------------------ */
/* Gifts                                                               */
/* ------------------------------------------------------------------ */

export async function giftsFor(userId: string) {
  const [{ data: received }, { data: sent }] = await Promise.all([
    supabase.from('casino_gifts').select('*').eq('to_user_id', userId).order('created_at', { ascending: false }).limit(20),
    supabase.from('casino_gifts').select('*').eq('from_user_id', userId).order('created_at', { ascending: false }).limit(20),
  ]);

  const name = async (id: string) => pseudoOf(id);
  return {
    received: await Promise.all((received || []).map(async (g) => ({
      pseudo: await name(g.from_user_id), amount: Number(g.amount), message: g.message, at: g.created_at,
    }))),
    sent: await Promise.all((sent || []).map(async (g) => ({
      pseudo: await name(g.to_user_id), amount: Number(g.amount), cost: Number(g.cost), message: g.message, at: g.created_at,
    }))),
    sentToday: await sentTodayCount(userId),
    dailyLimit: GIFT_DAILY_LIMIT,
    feePct: GIFT_COIN_FEE,
  };
}

async function sentTodayCount(userId: string): Promise<number> {
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase.from('casino_gifts')
    .select('id', { count: 'exact', head: true })
    .eq('from_user_id', userId).gte('created_at', since.toISOString());
  return count || 0;
}

/**
 * Coins, or a shop item. Coins cost the sender a fee on top; an item is
 * cheaper than buying it for yourself, which is the whole encouragement.
 */
export async function sendGift(
  userId: string, toPseudo: string, amount: number, message: string, itemId?: string
): Promise<Result<{ newBalance: number; delivered: string }>> {
  const { data: target } = await supabase.from('users')
    .select('id, pseudo').ilike('pseudo', toPseudo.trim()).maybeSingle();
  if (!target) return { ok: false, error: 'Joueur introuvable', status: 404 };
  if (target.id === userId) return { ok: false, error: 'Tu ne peux pas t’offrir un cadeau.', status: 400 };

  if (await sentTodayCount(userId) >= GIFT_DAILY_LIMIT) {
    return { ok: false, error: `${GIFT_DAILY_LIMIT} cadeaux par jour maximum.`, status: 400 };
  }

  const item = itemId ? itemById(itemId) : undefined;
  if (itemId && !item) return { ok: false, error: 'Objet inconnu', status: 404 };

  const value = item ? item.price : Math.floor(amount);
  const cost = item ? giftItemPrice(item.price) : giftCoinCost(value);

  if (!item && (value < GIFT_MIN || value > GIFT_MAX)) {
    return {
      ok: false, status: 400,
      error: `Entre ${GIFT_MIN.toLocaleString('en-US')} et ${GIFT_MAX.toLocaleString('en-US')} ₶.`,
    };
  }

  const { data: wallet } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
  if (!wallet) return { ok: false, error: 'Portefeuille introuvable', status: 404 };
  if (Number(wallet.balance) < cost) return { ok: false, error: 'Solde insuffisant', status: 400 };

  const afterCost = Number(wallet.balance) - cost;
  const { data: charged } = await supabase.from('casino_wallets')
    .update({ balance: afterCost, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('balance', wallet.balance)
    .select('user_id').maybeSingle();
  if (!charged) return { ok: false, error: 'Conflit, réessaye.', status: 409 };

  await supabase.from('casino_transactions').insert({
    user_id: userId, game_slug: 'casino', type: 'gift',
    amount: -cost, balance_after: afterCost,
    meta: { kind: 'gift_sent', to: target.pseudo, item: itemId ?? null, value },
  });

  if (item) {
    await addToInventory(target.id, item.id, 1);
  } else {
    await credit(target.id, value, 'gift_received', { from: await pseudoOf(userId), message: message || null });
  }

  await supabase.from('casino_gifts').insert({
    from_user_id: userId, to_user_id: target.id,
    amount: value, cost, message: message?.slice(0, 200) || null,
  });

  return {
    ok: true, newBalance: afterCost,
    delivered: item ? item.name : `${value.toLocaleString('en-US')} ₶`,
  };
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

export async function chatHistory() {
  const { data } = await supabase.from('casino_chat')
    .select('id, user_id, pseudo, body, created_at')
    .order('created_at', { ascending: false }).limit(CHAT_HISTORY);
  return (data || []).reverse();
}

export async function postChat(userId: string, body: string): Promise<Result> {
  const text = body.trim().replace(/\s+/g, ' ');
  if (!text) return { ok: false, error: 'Message vide', status: 400 };
  if (text.length > CHAT_MAX_LENGTH) return { ok: false, error: 'Message trop long', status: 400 };

  // Rate limit read off the last row rather than kept in memory: the server
  // runs as several instances and an in-process counter would not hold.
  const { data: last } = await supabase.from('casino_chat')
    .select('created_at').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (last && Date.now() - new Date(last.created_at).getTime() < CHAT_COOLDOWN_MS) {
    return { ok: false, error: 'Doucement.', status: 429 };
  }

  await supabase.from('casino_chat').insert({
    user_id: userId, pseudo: await pseudoOf(userId), body: text,
  });

  // Keep the room small; nothing else prunes it.
  const { data: cutoff } = await supabase.from('casino_chat')
    .select('id').order('created_at', { ascending: false })
    .range(CHAT_HISTORY * 4, CHAT_HISTORY * 4).maybeSingle();
  if (cutoff) await supabase.from('casino_chat').delete().lt('id', cutoff.id);

  return { ok: true };
}
