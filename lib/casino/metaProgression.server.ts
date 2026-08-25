import { supabase } from '@/lib/supabase/server';
import { ACHIEVEMENTS, JACKPOT_CONTRIBUTION_RATE, JACKPOT_HIT_CHANCE, JACKPOT_SEED, seasonKey, type WalletStats } from './meta';

// Secondary stats (streaks, achievements, season totals, jackpot pool) —
// not money-critical like the balance itself, so plain fetch-then-update is
// fine here (unlike casino_wallets.balance, which uses an optimistic lock
// because it's the one thing that must never double-spend).

export async function recordWager(userId: string, amount: number) {
  const { data: wallet } = await supabase.from('casino_wallets').select('total_wagered').eq('user_id', userId).maybeSingle();
  if (wallet) {
    await supabase.from('casino_wallets').update({ total_wagered: Number(wallet.total_wagered || 0) + amount }).eq('user_id', userId);
  }

  const key = seasonKey();
  const { data: season } = await supabase.from('casino_season_stats').select('*').eq('user_id', userId).eq('season_key', key).maybeSingle();
  if (season) {
    await supabase.from('casino_season_stats').update({ wagered: Number(season.wagered) + amount }).eq('user_id', userId).eq('season_key', key);
  } else {
    await supabase.from('casino_season_stats').insert({ user_id: userId, season_key: key, wagered: amount, won: 0 });
  }
}

export interface SettlementInput {
  amount: number; // original bet
  payout: number; // total returned this settlement (0 = loss)
  multiplier: number;
  newBalance: number;
}

export interface SettlementResult {
  newAchievements: { id: string; name: string; description: string }[];
  jackpotWon: number | null;
}

export async function recordSettlement(userId: string, gameSlug: string, input: SettlementInput): Promise<SettlementResult> {
  const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
  if (!wallet) return { newAchievements: [], jackpotWon: null };

  const isWin = input.multiplier > 1;
  const isLoss = input.multiplier === 0;

  const newStreak = isWin ? Number(wallet.current_streak || 0) + 1 : isLoss ? 0 : Number(wallet.current_streak || 0);
  const newBestStreak = Math.max(Number(wallet.best_streak || 0), newStreak);
  const newTotalWon = Number(wallet.total_won || 0) + (input.payout > 0 ? input.payout : 0);
  const newBiggest = Math.max(Number(wallet.biggest_multiplier || 0), input.multiplier);
  const newAllTimeBest = Math.max(Number(wallet.all_time_best_balance || 250), input.newBalance);

  await supabase.from('casino_wallets').update({
    current_streak: newStreak,
    best_streak: newBestStreak,
    total_won: newTotalWon,
    biggest_multiplier: newBiggest,
    all_time_best_balance: newAllTimeBest,
  }).eq('user_id', userId);

  if (input.payout > 0) {
    const key = seasonKey();
    const { data: season } = await supabase.from('casino_season_stats').select('*').eq('user_id', userId).eq('season_key', key).maybeSingle();
    if (season) await supabase.from('casino_season_stats').update({ won: Number(season.won) + input.payout }).eq('user_id', userId).eq('season_key', key);
    else await supabase.from('casino_season_stats').insert({ user_id: userId, season_key: key, won: input.payout, wagered: 0 });
  }

  // Progressive jackpot: losses feed the pool, every settled bet has a tiny
  // independent shot at winning the whole thing.
  let jackpotWon: number | null = null;
  const { data: jackpot } = await supabase.from('casino_jackpot').select('*').eq('id', 1).maybeSingle();
  if (jackpot) {
    let pool = Number(jackpot.amount);
    if (isLoss) pool += Math.max(1, Math.round(input.amount * JACKPOT_CONTRIBUTION_RATE));

    const hit = Math.random() < JACKPOT_HIT_CHANCE;
    if (hit && pool > JACKPOT_SEED) {
      jackpotWon = pool;
      await supabase.from('casino_jackpot').update({
        amount: JACKPOT_SEED, last_winner_user_id: userId, last_won_amount: pool, last_won_at: new Date().toISOString(),
      }).eq('id', 1);

      const { data: freshWallet } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
      if (freshWallet) {
        const nb = freshWallet.balance + pool;
        await supabase.from('casino_wallets').update({ balance: nb }).eq('user_id', userId);
        await supabase.from('casino_transactions').insert({ user_id: userId, game_slug: gameSlug, type: 'jackpot', amount: pool, balance_after: nb });
      }
    } else {
      await supabase.from('casino_jackpot').update({ amount: pool }).eq('id', 1);
    }
  }

  const stats: WalletStats = {
    balance: input.newBalance,
    totalWagered: Number(wallet.total_wagered || 0),
    totalWon: newTotalWon,
    currentStreak: newStreak,
    bestStreak: newBestStreak,
    prestigeCount: Number(wallet.prestige_count || 0),
    biggestMultiplier: newBiggest,
  };

  const newAchievements = await checkAchievements(userId, stats);
  return { newAchievements, jackpotWon };
}

export async function checkAchievements(userId: string, stats: WalletStats): Promise<SettlementResult['newAchievements']> {
  const { data: unlocked } = await supabase.from('casino_achievements_unlocked').select('achievement_id').eq('user_id', userId);
  const unlockedIds = new Set((unlocked || []).map((u) => u.achievement_id));
  const newAchievements: SettlementResult['newAchievements'] = [];
  for (const ach of ACHIEVEMENTS) {
    if (!unlockedIds.has(ach.id) && ach.check(stats)) {
      await supabase.from('casino_achievements_unlocked').insert({ user_id: userId, achievement_id: ach.id });
      newAchievements.push({ id: ach.id, name: ach.name, description: ach.description });
    }
  }
  return newAchievements;
}
