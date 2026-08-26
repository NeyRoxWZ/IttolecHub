import { supabase } from '@/lib/supabase/server';
import {
  ACHIEVEMENTS, achievementReward, JACKPOT_CONTRIBUTION_RATE, JACKPOT_HIT_CHANCE, JACKPOT_SEED,
  seasonKey, type WalletStats,
} from './meta';
import { cosmeticById } from './cosmetics';
import { xpForWager, levelFromXp, levelUpReward, isFeedWorthy } from './progression';
import {
  pickDailyMissions, missionById, isMissionComplete, missionValue,
  dayKey, gameBit, countBits, type MissionDef,
} from './missions';
import { consumeEffects, type EffectMap } from './effects.server';

/* ------------------------------------------------------------------ */
/* Wager tracking                                                      */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Missions                                                            */
/* ------------------------------------------------------------------ */

export interface MissionRow {
  slot: number;
  mission_id: string;
  progress: number;
  claimed: boolean;
  def: MissionDef;
  value: number;
  complete: boolean;
}

/** Fetch today's missions, creating them on first access of the day. */
export async function ensureMissions(userId: string): Promise<MissionRow[]> {
  const day = dayKey();
  let { data } = await supabase.from('casino_missions').select('*').eq('user_id', userId).eq('day_key', day);

  if (!data || data.length === 0) {
    const picked = pickDailyMissions(userId, day);
    const rows = picked.map((m, slot) => ({ user_id: userId, day_key: day, slot, mission_id: m.id, progress: 0, claimed: false }));
    await supabase.from('casino_missions').insert(rows);
    const res = await supabase.from('casino_missions').select('*').eq('user_id', userId).eq('day_key', day);
    data = res.data;
  }

  return (data || [])
    .map((r) => {
      const def = missionById(r.mission_id);
      if (!def) return null;
      const progress = Number(r.progress);
      return {
        slot: r.slot, mission_id: r.mission_id, progress, claimed: r.claimed, def,
        value: missionValue(def, progress),
        complete: isMissionComplete(def, progress),
      };
    })
    .filter((r): r is MissionRow => r !== null)
    .sort((a, b) => a.slot - b.slot);
}

interface MissionUpdateInput {
  gameSlug: string;
  amount: number;
  payout: number;
  won: boolean;
  baseMultiplier: number;
  newStreak: number;
}

async function advanceMissions(userId: string, input: MissionUpdateInput): Promise<MissionDef[]> {
  const rows = await ensureMissions(userId);
  const day = dayKey();
  const newlyComplete: MissionDef[] = [];

  for (const row of rows) {
    if (row.claimed || row.complete) continue;
    let next = row.progress;

    switch (row.def.kind) {
      case 'wager_total': next += input.amount; break;
      case 'play_count': next += 1; break;
      case 'win_count': if (input.won) next += 1; break;
      case 'win_total': if (input.payout > 0) next += input.payout; break;
      case 'streak_reach': next = Math.max(next, input.newStreak); break;
      case 'multiplier_reach': next = Math.max(next, Math.floor(input.baseMultiplier)); break;
      case 'distinct_games': next = row.progress | (1 << gameBit(input.gameSlug)); break;
    }

    if (next === row.progress) continue;
    await supabase.from('casino_missions').update({ progress: next })
      .eq('user_id', userId).eq('day_key', day).eq('slot', row.slot);

    if (isMissionComplete(row.def, next)) newlyComplete.push(row.def);
  }

  return newlyComplete;
}

/* ------------------------------------------------------------------ */
/* Small shared writes                                                 */
/* ------------------------------------------------------------------ */

async function bumpSeason(userId: string, wagered: number, won: number) {
  if (wagered === 0 && won === 0) return;
  const key = seasonKey();
  const { data: season } = await supabase.from('casino_season_stats').select('*').eq('user_id', userId).eq('season_key', key).maybeSingle();
  if (season) {
    await supabase.from('casino_season_stats')
      .update({ wagered: Number(season.wagered) + wagered, won: Number(season.won) + won })
      .eq('user_id', userId).eq('season_key', key);
  } else {
    await supabase.from('casino_season_stats').insert({ user_id: userId, season_key: key, wagered, won });
  }
}

async function pushFeed(userId: string, gameSlug: string, amount: number, multiplier: number, pinned: boolean) {
  const { data: u } = await supabase.from('users').select('pseudo').eq('id', userId).maybeSingle();
  if (!u?.pseudo) return;
  await supabase.from('casino_feed').insert({
    user_id: userId, pseudo: u.pseudo, game_slug: gameSlug, amount, multiplier, pinned,
  });
}

