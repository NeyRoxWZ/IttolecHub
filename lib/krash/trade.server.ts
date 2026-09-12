import { supabase } from '@/lib/supabase/server';
import {
  ASSET_BY_ID, KRASH_MAX_STAKE_PCT, KRASH_MIN_STAKE, LEVERAGES, LEVERAGE_UNLOCK,
  liquidationPrice, positionValue, tradeFee, type Leverage,
} from './assets';
import { firstCrossing, nowTick, priceAt } from './engine.server';

/**
 * Opening, closing and liquidating Krash positions.
 *
 * Money leaves the casino wallet when a position opens (stake + fee) and comes
 * back when it closes. The wallet moves through a single SQL statement that
 * refuses to go negative, and a position changes status through a guarded
 * update, so a double click can neither spend the same coins twice nor pay a
 * position out twice.
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

const seconds = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const iso = (t: number) => new Date(t * 1000).toISOString();

async function walletApply(userId: string, delta: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('krash_wallet_apply', { p_user: userId, p_delta: delta });
  if (error || data === null || data === undefined) return null;
  return Number(data);
}

async function ledger(userId: string, type: 'krash_open' | 'krash_close', amount: number, balanceAfter: number, meta: object) {
  await supabase.from('casino_transactions').insert({
    user_id: userId, game_slug: 'krash', type, amount, balance_after: balanceAfter, meta,
  });
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
  const [{ data: wallet }, trades] = await Promise.all([
    supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle(),
    tradesDone(userId),
  ]);
  if (!wallet) return { ok: false, status: 404, error: 'Portefeuille introuvable' };

  if (trades < LEVERAGE_UNLOCK[leverage]) {
    return { ok: false, status: 403, error: `Levier x${leverage} débloqué après ${LEVERAGE_UNLOCK[leverage]} trades` };
  }

  const fee = tradeFee(input.stake, leverage);
  const maxStake = Math.floor(Number(wallet.balance) * KRASH_MAX_STAKE_PCT);
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

  await ledger(userId, 'krash_open', -(input.stake + fee), balance, {
    asset: asset.id, side: input.side, leverage, stake: input.stake, fee, price,
  });

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
      await recordTrade(pos.user_id, -(pos.stake + pos.fee), pos.stake * pos.leverage, true);
      out.push(updated as PositionRow);
    } else {
      out.push({ ...pos, status: 'closed' });
    }
  }
  return out;
}

export async function closePosition(
  userId: string, positionId: string,
): Promise<Result<{ position: PositionRow; payout: number; pnl: number; balance: number | null }>> {
  const { data: row } = await supabase.from('krash_positions')
    .select('*').eq('id', positionId).eq('user_id', userId).maybeSingle();
  if (!row) return { ok: false, status: 404, error: 'Position introuvable' };

  const [pos] = await sweepLiquidations([row as PositionRow]);
  if (pos.status === 'liquidated') {
    return { ok: true, position: pos, payout: 0, pnl: -(pos.stake + pos.fee), balance: null };
  }
  if (pos.status !== 'open') return { ok: false, status: 409, error: 'Position déjà fermée' };

  const t = nowTick();
  const price = priceAt(pos.asset, t);
  const value = positionValue(pos, price);
  const closeFee = Math.min(value, tradeFee(pos.stake, pos.leverage));
  const payout = value - closeFee;

  const { data: closed } = await supabase.from('krash_positions').update({
    status: 'closed', exit_price: price, closed_at: iso(t), payout, checked_until: iso(t),
  }).eq('id', pos.id).eq('status', 'open').select().maybeSingle();
  if (!closed) return { ok: false, status: 409, error: 'Position déjà fermée' };

  const pnl = payout - pos.stake - pos.fee;
  const balance = payout > 0 ? await walletApply(userId, payout) : null;
  let finalBalance = balance;
  if (finalBalance === null) {
    const { data: w } = await supabase.from('casino_wallets').select('balance').eq('user_id', userId).maybeSingle();
    finalBalance = w ? Number(w.balance) : null;
  }

  await Promise.all([
    payout > 0 && finalBalance !== null
      ? ledger(userId, 'krash_close', payout, finalBalance, {
          asset: pos.asset, side: pos.side, leverage: pos.leverage, stake: pos.stake, price, pnl,
        })
      : Promise.resolve(),
    recordTrade(userId, pnl, pos.stake * pos.leverage, false),
  ]);

  return { ok: true, position: closed as PositionRow, payout, pnl, balance: finalBalance };
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
  };
}
