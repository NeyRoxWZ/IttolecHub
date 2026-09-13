import { supabase } from '@/lib/supabase/server';
import { streakBonus } from '@/lib/casino/progression';
import {
  ASSET_BY_ID, DURATIONS, KRASH_MAX_STAKE_PCT, KRASH_MIN_STAKE, KRASH_REFILL_AMOUNT, KRASH_REFILL_BELOW,
  LEVERAGES, LEVERAGE_UNLOCK, liquidationPrice, maxLeverageFor, positionValue, profitFee, type Leverage,
} from './assets';
import { firstCrossing, nowTick, priceAt, quantize, upcomingScheduled } from './engine.server';
import { KRASH_PASS_XP } from './pass';
import { advancePass, consumeEffect, krashBalanceOf, loadEffects, walletMove } from './meta.server';

/**
 * Opening, closing and liquidating Krash positions.
 *
 * Krash plays with its own wallet (krash_wallets), never the casino's. Money
 * leaves it when a position opens (the stake) and comes back when it closes.
 * The wallet moves through a single SQL statement that refuses to go negative,
 * and a position changes status through a guarded update, so a double click
 * can neither spend the same coins twice nor pay a position out twice.
 *
 * A timed trade closes by itself at its deadline, at the price of that exact
 * tick, whether or not its owner is still watching. The fee is taken on the
 * gain only. A win streak lifts the profit like the casino's streak does, and
 * shop items act here too.
 */

export interface PositionRow {
  id: string;
  user_id: string;
  asset: string;
  market: string;
  side: 'long' | 'short';
  leverage: number;
  stake: number;
  fee: number;
  entry_price: number;
  opened_at: string;
  checked_until: string;
  status: 'open' | 'closed' | 'liquidated';
  exit_price: number | null;
  closed_at: string | null;
  payout: number | null;
  duration: number | null;
  closes_at: string | null;
  perks?: { fee_free?: boolean };
  /** Set on a liquidation a parachute softened. */
  refund?: number;
}

export interface Settlement {
  position: PositionRow;
  payout: number;
  pnl: number;
  /** Result as a share of the stake, the number the reveal shows. */
  pct: number;
  bonus: number;
  refund: number;
  fee: number;
  streak: number;
  liquidated: boolean;
}

type Result<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };

/** How far back an unattended position is scanned for a liquidation. */
const MAX_SCAN_SECONDS = 14 * 86400;
const REFILL_COOLDOWN_MS = 86400_000;

const seconds = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const iso = (t: number) => new Date(t * 1000).toISOString();

/** The Krash balance, creating the wallet with its starting coins if needed. */
export const krashBalance = krashBalanceOf;

export interface WalletState {
  balance: number;
  canRefill: boolean;
  refillBlocked: 'positions' | 'cooldown' | null;
  nextRefillAt: string | null;
}

export async function walletState(userId: string): Promise<WalletState | null> {
  const balance = await krashBalanceOf(userId);
  if (balance === null) return null;

  const [{ data: wallet }, { count }] = await Promise.all([
    supabase.from('krash_wallets').select('last_refill_at').eq('user_id', userId).maybeSingle(),
    supabase.from('krash_positions').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'open'),
  ]);

  const last = wallet?.last_refill_at ? new Date(wallet.last_refill_at).getTime() : 0;
  const cooling = last > 0 && Date.now() - last < REFILL_COOLDOWN_MS;
  const low = balance < KRASH_REFILL_BELOW;
  const hasOpen = (count ?? 0) > 0;

  return {
    balance,
    canRefill: low && !hasOpen && !cooling,
    refillBlocked: !low ? null : hasOpen ? 'positions' : cooling ? 'cooldown' : null,
    nextRefillAt: cooling ? new Date(last + REFILL_COOLDOWN_MS).toISOString() : null,
  };
}

export async function refillWallet(userId: string): Promise<Result<{ balance: number }>> {
  const { data, error } = await supabase.rpc('krash_wallet_refill', {
    p_user: userId, p_below: KRASH_REFILL_BELOW, p_amount: KRASH_REFILL_AMOUNT,
  });
  if (error) return { ok: false, status: 500, error: 'Erreur interne' };
  if (data === null || data === undefined) {
    return { ok: false, status: 400, error: 'Renflouement indisponible pour le moment' };
  }
  return { ok: true, balance: Number(data) };
}

