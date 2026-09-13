import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { ACHIEVEMENTS } from '@/lib/casino/meta';
import { COSMETICS, cosmeticById, GAME_LABELS } from '@/lib/casino/cosmetics';

/**
 * Everything the profile shows, computed on the server.
 *
 * The profile used to fetch casino numbers it never rendered, and printed
 * hard-coded zeroes for ItollecClicker. Both blocks are now read from where
 * the truth lives — the wallet row and ledger for the casino, the cloud save
 * for the clicker — and arrive already aggregated, so the page only displays.
 */

// Generated once per instance: both lists are built by loops, not stored.
const CASINO_GAMES_TOTAL = 20;

/** Rows that are not a game of their own: meta movements and duels. */
const NOT_A_GAME = new Set(['casino', 'duel']);

function countBits(n: number): number {
  let c = 0;
  let v = n >>> 0;
  while (v) { c += v & 1; v >>>= 1; }
  return c;
}

async function casinoStats(userId: string) {
  const { data: w, error } = await supabase.from('casino_wallets').select('*').eq('user_id', userId).maybeSingle();
  // A failed read must not look like a player with no games: the page would
  // say "no games yet" to someone with hundreds.
  if (error) throw error;
  if (!w) return null;

  const [ledger, unlocked, inventory, duels, challenge, podiums, syndicates, giftsSent, giftsReceived] = await Promise.all([
    supabase.from('casino_transactions')
      .select('game_slug, type, amount, meta')
      .eq('user_id', userId).in('type', ['bet', 'win', 'push'])
      .order('created_at', { ascending: false }).limit(10000),
    supabase.from('casino_achievements_unlocked').select('achievement_id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('casino_inventory').select('item_id').eq('user_id', userId),
    supabase.from('casino_duels').select('challenger_id, opponent_id, winner_id, amount')
      .eq('status', 'done').or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`),
    supabase.from('casino_challenge').select('bankroll, finished, busted').eq('user_id', userId),
    supabase.from('casino_transactions').select('amount', { count: 'exact', head: true })
      .eq('user_id', userId).eq('type', 'bonus').eq('meta->>kind', 'challenge_prize'),
    supabase.from('casino_syndicate_members').select('contribution, payout').eq('user_id', userId),
    supabase.from('casino_gifts').select('amount, cost').eq('from_user_id', userId),
    supabase.from('casino_gifts').select('amount').eq('to_user_id', userId),
  ]);

  // Per game. A multi-step game writes its stake and its cash-out as two
  // rows; only the stake counts as a play, the cash-out still counts as a win.
  const perGame = new Map<string, { plays: number; wins: number; net: number }>();
  for (const r of ledger.data || []) {
    if (NOT_A_GAME.has(r.game_slug)) continue;
    const g = perGame.get(r.game_slug) || { plays: 0, wins: 0, net: 0 };
    const isCashout = r.type === 'win' && (r.meta as any)?.roundId;
    if (!isCashout) g.plays += 1;
    if (r.type === 'win') g.wins += 1;
    g.net += Number(r.amount);
    perGame.set(r.game_slug, g);
  }
  const games = Array.from(perGame.entries())
    .map(([slug, g]) => ({
      slug,
      label: GAME_LABELS[slug] || slug,
      plays: g.plays,
      winRate: g.plays > 0 ? Math.min(1, g.wins / g.plays) : 0,
      net: Math.round(g.net),
    }))
    .sort((a, b) => b.plays - a.plays);

  const byNet = [...games].sort((a, b) => b.net - a.net);

  // The wallet's play, win and games-tried counters were zeroed by past data
  // resets while the ledger kept every row, so the profile showed "0 bets,
  // 0 %" for players with hundreds. Whichever is larger wins: the ledger read
  // is capped at 10 000 rows, so for heavy players an intact counter is the
  // more complete of the two.
  let ledgerPlays = 0;
  let ledgerWins = 0;
  perGame.forEach((g) => { ledgerPlays += g.plays; ledgerWins += g.wins; });

  let duelWins = 0, duelLosses = 0, duelDraws = 0;
  for (const d of duels.data || []) {
    if (!d.winner_id) duelDraws += 1;
    else if (d.winner_id === userId) duelWins += 1;
    else duelLosses += 1;
  }

  const runs = challenge.data || [];
  const finishedRuns = runs.filter((r) => r.finished && !r.busted);

  const syn = syndicates.data || [];
  const synIn = syn.reduce((s, m) => s + Number(m.contribution || 0), 0);
  const synOut = syn.reduce((s, m) => s + Number(m.payout || 0), 0);

  const owned = new Set((inventory.data || []).map((r) => r.item_id));
  const cosmeticsOwned = Array.from(owned).filter((id) => cosmeticById(id)).length;

  const betsPlaced = Math.max(Number(w.bets_placed || 0), ledgerPlays);
  const winsCount = Math.max(Number(w.wins_count || 0), ledgerWins);
  const wagered = Number(w.total_wagered || 0);
  const won = Number(w.total_won || 0);

  return {
    balance: Number(w.balance || 0),
    bestBalance: Number(w.all_time_best_balance || 0),
    wagered,
    won,
    /** Payouts minus stakes: what the bets themselves gave back overall. */
    betNet: won - wagered,
    betsPlaced,
    winsCount,
    winRate: betsPlaced > 0 ? winsCount / betsPlaced : 0,
    biggestWin: Number(w.biggest_win || 0),
    biggestMultiplier: Number(w.biggest_multiplier || 0),
    bestStreak: Number(w.best_streak || 0),
    worstStreak: Number(w.worst_streak || 0),
    gamesTried: Math.max(countBits(Number(w.games_mask || 0)), perGame.size),
    gamesTotal: CASINO_GAMES_TOTAL,
    jackpots: Number(w.jackpots_won || 0),

    prestige: Number(w.prestige_count || 0),
    passTiersTotal: Number(w.pass_tiers_total || 0),
    missionsDone: Number(w.missions_done || 0),
    cratesOpened: Number(w.crates_opened || 0),
    dailyStreak: Number(w.daily_streak || 0),
    chestDay: Number(w.chest_day || 0),
    achievements: unlocked.count || 0,
    achievementsTotal: ACHIEVEMENTS.length,
    cosmetics: cosmeticsOwned,
    cosmeticsTotal: COSMETICS.length,

    games,
    favouriteGame: games[0] ?? null,
    bestGame: byNet[0] && byNet[0].net > 0 ? byNet[0] : null,
    worstGame: byNet.length && byNet[byNet.length - 1].net < 0 ? byNet[byNet.length - 1] : null,

    duels: { wins: duelWins, losses: duelLosses, draws: duelDraws },
    challenge: {
      runs: runs.length,
      best: finishedRuns.length ? Math.max(...finishedRuns.map((r) => Number(r.bankroll))) : 0,
      podiums: podiums.count || 0,
    },
    syndicates: { runs: syn.length, net: synOut - synIn },
    gifts: {
      sent: (giftsSent.data || []).reduce((s, g) => s + Number(g.amount), 0),
      sentCount: (giftsSent.data || []).length,
      received: (giftsReceived.data || []).reduce((s, g) => s + Number(g.amount), 0),
      receivedCount: (giftsReceived.data || []).length,
    },
  };
}

export async function GET(request: Request) {
  try {
    const userId = new URL(request.url).searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id requis' }, { status: 400 });

    const casino = await casinoStats(userId);
    return NextResponse.json({ casino });
  } catch (err) {
    console.error('Erreur GET stats profil:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
