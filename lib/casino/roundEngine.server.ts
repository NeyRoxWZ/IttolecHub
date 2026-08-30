import { supabase } from '@/lib/supabase/server';
import { CASINO_MIN_BET } from './core';
import { streakBonus, prestigeWinBonus } from './progression';
import { timedWinBonus } from './events';
import { loadEffects, consumeEffects } from './effects.server';
import { effectiveMaxBet } from './settleBet.server';
import { recordWager, recordSettlement, type SettlementResult } from './metaProgression.server';
import { loadBankroll, applyDelta, logPotMove } from './bankroll.server';
import { endDrainedSyndicate } from './syndicate.server';
import { advancePass, type PassProgress } from './pass.server';
import { pushLive } from './live.server';
import { PASS_XP } from './pass';

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

  const bank = await loadBankroll(userId);
  if (!bank) return { ok: false as const, status: 404, error: 'Portefeuille introuvable' };

  const effects = await loadEffects(userId);
  const pooled = bank.kind === 'syndicate';
  const maxBet = effectiveMaxBet(bank.balance, effects);
  if (amount > bank.balance) {
    return { ok: false as const, status: 400, error: pooled ? 'La cagnotte est trop basse' : 'Solde insuffisant' };
  }
  if (amount > maxBet) return { ok: false as const, status: 400, error: `Mise max: ${maxBet} ₶` };

  const staked = await applyDelta(bank, userId, -amount, bank.balance);
  if (!staked.ok) return { ok: false as const, status: 409, error: 'Conflit de mise à jour, réessayez.' };
  const newBalance = staked.newBalance;

  const { data: round, error: roundError } = await supabase
    .from('casino_rounds')
    .insert({ user_id: userId, game_slug: gameSlug, status: 'active', amount, multiplier: 1, state: initialState })
    .select()
    .maybeSingle();

  if (roundError || !round) {
    // Refund — round creation failed after we already took the bet.
    await applyDelta(bank, userId, amount, newBalance);
    return { ok: false as const, status: 500, error: 'Impossible de démarrer la partie.' };
  }

  if (pooled) {
    await logPotMove(bank, userId, gameSlug, amount, 0, 0, newBalance);
  } else {
    await supabase.from('casino_transactions').insert({
      user_id: userId, game_slug: gameSlug, type: 'bet', amount: -amount, balance_after: newBalance, meta: { roundId: round.id },
    });
  }

  await recordWager(userId, amount);

  return { ok: true as const, roundId: round.id as string, newBalance, state: round.state };
}

export async function getActiveRound(userId: string, roundId: string, gameSlug: string) {
  const { data: round } = await supabase.from('casino_rounds').select('*').eq('id', roundId).eq('user_id', userId).eq('game_slug', gameSlug).maybeSingle();
  if (!round) return { ok: false as const, status: 404, error: 'Partie introuvable' };
  if (round.status !== 'active') return { ok: false as const, status: 400, error: 'Cette partie est terminée.' };
  return { ok: true as const, round };
}

// Blackjack "double down": take an extra bet equal to the original, from
// whichever bankroll is paying for this round.
export async function doubleBet(userId: string, roundId: string, gameSlug: string, currentAmount: number) {
  const bank = await loadBankroll(userId);
  if (!bank) return { ok: false as const, status: 404, error: 'Portefeuille introuvable' };
  if (bank.balance < currentAmount) {
    return {
      ok: false as const, status: 400,
      error: bank.kind === 'syndicate' ? 'La cagnotte est trop basse pour doubler.' : 'Solde insuffisant pour doubler.',
    };
  }

  const staked = await applyDelta(bank, userId, -currentAmount, bank.balance);
  if (!staked.ok) return { ok: false as const, status: 409, error: 'Conflit de mise à jour, réessayez.' };
  const newBalance = staked.newBalance;

  const newAmount = currentAmount * 2;
  await supabase.from('casino_rounds').update({ amount: newAmount, updated_at: new Date().toISOString() }).eq('id', roundId);
  if (bank.kind === 'syndicate') {
    await logPotMove(bank, userId, gameSlug, currentAmount, 0, 0, newBalance);
  } else {
    await supabase.from('casino_transactions').insert({
      user_id: userId, game_slug: gameSlug, type: 'bet', amount: -currentAmount, balance_after: newBalance, meta: { roundId, double: true },
    });
  }

  return { ok: true as const, newAmount, newBalance };
}

export async function updateRoundState(roundId: string, state: any, multiplier: number) {
  await supabase.from('casino_rounds').update({ state, multiplier, updated_at: new Date().toISOString() }).eq('id', roundId);
}

