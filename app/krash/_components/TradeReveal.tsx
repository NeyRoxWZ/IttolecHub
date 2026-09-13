'use client';

import { useEffect, useState } from 'react';
import { Flame, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { streakLabel } from '@/lib/casino/progression';
import { ASSET_BY_ID } from '@/lib/krash/assets';
import Confetti from '@/app/casino/_components/Confetti';
import type { KrashSettlement } from '../_lib/useKrashPositions';
import { KRASH_BIG_WIN_EVENT } from './KrashSkin';

/**
 * The moment a timed trade ends: the result counts up from zero to its final
 * percentage, then lands with a colour, a sound and — past +100 % — confetti.
 * The casino's reveal, on a price.
 */
export default function TradeReveal({ settlement, onClose }: { settlement: KrashSettlement; onClose: () => void }) {
  const { position, pct, pnl, payout, bonus, refund, streak, liquidated } = settlement;
  const asset = ASSET_BY_ID.get(position.asset);
  const [shown, setShown] = useState(0);
  const [landed, setLanded] = useState(false);
  const win = pnl > 0;
  const huge = pct >= 100;

  useEffect(() => {
    const duration = Math.min(1600, 500 + Math.abs(pct) * 6);
    const start = performance.now();
    let raf = 0;
    let lastTick = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(pct * eased);
      if (now - lastTick > 70 && t < 1) { lastTick = now; sfx.tick(); }
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        setLanded(true);
        if (liquidated) { sfx.bust(); vibrate(HAPTIC.MEDIUM); }
        else if (huge) { sfx.jackpot(); vibrate(HAPTIC.SUCCESS); window.dispatchEvent(new Event(KRASH_BIG_WIN_EVENT)); }
        else if (pct >= 20) { sfx.bigWin(); vibrate(HAPTIC.SUCCESS); }
        else if (win) sfx.cashout();
        else sfx.lose();
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [pct, win, huge, liquidated]);

  const label = streakLabel(streak);

  return (
    <div className="fixed inset-0 z-[240] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={landed ? onClose : undefined}>
      {landed && huge && <Confetti trigger={1} intensity="huge" />}
      {landed && (
        <div
          className={cn(
            'pointer-events-none fixed inset-0 animate-out fade-out fill-mode-forwards duration-700',
            win ? 'bg-accent-success/35' : 'bg-rose-500/35'
          )}
        />
      )}
      <div
        className={cn(
          'w-full max-w-sm rounded-[28px] border-4 p-6 text-center shadow-brutal bg-brand-card transition-colors duration-300 animate-in zoom-in-90 duration-300',
          !landed ? 'border-brand-border' : win ? 'border-accent-success' : 'border-rose-500'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[11px] font-black uppercase tracking-widest text-tx-muted">
          {liquidated ? 'Liquidé' : 'Résultat'} · {asset?.name ?? position.asset} · {position.side === 'long' ? '↑ monte' : '↓ baisse'} x{position.leverage}
        </div>

        <div className={cn(
          'font-display font-black tabular-nums leading-none mt-4 transition-colors',
          huge && landed ? 'text-7xl' : 'text-6xl',
          !landed ? 'text-tx-base' : win ? 'text-accent-success' : 'text-rose-400',
          landed && huge && 'animate-bounce'
        )}>
          {shown >= 0 ? '+' : ''}{shown.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %
        </div>

        <div className={cn('mt-3 flex items-center justify-center gap-2 font-display font-black text-xl tabular-nums transition-opacity', landed ? 'opacity-100' : 'opacity-0')}>
          {win ? <TrendingUp className="h-5 w-5 text-accent-success" /> : <TrendingDown className="h-5 w-5 text-rose-400" />}
          <span className={win ? 'text-accent-success' : 'text-rose-400'}>{pnl >= 0 ? '+' : '−'}{Math.abs(pnl).toLocaleString('fr-FR')} ₶</span>
        </div>

        <div className={cn('mt-3 space-y-1 text-[12px] transition-opacity', landed ? 'opacity-100' : 'opacity-0')}>
          <div className="text-tx-muted">Mise {position.stake.toLocaleString('fr-FR')} ₶ → retour {payout.toLocaleString('fr-FR')} ₶</div>
          {bonus > 0 && <div className="font-bold text-accent-primary">dont +{bonus.toLocaleString('fr-FR')} ₶ de bonus</div>}
          {refund > 0 && <div className="font-bold text-sky-300">+{refund.toLocaleString('fr-FR')} ₶ remboursés par ton objet</div>}
          {win && streak >= 2 && (
            <div className="inline-flex items-center gap-1 rounded-full border-2 border-orange-400 bg-orange-400/10 px-2.5 py-0.5 font-black text-orange-300">
              <Flame className="h-3.5 w-3.5" /> Série de {streak}{label ? ` · ${label}` : ''}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          disabled={!landed}
          className={cn(
            'mt-5 w-full h-12 rounded-xl border-2 border-brand-border font-display font-black tracking-wider disabled:opacity-40',
            win ? 'bg-accent-success text-brand-bg' : 'bg-brand-inner text-tx-base'
          )}
        >
          {win ? 'ENCORE !' : 'REVANCHE'}
        </button>
      </div>
    </div>
  );
}