async function loadStats(userId: string) {
  const { data } = await supabase.from('krash_stats').select('trades, current_streak, best_streak').eq('user_id', userId).maybeSingle();
  return { trades: Number(data?.trades ?? 0), streak: Number(data?.current_streak ?? 0), best: Number(data?.best_streak ?? 0) };
}

/** Folds a finished trade into the totals, and moves the win streak. */
async function recordTrade(userId: string, pnl: number, volume: number, liquidated: boolean): Promise<number> {
  await supabase.rpc('krash_record_trade', { p_user: userId, p_pnl: pnl, p_volume: volume, p_liquidated: liquidated });
  const stats = await loadStats(userId);
  const streak = pnl > 0 ? stats.streak + 1 : 0;
  await supabase.from('krash_stats')
    .update({ current_streak: streak, best_streak: Math.max(stats.best, streak) })
    .eq('user_id', userId);
  return streak;
}

export async function tradesDone(userId: string): Promise<number> {
  return (await loadStats(userId)).trades;
}

export async function openPosition(
  userId: string,
  input: { asset: string; side: string; leverage: number; stake: number; duration?: number | null },
): Promise<Result<{ position: PositionRow; balance: number }>> {
  const asset = ASSET_BY_ID.get(input.asset);
  if (!userId) return { ok: false, status: 400, error: 'user_id requis' };
  if (!asset) return { ok: false, status: 400, error: 'Actif inconnu' };
  if (input.side !== 'long' && input.side !== 'short') return { ok: false, status: 400, error: 'Sens invalide' };
  if (!LEVERAGES.includes(input.leverage as Leverage)) return { ok: false, status: 400, error: 'Levier invalide' };
  if (!Number.isInteger(input.stake) || input.stake < KRASH_MIN_STAKE) {
    return { ok: false, status: 400, error: `Mise minimum : ${KRASH_MIN_STAKE} ₶` };
  }
  const duration = input.duration ?? null;
  if (duration !== null && !DURATIONS.includes(duration as (typeof DURATIONS)[number])) {
    return { ok: false, status: 400, error: 'Durée invalide' };
  }

  const leverage = input.leverage as Leverage;
  const announced = upcomingScheduled(nowTick())?.scheduled?.asset ?? null;
  const cap = maxLeverageFor(asset, announced);
  if (leverage > cap) {
    return {
      ok: false, status: 400,
      error: announced === asset.id
        ? `Levier max x${cap} sur ${asset.name} jusqu’à la révélation du résultat`
        : `Levier max x${cap} sur ${asset.name}`,
    };
  }
  const [current, stats, effects] = await Promise.all([krashBalanceOf(userId), loadStats(userId), loadEffects(userId)]);
  if (current === null) return { ok: false, status: 404, error: 'Portefeuille introuvable' };

  if (stats.trades < LEVERAGE_UNLOCK[leverage] && !effects.leverage_unlock) {
    return { ok: false, status: 403, error: `Levier x${leverage} débloqué après ${LEVERAGE_UNLOCK[leverage]} trades` };
  }

  const maxStake = Math.floor(current * (effects.max_stake?.magnitude ?? KRASH_MAX_STAKE_PCT));
  if (input.stake > maxStake) return { ok: false, status: 400, error: `Mise max : ${maxStake} ₶` };

  const t = nowTick();
  const price = priceAt(asset.id, t);
  const feeFree = !!effects.fee_free;

  const balance = await walletMove(userId, -input.stake, 'ouverture', { asset: asset.id, side: input.side, leverage, duration });
  if (balance === null) return { ok: false, status: 400, error: 'Solde insuffisant' };

  const { data: position, error } = await supabase.from('krash_positions').insert({
    user_id: userId,
    asset: asset.id,
    market: asset.market,
    side: input.side,
    leverage,
    stake: input.stake,
    fee: 0,
    entry_price: price,
    opened_at: iso(t),
    checked_until: iso(t),
    duration,
    closes_at: duration ? iso(t + duration) : null,
    perks: feeFree ? { fee_free: true } : {},
  }).select().single();

  if (error || !position) {
    const refunded = await walletMove(userId, input.stake, 'remboursement', { reason: 'ouverture échouée' });
    console.error('Ouverture Krash échouée:', error);
    return { ok: false, status: 500, error: refunded === null ? 'Erreur interne' : 'Erreur interne, mise remboursée' };
  }

  if (feeFree) await consumeEffect(userId, effects, 'fee_free');
  return { ok: true, position: position as PositionRow, balance };
}

