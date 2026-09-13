'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Lock, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import {
  DURATIONS, KRASH_FEE_RATE, KRASH_MAX_STAKE_PCT, KRASH_MIN_STAKE, LEVERAGES, LEVERAGE_UNLOCK,
  durationLabel, formatPrice, liquidationPrice, type Asset, type Leverage,
} from '@/lib/krash/assets';

const TICKET_KEY = 'krash_ticket_v2';

/**
 * The ticket: how long, how much, how hard, and two big buttons.
 *
 * A timed trade (30 s, 1 min, 5 min) closes by itself and reveals its result,
 * the casino's loop on a price; "Libre" keeps a position open until withdrawn.
 * Defaults are set so the first trade already moves: 10 % of the balance, x2.
 */
export default function TradePanel({
  asset, price, balance, trades, busy, onOpen, maxLeverage = 50, capReason,
}: {
  asset: Asset;
  price: number | null;
  balance: number;
  trades: number;
  busy: boolean;
  onOpen: (side: 'long' | 'short', leverage: Leverage, stake: number, duration: number | null) => Promise<boolean>;
  /** Highest leverage this asset allows right now. */
  maxLeverage?: number;
  /** Why the cap is lower than usual, when it is. */
  capReason?: string | null;
}) {
  const maxStake = Math.max(0, Math.floor(balance * KRASH_MAX_STAKE_PCT));
  const [stakeText, setStakeText] = useState<string | null>(null);
  const [leverage, setLeverage] = useState<Leverage>(2);
  const [duration, setDuration] = useState<number | null>(60);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TICKET_KEY) || 'null');
      if (saved?.stake) setStakeText(String(saved.stake));
      if (LEVERAGES.includes(saved?.leverage)) setLeverage(saved.leverage);
      if (saved && 'duration' in saved) setDuration(saved.duration);
    } catch {}
  }, []);

  // Until the player types an amount, the stake follows 10 % of the balance.
  const defaultStake = Math.max(KRASH_MIN_STAKE, Math.floor(balance * 0.1));
  const stake = Math.floor(Number(stakeText ?? defaultStake) || 0);

  const locked = (l: Leverage) => trades < LEVERAGE_UNLOCK[l];
  const capped = (l: Leverage) => l > maxLeverage;
  const effectiveLeverage = (capped(leverage) ? LEVERAGES.filter((l) => l <= maxLeverage).pop() : leverage) as Leverage;
  const valid = stake >= KRASH_MIN_STAKE && stake <= maxStake && !locked(effectiveLeverage) && price !== null;
  const liqLong = price ? liquidationPrice({ side: 'long', leverage: effectiveLeverage, entry_price: price }) : null;

  const submit = async (side: 'long' | 'short') => {
    if (!valid) return;
    try { localStorage.setItem(TICKET_KEY, JSON.stringify({ stake: stakeText ? stake : null, leverage: effectiveLeverage, duration })); } catch {}
    await onOpen(side, effectiveLeverage, stake, duration);
  };

  return (
    <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-4 shadow-brutal">
      <div className="flex items-center gap-1.5 mb-1 text-[10px] font-black uppercase tracking-widest text-tx-muted"><Timer className="h-3.5 w-3.5" /> Durée</div>
      <div className="grid grid-cols-4 gap-1.5">
        {[...DURATIONS, null].map((d) => (
          <button
            key={String(d)}
            onClick={() => { sfx.select(); setDuration(d); }}
            className={cn(
              'h-10 rounded-xl border-2 font-display font-black text-[12px]',
              duration === d ? 'border-accent-primary bg-accent-primary/15 text-accent-primary' : 'border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base'
            )}
          >
            {d === null ? 'Libre' : durationLabel(d)}
          </button>
        ))}
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-3 mb-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Mise</span>
        <span className="text-[10px] text-tx-muted">Max {maxStake.toLocaleString('fr-FR')} ₶</span>
      </div>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <input
            inputMode="numeric"
            value={stakeText ?? String(defaultStake)}
            onChange={(e) => setStakeText(e.target.value.replace(/[^\d]/g, ''))}
            className="w-full h-11 rounded-xl border-2 border-brand-border bg-brand-inner pl-3 pr-7 font-display font-black text-lg tabular-nums focus:outline-none focus:border-rose-400"
            aria-label="Mise"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-black text-tx-muted">₶</span>
        </div>
        {[0.1, 0.25, 0.5].map((share) => (
          <button
            key={share}
            onClick={() => { sfx.click(); setStakeText(String(Math.max(KRASH_MIN_STAKE, Math.floor(balance * share)))); }}
            className="h-11 px-2 rounded-xl border-2 border-brand-border bg-brand-inner text-[11px] font-black text-tx-secondary hover:text-tx-base hover:border-tx-base"
          >
            {share === 0.5 ? 'MAX' : `${Math.round(share * 100)} %`}
          </button>
        ))}
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-3 mb-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-tx-muted">Levier</span>
        {capReason && <span className="text-[10px] font-bold text-accent-primary">{capReason}</span>}
      </div>
      <div className="grid grid-cols-6 gap-1">
        {LEVERAGES.map((l) => {
          const isLocked = locked(l);
          const isCapped = capped(l);
          const off = isLocked || isCapped;
          return (
            <button
              key={l}
              disabled={off}
              onClick={() => { sfx.select(); setLeverage(l); }}
              title={isLocked ? `Débloqué après ${LEVERAGE_UNLOCK[l]} trades` : isCapped ? `Levier max x${maxLeverage} ici` : undefined}
              className={cn(
                'h-10 rounded-lg border-2 font-display font-black text-[12px] flex items-center justify-center gap-0.5',
                effectiveLeverage === l && !off ? 'border-rose-400 bg-rose-400/15 text-rose-300' : 'border-brand-border bg-brand-inner text-tx-secondary',
                off ? 'opacity-35 cursor-not-allowed' : 'hover:text-tx-base'
              )}
            >
              {isLocked && <Lock className="h-2.5 w-2.5" />}x{l}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-tx-muted">
        {effectiveLeverage === 1
          ? 'Sans levier : ta mise suit exactement la cote.'
          : <>x{effectiveLeverage} : 1 % de mouvement = <b className="text-tx-base">{effectiveLeverage} %</b> sur ta mise. Perdue si la cote va {(100 / effectiveLeverage).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % contre toi.</>}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          disabled={!valid || busy}
          onClick={() => submit('long')}
          className="h-[76px] rounded-2xl bg-accent-success text-brand-bg border-2 border-brand-border shadow-brutal font-display font-black tracking-wider flex flex-col items-center justify-center disabled:opacity-40 active:translate-y-0.5 transition-transform"
        >
          <span className="flex items-center gap-1 text-xl"><ArrowUp className="h-6 w-6" /> ÇA MONTE</span>
          <span className="text-[10px] tracking-normal font-bold opacity-80">{duration ? `résultat dans ${durationLabel(duration)}` : 'position libre'}</span>
        </button>
        <button
          disabled={!valid || busy}
          onClick={() => submit('short')}
          className="h-[76px] rounded-2xl bg-rose-500 text-white border-2 border-brand-border shadow-brutal font-display font-black tracking-wider flex flex-col items-center justify-center disabled:opacity-40 active:translate-y-0.5 transition-transform"
        >
          <span className="flex items-center gap-1 text-xl"><ArrowDown className="h-6 w-6" /> ÇA BAISSE</span>
          <span className="text-[10px] tracking-normal font-bold opacity-90">{duration ? `résultat dans ${durationLabel(duration)}` : 'position libre'}</span>
        </button>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        <span className="text-tx-muted">Si {asset.name} bouge de 10 %</span>
        <span className="text-right font-bold tabular-nums">± {Math.round(stake * effectiveLeverage * 0.1).toLocaleString('fr-FR')} ₶</span>
        <span className="text-tx-muted">Frais</span>
        <span className="text-right font-bold">{(KRASH_FEE_RATE * effectiveLeverage * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % de la mise, sur le gain seulement</span>
        {effectiveLeverage > 1 && liqLong && (
          <>
            <span className="text-tx-muted">Liquidation (monte)</span>
            <span className="text-right font-bold tabular-nums text-rose-400">{formatPrice(liqLong)}</span>
          </>
        )}
      </div>
      {stake > maxStake && <p className="mt-2 text-[11px] text-rose-400">Au-dessus du maximum ({maxStake.toLocaleString('fr-FR')} ₶).</p>}
    </section>
  );
}
