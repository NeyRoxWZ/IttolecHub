import { supabase } from '@/lib/supabase/server';
import { getMaxBet, CASINO_MIN_BET } from './core';

// Shared by every "start a round, take steps, cash out anytime" game
// (Mines, Tower, Poulet, Dino). casino_rounds.state holds the server-secret
// data (mine positions, etc) and has NO client read policy at all — unlike
// casino_wallets/transactions, this table is 100% service-role only,
// because reading it directly would leak the secret before it's revealed.

interface StartParams {
  userId: string;
  gameSlug: string;
  amount: number;
  initialState: any;
}

export async function startRound({ userId, gameSlug, amount, initialState }: StartParams) {
  if (!userId) return { ok: false as const, status: 400, error: 'user_id requis' };
  if (!Number.isInteger(amount) || amount < CASINO_MIN_BET) return { ok: false as const, status: 400, error: 'Mise invalide' };

  const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
  if (!wallet) return { ok: false as const, status: 404, error: 'Portefeuille introuvable' };

  const maxBet = getMaxBet(wallet.balance);
  if (amount > wallet.balance) return { ok: false as const, status: 400, error: 'Solde insuffisant' };
  if (amount > maxBet) return { ok: false as const, status: 400, error: `Mise max: ${maxBet} ₶` };

  const newBalance = wallet.balance - amount;
  const { data: updatedWallet, error: walletError } = await supabase
    .from('casino_wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('balance', wallet.balance)
    .select()
    .maybeSingle();
  if (walletError || !updatedWallet) return { ok: false as const, status: 409, error: 'Conflit de mise à jour, réessayez.' };

  const { data: round, error: roundError } = await supabase
    .from('casino_rounds')
    .insert({ user_id: userId, game_slug: gameSlug, status: 'active', amount, multiplier: 1, state: initialState })
    .select()
    .maybeSingle();

  if (roundError || !round) {
    // Refund — round creation failed after we already took the bet.
    await supabase.from('casino_wallets').update({ balance: wallet.balance }).eq('user_id', userId);
    return { ok: false as const, status: 500, error: 'Impossible de démarrer la partie.' };
  }

  await supabase.from('casino_transactions').insert({
    user_id: userId, game_slug: gameSlug, type: 'bet', amount: -amount, balance_after: newBalance, meta: { roundId: round.id },
  });

  return { ok: true as const, roundId: round.id as string, newBalance, state: round.state };
}

export async function getActiveRound(userId: string, roundId: string, gameSlug: string) {
  const { data: round } = await supabase.from('casino_rounds').select('*').eq('id', roundId).eq('user_id', userId).eq('game_slug', gameSlug).maybeSingle();
  if (!round) return { ok: false as const, status: 404, error: 'Partie introuvable' };
  if (round.status !== 'active') return { ok: false as const, status: 400, error: 'Cette partie est terminée.' };
  return { ok: true as const, round };
}

export async function updateRoundState(roundId: string, state: any, multiplier: number) {
  await supabase.from('casino_rounds').update({ state, multiplier, updated_at: new Date().toISOString() }).eq('id', roundId);
}

export async function bustRound(roundId: string) {
  await supabase.from('casino_rounds').update({ status: 'busted', updated_at: new Date().toISOString() }).eq('id', roundId);
}

export async function cashoutRound(userId: string, roundId: string, amount: number, multiplier: number, gameSlug: string) {
  const payout = Math.round(amount * multiplier);

  const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
  if (!wallet) return { ok: false as const, status: 404, error: 'Portefeuille introuvable' };

  const newBalance = wallet.balance + payout;
  const { data: updated, error } = await supabase
    .from('casino_wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('balance', wallet.balance)
    .select()
    .maybeSingle();
  if (error || !updated) return { ok: false as const, status: 409, error: 'Conflit de mise à jour, réessayez.' };

  await supabase.from('casino_rounds').update({ status: 'cashed_out', multiplier, updated_at: new Date().toISOString() }).eq('id', roundId);
  await supabase.from('casino_transactions').insert({
    user_id: userId, game_slug: gameSlug, type: 'win', amount: payout, balance_after: newBalance, meta: { roundId, multiplier },
  });

  return { ok: true as const, payout, newBalance };
}