/** Closes a position at `price`, tick `t`: fee on the gain, streak and items, pass XP. */
async function settle(pos: PositionRow, t: number, price: number): Promise<Settlement | null> {
  const value = positionValue(pos, price);
  const gross = value - pos.stake;
  const fee = pos.perks?.fee_free ? 0 : profitFee(gross, pos.stake, pos.leverage);
  let payout = value - fee;
  const basePnl = payout - pos.stake;

  const [effects, stats] = await Promise.all([loadEffects(pos.user_id), loadStats(pos.user_id)]);
  let bonus = 0;
  let refund = 0;
  if (basePnl > 0) {
    const lift = streakBonus(stats.streak) + (effects.profit_boost?.magnitude ?? 0);
    bonus = Math.floor(basePnl * lift);
    payout += bonus;
  } else if (basePnl < 0 && effects.loss_refund) {
    refund = Math.floor(-basePnl * effects.loss_refund.magnitude);
    payout += refund;
  }

  const { data: closed } = await supabase.from('krash_positions').update({
    status: 'closed', exit_price: price, closed_at: iso(t), payout, checked_until: iso(t),
  }).eq('id', pos.id).eq('status', 'open').select().maybeSingle();
  if (!closed) return null;

  const pnl = payout - pos.stake;
  const [, streak] = await Promise.all([
    payout > 0 ? walletMove(pos.user_id, payout, 'retrait', { asset: pos.asset, pnl, bonus, refund, fee }) : Promise.resolve(null),
    recordTrade(pos.user_id, pnl, pos.stake * pos.leverage, false),
    advancePass(pos.user_id, KRASH_PASS_XP.trade + (pnl > 0 ? KRASH_PASS_XP.win : 0), 'trade'),
    effects.profit_boost && basePnl > 0 ? consumeEffect(pos.user_id, effects, 'profit_boost') : Promise.resolve(),
    refund > 0 ? consumeEffect(pos.user_id, effects, 'loss_refund') : Promise.resolve(),
  ]);

  return {
    position: closed as PositionRow, payout, pnl, pct: (pnl / pos.stake) * 100,
    bonus, refund, fee, streak, liquidated: false,
  };
}

async function liquidate(pos: PositionRow, t: number, price: number): Promise<Settlement | null> {
  const { data: updated } = await supabase.from('krash_positions').update({
    status: 'liquidated', exit_price: price, closed_at: iso(t), payout: 0, checked_until: iso(t),
  }).eq('id', pos.id).eq('status', 'open').select().maybeSingle();
  if (!updated) return null;

  // A parachute gives part of the stake back.
  const effects = await loadEffects(pos.user_id);
  let refund = 0;
  if (effects.liquidation_shield) {
    refund = Math.floor(pos.stake * effects.liquidation_shield.magnitude);
    if (refund > 0) {
      await walletMove(pos.user_id, refund, 'parachute', { asset: pos.asset });
      await supabase.from('krash_positions').update({ payout: refund }).eq('id', pos.id);
    }
    await consumeEffect(pos.user_id, effects, 'liquidation_shield');
  }

  const pnl = refund - pos.stake;
  const [streak] = await Promise.all([
    recordTrade(pos.user_id, pnl, pos.stake * pos.leverage, true),
    // A liquidated trade still moves the pass: losing is part of playing.
    advancePass(pos.user_id, KRASH_PASS_XP.trade, 'trade'),
  ]);
  return {
    position: { ...(updated as PositionRow), payout: refund, refund },
    payout: refund, pnl, pct: (pnl / pos.stake) * 100, bonus: 0, refund, fee: 0, streak, liquidated: true,
  };
}

/**
 * Settles whatever the clock has decided since each position was last looked
 * at: a liquidation along the real price path, or the deadline of a timed
 * trade — whichever came first.
 */
