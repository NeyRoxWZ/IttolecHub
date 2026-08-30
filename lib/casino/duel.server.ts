import { supabase } from '@/lib/supabase/server';
import { spinSlots } from './slots';
import { dropBall } from './plinko';
import { scratchTicket } from './grattage';
import { recordSettlement } from './metaProgression.server';
import { advancePass } from './pass.server';
import { PASS_XP } from './pass';

/**
 * One-shot duels.
 *
 * Both players stake the same amount, both roll once on the same game, the
 * better multiplier takes the pot. Only games that resolve in a single draw
 * with nothing to decide are allowed: a duel is meant to be settled in one
 * click each, and a game with choices would make it a question of who took
 * longer rather than who was luckier.
 */

export const DUEL_GAMES = ['slots', 'plinko', 'grattage'] as const;
export type DuelGame = (typeof DUEL_GAMES)[number];

export const DUEL_GAME_LABEL: Record<DuelGame, string> = {
  slots: 'Frenly Slots',
  plinko: 'Frenly Plinko',
  grattage: 'Frenly Grattage',
};

export const DUEL_MIN = 100;
export const DUEL_MAX = 100_000;

function roll(game: DuelGame): number {
  if (game === 'slots') return spinSlots().multiplier;
  if (game === 'plinko') return dropBall().multiplier;
  return scratchTicket().multiplier;
}

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; error: string; status: number };
type Row = Record<string, any>;

