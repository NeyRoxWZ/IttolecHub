import { supabase } from '@/lib/supabase/server';

/**
 * The Monday recap.
 *
 * Everything here is read back out of the ledger rather than accumulated in a
 * table: a weekly summary that needs its own counters is a weekly summary that
 * silently drifts, and there is no scheduled job to keep one honest.
 */

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date = new Date()): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

export interface Recap {
  from: string;
  to: string;
  bets: number;
  wagered: number;
  won: number;
  net: number;
  biggestWin: number;
  biggestMultiplier: number;
  favouriteGame: string | null;
  favouriteGamePlays: number;
  bestDay: string | null;
  bestDayNet: number;
  /** Where they sat on net profit among everyone who played that week. */
  rank: number | null;
  players: number;
}

/** `offset` 0 is the week just gone, 1 the one before it. */
export async function weeklyRecap(userId: string, offset = 1): Promise<Recap> {
  const to = weekStart();
  to.setUTCDate(to.getUTCDate() - 7 * (offset - 1));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 7);

  const { data: rows } = await supabase.from('casino_transactions')
    .select('amount, type, game_slug, created_at, meta')
    .eq('user_id', userId)
    .gte('created_at', from.toISOString())
    .lt('created_at', to.toISOString())
    .in('type', ['bet', 'win', 'push'])
    .limit(5000);

  const list = rows || [];
  let bets = 0, wagered = 0, won = 0, biggestWin = 0, biggestMultiplier = 0;
  const plays = new Map<string, number>();
  const byDay = new Map<string, number>();

  for (const r of list) {
    const amount = Number(r.amount);
    const stake = Number(r.meta?.amount ?? 0);
    const mult = Number(r.meta?.multiplier ?? 0);

    if (r.type === 'bet' || r.type === 'push' || r.type === 'win') {
      bets += 1;
      // The stake is on the meta; older rows without it fall back to the
      // absolute move, which is right for a plain loss.
      wagered += stake || (amount < 0 ? -amount : 0);
      plays.set(r.game_slug, (plays.get(r.game_slug) || 0) + 1);
    }
    if (amount > 0) { won += amount; biggestWin = Math.max(biggestWin, amount); }
    if (mult > biggestMultiplier) biggestMultiplier = mult;

    const day = String(r.created_at).slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + amount);
  }

  const net = list.reduce((sum, r) => sum + Number(r.amount), 0);

  let favouriteGame: string | null = null;
  let favouriteGamePlays = 0;
  plays.forEach((n, g) => { if (n > favouriteGamePlays) { favouriteGame = g; favouriteGamePlays = n; } });

  let bestDay: string | null = null;
  let bestDayNet = 0;
  byDay.forEach((v, d) => { if (bestDay === null || v > bestDayNet) { bestDay = d; bestDayNet = v; } });

  const { rank, players } = await weekRank(userId, from, to);

  return {
    from: from.toISOString(), to: to.toISOString(),
    bets, wagered, won, net, biggestWin,
    biggestMultiplier: Math.round(biggestMultiplier * 100) / 100,
    favouriteGame, favouriteGamePlays,
    bestDay, bestDayNet,
    rank, players,
  };
}

/**
 * Where this player finished on net profit that week.
 *
 * Read from the same ledger as the rest — approximate by design, since only
 * the last few thousand rows are scanned, but it is a bragging number rather
 * than an accounting one.
 */
async function weekRank(userId: string, from: Date, to: Date) {
  const { data } = await supabase.from('casino_transactions')
    .select('user_id, amount')
    .gte('created_at', from.toISOString())
    .lt('created_at', to.toISOString())
    .in('type', ['bet', 'win', 'push'])
    .limit(20000);

  const nets = new Map<string, number>();
  for (const r of data || []) nets.set(r.user_id, (nets.get(r.user_id) || 0) + Number(r.amount));
  if (!nets.has(userId)) return { rank: null, players: nets.size };

  const sorted = Array.from(nets.entries()).sort((a, b) => b[1] - a[1]);
  return {
    rank: sorted.findIndex(([id]) => id === userId) + 1,
    players: sorted.length,
  };
}
