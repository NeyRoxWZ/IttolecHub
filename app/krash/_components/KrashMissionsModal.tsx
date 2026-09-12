'use client';

import { useState } from 'react';
import { Check, Target, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KRASH_XP } from '@/lib/krash/progression';
import { useKrashProgression } from '../_lib/useKrashProgression';

/** Krash's three daily missions, in the casino's missions modal frame. */
export default function KrashMissionsModal({ onClose }: { onClose: () => void }) {
  const { progression: p, claimMission } = useKrashProgression();
  const [busy, setBusy] = useState<string | null>(null);
  if (!p) return null;

  const claim = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try { await claimMission(id); } finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[88dvh] overflow-y-auto bg-brand-card border-4 border-brand-border rounded-[28px] p-6 shadow-brutal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-xl font-black flex items-center gap-2">
              <Target className="h-5 w-5 text-accent-primary" /> Missions Krash
            </h2>
            <p className="text-[11px] text-tx-muted mt-1">
              Trois missions par jour, les mêmes pour tout le monde. Comptent les trades fermés aujourd’hui.
            </p>
          </div>
          <button onClick={onClose} className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base focus:outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          {p.missions.map((m) => (
            <div
              key={m.id}
              className={cn(
                'rounded-xl border-2 p-3',
                m.claimed ? 'border-brand-border bg-brand-inner opacity-60'
                  : m.done ? 'border-accent-success bg-accent-success/10'
                    : 'border-brand-border bg-brand-inner'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-[13px] flex-1">{m.label}</span>
                <span className="text-[11px] font-black text-accent-primary">+{m.reward} ₶</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-brand-border overflow-hidden">
                  <div className={cn('h-full rounded-full', m.done ? 'bg-accent-success' : 'bg-accent-primary')} style={{ width: `${(m.progress / m.goal) * 100}%` }} />
                </div>
                <span className="text-[11px] font-black tabular-nums text-tx-muted">
                  {m.progress.toLocaleString('fr-FR')}/{m.goal.toLocaleString('fr-FR')}
                </span>
                {m.claimed ? (
                  <Check className="h-4 w-4 text-accent-success" />
                ) : m.done ? (
                  <button
                    onClick={() => claim(m.id)}
                    disabled={busy === m.id}
                    className="h-8 px-3 rounded-lg bg-accent-success text-brand-bg font-display font-black text-[11px] tracking-wider disabled:opacity-50"
                  >
                    {busy === m.id ? '···' : 'RÉCUPÉRER'}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-tx-muted mt-4">Nouvelles missions chaque jour à minuit UTC. +{KRASH_XP.mission} XP de pass par mission.</p>
      </div>
    </div>
  );
}
