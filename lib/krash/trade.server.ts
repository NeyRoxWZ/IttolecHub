import { supabase } from '@/lib/supabase/server';
import {
  ASSET_BY_ID, KRASH_MAX_STAKE_PCT, KRASH_MIN_STAKE, KRASH_REFILL_AMOUNT, KRASH_REFILL_BELOW, dividendFor,
  LEVERAGES, LEVERAGE_UNLOCK, liquidationPrice, positionValue, tradeFee, type Leverage,
} from './assets';
import { firstCrossing, nowTick, priceAt } from './engine.server';
import { KRASH_XP } from './progression';
import { addXp } from './progression.server';

/**
 * Opening, closing and liquidating Krash positions.
 *
 * Krash plays with its own wallet (krash_wallets), never the casino's: the
 * coins share a name, not a balance. Money leaves it when a position opens
 * (stake + fee) and comes back when it closes. The wallet moves through a
 * single SQL statement that refuses to go negative, and a position changes
 * status through a guarded update, so a double click can neither spend the
 * same coins twice nor pay a position out twice.
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
}

type Result<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };

/** How far back an unattended position is scanned for a liquidation. */
const MAX_SCAN_SECONDS = 14 * 86400;
const REFILL_COOLDOWN_MS = 86400_000;

const seconds = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const iso = (t: number) => new Date(t * 1000).toISOString();

async function walletApply(userId: string, delta: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('krash_wallet_apply', { p_user: userId, p_delta: delta });
  if (error || data === null || data === undefined) return null;
  return Number(data);
}

/** The Krash balance, creating the wallet with its starting coins if needed. */
export async function krashBalance(userId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('krash_wallet_get', { p_user: userId });
  if (error || data === null || data === undefined) return null;
  return Number(data);
}

export interface WalletState {
  balance: number;
  /** When a refill is possible right now. */
  canRefill: boolean;
  /** Why not, when the balance is low but no refill is available. */
  refillBlocked: 'positions' | 'cooldown' | null;
  nextRefillAt: string | null;
}

