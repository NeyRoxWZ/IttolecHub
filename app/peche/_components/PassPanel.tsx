'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Lock, Package, Sparkles, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { sfx } from '@/lib/casino/sfx';
import { fmtBig } from '@/lib/peche/format';
import type { PecheState } from '@/lib/peche/server';

type Api = (action: string, extra?: Record<string, unknown>) => Promise<any>;

/** The monthly fishing pass and the achievements, side by side in one tab. */
export default function PassPanel({ state, api }: { state: PecheState; api: Api }) {
  const [view, setView] = useState<'pass' | 'succes'>('pass');
  const p = state.pass;
  const claimable = p.tiers.filter((t) => t.tier <= p.tier && !p.claimed.includes(t.tier)).length;
  const achReady = state.achievements.filter((a) => !a.claimed && a.progress >= a.target).length;
  const monthName = new Date(`${p.month}-01T00:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl border-[3px] border-brand-border bg-brand-bg p-1">
        {(['pass', 'succes'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={cn('relative h-10 rounded-lg font-display', view === v ? 'bg-accent-primary text-brand-bg' : 'text-tx-secondary')}>
            {v === 'pass' ? `Pass de ${monthName}` : 'Succès'}
            {(v === 'pass' ? claimable : achReady) > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-accent-secondary border-2 border-brand-border text-white text-[11px] flex items-center justify-center">{v === 'pass' ? claimable : achReady}</span>
            )}
          </button>
        ))}
      </div>

      {view === 'pass' && (
        <>
          <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
            <div className="flex items-center justify-between">
              <div className="font-display text-xl">Palier {p.tier} / {p.tiers.length}</div>
              <span className="text-xs font-black text-tx-secondary">remis à zéro le 1er du mois</span>
            </div>
            <div className="mt-2 h-4 rounded-full bg-brand-bg border-[3px] border-brand-border overflow-hidden">
              <div className="h-full bg-accent-info" style={{ width: `${p.needed ? (p.into / p.needed) * 100 : 100}%` }} />
            </div>
            <p className="mt-1 text-xs font-bold text-tx-secondary">
              Chaque poisson donne des points de pass selon sa rareté (commun 1, rare 3, épique 10, légendaire 40, mythique 200, ×3 chromatique, ×10 doré).
              {p.needed ? ` Encore ${fmtBig(p.needed - p.into)} pour le palier suivant.` : ' Pass terminé !'}
            </p>
          </div>
          <div className="space-y-1.5">
            {p.tiers.map((t) => {
              const reached = t.tier <= p.tier;
              const taken = p.claimed.includes(t.tier);
              return (
                <div key={t.tier} className={cn('flex items-center gap-2 rounded-xl border-2 border-brand-border px-2 py-1.5', reached && !taken ? 'bg-[#3A3A20]' : 'bg-brand-card', !reached && 'opacity-70')}>
                  <span className={cn('h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border flex items-center justify-center font-display', reached ? 'bg-accent-primary text-brand-bg' : 'bg-brand-bg text-tx-secondary')}>{t.tier}</span>
                  <div className="flex-1 min-w-0 flex flex-wrap gap-1.5 text-xs font-black">
                    <span className="text-accent-primary">{fmtBig(t.coins)} ₶</span>
                    {t.packs > 0 && <span className="text-white flex items-center gap-0.5"><Package className="h-3.5 w-3.5" /> {t.packs} coffre{t.packs > 1 ? 's' : ''}</span>}
                    {t.perles > 0 && <span className="text-[#9EE7FF] flex items-center gap-0.5"><Sparkles className="h-3.5 w-3.5" /> {t.perles} Perles</span>}
                  </div>
                  {taken ? <Check className="h-5 w-5 text-accent-success" strokeWidth={3} /> : reached ? (
                    <button onClick={async () => { const r = await api('pass', { tier: t.tier }); if (r) { sfx.coin(); toast.success(`Palier ${t.tier} récupéré`); } }} className={cn(BRAWL.green, 'h-9 px-3 text-sm')}>Récupérer</button>
                  ) : <Lock className="h-4 w-4 text-tx-secondary" />}
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === 'succes' && (
        <div className="space-y-1.5">
          <div className="font-display text-lg">{state.achievements.filter((a) => a.claimed).length} / {state.achievements.length} succès</div>
          {[...state.achievements].sort((a, b) => Number(a.claimed) - Number(b.claimed) || (b.progress / b.target) - (a.progress / a.target)).map((a) => {
            const done = a.progress >= a.target;
            return (
              <div key={a.id} className={cn('rounded-xl border-2 border-brand-border px-2.5 py-2', a.claimed ? 'bg-brand-card opacity-70' : done ? 'bg-[#3A3A20]' : 'bg-brand-card')}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-base leading-tight flex items-center gap-1.5"><Trophy className={cn('h-4 w-4 shrink-0', done ? 'text-accent-primary' : 'text-tx-secondary')} /> {a.label}</div>
                    <div className="text-[11px] font-black text-tx-secondary">
                      {a.perles > 0 && `${a.perles} Perles`}{a.perles > 0 && a.packs > 0 && ' · '}{a.packs > 0 && `${a.packs} coffre${a.packs > 1 ? 's' : ''}`}
                    </div>
                  </div>
                  {a.claimed ? <Check className="h-5 w-5 text-accent-success shrink-0" strokeWidth={3} /> : (
                    <button onClick={async () => { const r = await api('achievement', { id: a.id }); if (r) { sfx.bigWin(); toast.success('Succès récupéré'); } }} disabled={!done} className={cn(BRAWL.green, 'h-9 px-3 text-sm shrink-0')}>Récupérer</button>
                  )}
                </div>
                {!a.claimed && (
                  <div className="mt-1.5 h-2 rounded-full bg-brand-bg border-2 border-brand-border overflow-hidden">
                    <div className="h-full bg-accent-primary" style={{ width: `${Math.min(100, (a.progress / a.target) * 100)}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