export async function sweepPositions(positions: PositionRow[]): Promise<{ open: PositionRow[]; settled: Settlement[] }> {
  const now = nowTick();
  const open: PositionRow[] = [];
  const settled: Settlement[] = [];

  for (const pos of positions) {
    if (pos.status !== 'open') continue;

    const deadline = pos.closes_at ? quantize(seconds(pos.closes_at)) : null;
    const horizon = deadline !== null ? Math.min(now, deadline) : now;
    const liq = liquidationPrice(pos);
    const from = Math.max(seconds(pos.checked_until), now - MAX_SCAN_SECONDS);

    const hit = liq !== null && horizon > from
      ? firstCrossing(pos.asset, from, horizon, (p) => (pos.side === 'long' ? p <= liq : p >= liq))
      : null;

    if (hit) {
      const done = await liquidate(pos, hit.t, hit.p);
      if (done) settled.push(done);
      continue;
    }

    if (deadline !== null && now >= deadline) {
      const done = await settle(pos, deadline, priceAt(pos.asset, deadline));
      if (done) settled.push(done);
      continue;
    }

    // Only worth a write once the scanned stretch is long enough to matter.
    if (liq !== null && now - seconds(pos.checked_until) > 300) {
      await supabase.from('krash_positions').update({ checked_until: iso(now) }).eq('id', pos.id).eq('status', 'open');
    }
    open.push(pos);
  }
  return { open, settled };
}

export async function closePosition(userId: string, positionId: string): Promise<Result<Settlement & { balance: number | null }>> {
  const { data: row } = await supabase.from('krash_positions')
    .select('*').eq('id', positionId).eq('user_id', userId).maybeSingle();
  if (!row) return { ok: false, status: 404, error: 'Position introuvable' };
  if (row.status !== 'open') return { ok: false, status: 409, error: 'Position déjà fermée' };

  const { open, settled } = await sweepPositions([row as PositionRow]);
  if (settled.length) return { ok: true, ...settled[0], balance: await krashBalanceOf(userId) };
  if (!open.length) return { ok: false, status: 409, error: 'Position déjà fermée' };

  const t = nowTick();
  const done = await settle(open[0], t, priceAt(open[0].asset, t));
  if (!done) return { ok: false, status: 409, error: 'Position déjà fermée' };
  return { ok: true, ...done, balance: await krashBalanceOf(userId) };
}

export async function closeAll(userId: string): Promise<Result<{ closed: number; payout: number; pnl: number; balance: number | null }>> {
  const { data: rows } = await supabase.from('krash_positions')
    .select('id').eq('user_id', userId).eq('status', 'open');

  let closed = 0, payout = 0, pnl = 0;
  let balance: number | null = null;
  for (const r of rows || []) {
    const res = await closePosition(userId, r.id);
    if (!res.ok) continue;
    closed += 1;
    payout += res.payout;
    pnl += res.pnl;
    balance = res.balance;
  }
  return { ok: true, closed, payout, pnl, balance };
}

export async function loadPositions(userId: string) {
  const [{ data: open }, { data: recent }, { data: stats }] = await Promise.all([
    supabase.from('krash_positions').select('*').eq('user_id', userId).eq('status', 'open')
      .order('opened_at', { ascending: false }),
    supabase.from('krash_positions').select('*').eq('user_id', userId).neq('status', 'open')
      .order('closed_at', { ascending: false }).limit(20),
    supabase.from('krash_stats').select('*').eq('user_id', userId).maybeSingle(),
  ]);

  const swept = await sweepPositions((open || []) as PositionRow[]);
  const settledIds = new Set(swept.settled.map((s) => s.position.id));

  return {
    open: swept.open,
    recent: [...swept.settled.map((s) => s.position), ...((recent || []) as PositionRow[]).filter((p) => !settledIds.has(p.id))].slice(0, 20),
    /** Closed by the clock since the last look: the page reveals them. */
    settledNow: swept.settled,
    liquidatedNow: swept.settled.filter((s) => s.liquidated).map((s) => s.position),
    stats: stats ?? { trades: 0, wins: 0, liquidations: 0, realized_pnl: 0, volume: 0, best_trade: 0, current_streak: 0, best_streak: 0 },
    // After the sweep, so a liquidation that just freed the player shows up.
    wallet: await walletState(userId),
  };
}
