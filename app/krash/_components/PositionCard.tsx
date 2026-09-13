'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import {
  ASSET_BY_ID, SECTORS, formatPrice, liquidationPrice, positionValue, profitFee,
} from '@/lib/krash/assets';
import type { KrashPosition } from '../_lib/useKrashPositions';
import { serverNow } from '../_lib/useKrashMarket';

/** Gain or loss if the position were withdrawn now; the fee only ever touches a gain. */
export function livePnl(p: KrashPosition, price: number | null) {
  if (price === null) return null;
  const value = positionValue(p, price);
  const fee = p.perks?.fee_free ? 0 : profitFee(value - p.stake, p.stake, p.leverage);
  const payout = value - fee;
  const pnl = payout - p.stake;
  return { value, payout, pnl, fee, pct: (pnl / p.stake) * 100, grossPct: ((value - p.stake) / p.stake) * 100 };
}

/**
 * One open position with its live result, in percent first: "+18,4 %" reads
 * as a result, "+2 ₶" does not. A timed trade counts down to its reveal; the
 * danger bar fills as the price approaches liquidation.
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
  const winning = (live?.pnl ?? 0) >= 0;

  const deadline = position.closes_at ? Date.parse(position.closes_at) / 1000 : null;
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  const left = deadline ? Math.max(0, deadline - now) : null;

  // 0 at entry, 1 at liquidation.
  let danger = 0;
  if (liq !== null && price !== null) {
    danger = Math.min(1, Math.max(0, (price - position.entry_price) / (liq - position.entry_price)));
  }

  // A ping when the trade turns green, a low tone when it turns red, a tick in
  // the last seconds of a timed trade, a warning near liquidation.
  const hasLive = live !== null;
  const wasWinning = useRef<boolean | null>(null);
  const lastWarning = useRef(0);
  const lastSecond = useRef<number | null>(null);
  useEffect(() => {
    if (!hasLive) return;
    if (wasWinning.current !== null && wasWinning.current !== winning) {
      if (winning) sfx.coin(); else sfx.tick();
    }
    wasWinning.current = winning;
  }, [winning, hasLive]);
  useEffect(() => {
    if (danger > 0.75 && Date.now() - lastWarning.current > 8000) {
      lastWarning.current = Date.now();
      sfx.step(0);
    }
  }, [danger]);
  useEffect(() => {
    if (left === null) return;
    const s = Math.ceil(left);
    if (s <= 5 && s > 0 && lastSecond.current !== s) { lastSecond.current = s; sfx.tick(); }
  }, [left]);

  const pctText = live ? `${live.pct >= 0 ? '+' : ''}${live.pct.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %` : '…';

  return (
    <div className={cn(
      'rounded-xl border-2 bg-brand-inner p-3 transition-colors duration-300',
      winning ? 'border-accent-success/50' : 'border-rose-500/60'
    )}>
      <div className="flex items-center gap-2">
        <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', asset ? SECTORS[asset.sector].dot : 'bg-tx-muted')} />
        <span className="font-display font-black">{position.asset}</span>
        {!compact && <span className="text-[11px] text-tx-muted truncate">{asset?.name}</span>}
        <span className={cn(
          'ml-auto shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-black',
          position.side === 'long' ? 'bg-accent-success/15 text-accent-success' : 'bg-rose-500/15 text-rose-400'
        )}>
          {position.side === 'long' ? '↑ MONTE' : '↓ BAISSE'} x{position.leverage}
        </span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-[11px] text-tx-muted leading-tight">
          <div>Mise {position.stake.toLocaleString('fr-FR')} ₶</div>
          <div className="tabular-nums">{formatPrice(position.entry_price)} → {price !== null ? formatPrice(price) : '…'}</div>
          {live && <div className={cn('font-bold tabular-nums', winning ? 'text-accent-success' : 'text-rose-400')}>{live.pnl >= 0 ? '+' : '−'}{Math.abs(live.pnl).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ₶</div>}
          {/* A small gain can vanish into the fee: show what the price did anyway. */}
          {live && live.fee > 0 && <div className="tabular-nums">cote +{live.grossPct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %, frais {live.fee.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ₶</div>}
        </div>
        <div className={cn(
          'font-display font-black text-3xl tabular-nums leading-none transition-colors duration-200',
          winning ? 'text-accent-success' : 'text-rose-400'
        )}>
          {pctText}
        </div>
      </div>

      {left !== null && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="flex items-center gap-1 text-accent-primary"><Timer className="h-3 w-3" /> Résultat dans</span>
            <span className={cn('tabular-nums text-sm', left <= 5 ? 'text-rose-400 animate-pulse' : 'text-tx-base')}>{Math.ceil(left)} s</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-brand-border overflow-hidden">
            <div
              className="h-full rounded-full bg-accent-primary transition-all duration-300 ease-linear"
              style={{ width: `${position.duration ? (left / position.duration) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

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
        {busy ? '…' : `${left !== null ? 'RETIRER MAINTENANT' : 'RETIRER'} ${live ? `${live.payout.toLocaleString('fr-FR')} ₶` : ''}`}
      </button>
    </div>
  );
}