export async function bustRound(userId: string, roundId: string, gameSlug: string, amount: number): Promise<SettlementResult> {
  await supabase.from('casino_rounds').update({ status: 'busted', updated_at: new Date().toISOString() }).eq('id', roundId);
  const bank = await loadBankroll(userId);
  const pooled = bank?.kind === 'syndicate';
  let balance = bank?.balance ?? 0;

  // Loss insurance hands part of the stake back before the settlement is logged.
  const effects = await loadEffects(userId);
  if (effects.loss_refund && bank) {
    const refunded = Math.round(amount * effects.loss_refund.magnitude);
    if (refunded > 0) {
      const back = await applyDelta(bank, userId, refunded, balance);
      if (back.ok) balance = back.newBalance;
      if (pooled) {
        await logPotMove(bank!, userId, gameSlug, 0, refunded, 0, balance);
      } else {
        await supabase.from('casino_transactions').insert({
          user_id: userId, game_slug: gameSlug, type: 'bonus', amount: refunded,
          balance_after: balance, meta: { kind: 'loss_refund', roundId },
        });
      }
    }
    await consumeEffects(userId, effects, ['loss_refund']);
  }

  const [progression] = await Promise.all([
    recordSettlement(userId, gameSlug, { amount, payout: 0, multiplier: 0, baseMultiplier: 0, newBalance: balance, effects, pooled }),
    advancePass(userId, PASS_XP.bet),
    pooled ? Promise.resolve() : pushLive(userId, gameSlug, -amount, 0),
  ]);
  if (pooled && balance <= 0) await endDrainedSyndicate(bank!.syndicateId!);
  return progression;
}

export async function cashoutRound(userId: string, roundId: string, amount: number, baseMultiplier: number, gameSlug: string) {
  const bank = await loadBankroll(userId);
  if (!bank) return { ok: false as const, status: 404, error: 'Portefeuille introuvable' };
  const wallet = bank.wallet;

  // Same rule as the instant games: bonuses lift the profit, never the stake.
  const effects = await loadEffects(userId);
  const used: string[] = [];
  const streakPct = baseMultiplier > 1 ? streakBonus(Number(wallet.current_streak || 0)) : 0;
  const itemPct = baseMultiplier > 1 ? (effects.win_bonus?.magnitude ?? 0) : 0;
  const prestigePct = baseMultiplier > 1 ? prestigeWinBonus(Number(wallet.prestige_count || 0)) : 0;
  const timedPct = baseMultiplier > 1 ? timedWinBonus(gameSlug) : 0;
  if (itemPct > 0) used.push('win_bonus');

  const lift = streakPct + itemPct + prestigePct + timedPct;
  const multiplier = baseMultiplier > 1 && lift > 0
    ? 1 + (baseMultiplier - 1) * (1 + lift)
    : baseMultiplier;
  const payout = Math.round(amount * multiplier);

  const paid = await applyDelta(bank, userId, payout, bank.balance);
  if (!paid.ok) return { ok: false as const, status: 409, error: 'Conflit de mise à jour, réessayez.' };
  const newBalance = paid.newBalance;

  await supabase.from('casino_rounds').update({ status: 'cashed_out', multiplier, updated_at: new Date().toISOString() }).eq('id', roundId);
  if (bank.kind === 'syndicate') {
    await logPotMove(bank, userId, gameSlug, amount, payout, multiplier, newBalance);
  } else {
    await supabase.from('casino_transactions').insert({
      user_id: userId, game_slug: gameSlug, type: 'win', amount: payout, balance_after: newBalance,
      meta: { roundId, multiplier, baseMultiplier, streakPct, itemPct, prestigePct, timedPct },
    });
  }

  await consumeEffects(userId, effects, used);
  const [progression, pass] = await Promise.all([
    recordSettlement(userId, gameSlug, { amount, payout, multiplier, baseMultiplier, newBalance, effects, pooled: bank.kind === 'syndicate' }),
    advancePass(userId, PASS_XP.bet + (baseMultiplier > 1 ? PASS_XP.win : 0)),
    bank.kind === 'syndicate' ? Promise.resolve() : pushLive(userId, gameSlug, payout - amount, multiplier),
  ]);

  return {
    ok: true as const,
    payout,
    newBalance,
    multiplier: Math.round(multiplier * 100) / 100,
    progression,
    pass,
    bonuses: { streak: streakPct, item: itemPct, prestige: prestigePct, timed: timedPct },
  };
}