/* ------------------------------------------------------------------ */
/* Settlement                                                          */
/* ------------------------------------------------------------------ */

export interface SettlementInput {
  amount: number;
  payout: number;
  multiplier: number;       // after bonuses
  baseMultiplier?: number;  // before bonuses — what the game actually rolled
  newBalance: number;
  effects?: EffectMap;
  /** Stake to fold into total_wagered here, instead of a separate round-trip. */
  wagered?: number;
}

export interface SettlementResult {
  newAchievements: { id: string; name: string; description: string; reward: number }[];
  jackpotWon: number | null;
  xpGained: number;
  level: number;
  levelsGained: number;
  levelReward: number;
  missionsCompleted: { id: string; label: string }[];
  streak: number;
  streakSaved: boolean;
}

const EMPTY_RESULT: SettlementResult = {
  newAchievements: [], jackpotWon: null, xpGained: 0, level: 1,
  levelsGained: 0, levelReward: 0, missionsCompleted: [], streak: 0, streakSaved: false,
};

export async function recordSettlement(userId: string, gameSlug: string, input: SettlementInput): Promise<SettlementResult> {
  const { data: wallet } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
  if (!wallet) return EMPTY_RESULT;

  const effects = input.effects ?? {};
  const base = input.baseMultiplier ?? input.multiplier;
  const isWin = base > 1;
  const isLoss = base === 0;

  /* ---- streak (a shield can absorb the reset) ---- */
  let streakSaved = false;
  let newStreak = Number(wallet.current_streak || 0);
  if (isWin) newStreak += 1;
  else if (isLoss) {
    if (effects.streak_shield) {
      streakSaved = true;
      await consumeEffects(userId, effects, ['streak_shield']);
    } else {
      newStreak = 0;
    }
  }
  const newBestStreak = Math.max(Number(wallet.best_streak || 0), newStreak);

  /* ---- XP (always, win or lose — that's the point) ---- */
  const xpMult = effects.xp_multiplier?.magnitude ?? 1;
  const xpGained = Math.round(xpForWager(input.amount) * xpMult);
  const newXp = Number(wallet.xp || 0) + xpGained;
  const before = levelFromXp(Number(wallet.xp || 0));
  const after = levelFromXp(newXp);
  const levelsGained = Math.max(0, after.level - before.level);

  let levelReward = 0;
  for (let l = before.level; l < after.level; l++) levelReward += levelUpReward(l);

  const newTotalWon = Number(wallet.total_won || 0) + (input.payout > 0 ? input.payout : 0);
  const newTotalWagered = Number(wallet.total_wagered || 0) + (input.wagered || 0);

  // Counters the achievement list reads. None of them can be reconstructed
  // from the totals, so they're tracked as they happen.
  const betsPlaced = Number(wallet.bets_placed || 0) + 1;
  const winsCount = Number(wallet.wins_count || 0) + (isWin ? 1 : 0);
  const gamesMask = Number(wallet.games_mask || 0) | (1 << gameBit(gameSlug));
  const biggestWin = Math.max(Number(wallet.biggest_win || 0), input.payout);
  const lossStreak = isLoss && !streakSaved ? Number(wallet.current_loss_streak || 0) + 1 : 0;
  const worstStreak = Math.max(Number(wallet.worst_streak || 0), lossStreak);
  const newBiggest = Math.max(Number(wallet.biggest_multiplier || 0), base);
  let balance = input.newBalance + levelReward;
  const newAllTimeBest = Math.max(Number(wallet.all_time_best_balance || 250), balance);

  const stats: WalletStats = {
    balance,
    totalWagered: newTotalWagered,
    totalWon: newTotalWon,
    currentStreak: newStreak,
    bestStreak: newBestStreak,
    prestigeCount: Number(wallet.prestige_count || 0),
    biggestMultiplier: newBiggest,
    level: after.level,
    dailyStreak: Number(wallet.daily_streak || 0),
    allTimeBestBalance: newAllTimeBest,
    betsPlaced,
    winsCount,
    gamesMask,
    distinctGames: countBits(gamesMask),
    cratesOpened: Number(wallet.crates_opened || 0),
    missionsDone: Number(wallet.missions_done || 0),
    jackpotsWon: Number(wallet.jackpots_won || 0),
    passTiersTotal: Number(wallet.pass_tiers_total || 0),
    biggestWin,
    worstStreak,
    cosmeticsOwned: 0,
    legendaryOwned: 0,
  };

  // Everything below touches a different table (or a different column set) and
  // was previously awaited one statement at a time — a dozen sequential
  // round-trips the player sat through before the animation could even start.
  const [missionsCompleted, newAchievements] = await Promise.all([
    supabase.from('casino_wallets').update({
      balance,
      current_streak: newStreak,
      best_streak: newBestStreak,
      total_won: newTotalWon,
      total_wagered: newTotalWagered,
      biggest_multiplier: newBiggest,
      all_time_best_balance: newAllTimeBest,
      xp: newXp,
      level: after.level,
    }).eq('user_id', userId),

    levelReward > 0
      ? supabase.from('casino_transactions').insert({
          user_id: userId, game_slug: 'casino', type: 'bonus',
          amount: levelReward, balance_after: balance, meta: { kind: 'level_up', level: after.level },
        })
      : null,

    bumpSeason(userId, input.wagered || 0, input.payout > 0 ? input.payout : 0),
    advanceMissions(userId, {
      gameSlug, amount: input.amount, payout: input.payout, won: isWin,
      baseMultiplier: base, newStreak,
    }),
    isWin && isFeedWorthy(input.payout, base)
      ? pushFeed(userId, gameSlug, input.payout, Math.round(base * 100) / 100, false)
      : null,
    checkAchievements(userId, stats),
  ]).then(([, , , missions, , achievements]) => [missions, achievements] as const);

  /* ---- progressive jackpot ---- */
  let jackpotWon: number | null = null;
  const { data: jackpot } = await supabase.from('casino_jackpot').select('*').eq('id', 1).maybeSingle();
  if (jackpot) {
    let pool = Number(jackpot.amount);
    if (isLoss) pool += Math.max(1, Math.round(input.amount * JACKPOT_CONTRIBUTION_RATE));

    const boost = effects.jackpot_boost?.magnitude ?? 1;
    if (boost > 1) await consumeEffects(userId, effects, ['jackpot_boost']);
    const hit = Math.random() < JACKPOT_HIT_CHANCE * boost;

    if (hit && pool > JACKPOT_SEED) {
      jackpotWon = pool;
      await supabase.from('casino_wallets')
        .update({ jackpots_won: Number(wallet.jackpots_won || 0) + 1 })
        .eq('user_id', userId);
      await supabase.from('casino_jackpot').update({
        amount: JACKPOT_SEED, last_winner_user_id: userId, last_won_amount: pool, last_won_at: new Date().toISOString(),
      }).eq('id', 1);

      const { data: fresh } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
      if (fresh) {
        balance = fresh.balance + pool;
        await supabase.from('casino_wallets').update({ balance }).eq('user_id', userId);
        await supabase.from('casino_transactions').insert({ user_id: userId, game_slug: gameSlug, type: 'jackpot', amount: pool, balance_after: balance });

        await pushFeed(userId, gameSlug, pool, 0, true);
      }
    } else {
      await supabase.from('casino_jackpot').update({ amount: pool }).eq('id', 1);
    }
  }

  return {
    newAchievements,
    jackpotWon,
    xpGained,
    level: after.level,
    levelsGained,
    levelReward,
    missionsCompleted: missionsCompleted.map((m) => ({ id: m.id, label: m.label })),
    streak: newStreak,
    streakSaved,
  };
}