function code(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function pseudoOf(userId: string): Promise<string> {
  const { data } = await supabase.from('users').select('pseudo').eq('id', userId).maybeSingle();
  return data?.pseudo || 'Joueur';
}

async function charge(userId: string, amount: number, duelCode: string): Promise<Result<{ newBalance: number }>> {
  const { data: w } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
  if (!w) return { ok: false, error: 'Portefeuille introuvable', status: 404 };
  if (Number(w.balance) < amount) return { ok: false, error: 'Solde insuffisant', status: 400 };

  const newBalance = Number(w.balance) - amount;
  const { data: ok } = await supabase.from('casino_wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('balance', w.balance).select('user_id').maybeSingle();
  if (!ok) return { ok: false, error: 'Conflit, réessaye.', status: 409 };

  await supabase.from('casino_transactions').insert({
    user_id: userId, game_slug: 'duel', type: 'bet',
    amount: -amount, balance_after: newBalance, meta: { kind: 'duel_stake', code: duelCode },
  });
  return { ok: true, newBalance };
}

async function pay(userId: string, amount: number, duelCode: string, kind: string) {
  const { data: w } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
  if (!w) return;
  const newBalance = Number(w.balance) + amount;
  await supabase.from('casino_wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', userId);
  await supabase.from('casino_transactions').insert({
    user_id: userId, game_slug: 'duel', type: 'win',
    amount, balance_after: newBalance, meta: { kind, code: duelCode },
  });
}

/* ------------------------------------------------------------------ */

export async function duelState(userId: string | null) {
  const [{ data: open }, { data: mine }] = await Promise.all([
    supabase.from('casino_duels').select('*').eq('status', 'open')
      .order('created_at', { ascending: false }).limit(20),
    userId
      ? supabase.from('casino_duels').select('*')
          .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
          .order('created_at', { ascending: false }).limit(20)
      : Promise.resolve({ data: [] as Row[] }),
  ]);

  return {
    open: (open || []).filter((d) => d.challenger_id !== userId),
    mine: mine || [],
    games: DUEL_GAMES.map((g) => ({ slug: g, label: DUEL_GAME_LABEL[g] })),
    min: DUEL_MIN,
    max: DUEL_MAX,
  };
}

export async function createDuel(
  userId: string, game: string, amount: number
): Promise<Result<{ code: string; newBalance: number }>> {
  if (!DUEL_GAMES.includes(game as DuelGame)) return { ok: false, error: 'Jeu invalide', status: 400 };
  const stake = Math.floor(amount);
  if (stake < DUEL_MIN || stake > DUEL_MAX) {
    return { ok: false, error: `Entre ${DUEL_MIN.toLocaleString('en-US')} et ${DUEL_MAX.toLocaleString('en-US')} ₶.`, status: 400 };
  }

  const { count } = await supabase.from('casino_duels')
    .select('id', { count: 'exact', head: true })
    .eq('challenger_id', userId).in('status', ['open', 'playing']);
  if ((count || 0) >= 3) return { ok: false, error: '3 duels en cours maximum.', status: 400 };

  const c = code();
  const charged = await charge(userId, stake, c);
  if (!charged.ok) return charged;

  const { data, error } = await supabase.from('casino_duels').insert({
    code: c, game_slug: game, amount: stake, status: 'open',
    challenger_id: userId, challenger_pseudo: await pseudoOf(userId),
  }).select().maybeSingle();
  if (error || !data) return { ok: false, error: 'Création impossible', status: 500 };

  return { ok: true, code: c, newBalance: charged.newBalance };
}

export async function joinDuel(userId: string, duelCode: string): Promise<Result<{ newBalance: number }>> {
  const { data: duel } = await supabase.from('casino_duels')
    .select('*').eq('code', duelCode.trim().toUpperCase()).maybeSingle();
  if (!duel) return { ok: false, error: 'Duel introuvable', status: 404 };
  if (duel.status !== 'open') return { ok: false, error: 'Ce duel est déjà pris.', status: 400 };
  if (duel.challenger_id === userId) return { ok: false, error: 'C’est ton duel.', status: 400 };

  const charged = await charge(userId, Number(duel.amount), duel.code);
  if (!charged.ok) return charged;

  // Claiming the slot is what stops two people joining the same duel.
  const { data: taken } = await supabase.from('casino_duels')
    .update({ status: 'playing', opponent_id: userId, opponent_pseudo: await pseudoOf(userId) })
    .eq('id', duel.id).eq('status', 'open')
    .select('id').maybeSingle();

  if (!taken) {
    await pay(userId, Number(duel.amount), duel.code, 'duel_refund');
    return { ok: false, error: 'Quelqu’un est passé avant toi.', status: 409 };
  }

  return { ok: true, newBalance: charged.newBalance };
}

/** Rolls this player's single shot, and settles once both have played. */
export async function playDuel(userId: string, duelId: string): Promise<Result<{ multiplier: number; duel: Row }>> {
  const { data: duel } = await supabase.from('casino_duels').select('*').eq('id', duelId).maybeSingle();
  if (!duel) return { ok: false, error: 'Duel introuvable', status: 404 };
  if (duel.status !== 'playing') return { ok: false, error: 'Duel pas en cours.', status: 400 };

  const isChallenger = duel.challenger_id === userId;
  const isOpponent = duel.opponent_id === userId;
  if (!isChallenger && !isOpponent) return { ok: false, error: 'Tu n’es pas dans ce duel.', status: 403 };

  const already = isChallenger ? duel.challenger_multiplier : duel.opponent_multiplier;
  if (already !== null && already !== undefined) {
    return { ok: false, error: 'Tu as déjà joué ton coup.', status: 400 };
  }

  const multiplier = roll(duel.game_slug as DuelGame);
  const field = isChallenger ? 'challenger_multiplier' : 'opponent_multiplier';

  // Only write if still empty: a double click must not reroll.
  const { data: written } = await supabase.from('casino_duels')
    .update({ [field]: multiplier })
    .eq('id', duelId).is(field, null)
    .select().maybeSingle();
  if (!written) return { ok: false, error: 'Tu as déjà joué ton coup.', status: 409 };

  // The duel is a bet like any other for progression purposes.
  const { data: w } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
  await Promise.all([
    recordSettlement(userId, 'duel', {
      amount: Number(duel.amount), payout: 0, multiplier, baseMultiplier: multiplier,
      newBalance: Number(w?.balance || 0), wagered: Number(duel.amount),
    }),
    advancePass(userId, PASS_XP.bet),
  ]);

  const both = written.challenger_multiplier !== null && written.opponent_multiplier !== null;
  const settled = both ? await settleDuel(written) : written;

  return { ok: true, multiplier, duel: settled };
}

async function settleDuel(duel: Row): Promise<Row> {
  const a = Number(duel.challenger_multiplier);
  const b = Number(duel.opponent_multiplier);
  const pot = Number(duel.amount) * 2;

  const winner = a === b ? null : a > b ? duel.challenger_id : duel.opponent_id;

  const { data: closed } = await supabase.from('casino_duels')
    .update({
      status: 'done', winner_id: winner, settled_at: new Date().toISOString(),
      challenger_payout: winner === null ? Number(duel.amount) : winner === duel.challenger_id ? pot : 0,
      opponent_payout: winner === null ? Number(duel.amount) : winner === duel.opponent_id ? pot : 0,
    })
    .eq('id', duel.id).eq('status', 'playing')
    .select().maybeSingle();
  if (!closed) return duel;

  if (winner === null) {
    // Same multiplier: everyone gets their stake back rather than a coin flip.
    await pay(duel.challenger_id, Number(duel.amount), duel.code, 'duel_draw');
    await pay(duel.opponent_id, Number(duel.amount), duel.code, 'duel_draw');
  } else {
    await pay(winner, pot, duel.code, 'duel_win');
  }

  return closed;
}

export async function cancelDuel(userId: string, duelId: string): Promise<Result<{ refund: number }>> {
  const { data: duel } = await supabase.from('casino_duels').select('*').eq('id', duelId).maybeSingle();
  if (!duel) return { ok: false, error: 'Duel introuvable', status: 404 };
  if (duel.challenger_id !== userId) return { ok: false, error: 'Ce duel n’est pas le tien.', status: 403 };
  if (duel.status !== 'open') return { ok: false, error: 'Trop tard, il est lancé.', status: 400 };

  const { data: closed } = await supabase.from('casino_duels')
    .update({ status: 'cancelled', settled_at: new Date().toISOString() })
    .eq('id', duelId).eq('status', 'open').select('id').maybeSingle();
  if (!closed) return { ok: false, error: 'Trop tard, il est lancé.', status: 409 };

  await pay(userId, Number(duel.amount), duel.code, 'duel_refund');
  return { ok: true, refund: Number(duel.amount) };
}
