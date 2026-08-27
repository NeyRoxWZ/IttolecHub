'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Gift, Package, Check, Flame } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';
import { CHEST_LENGTH } from '@/lib/casino/events';
import { crateById } from '@/lib/casino/crates';

interface ChestDay {
  day: number;
  coins: number;
  crate: string | null;
}

interface ChestState {
  days: ChestDay[];
  day: number;
  claimedToday: boolean;
  broken: boolean;
  next: number;
}

export function useChest() {
  const { user } = useAuth();
  const [state, setState] = useState<ChestState | null>(null);

  const load = useCallback(async () => {
    const qs = user ? `?user_id=${user.id}` : '';
    const res = await fetch(`/api/casino/chest${qs}`);
    if (res.ok) setState(await res.json());
  }, [user]);

  useEffect(() => { void load(); }, [load]);
  return { state, reload: load };
}

/**
 * Seven cases, one a day. Missing a day sends you back to the first — which
 * is the whole mechanism: the run is worth more than any single case.
 */
export default function ChestModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { setBalance } = useCasinoWallet();
  const { state, reload } = useChest();
  const [busy, setBusy] = useState(false);

  if (!state) return null;

  const open = async () => {
    if (!user) { toast.error('Connecte-toi pour ouvrir le coffre.'); return; }
    if (busy || state.claimedToday) return;

    setBusy(true);
    vibrate(HAPTIC.MEDIUM);
    try {
      const res = await fetch('/api/casino/chest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur'); return; }

      sfx.bigWin();
      setBalance(data.newBalance);
      const crate = data.reward.crate ? crateById(data.reward.crate) : null;
      toast.success(`Jour ${data.day} du coffre`, {
        description: crate
          ? `${crate.name} ajoutée à ton inventaire`
          : `+${data.reward.coins.toLocaleString('en-US')} ₶`,
      });
      void reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-xl font-black flex items-center gap-2">
              <Gift className="h-5 w-5 text-accent-primary" /> Coffre d&apos;assiduité
            </h2>
            <p className="text-[11px] text-tx-muted mt-1">
              Une case par jour. Un jour manqué et tu repars de la première.
            </p>
          </div>
          <button onClick={onClose} className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        {state.broken && state.day === 0 && (
          <div className="rounded-xl border-2 border-accent-secondary bg-accent-secondary/10 p-3 mb-3 text-sm text-accent-secondary font-bold">
            Un jour a été sauté : le coffre repart de la première case.
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 mb-4">
          {state.days.map((d) => {
            const done = d.day <= state.day;
            const isNext = !state.claimedToday && d.day === state.next;
            const crate = d.crate ? crateById(d.crate) : null;

            return (
              <div
                key={d.day}
                className={cn(
                  'relative rounded-xl border-2 p-2 flex flex-col items-center justify-center gap-1 min-h-[84px]',
                  d.day === CHEST_LENGTH && 'col-span-4 min-h-[92px]',
                  done ? 'border-accent-success bg-accent-success/10'
                    : isNext ? 'border-accent-primary bg-accent-primary/10 ring-2 ring-accent-primary/40'
                    : 'border-brand-border bg-brand-inner opacity-70'
                )}
              >
                <span className="text-[9px] font-black uppercase tracking-widest text-tx-muted">
                  Jour {d.day}
                </span>

                {crate
                  ? <Package className="h-5 w-5 text-accent-primary" />
                  : <span className="font-display font-black text-sm tabular-nums">
                      {d.coins.toLocaleString('en-US')} ₶
                    </span>}

                {crate && (
                  <span className="text-[9px] font-bold text-tx-secondary text-center leading-tight">
                    {crate.name}
                  </span>
                )}

                {done && <Check className="absolute top-1 right-1 h-3 w-3 text-accent-success" />}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mb-4 text-[11px] text-tx-muted">
          <Flame className={cn('h-3.5 w-3.5', state.day > 0 ? 'text-accent-secondary' : 'text-tx-muted')} />
          <span>
            {state.day > 0
              ? `${state.day} jour${state.day > 1 ? 's' : ''} d'affilée`
              : 'Aucune série en cours'}
          </span>
        </div>

        <button
          onClick={open}
          disabled={busy || state.claimedToday}
          className={cn(
            'w-full h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border shadow-brutal transition-all focus:outline-none',
            state.claimedToday
              ? 'bg-brand-inner text-tx-muted cursor-default shadow-none'
              : 'bg-accent-primary text-brand-bg hover:brightness-110 active:translate-y-1 active:shadow-none'
          )}
        >
          {busy ? '···' : state.claimedToday ? 'REVIENS DEMAIN' : `OUVRIR LA CASE ${state.next}`}
        </button>
      </div>
    </div>
  );
}
