import { supabase } from '@/lib/supabase/server';
import { CASINO_MIN_BET } from './core';
import { streakBonus } from './progression';
import { loadEffects, consumeEffects } from './effects.server';
import { effectiveMaxBet } from './settleBet.server';
import { recordWager, recordSettlement, type SettlementResult } from './metaProgression.server';

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

  const effects = await loadEffects(userId);
  const maxBet = effectiveMaxBet(wallet.balance, effects);
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

  await recordWager(userId, amount);

  return { ok: true as const, roundId: round.id as string, newBalance, state: round.state };
}

export async function getActiveRound(userId: string, roundId: string, gameSlug: string) {
  const { data: round } = await supabase.from('casino_rounds').select('*').eq('id', roundId).eq('user_id', userId).eq('game_slug', gameSlug).maybeSingle();
  if (!round) return { ok: false as const, status: 404, error: 'Partie introuvable' };
  if (round.status !== 'active') return { ok: false as const, status: 400, error: 'Cette partie est terminée.' };
  return { ok: true as const, round };
}

// Blackjack "double down": take an extra bet equal to the original, same
// optimistic-lock pattern as everywhere else.
export async function doubleBet(userId: string, roundId: string, gameSlug: string, currentAmount: number) {
  const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
  if (!wallet) return { ok: false as const, status: 404, error: 'Portefeuille introuvable' };
  if (wallet.balance < currentAmount) return { ok: false as const, status: 400, error: 'Solde insuffisant pour doubler.' };

  const newBalance = wallet.balance - currentAmount;
  const { data: updated, error } = await supabase
    .from('casino_wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('balance', wallet.balance)
    .select()
    .maybeSingle();
  if (error || !updated) return { ok: false as const, status: 409, error: 'Conflit de mise à jour, réessayez.' };

  const newAmount = currentAmount * 2;
  await supabase.from('casino_rounds').update({ amount: newAmount, updated_at: new Date().toISOString() }).eq('id', roundId);
  await supabase.from('casino_transactions').insert({
    user_id: userId, game_slug: gameSlug, type: 'bet', amount: -currentAmount, balance_after: newBalance, meta: { roundId, double: true },
  });

  return { ok: true as const, newAmount, newBalance };
}

export async function updateRoundState(roundId: string, state: any, multiplier: number) {
  await supabase.from('casino_rounds').update({ state, multiplier, updated_at: new Date().toISOString() }).eq('id', roundId);
}

export async function bustRound(userId: string, roundId: string, gameSlug: string, amount: number): Promise<SettlementResult> {
  await supabase.from('casino_rounds').update({ status: 'busted', updated_at: new Date().toISOString() }).eq('id', roundId);
  const { data: wallet } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
  let balance = wallet?.balance ?? 0;

  // Loss insurance hands part of the stake back before the settlement is logged.
  const effects = await loadEffects(userId);
  if (effects.loss_refund) {
    const refunded = Math.round(amount * effects.loss_refund.magnitude);
    if (refunded > 0) {
      balance += refunded;
      await supabase.from('casino_wallets').update({ balance, updated_at: new Date().toISOString() }).eq('user_id', userId);
      await supabase.from('casino_transactions').insert({
        user_id: userId, game_slug: gameSlug, type: 'bonus', amount: refunded,
        balance_after: balance, meta: { kind: 'loss_refund', roundId },
      });
    }
    await consumeEffects(userId, effects, ['loss_refund']);
  }

  return recordSettlement(userId, gameSlug, { amount, payout: 0, multiplier: 0, baseMultiplier: 0, newBalance: balance, effects });
}

export async function cashoutRound(userId: string, roundId: string, amount: number, baseMultiplier: number, gameSlug: string) {
  const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
  if (!wallet) return { ok: false as const, status: 404, error: 'Portefeuille introuvable' };

  // Same rule as the instant games: bonuses lift the profit, never the stake.
  const effects = await loadEffects(userId);
  const used: string[] = [];
  const streakPct = baseMultiplier > 1 ? streakBonus(Number(wallet.current_streak || 0)) : 0;
  const itemPct = baseMultiplier > 1 ? (effects.win_bonus?.magnitude ?? 0) : 0;
  if (itemPct > 0) used.push('win_bonus');

  const multiplier = baseMultiplier > 1 && streakPct + itemPct > 0
    ? 1 + (baseMultiplier - 1) * (1 + streakPct + itemPct)
    : baseMultiplier;
  const payout = Math.round(amount * multiplier);

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
    user_id: userId, game_slug: gameSlug, type: 'win', amount: payout, balance_after: newBalance,
    meta: { roundId, multiplier, baseMultiplier, streakPct, itemPct },
  });

  await consumeEffects(userId, effects, used);
  const progression = await recordSettlement(userId, gameSlug, { amount, payout, multiplier, baseMultiplier, newBalance, effects });

  return {
    ok: true as const,
    payout,
    newBalance,
    multiplier: Math.round(multiplier * 100) / 100,
    progression,
    bonuses: { streak: streakPct, item: itemPct },
  };
}
