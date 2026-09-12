'use client';

import { Check, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COSMETICS, KRASH_XP, PASS_TIERS, XP_PER_TIER, tierReward } from '@/lib/krash/progression';
import KrashShell from '../_components/KrashShell';
import { useKrashProgression } from '../_lib/useKrashProgression';

function resetLabel(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

/** The monthly pass Krash: thirty tiers filled by playing. */
export default function KrashPassPage() {
  const { progression: p, claimAllTiers } = useKrashProgression();

  if (!p) {
    return (
      <KrashShell title="Pass Krash">
        <p className="text-tx-muted text-center py-16">Chargement…</p>
      </KrashShell>
    );
  }

  const inTier = p.pass.xp - p.pass.tier * XP_PER_TIER;
  const unclaimed = Array.from({ length: p.pass.tier }, (_, i) => i + 1).filter((t) => !p.pass.claimed.includes(t));

  return (
    <KrashShell title="Pass Krash">
      <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-5 shadow-brutal">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
          <Sparkles className="h-5 w-5 text-fuchsia-400" />
          <h2 className="font-display font-black tracking-wider uppercase">Saison du mois</h2>
          <span className="text-[11px] text-tx-muted">Se remet à zéro le {resetLabel(p.pass.endsAt)}</span>
          {unclaimed.length > 0 && (
            <button
              onClick={claimAllTiers}
              className="ml-auto h-10 px-4 rounded-xl bg-fuchsia-500 text-white border-2 border-brand-border shadow-brutal font-display font-black text-xs tracking-wider animate-pulse"
            >
              TOUT RÉCUPÉRER ({unclaimed.length})
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 mb-1">
          <span className="font-display text-3xl font-black">Palier {p.pass.tier}<span className="text-tx-muted text-lg">/{PASS_TIERS}</span></span>
          <div className="flex-1 h-3 rounded-full bg-brand-border overflow-hidden">
            <div className="h-full rounded-full bg-fuchsia-500" style={{ width: p.pass.tier >= PASS_TIERS ? '100%' : `${(inTier / XP_PER_TIER) * 100}%` }} />
          </div>
          <span className="text-[11px] font-black tabular-nums text-tx-muted">
            {p.pass.tier >= PASS_TIERS ? 'MAX' : `${inTier}/${XP_PER_TIER} XP`}
          </span>
        </div>
        <p className="text-[11px] text-tx-muted mb-5">
          XP : +{KRASH_XP.trade} par trade fermé (même perdant), +{KRASH_XP.win} s’il gagne, +{KRASH_XP.mission} par mission, +{KRASH_XP.chest} pour le coffre.
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
          {Array.from({ length: PASS_TIERS }, (_, i) => {
            const tier = i + 1;
            const reward = tierReward(tier);
            const reached = p.pass.tier >= tier;
            const claimed = p.pass.claimed.includes(tier);
            const item = reward.item ? COSMETICS[reward.item] : null;
            return (
              <div
                key={tier}
                className={cn(
                  'rounded-xl border-2 p-2 text-center',
                  claimed ? 'border-brand-border bg-brand-inner opacity-50'
                    : reached ? 'border-fuchsia-400 bg-fuchsia-500/15'
                      : item ? 'border-accent-primary/50 bg-brand-inner' : 'border-brand-border bg-brand-inner'
                )}
              >
                <div className="text-[10px] font-black text-tx-muted">P{tier}</div>
                {item ? (
                  <div className="text-[11px] font-black leading-tight text-accent-primary min-h-[30px] flex items-center justify-center">{item.label}</div>
                ) : (
                  <div className="text-[13px] font-black tabular-nums min-h-[30px] flex items-center justify-center">{reward.coins} ₶</div>
                )}
                <div className="mt-1 h-4 flex items-center justify-center">
                  {claimed ? <Check className="h-3.5 w-3.5 text-accent-success" /> : !reached ? <Lock className="h-3 w-3 text-tx-muted" /> : <span className="text-[9px] font-black text-fuchsia-300">PRÊT</span>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-tx-muted mt-4">Un cosmétique aux paliers 5, 10, 15, 20, 25 et 30, à équiper dans l’inventaire.</p>
      </section>
    </KrashShell>
  );
}
