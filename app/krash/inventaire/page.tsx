'use client';

import { Lock, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHART_SKINS, COSMETICS } from '@/lib/krash/progression';
import KrashShell from '../_components/KrashShell';
import { useKrashProgression } from '../_lib/useKrashProgression';

/** Owned Krash cosmetics and what is equipped. */
export default function KrashInventoryPage() {
  const { progression: p, equip } = useKrashProgression();

  if (!p) {
    return (
      <KrashShell title="Inventaire">
        <p className="text-tx-muted text-center py-16">Chargement…</p>
      </KrashShell>
    );
  }

  const titles = Object.values(COSMETICS).filter((c) => c.kind === 'title');
  const skins = [
    { id: null as string | null, label: CHART_SKINS.classic.label, colors: CHART_SKINS.classic, description: 'Les couleurs d’origine.' },
    ...Object.values(COSMETICS).filter((c) => c.kind === 'skin').map((s) => ({ id: s.id as string | null, label: CHART_SKINS[s.id].label, colors: CHART_SKINS[s.id], description: s.description })),
  ];

  return (
    <KrashShell title="Inventaire">
      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-2">
        <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-5 shadow-brutal">
          <h2 className="font-display font-black tracking-wider uppercase mb-1">Titres</h2>
          <p className="text-[11px] text-tx-muted mb-3">Affiché sous ton pseudo au classement Krash.</p>
          <div className="space-y-2">
            {[{ id: null as string | null, label: 'Aucun titre', description: 'Juste ton pseudo.' }, ...titles].map((c) => {
              const owned = c.id === null || p.cosmetics.unlocked.includes(c.id);
              const active = (p.cosmetics.title ?? null) === c.id;
              return (
                <button
                  key={c.label}
                  disabled={!owned}
                  onClick={() => equip('title', c.id)}
                  className={cn(
                    'w-full text-left rounded-xl border-2 p-3 flex items-center gap-3 transition-colors',
                    active ? 'border-accent-primary bg-accent-primary/10' : 'border-brand-border bg-brand-inner hover:border-tx-base',
                    !owned && 'opacity-45 cursor-not-allowed hover:border-brand-border'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-black">{c.label}</div>
                    <div className="text-[11px] text-tx-muted">{owned ? c.description : 'Débloqué dans le pass Krash'}</div>
                  </div>
                  {!owned ? <Lock className="h-4 w-4 text-tx-muted" /> : active ? <span className="text-[10px] font-black text-accent-primary">ÉQUIPÉ</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-5 shadow-brutal">
          <h2 className="font-display font-black tracking-wider uppercase mb-1 flex items-center gap-2"><Palette className="h-4 w-4 text-sky-400" /> Couleurs de courbe</h2>
          <p className="text-[11px] text-tx-muted mb-3">Appliquées au graphique du marché.</p>
          <div className="space-y-2">
            {skins.map((s) => {
              const owned = s.id === null || p.cosmetics.unlocked.includes(s.id);
              const active = (p.cosmetics.chartSkin ?? null) === s.id;
              return (
                <button
                  key={s.label}
                  disabled={!owned}
                  onClick={() => equip('skin', s.id)}
                  className={cn(
                    'w-full text-left rounded-xl border-2 p-3 flex items-center gap-3 transition-colors',
                    active ? 'border-accent-primary bg-accent-primary/10' : 'border-brand-border bg-brand-inner hover:border-tx-base',
                    !owned && 'opacity-45 cursor-not-allowed hover:border-brand-border'
                  )}
                >
                  <svg viewBox="0 0 60 24" className="h-8 w-16 shrink-0">
                    <polyline points="0,18 12,14 22,16 34,6 44,9 60,2" fill="none" stroke={s.colors.up} strokeWidth="3" />
                    <polyline points="0,6 14,10 26,8 38,18 48,15 60,22" fill="none" stroke={s.colors.down} strokeWidth="3" opacity="0.7" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-black">{s.label}</div>
                    <div className="text-[11px] text-tx-muted">{owned ? s.description : 'Débloqué dans le pass Krash'}</div>
                  </div>
                  {!owned ? <Lock className="h-4 w-4 text-tx-muted" /> : active ? <span className="text-[10px] font-black text-accent-primary">ÉQUIPÉ</span> : null}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </KrashShell>
  );
}