/** Build the achievement view of a wallet row. */
export function statsFromWallet(wallet: any, overrides: Partial<WalletStats> = {}): WalletStats {
  const gamesMask = Number(wallet.games_mask || 0);
  return {
    balance: wallet.balance,
    totalWagered: Number(wallet.total_wagered || 0),
    totalWon: Number(wallet.total_won || 0),
    currentStreak: Number(wallet.current_streak || 0),
    bestStreak: Number(wallet.best_streak || 0),
    prestigeCount: Number(wallet.prestige_count || 0),
    biggestMultiplier: Number(wallet.biggest_multiplier || 0),
    level: Number(wallet.level || 1),
    dailyStreak: Number(wallet.daily_streak || 0),
    allTimeBestBalance: Number(wallet.all_time_best_balance || 0),
    betsPlaced: Number(wallet.bets_placed || 0),
    winsCount: Number(wallet.wins_count || 0),
    gamesMask,
    distinctGames: countBits(gamesMask),
    cratesOpened: Number(wallet.crates_opened || 0),
    missionsDone: Number(wallet.missions_done || 0),
    jackpotsWon: Number(wallet.jackpots_won || 0),
    passTiersTotal: Number(wallet.pass_tiers_total || 0),
    biggestWin: Number(wallet.biggest_win || 0),
    worstStreak: Number(wallet.worst_streak || 0),
    cosmeticsOwned: 0,
    legendaryOwned: 0,
    ...overrides,
  };
}

