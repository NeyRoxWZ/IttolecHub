'use client';

import { useEffect, useState } from 'react';
import { Package, Backpack, Zap, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ShopItem } from '@/lib/casino/shop';
import type { CrateDef } from '@/lib/casino/crates';

export interface ActiveEffect {
  effect: string;
  magnitude: number;
  uses_left: number | null;
  expires_at: string | null;
}

export interface InventoryState {
  items: (ShopItem & { quantity: number })[];
  crates: (CrateDef & { quantity: number })[];
  effects: Record<string, ActiveEffect>;
}

const EFFECT_LABEL: Record<string, string> = {
  loss_refund: 'Remboursement sur défaite',
  streak_shield: 'Bouclier de série',
  win_bonus: 'Bonus de gain',
  jackpot_boost: 'Chances de jackpot',
  xp_multiplier: 'XP multipliée',
  max_bet_pct: 'Plafond de mise',
  cashback_boost: 'Cashback doublé',
};

/** How the magnitude should read for each effect. */
function magnitudeLabel(effect: string, magnitude: number): string {
  switch (effect) {
    case 'loss_refund': return `${Math.round(magnitude * 100)}% de la mise`;
    case 'win_bonus': return `+${Math.round(magnitude * 100)}%`;
    case 'jackpot_boost': return `×${magnitude}`;
    case 'xp_multiplier': return `×${magnitude}`;
    case 'max_bet_pct': return `${Math.round(magnitude * 100)}% du solde`;
    default: return '';
  }
}

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function remainingLabel(effect: ActiveEffect, now: number): string {
  if (effect.expires_at) {
    const left = Math.max(0, new Date(effect.expires_at).getTime() - now);
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    return m > 0 ? `${m} min ${String(s).padStart(2, '0')}s` : `${s}s`;
  }
  if (effect.uses_left !== null) return `${effect.uses_left} mise${effect.uses_left > 1 ? 's' : ''}`;
  return 'Actif';
}

/**
 * The inventory and the running effects, side by side. Before this, an item
 * fired the moment it was bought and nothing on screen said when it would run
 * out — you could not tell whether your insurance was still covering you.
 */
export default function InventoryPanel({
  state, busy, onUse, compact,
}: {
  state: InventoryState;
  busy: string | null;
  onUse: (itemId: string, name: string, quantity?: number) => void;
  compact?: boolean;
}) {
  const now = useNow();
  const [batch, setBatch] = useState<Record<string, number>>({});
  const activeEntries = Object.values(state.effects || {});
  const isEmpty = state.items.length === 0 && state.crates.length === 0 && activeEntries.length === 0;

  return (
    <div className="rounded-2xl border-4 border-brand-border bg-brand-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Backpack className="h-4 w-4 text-accent-primary" />
        <h2 className="font-display font-black text-sm">Inventaire</h2>
        <span className="text-[11px] text-tx-muted">Un objet ne s&apos;active que quand tu l&apos;utilises.</span>
      </div>

      {isEmpty && (
        <p className="text-sm text-tx-secondary">
          Rien en stock. Les objets achetés et ceux du Frenly Pass atterrissent ici.
        </p>
      )}

      {activeEntries.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted mb-2 flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-accent-success" /> En cours
          </div>
          <div className="flex flex-wrap gap-2">
            {activeEntries.map((e) => (
              <div key={e.effect} className="rounded-xl border-2 border-accent-success bg-accent-success/10 px-3 py-2">
                <div className="font-display font-black text-[11px] leading-tight">
                  {EFFECT_LABEL[e.effect] || e.effect}
                </div>
                <div className="text-[10px] text-tx-secondary tabular-nums">
                  {magnitudeLabel(e.effect, e.magnitude)}
                  {magnitudeLabel(e.effect, e.magnitude) && ' · '}
                  reste {remainingLabel(e, now)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5')}>
        {state.crates.map((crate) => {
          const count = Math.min(crate.quantity, batch[crate.id] || 1);
          return (
            <div key={crate.id} className="relative rounded-xl border-2 border-accent-primary bg-accent-primary/10 p-3 flex flex-col gap-2">
              <div>
                <Package className="h-4 w-4 text-accent-primary mb-1" />
                <div className="font-display font-black text-[11px] leading-tight pr-6">{crate.name}</div>
              </div>
              <span className="absolute top-1.5 right-2 text-[11px] font-black tabular-nums text-tx-muted">×{crate.quantity}</span>

              {crate.quantity > 1 && (
                <div className="flex items-center h-7 rounded-lg border-2 border-brand-border bg-brand-inner self-start">
                  <button
                    onClick={() => setBatch((b) => ({ ...b, [crate.id]: Math.max(1, count - 1) }))}
                    className="h-full w-6 flex items-center justify-center text-tx-secondary hover:text-tx-base focus:outline-none"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center font-display font-black text-[11px] tabular-nums">{count}</span>
                  <button
                    onClick={() => setBatch((b) => ({ ...b, [crate.id]: Math.min(crate.quantity, count + 1) }))}
                    className="h-full w-6 flex items-center justify-center text-tx-secondary hover:text-tx-base focus:outline-none"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              )}

              <button
                onClick={() => onUse(crate.id, crate.name, count)}
                disabled={busy !== null}
                className="mt-auto h-8 rounded-lg border-2 border-accent-primary bg-accent-primary text-brand-bg font-black text-[10px] tracking-widest focus:outline-none disabled:opacity-50"
              >
                {busy === crate.id ? '···' : count > 1 ? `OUVRIR ×${count}` : 'OUVRIR'}
              </button>
            </div>
          );
        })}

        {state.items.map((item) => (
          <button
            key={item.id}
            onClick={() => onUse(item.id, item.name)}
            disabled={busy !== null}
            className="relative rounded-xl border-2 border-brand-border bg-brand-inner p-3 text-left hover:border-accent-primary hover:-translate-y-0.5 transition-all focus:outline-none disabled:opacity-50"
          >
            <div className="font-display font-black text-[11px] leading-tight mb-0.5 pr-6">{item.name}</div>
            <div className="text-[10px] text-tx-muted leading-tight line-clamp-2">{item.description}</div>
            <div className="text-[10px] font-black text-accent-primary mt-1">
              {busy === item.id ? '···' : 'UTILISER'}
            </div>
            <span className="absolute top-1.5 right-2 text-[11px] font-black tabular-nums text-tx-muted">×{item.quantity}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
