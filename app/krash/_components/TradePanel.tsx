'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import {
  KRASH_MAX_STAKE_PCT, KRASH_MIN_STAKE, LEVERAGES, LEVERAGE_UNLOCK,
  formatPrice, liquidationPrice, tradeFee, type Asset, type Leverage,
} from '@/lib/krash/assets';

/**
 * Stake, leverage, and the two buttons. Leverage explains itself in plain
 * words right under the choice, because "x10" means nothing until you read
 * that a 10 % move the wrong way wipes the stake.
 */
export default function TradePanel({
  asset, price, balance, trades, busy, onOpen,
}: {
  asset: Asset;
  price: number | null;
  balance: number;
  trades: number;
  busy: boolean;
  onOpen: (side: 'long' | 'short', leverage: Leverage, stake: number) => Promise<boolean>;
}) {
  const maxStake = Math.max(0, Math.floor(balance * KRASH_MAX_STAKE_PCT));
  const [stakeText, setStakeText] = useState('100');
  const [leverage, setLeverage] = useState<Leverage>(1);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('krash_ticket') || 'null');
      if (saved?.stake) setStakeText(String(saved.stake));
      if (LEVERAGES.includes(saved?.leverage)) setLeverage(saved.leverage);
    } catch {}
  }, []);

  const stake = Math.floor(Number(stakeText) || 0);
  const locked = (l: Leverage) => trades < LEVERAGE_UNLOCK[l];
  const valid = stake >= KRASH_MIN_STAKE && stake <= maxStake && !locked(leverage) && price !== null;
  const fee = stake > 0 ? tradeFee(stake, leverage) : 0;
  const onePct = Math.round(stake * leverage * 0.01);

  const submit = async (side: 'long' | 'short') => {
    if (!valid) return;
    try { localStorage.setItem('krash_ticket', JSON.stringify({ stake, leverage })); } catch {}
    await onOpen(side, leverage, stake);
  };

  const liqLong = price ? liquidationPrice({ side: 'long', leverage, entry_price: price }) : null;
  const liqShort = price ? liquidationPrice({ side: 'short', leverage, entry_price: price }) : null;

  return (
    <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-4 shadow-brutal">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="font-display font-black tracking-wider uppercase">Placer</h2>
        <span className="text-[11px] text-tx-muted">Max {maxStake.toLocaleString('fr-FR')} ₶ (50 % du solde)</span>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            inputMode="numeric"
            value={stakeText}
            onChange={(e) => setStakeText(e.target.value.replace(/[^\d]/g, ''))}
            className="w-full h-12 rounded-xl border-2 border-brand-border bg-brand-inner pl-3 pr-8 font-display font-black text-lg tabular-nums focus:outline-none focus:border-rose-400"
            aria-label="Mise"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-black text-tx-muted">₶</span>
        </div>
        {[0.1, 0.25, 1].map((share) => (
          <button
            key={share}
            onClick={() => { sfx.click(); setStakeText(String(Math.max(KRASH_MIN_STAKE, Math.floor(maxStake * (share === 1 ? 1 : share * 2))))); }}
            className="h-12 px-2.5 rounded-xl border-2 border-brand-border bg-brand-inner text-[11px] font-black text-tx-secondary hover:text-tx-base hover:border-tx-base"
          >
            {share === 1 ? 'MAX' : `${Math.round(share * 100)} %`}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {LEVERAGES.map((l) => {
          const isLocked = locked(l);
          return (
            <button
              key={l}
              disabled={isLocked}
              onClick={() => { sfx.select(); setLeverage(l); }}
              title={isLocked ? `Débloqué après ${LEVERAGE_UNLOCK[l]} trades` : undefined}
              className={cn(
                'h-11 rounded-xl border-2 font-display font-black flex items-center justify-center gap-1 transition-colors',
                leverage === l && !isLocked ? 'border-rose-400 bg-rose-400/15 text-rose-300' : 'border-brand-border bg-brand-inner text-tx-secondary',
                isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:text-tx-base'
              )}
            >
              {isLocked && <Lock className="h-3 w-3" />}x{l}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-tx-muted min-h-[30px]">
        {leverage === 1
          ? 'Sans levier : ta mise suit exactement la cote.'
          : <>Levier x{leverage} : chaque 1 % de mouvement = <b className="text-tx-base">{leverage} %</b> sur ta mise. Si la cote va {Math.round(100 / leverage)} % contre toi, tu perds la mise.</>}
        {LEVERAGES.some(locked) && (
          <span className="block">
            {LEVERAGES.filter(locked).map((l) => `x${l} après ${LEVERAGE_UNLOCK[l]} trades`).join(' · ')} (tu en as {trades}).
          </span>
        )}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          disabled={!valid || busy}
          onClick={() => submit('long')}
          className="h-[68px] rounded-xl bg-accent-success text-brand-bg border-2 border-brand-border shadow-brutal font-display font-black tracking-wider flex flex-col items-center justify-center disabled:opacity-40 active:translate-y-0.5 transition-transform"
        >
          <span className="flex items-center gap-1 text-lg"><ArrowUp className="h-5 w-5" /> ACHETER</span>
          <span className="text-[10px] tracking-normal font-bold opacity-80">je parie que ça monte</span>
        </button>
        <button
          disabled={!valid || busy}
          onClick={() => submit('short')}
          className="h-[68px] rounded-xl bg-rose-500 text-white border-2 border-brand-border shadow-brutal font-display font-black tracking-wider flex flex-col items-center justify-center disabled:opacity-40 active:translate-y-0.5 transition-transform"
        >
          <span className="flex items-center gap-1 text-lg"><ArrowDown className="h-5 w-5" /> VENDRE</span>
          <span className="text-[10px] tracking-normal font-bold opacity-90">je parie que ça baisse</span>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <span className="text-tx-muted">Frais d’ouverture</span>
        <span className="text-right font-bold tabular-nums">{fee.toLocaleString('fr-FR')} ₶</span>
        <span className="text-tx-muted">Si {asset.name} bouge de 1 %</span>
        <span className="text-right font-bold tabular-nums">± {onePct.toLocaleString('fr-FR')} ₶</span>
        {leverage > 1 && liqLong && (
          <>
            <span className="text-tx-muted">Liquidation (achat)</span>
            <span className="text-right font-bold tabular-nums text-rose-400">{formatPrice(liqLong)}</span>
          </>
        )}
        {liqShort && (
          <>
            <span className="text-tx-muted">Liquidation (vente)</span>
            <span className="text-right font-bold tabular-nums text-rose-400">{formatPrice(liqShort)}</span>
          </>
        )}
      </div>
      {stake > 0 && stake < KRASH_MIN_STAKE && <p className="mt-2 text-[11px] text-rose-400">Mise minimum : {KRASH_MIN_STAKE} ₶</p>}
      {stake > maxStake && <p className="mt-2 text-[11px] text-rose-400">Au-dessus du maximum ({maxStake.toLocaleString('fr-FR')} ₶).</p>}
    </section>
  );
}