export async function walletState(userId: string): Promise<WalletState | null> {
  const balance = await krashBalance(userId);
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

async function recordTrade(userId: string, pnl: number, volume: number, liquidated: boolean) {
  await supabase.rpc('krash_record_trade', {
    p_user: userId, p_pnl: pnl, p_volume: volume, p_liquidated: liquidated,
  });
}

export async function tradesDone(userId: string): Promise<number> {
  const { data } = await supabase.from('krash_stats').select('trades').eq('user_id', userId).maybeSingle();
  return Number(data?.trades ?? 0);
}

export async function openPosition(
  userId: string,
  input: { asset: string; side: string; leverage: number; stake: number },
): Promise<Result<{ position: PositionRow; balance: number }>> {
  const asset = ASSET_BY_ID.get(input.asset);
  if (!userId) return { ok: false, status: 400, error: 'user_id requis' };
  if (!asset) return { ok: false, status: 400, error: 'Actif inconnu' };
  if (input.side !== 'long' && input.side !== 'short') return { ok: false, status: 400, error: 'Sens invalide' };
  if (!LEVERAGES.includes(input.leverage as Leverage)) return { ok: false, status: 400, error: 'Levier invalide' };
  if (!Number.isInteger(input.stake) || input.stake < KRASH_MIN_STAKE) {
    return { ok: false, status: 400, error: `Mise minimum : ${KRASH_MIN_STAKE} ₶` };
  }

  const leverage = input.leverage as Leverage;
  const [current, trades] = await Promise.all([krashBalance(userId), tradesDone(userId)]);
  if (current === null) return { ok: false, status: 404, error: 'Portefeuille introuvable' };

  if (trades < LEVERAGE_UNLOCK[leverage]) {
    return { ok: false, status: 403, error: `Levier x${leverage} débloqué après ${LEVERAGE_UNLOCK[leverage]} trades` };
  }

  const fee = tradeFee(input.stake, leverage);
  const maxStake = Math.floor(current * KRASH_MAX_STAKE_PCT);
  if (input.stake > maxStake) return { ok: false, status: 400, error: `Mise max : ${maxStake} ₶` };

  const t = nowTick();
  const price = priceAt(asset.id, t);

  const balance = await walletApply(userId, -(input.stake + fee));
  if (balance === null) return { ok: false, status: 400, error: 'Solde insuffisant' };

  const { data: position, error } = await supabase.from('krash_positions').insert({
    user_id: userId,
    asset: asset.id,
    market: asset.market,
    side: input.side,
    leverage,
    stake: input.stake,
    fee,
    entry_price: price,
    opened_at: iso(t),
    checked_until: iso(t),
  }).select().single();

  if (error || !position) {
    const refunded = await walletApply(userId, input.stake + fee);
    console.error('Ouverture Krash échouée:', error);
    return { ok: false, status: 500, error: refunded === null ? 'Erreur interne' : 'Erreur interne, mise remboursée' };
  }

  return { ok: true, position: position as PositionRow, balance };
}

/**
 * Liquidates any open position whose price path crossed its liquidation level
 * since it was last checked — including while its owner was away.
 */
export async function sweepLiquidations(positions: PositionRow[]): Promise<PositionRow[]> {
  const now = nowTick();
  const out: PositionRow[] = [];

  for (const pos of positions) {
    if (pos.status !== 'open') { out.push(pos); continue; }

    const liq = liquidationPrice(pos);
    const from = Math.max(seconds(pos.checked_until), now - MAX_SCAN_SECONDS);
    if (liq === null || now <= from) { out.push(pos); continue; }

    const hit = firstCrossing(pos.asset, from, now, (p) => (pos.side === 'long' ? p <= liq : p >= liq));

    if (!hit) {
      // Only worth a write once the scanned stretch is long enough to matter.
      if (now - seconds(pos.checked_until) > 300) {
        await supabase.from('krash_positions').update({ checked_until: iso(now) })
          .eq('id', pos.id).eq('status', 'open');
      }
      out.push(pos);
      continue;
    }

    const { data: updated } = await supabase.from('krash_positions').update({
      status: 'liquidated', exit_price: hit.p, closed_at: iso(hit.t), payout: 0, checked_until: iso(hit.t),
    }).eq('id', pos.id).eq('status', 'open').select().maybeSingle();

    if (updated) {
      await Promise.all([
        recordTrade(pos.user_id, -(pos.stake + pos.fee), pos.stake * pos.leverage, true),
        // A liquidated trade still moves the pass: losing is part of playing.
        addXp(pos.user_id, KRASH_XP.trade),
      ]);
      out.push(updated as PositionRow);
    } else {
      out.push({ ...pos, status: 'closed' });
    }
  }
  return out;
}

export async function closePosition(
  userId: string, positionId: string,
): Promise<Result<{ position: PositionRow; payout: number; pnl: number; dividend: number; balance: number | null }>> {
  const { data: row } = await supabase.from('krash_positions')
    .select('*').eq('id', positionId).eq('user_id', userId).maybeSingle();
  if (!row) return { ok: false, status: 404, error: 'Position introuvable' };

  const [pos] = await sweepLiquidations([row as PositionRow]);
  if (pos.status === 'liquidated') {
    return { ok: true, position: pos, payout: 0, pnl: -(pos.stake + pos.fee), dividend: 0, balance: await krashBalance(userId) };
  }
  if (pos.status !== 'open') return { ok: false, status: 409, error: 'Position déjà fermée' };

  const t = nowTick();
  const price = priceAt(pos.asset, t);
  const value = positionValue(pos, price);
  const closeFee = Math.min(value, tradeFee(pos.stake, pos.leverage));
  // Long company positions earn a dividend for the time they were held.
  const dividend = value > 0 ? dividendFor(pos, t) : 0;
  const payout = value - closeFee + dividend;

  const { data: closed } = await supabase.from('krash_positions').update({
    status: 'closed', exit_price: price, closed_at: iso(t), payout, checked_until: iso(t),
  }).eq('id', pos.id).eq('status', 'open').select().maybeSingle();
  if (!closed) return { ok: false, status: 409, error: 'Position déjà fermée' };

  const pnl = payout - pos.stake - pos.fee;
  const [credited] = await Promise.all([
    payout > 0 ? walletApply(userId, payout) : Promise.resolve(null),
    recordTrade(userId, pnl, pos.stake * pos.leverage, false),
    addXp(userId, KRASH_XP.trade + (pnl > 0 ? KRASH_XP.win : 0)),
  ]);
  const balance = credited ?? await krashBalance(userId);

  return { ok: true, position: closed as PositionRow, payout, pnl, dividend, balance };
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
    if (res.balance !== null) balance = res.balance;
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

  const swept = await sweepLiquidations((open || []) as PositionRow[]);
  const liquidatedNow = swept.filter((p) => p.status === 'liquidated');

  return {
    open: swept.filter((p) => p.status === 'open'),
    recent: [...liquidatedNow, ...((recent || []) as PositionRow[])].slice(0, 20),
    liquidatedNow,
    stats: stats ?? { trades: 0, wins: 0, liquidations: 0, realized_pnl: 0, volume: 0, best_trade: 0 },
    // After the sweep, so a liquidation that just freed the player shows up.
    wallet: await walletState(userId),
  };
}
