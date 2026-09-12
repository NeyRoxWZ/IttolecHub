'use client';

import { useState } from 'react';
import { Check, Flame, Gift, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { chestReward, KRASH_XP } from '@/lib/krash/progression';
import { useKrashProgression } from '../_lib/useKrashProgression';

const DAYS = 7;

/** Krash's daily chest, drawn like the casino's: seven cases, a streak, one button. */
export default function KrashChestModal({ onClose }: { onClose: () => void }) {
  const { progression: p, claimChest } = useKrashProgression();
  const [busy, setBusy] = useState(false);
  if (!p) return null;

  const streak = p.chest.streak;
  const next = p.chest.canClaim ? Math.min(DAYS, streak + 1) : streak;

  const open = async () => {
    if (busy || !p.chest.canClaim) return;
    setBusy(true);
    try { await claimChest(); } finally { setBusy(false); }
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
              <Gift className="h-5 w-5 text-accent-primary" /> Coffre Krash
            </h2>
            <p className="text-[11px] text-tx-muted mt-1">
              Une case par jour, la récompense grimpe avec la série. Un jour manqué et tu repars de la première.
            </p>
          </div>
          <button onClick={onClose} className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {Array.from({ length: DAYS }, (_, i) => {
            const day = i + 1;
            const done = day <= streak;
            const isNext = p.chest.canClaim && day === next;
            return (
              <div
                key={day}
                className={cn(
                  'relative rounded-xl border-2 p-2 flex flex-col items-center justify-center gap-1 min-h-[84px]',
                  day === DAYS && 'col-span-4 min-h-[92px]',
                  done ? 'border-accent-success bg-accent-success/10'
                    : isNext ? 'border-accent-primary bg-accent-primary/10 ring-2 ring-accent-primary/40'
                      : 'border-brand-border bg-brand-inner opacity-70'
                )}
              >
                <span className="text-[9px] font-black uppercase tracking-widest text-tx-muted">Jour {day}</span>
                <span className="font-display font-black text-sm tabular-nums">{chestReward(day).toLocaleString('fr-FR')} ₶</span>
                {done && <Check className="absolute top-1 right-1 h-3 w-3 text-accent-success" />}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mb-4 text-[11px] text-tx-muted">
          <Flame className={cn('h-3.5 w-3.5', streak > 0 ? 'text-accent-secondary' : 'text-tx-muted')} />
          <span>{streak > 0 ? `${streak} jour${streak > 1 ? 's' : ''} d'affilée` : 'Aucune série en cours'} · +{KRASH_XP.chest} XP de pass</span>
        </div>

        <button
          onClick={open}
          disabled={busy || !p.chest.canClaim}
          className={cn(
            'w-full h-14 rounded-2xl font-display font-black tracking-wider border-4 border-brand-border shadow-brutal transition-all focus:outline-none',
            !p.chest.canClaim
              ? 'bg-brand-inner text-tx-muted cursor-default shadow-none'
              : 'bg-accent-primary text-brand-bg hover:brightness-110 active:translate-y-1 active:shadow-none'
          )}
        >
          {busy ? '···' : p.chest.canClaim ? `OUVRIR LA CASE ${next} · +${p.chest.reward} ₶` : 'REVIENS DEMAIN'}
        </button>
      </div>
    </div>
  );
}
