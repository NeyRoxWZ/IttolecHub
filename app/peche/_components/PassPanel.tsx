'use client';

import { toast } from 'sonner';
import { Check, Crown, Gift, Lock, Package, Sparkles, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { sfx } from '@/lib/casino/sfx';
import { COSMETIC_BY_ID } from '@/lib/peche/data';
import { fmtBig } from '@/lib/peche/format';
import type { PecheState } from '@/lib/peche/server';
import CosmeticIcon from './CosmeticIcon';

type Api = (action: string, extra?: Record<string, unknown>) => Promise<any>;

function Rewards({ coins, packs, perles, cosmeticId }: { coins: number; packs: number; perles: number; cosmeticId?: string | null }) {
  const cosmetic = cosmeticId ? COSMETIC_BY_ID.get(cosmeticId) : undefined;
  return (
    <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-black min-w-0">
      {cosmetic && <CosmeticIcon cosmetic={cosmetic} size={30} />}
      <span className="text-accent-primary">{fmtBig(coins)} ₶</span>
      {packs > 0 && <span className="text-white flex items-center gap-0.5"><Package className="h-3.5 w-3.5" />{packs}</span>}
      {perles > 0 && <span className="text-[#9EE7FF] flex items-center gap-0.5"><Sparkles className="h-3.5 w-3.5" />{perles}</span>}
    </div>
  );
}

/** The monthly pass: a free track for everyone and a premium track bought with ₶. */
export function PassPanel({ state, api }: { state: PecheState; api: Api }) {
  const p = state.pass;
  const monthName = new Date(`${p.month}-01T00:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'UTC' });

  const claim = async (tier: number, track: 'free' | 'premium') => {
    const r = await api('pass', { tier, track });
    if (r) { sfx.coin(); toast.success(r.cosmeticId ? `Palier ${tier} : cosmétique exclusif débloqué !` : `Palier ${tier} récupéré`); }
  };

  const ready = p.tiers.filter((t) => t.tier <= p.tier && (!p.claimed.includes(t.tier) || (p.premium && !p.claimedPremium.includes(t.tier)))).length;
  const claimAll = async () => {
    const r = await api('pass_all');
    if (!r) return;
    sfx.jackpot();
    const parts = [`+${fmtBig(r.coins)} ₶`, r.packs ? `${r.packs} coffre${r.packs > 1 ? 's' : ''}` : '', r.perles ? `${r.perles} Perles` : ''].filter(Boolean);
    toast.success(`${r.tiers} récompense${r.tiers > 1 ? 's' : ''} récupérée${r.tiers > 1 ? 's' : ''}`, {
      description: `${parts.join(', ')}${r.cosmetics.length ? ` et ${r.cosmetics.length} cosmétique${r.cosmetics.length > 1 ? 's' : ''} exclusif${r.cosmetics.length > 1 ? 's' : ''}` : ''}`,
    });
  };

  return (
    <div className="space-y-3">
      {ready > 0 && (
        <button onClick={claimAll} className={cn(BRAWL.green, 'w-full h-14 text-xl')}>
          <Gift className="h-6 w-6" /> Tout récupérer · {ready} palier{ready > 1 ? 's' : ''}
        </button>
      )}
      <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
        <div className="flex items-center justify-between">
          <div className="font-display text-xl">Pass de {monthName} · palier {p.tier}/{p.tiers.length}</div>
        </div>
        <div className="mt-2 h-4 rounded-full bg-brand-bg border-[3px] border-brand-border overflow-hidden">
          <div className="h-full bg-accent-info" style={{ width: `${p.needed ? (p.into / p.needed) * 100 : 100}%` }} />
        </div>
        <p className="mt-1 text-xs font-bold text-tx-secondary">
          Les points de rareté de chaque prise font avancer le pass (commun 1, rare 3, épique 10, légendaire 40, mythique 200, ×3 chromatique, ×10 doré). Remis à zéro le 1er du mois.
        </p>
      </div>

      <div className={cn('rounded-2xl border-[3px] border-brand-border p-3 flex items-center gap-3', p.premium ? 'bg-[#3A2A5A]' : 'bg-[#2B1F4A]')}>
        <span className="h-12 w-12 shrink-0 rounded-xl border-[3px] border-brand-border bg-[#B06BFF] flex items-center justify-center shadow-[inset_0_-4px_0_#7A3FCC]"><Crown className="h-6 w-6 text-white" /></span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight">Voie premium</div>
          <p className="text-xs font-bold text-tx-secondary">Plus de ₶, un coffre tous les 3 paliers, des Perles, et 5 cosmétiques exclusifs du Pass.</p>
        </div>
        {p.premium ? (
          <span className="px-2.5 py-1 rounded-xl border-[3px] border-brand-border bg-accent-success text-brand-bg font-display flex items-center gap-1"><Check className="h-4 w-4" strokeWidth={3} /> Active</span>
        ) : (
          <button onClick={async () => { const r = await api('pass_premium'); if (r) { sfx.jackpot(); toast.success('Voie premium débloquée !'); } }} disabled={state.balance < p.premiumPrice}
            className={cn(BRAWL.yellow, 'h-12 px-3 text-base shrink-0')}>
            {fmtBig(p.premiumPrice)} ₶
          </button>
        )}
      </div>

      <div className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 text-xs font-black text-tx-secondary px-1">
        <span />
        <span>Gratuit</span>
        <span className="text-[#C9A3FF]">Premium</span>
      </div>
      <div className="space-y-1.5">
        {p.tiers.map((t) => {
          const reached = t.tier <= p.tier;
          const freeTaken = p.claimed.includes(t.tier);
          const premTaken = p.claimedPremium.includes(t.tier);
          return (
            <div key={t.tier} className={cn('grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 items-stretch', !reached && 'opacity-70')}>
              <span className={cn('rounded-lg border-2 border-brand-border flex items-center justify-center font-display text-lg', reached ? 'bg-accent-primary text-brand-bg' : 'bg-brand-bg text-tx-secondary')}>{t.tier}</span>
              {/* Rewards and the button wrap onto two lines when the column is narrow, instead of pushing the page sideways. */}
              <div className={cn('rounded-xl border-2 border-brand-border px-2 py-1.5 flex flex-wrap items-center justify-between gap-1', reached && !freeTaken ? 'bg-[#3A3A20]' : 'bg-brand-card')}>
                <Rewards coins={t.coins} packs={t.packs} perles={t.perles} />
                {freeTaken ? <Check className="h-4 w-4 text-accent-success shrink-0" strokeWidth={3} /> : reached ? (
                  <button onClick={() => claim(t.tier, 'free')} className={cn(BRAWL.green, 'h-8 px-2 text-xs shrink-0')}>Prendre</button>
                ) : <Lock className="h-3.5 w-3.5 shrink-0" />}
              </div>
              <div className={cn('rounded-xl border-2 border-brand-border px-2 py-1.5 flex flex-wrap items-center justify-between gap-1', p.premium && reached && !premTaken ? 'bg-[#4A2A6A]' : 'bg-[#1E1A40]')}>
                <Rewards {...t.premiumReward} />
                {premTaken ? <Check className="h-4 w-4 text-accent-success shrink-0" strokeWidth={3} /> : p.premium && reached ? (
                  <button onClick={() => claim(t.tier, 'premium')} className={cn(BRAWL.green, 'h-8 px-2 text-xs shrink-0')}>Prendre</button>
                ) : <Lock className="h-3.5 w-3.5 shrink-0" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Every achievement with its progress, the ones ready to claim first. */
export function AchievementsPanel({ state, api }: { state: PecheState; api: Api }) {
  return (
    <div className="space-y-1.5">
      <div className="font-display text-xl">{state.achievements.filter((a) => a.claimed).length} / {state.achievements.length} succès</div>
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
  );
}

export default PassPanel;
