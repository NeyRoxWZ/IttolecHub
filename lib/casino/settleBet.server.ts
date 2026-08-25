import { supabase } from '@/lib/supabase/server';
import { getMaxBet, CASINO_MIN_BET, type BetResolution } from './core';
import { recordWager, recordSettlement, type SettlementResult } from './metaProgression.server';

interface SettleParams {
  userId: string;
  gameSlug: string;
  amount: number;
  resolve: () => BetResolution; // must be pure/deterministic given its own RNG call inside
}

interface SettleSuccess {
  ok: true;
  won: boolean;
  multiplier: number;
  payout: number;
  netChange: number;
  newBalance: number;
  meta: any;
  progression: SettlementResult;
}

interface SettleFailure {
  ok: false;
  status: number;
  error: string;
}

// Shared by every casino game's API route: validates the bet, resolves it
// (RNG happens inside `resolve`, server-side only), and atomically updates
// the wallet with an optimistic lock so concurrent/duplicate requests can't
// double-spend the same balance.
export async function settleBet({ userId, gameSlug, amount, resolve }: SettleParams): Promise<SettleSuccess | SettleFailure> {
  if (!userId) return { ok: false, status: 400, error: 'user_id requis' };
  if (!Number.isInteger(amount) || amount < CASINO_MIN_BET) return { ok: false, status: 400, error: 'Mise invalide' };

  const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
  if (!wallet) return { ok: false, status: 404, error: 'Portefeuille introuvable' };

  const maxBet = getMaxBet(wallet.balance);
  if (amount > wallet.balance) return { ok: false, status: 400, error: 'Solde insuffisant' };
  if (amount > maxBet) return { ok: false, status: 400, error: `Mise max: ${maxBet} ₶` };

  const { won, multiplier, meta } = resolve();
  const payout = Math.round(amount * multiplier);
  const netChange = payout - amount;
  const newBalance = wallet.balance + netChange;

  const { data: updated, error: updateError } = await supabase
    .from('casino_wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('balance', wallet.balance) // optimistic lock
    .select()
    .maybeSingle();

  if (updateError || !updated) return { ok: false, status: 409, error: 'Conflit de mise à jour, réessayez.' };

  const txType = multiplier === 0 ? 'bet' : multiplier === 1 ? 'push' : 'win';
  await supabase.from('casino_transactions').insert({
    user_id: userId,
    game_slug: gameSlug,
    type: txType,
    amount: netChange,
    balance_after: newBalance,
    meta: { ...meta, amount, multiplier },
  });

  await recordWager(userId, amount);
  const progression = await recordSettlement(userId, gameSlug, { amount, payout, multiplier, newBalance });

  return { ok: true, won, multiplier, payout, netChange, newBalance, meta, progression };
}