/**
 * Collection achievements need the inventory; everything else is already in
 * the wallet row. Filled in here so the caller doesn't pay for the query
 * when nothing collection-related can have changed.
 */
export async function withCollectionStats(userId: string, stats: WalletStats): Promise<WalletStats> {
  const { data: inv } = await supabase.from('casino_inventory').select('item_id').eq('user_id', userId);
  let owned = 0;
  let legendary = 0;
  for (const row of inv || []) {
    const c = cosmeticById(row.item_id);
    if (!c) continue;
    owned++;
    if (c.rarity === 'legendaire') legendary++;
  }
  return { ...stats, cosmeticsOwned: owned, legendaryOwned: legendary };
}

export async function checkAchievements(userId: string, stats: WalletStats): Promise<SettlementResult['newAchievements']> {
  const { data: unlocked } = await supabase.from('casino_achievements_unlocked').select('achievement_id').eq('user_id', userId);
  const unlockedIds = new Set((unlocked || []).map((u) => u.achievement_id));

  const newAchievements: SettlementResult['newAchievements'] = [];
  let coins = 0;
  let points = 0;

  for (const ach of ACHIEVEMENTS) {
    if (unlockedIds.has(ach.id) || !ach.check(stats)) continue;
    await supabase.from('casino_achievements_unlocked').insert({ user_id: userId, achievement_id: ach.id });
    newAchievements.push({ id: ach.id, name: ach.name, description: ach.description, reward: achievementReward(ach.points) });
    coins += achievementReward(ach.points);
    points += ach.points;
  }

  if (coins > 0) {
    const { data: w } = await supabase.from('casino_wallets').select('balance, achievement_points').eq('user_id', userId).maybeSingle();
    if (w) {
      const newBalance = w.balance + coins;
      await supabase.from('casino_wallets')
        .update({ balance: newBalance, achievement_points: Number(w.achievement_points || 0) + points })
        .eq('user_id', userId);
      await supabase.from('casino_transactions').insert({
        user_id: userId, game_slug: 'casino', type: 'bonus', amount: coins,
        balance_after: newBalance, meta: { kind: 'achievement', count: newAchievements.length },
      });
    }
  }

  return newAchievements;
}

/* ------------------------------------------------------------------ */
/* Mission helpers used by shop items                                  */
/* ------------------------------------------------------------------ */

/** Swap today's unclaimed missions for a fresh set. */
export async function rerollMissions(userId: string): Promise<MissionRow[]> {
  const day = dayKey();
  await ensureMissions(userId);
  // Seed with the clock so the new draw differs from the deterministic one.
  const picked = pickDailyMissions(`${userId}:${Date.now()}`, day);
  const { data: existing } = await supabase.from('casino_missions').select('*').eq('user_id', userId).eq('day_key', day);

  let i = 0;
  for (const row of existing || []) {
    if (row.claimed) continue;
    const def = picked[i++ % picked.length];
    await supabase.from('casino_missions')
      .update({ mission_id: def.id, progress: 0 })
      .eq('user_id', userId).eq('day_key', day).eq('slot', row.slot);
  }
  return ensureMissions(userId);
}

/** Instantly finish whichever mission is closest to done. */
export async function completeBestMission(userId: string): Promise<MissionRow | null> {
  const rows = await ensureMissions(userId);
  const open = rows.filter((r) => !r.claimed && !r.complete);
  if (open.length === 0) return null;

  open.sort((a, b) => b.value / b.def.target - a.value / a.def.target);
  const best = open[0];
  const progress = best.def.kind === 'distinct_games'
    ? (1 << best.def.target) - 1 // enough bits set to satisfy the target
    : best.def.target;

  await supabase.from('casino_missions').update({ progress })
    .eq('user_id', userId).eq('day_key', dayKey()).eq('slot', best.slot);
  return { ...best, progress, value: best.def.target, complete: true };
}
