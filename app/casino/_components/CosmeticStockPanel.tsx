'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Boxes, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

/** Only the catalogue owner needs to know when it's time to write more. */
/**
 * Keyed on the account id, not the pseudo: this panel vanished the day the
 * owner renamed themselves, and a gate that breaks on a rename is not a gate.
 */
const OWNER_IDS = ['080a255a-12df-4307-a660-f5e8dfe74468'];

interface SeasonRow {
  season: number;
  count: number;
  live: boolean;
  past: boolean;
  preview: string[];
}

interface Stock {
  total: number;
  perGame: number;
  general: number;
  pass: number;
  crate: number;
  prestige: number;
  currentSeason: number;
  seasonsRemaining: number;
  exhausted: boolean;
  seasons: SeasonRow[];
}

/**
 * The runway on the cosmetic catalogue: which season is live, how many are
 * still written, and a warning when the last one is in sight. Without it the
 * pass would quietly start repeating itself.
 */
export default function CosmeticStockPanel() {
  const { user } = useAuth();
  const [stock, setStock] = useState<Stock | null>(null);

  const isOwner = !!user && OWNER_IDS.includes(user.id);

  useEffect(() => {
    if (!isOwner) return;
    fetch('/api/casino/cosmetics/stock')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setStock(d); })
      .catch(() => {});
  }, [isOwner]);

  if (!isOwner || !stock) return null;

  const low = stock.seasonsRemaining <= 2;

  return (
    <div className={cn(
      'rounded-2xl border-4 p-4 mb-3',
      low ? 'border-accent-secondary bg-accent-secondary/10' : 'border-brand-border bg-brand-card'
    )}>
      <div className="flex items-center gap-2 mb-2">
        {low ? <AlertTriangle className="h-4 w-4 text-accent-secondary" /> : <Boxes className="h-4 w-4 text-accent-primary" />}
        <h2 className="font-display font-black text-sm">Stock de cosmétiques</h2>
        <span className="text-[11px] text-tx-muted">visible uniquement pour toi</span>
      </div>

      <p className={cn('text-sm leading-snug mb-3', low ? 'text-accent-secondary font-bold' : 'text-tx-secondary')}>
        {stock.exhausted
          ? 'Dernière saison écrite : le passe rejoue ce catalogue tant que de nouvelles ne sont pas créées.'
          : low
            ? `Plus que ${stock.seasonsRemaining} saison${stock.seasonsRemaining > 1 ? 's' : ''} d'avance — il faut en écrire de nouvelles.`
            : `Saison ${stock.currentSeason} en cours, ${stock.seasonsRemaining} saisons d'avance.`}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {[
          { label: 'Total', value: stock.total },
          { label: 'Passe', value: stock.pass },
          { label: 'Caisses', value: stock.crate },
          { label: 'Prestige', value: stock.prestige },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border-2 border-brand-border bg-brand-inner p-2.5">
            <div className="text-[9px] font-black uppercase tracking-widest text-tx-muted">{s.label}</div>
            <div className="font-display font-black text-lg tabular-nums">{s.value.toLocaleString('en-US')}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {stock.seasons.map((s) => (
          <span
            key={s.season}
            title={s.preview.join(' · ')}
            className={cn(
              'h-8 px-2.5 rounded-lg border-2 flex items-center gap-1.5 text-[11px] font-black',
              s.live ? 'border-accent-primary bg-accent-primary text-brand-bg'
                : s.past ? 'border-brand-border bg-brand-inner text-tx-muted'
                : 'border-accent-success/60 bg-accent-success/10 text-accent-success'
            )}
          >
            {s.past && <Check className="h-3 w-3" />}
            S{s.season}
            <span className="opacity-70">{s.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
