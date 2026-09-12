'use client';

import { cn } from '@/lib/utils';
import {
  ASSET_BY_ID, SECTORS, formatPrice, liquidationPrice, positionValue, tradeFee,
} from '@/lib/krash/assets';
import type { KrashPosition } from '../_lib/useKrashPositions';

/** Gain or loss if the position were withdrawn now, fees included. */
export function livePnl(p: KrashPosition, price: number | null) {
  if (price === null) return null;
  const value = positionValue(p, price);
  const payout = value - Math.min(value, tradeFee(p.stake, p.leverage));
  return { value, payout, pnl: payout - p.stake - p.fee };
}

/**
 * One open position with its live result. The danger bar fills as the price
 * approaches the liquidation level, so a leveraged bet going wrong is felt
 * before it is lost.
 */
export default function PositionCard({
  position, price, busy, onClose, compact = false,
}: {
  position: KrashPosition;
  price: number | null;
  busy: boolean;
  onClose: () => void;
  compact?: boolean;
}) {
  const asset = ASSET_BY_ID.get(position.asset);
  const live = livePnl(position, price);
  const liq = liquidationPrice(position);
  const pct = live ? (live.pnl / position.stake) * 100 : 0;
  const winning = (live?.pnl ?? 0) >= 0;

  // 0 at entry, 1 at liquidation.
  let danger = 0;
  if (liq !== null && price !== null) {
    const span = liq - position.entry_price;
    danger = Math.min(1, Math.max(0, (price - position.entry_price) / span));
  }

  return (
    <div className={cn(
      'rounded-xl border-2 bg-brand-inner p-3 transition-colors',
      winning ? 'border-accent-success/40' : 'border-rose-500/50'
    )}>
      <div className="flex items-center gap-2">
        <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', asset ? SECTORS[asset.sector].dot : 'bg-tx-muted')} />
        <span className="font-display font-black">{position.asset}</span>
        {!compact && <span className="text-[11px] text-tx-muted truncate">{asset?.name}</span>}
        <span className={cn(
          'ml-auto shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-black',
          position.side === 'long' ? 'bg-accent-success/15 text-accent-success' : 'bg-rose-500/15 text-rose-400'
        )}>
          {position.side === 'long' ? '↑ ACHAT' : '↓ VENTE'} x{position.leverage}
        </span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-[11px] text-tx-muted leading-tight">
          <div>Mise {position.stake.toLocaleString('fr-FR')} ₶</div>
          <div className="tabular-nums">{formatPrice(position.entry_price)} → {price !== null ? formatPrice(price) : '…'}</div>
        </div>
        <div className="text-right">
          <div className={cn('font-display font-black text-xl tabular-nums leading-none', winning ? 'text-accent-success' : 'text-rose-400')}>
            {live ? `${live.pnl >= 0 ? '+' : '−'}${Math.abs(live.pnl).toLocaleString('fr-FR')} ₶` : '…'}
          </div>
          <div className={cn('text-[11px] font-bold tabular-nums', winning ? 'text-accent-success/80' : 'text-rose-400/80')}>
            {live ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)} % · frais inclus` : ''}
          </div>
        </div>
      </div>

      {liq !== null && (
        <div className="mt-2">
          <div className="h-1.5 rounded-full bg-brand-border overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', danger > 0.7 ? 'bg-rose-500 animate-pulse' : danger > 0.4 ? 'bg-orange-400' : 'bg-accent-success/60')}
              style={{ width: `${Math.max(3, danger * 100)}%` }}
            />
          </div>
          <div className="text-[10px] text-tx-muted mt-0.5">Liquidation à {formatPrice(liq)}</div>
        </div>
      )}

      <button
        onClick={onClose}
        disabled={busy || !live}
        className={cn(
          'mt-2.5 w-full h-10 rounded-lg border-2 font-display font-black text-xs tracking-wider transition-colors disabled:opacity-50',
          winning ? 'border-accent-success bg-accent-success text-brand-bg' : 'border-brand-border bg-brand-card text-tx-base hover:border-tx-base'
        )}
      >
        {busy ? '…' : `RETIRER ${live ? `${live.payout.toLocaleString('fr-FR')} ₶` : ''}`}
      </button>
    </div>
  );
}
