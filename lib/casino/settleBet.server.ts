import { supabase } from '@/lib/supabase/server';
import { CASINO_MIN_BET, CASINO_MAX_BET_ABS, type BetResolution } from './core';
import { streakBonus } from './progression';
import { loadEffects, consumeEffects, type EffectMap } from './effects.server';
import { recordSettlement, type SettlementResult } from './metaProgression.server';

interface SettleParams {
  userId: string;
  gameSlug: string;
  amount: number;
  resolve: () => BetResolution; // RNG happens inside, server-side only
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
  /** What boosted this settlement, so the UI can show it. */
  bonuses: { streak: number; item: number; refunded: number };
}

interface SettleFailure { ok: false; status: number; error: string }

/** Bet cap, widened while a "high roller" style item is active. */
export function effectiveMaxBet(balance: number, effects: EffectMap): number {
  const pct = effects.max_bet_pct?.magnitude ?? 0.5;
  return Math.max(CASINO_MIN_BET, Math.min(CASINO_MAX_BET_ABS, Math.floor(balance * pct)));
}

/**
 * Shared by every casino game's API route: validates the bet, resolves it,
 * applies streak/item bonuses, and atomically updates the wallet with an
 * optimistic lock so duplicate requests can't double-spend the same balance.
 */
export async function settleBet({ userId, gameSlug, amount, resolve }: SettleParams): Promise<SettleSuccess | SettleFailure> {
  if (!userId) return { ok: false, status: 400, error: 'user_id requis' };
  if (!Number.isInteger(amount) || amount < CASINO_MIN_BET) return { ok: false, status: 400, error: 'Mise invalide' };

  const [{ data: wallet }, effects] = await Promise.all([
    supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle(),
    loadEffects(userId),
  ]);
  if (!wallet) return { ok: false, status: 404, error: 'Portefeuille introuvable' };
  const maxBet = effectiveMaxBet(wallet.balance, effects);
  if (amount > wallet.balance) return { ok: false, status: 400, error: 'Solde insuffisant' };
  if (amount > maxBet) return { ok: false, status: 400, error: `Mise max: ${maxBet} ₶` };

  const { won, multiplier: baseMultiplier, meta } = resolve();
  const used: string[] = [];

  // Bonuses lift the *profit* only — a push (x1) or a refund is untouched.
  const currentStreak = Number(wallet.current_streak || 0);
  const streakPct = baseMultiplier > 1 ? streakBonus(currentStreak) : 0;
  const itemPct = baseMultiplier > 1 ? (effects.win_bonus?.magnitude ?? 0) : 0;
  if (itemPct > 0) used.push('win_bonus');

  let multiplier = baseMultiplier;
  if (baseMultiplier > 1 && streakPct + itemPct > 0) {
    multiplier = 1 + (baseMultiplier - 1) * (1 + streakPct + itemPct);
  }

  let payout = Math.round(amount * multiplier);

  // Loss insurance hands part of the stake back.
  let refunded = 0;
  if (baseMultiplier === 0 && effects.loss_refund) {
    refunded = Math.round(amount * effects.loss_refund.magnitude);
    payout += refunded;
    used.push('loss_refund');
  }

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

  const txType = baseMultiplier === 0 ? 'bet' : baseMultiplier === 1 ? 'push' : 'win';

  // The ledger write, the consumed items and the meta progression touch
  // different tables — run them together rather than making the player wait
  // through three sequential round-trips before the animation can start.
  const [, , progression] = await Promise.all([
    supabase.from('casino_transactions').insert({
      user_id: userId,
      game_slug: gameSlug,
      type: txType,
      amount: netChange,
      balance_after: newBalance,
      meta: { ...meta, amount, multiplier, baseMultiplier, streakPct, itemPct, refunded },
    }),
    consumeEffects(userId, effects, used),
    recordSettlement(userId, gameSlug, {
      amount, payout, multiplier, baseMultiplier, newBalance, effects, wagered: amount,
    }),
  ]);

  return {
    ok: true,
    won,
    multiplier: Math.round(multiplier * 100) / 100,
    payout,
    netChange,
    newBalance,
    meta,
    progression,
    bonuses: { streak: streakPct, item: itemPct, refunded },
  };
}
