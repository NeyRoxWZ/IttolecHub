'use client';

import { Check, Gift, Lock, Palette, Sparkles, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CHART_SKINS, COSMETICS, KRASH_XP, PASS_TIERS, XP_PER_TIER, chestReward, tierReward,
} from '@/lib/krash/progression';
import KrashShell from '../_components/KrashShell';
import { useKrashProgression } from '../_lib/useKrashProgression';

function resetLabel(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

/**
 * Everything that brings a player back to Krash: the daily chest and its
 * streak, three missions a day, the monthly pass and what it unlocks.
 */
export default function KrashProgressionPage() {
  const { progression: p, claimChest, claimMission, claimAllTiers, equip } = useKrashProgression();

  if (!p) {
    return (
      <KrashShell title="Progression">
        <p className="text-tx-muted text-center py-16">Chargement…</p>
      </KrashShell>
    );
  }

  const inTier = p.pass.xp - p.pass.tier * XP_PER_TIER;
  const unclaimedTiers = Array.from({ length: p.pass.tier }, (_, i) => i + 1).filter((t) => !p.pass.claimed.includes(t));
  const titles = Object.values(COSMETICS).filter((c) => c.kind === 'title');
  const skins = Object.values(COSMETICS).filter((c) => c.kind === 'skin');

  return (
    <KrashShell title="Progression">
      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Chest */}
        <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-5 shadow-brutal">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="h-5 w-5 text-accent-primary" />
            <h2 className="font-display font-black tracking-wider uppercase">Coffre du jour</h2>
            <span className="ml-auto text-[11px] font-black text-tx-muted">Série : {p.chest.streak} j</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 mb-4">
            {Array.from({ length: 7 }, (_, i) => {
              const day = i + 1;
              const reached = p.chest.streak >= day;
              const next = !reached && p.chest.canClaim && day === p.chest.streak + 1;
              return (
                <div
                  key={day}
                  className={cn(
                    'rounded-xl border-2 py-2 text-center',
                    reached ? 'border-accent-primary bg-accent-primary/15' : next ? 'border-rose-400 bg-rose-400/10 animate-pulse' : 'border-brand-border bg-brand-inner'
                  )}
                >
                  <div className="text-[9px] font-black text-tx-muted">J{day}</div>
                  <div className="text-[11px] font-black tabular-nums">{chestReward(day)}</div>
                </div>
              );
            })}
          </div>
          <button
            onClick={claimChest}
            disabled={!p.chest.canClaim}
            className="w-full h-12 rounded-xl bg-accent-primary text-brand-bg border-2 border-brand-border shadow-brutal font-display font-black tracking-wider disabled:opacity-40 disabled:shadow-none"
          >
            {p.chest.canClaim ? `OUVRIR · +${p.chest.reward} ₶` : 'DÉJÀ OUVERT, REVIENS DEMAIN'}
          </button>
          <p className="text-[11px] text-tx-muted mt-2">Un jour sans l’ouvrir et la série repart à 1. +{KRASH_XP.chest} XP de pass.</p>
        </section>

        {/* Missions */}
        <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-5 shadow-brutal">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-rose-400" />
            <h2 className="font-display font-black tracking-wider uppercase">Missions du jour</h2>
            <span className="ml-auto text-[11px] font-black text-tx-muted">Nouvelles à 2 h</span>
          </div>
          <div className="space-y-2">
            {p.missions.map((m) => (
              <div key={m.id} className={cn('rounded-xl border-2 p-3', m.claimed ? 'border-brand-border bg-brand-inner opacity-60' : m.done ? 'border-accent-success bg-accent-success/10' : 'border-brand-border bg-brand-inner')}>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[13px] flex-1">{m.label}</span>
                  <span className="text-[11px] font-black text-accent-primary">+{m.reward} ₶</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-brand-border overflow-hidden">
                    <div className={cn('h-full rounded-full', m.done ? 'bg-accent-success' : 'bg-rose-400')} style={{ width: `${(m.progress / m.goal) * 100}%` }} />
                  </div>
                  <span className="text-[11px] font-black tabular-nums text-tx-muted">{m.progress.toLocaleString('fr-FR')}/{m.goal.toLocaleString('fr-FR')}</span>
                  {m.claimed ? (
                    <Check className="h-4 w-4 text-accent-success" />
                  ) : m.done ? (
                    <button onClick={() => claimMission(m.id)} className="h-8 px-3 rounded-lg bg-accent-success text-brand-bg font-display font-black text-[11px] tracking-wider">
                      RÉCUPÉRER
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-tx-muted mt-2">Comptent les trades fermés aujourd’hui. +{KRASH_XP.mission} XP par mission.</p>
        </section>

        {/* Pass */}
        <section className="lg:col-span-2 bg-brand-card border-4 border-brand-border rounded-[24px] p-5 shadow-brutal">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
            <Sparkles className="h-5 w-5 text-fuchsia-400" />
            <h2 className="font-display font-black tracking-wider uppercase">Pass Krash</h2>
            <span className="text-[11px] text-tx-muted">Se remet à zéro le {resetLabel(p.pass.endsAt)}</span>
            {unclaimedTiers.length > 0 && (
              <button
                onClick={claimAllTiers}
                className="ml-auto h-9 px-4 rounded-xl bg-fuchsia-500 text-white border-2 border-brand-border font-display font-black text-xs tracking-wider animate-pulse"
              >
                TOUT RÉCUPÉRER ({unclaimedTiers.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 mb-1">
            <span className="font-display text-2xl font-black">Palier {p.pass.tier}<span className="text-tx-muted text-base">/{PASS_TIERS}</span></span>
            <div className="flex-1 h-3 rounded-full bg-brand-border overflow-hidden">
              <div className="h-full rounded-full bg-fuchsia-500" style={{ width: p.pass.tier >= PASS_TIERS ? '100%' : `${(inTier / XP_PER_TIER) * 100}%` }} />
            </div>
            <span className="text-[11px] font-black tabular-nums text-tx-muted">
              {p.pass.tier >= PASS_TIERS ? 'MAX' : `${inTier}/${XP_PER_TIER} XP`}
            </span>
          </div>
          <p className="text-[11px] text-tx-muted mb-4">
            XP : +{KRASH_XP.trade} par trade fermé (même perdant), +{KRASH_XP.win} s’il gagne, +{KRASH_XP.mission} par mission, +{KRASH_XP.chest} pour le coffre.
          </p>

          <div className="flex gap-2 overflow-x-auto pb-2">
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
                    'shrink-0 w-24 rounded-xl border-2 p-2 text-center',
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
        </section>

        {/* Cosmetics */}
        <section className="lg:col-span-2 bg-brand-card border-4 border-brand-border rounded-[24px] p-5 shadow-brutal">
          <div className="flex items-center gap-2 mb-3">
            <Palette className="h-5 w-5 text-sky-400" />
            <h2 className="font-display font-black tracking-wider uppercase">Mes cosmétiques</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-[11px] font-black uppercase tracking-widest text-tx-muted mb-2">Titre (visible au classement)</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => equip('title', null)}
                  className={cn('h-9 px-3 rounded-lg border-2 text-[12px] font-bold', !p.cosmetics.title ? 'border-sky-400 text-sky-300' : 'border-brand-border text-tx-secondary')}
                >
                  Aucun
                </button>
                {titles.map((c) => {
                  const owned = p.cosmetics.unlocked.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      disabled={!owned}
                      onClick={() => equip('title', c.id)}
                      className={cn(
                        'h-9 px-3 rounded-lg border-2 text-[12px] font-bold flex items-center gap-1',
                        p.cosmetics.title === c.id ? 'border-sky-400 text-sky-300' : 'border-brand-border text-tx-secondary',
                        !owned && 'opacity-40'
                      )}
                    >
                      {!owned && <Lock className="h-3 w-3" />}{c.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-widest text-tx-muted mb-2">Couleurs de la courbe</div>
              <div className="flex flex-wrap gap-2">
                {[{ id: null as string | null, label: CHART_SKINS.classic.label, colors: CHART_SKINS.classic }, ...skins.map((s) => ({ id: s.id, label: CHART_SKINS[s.id].label, colors: CHART_SKINS[s.id] }))].map((s) => {
                  const owned = s.id === null || p.cosmetics.unlocked.includes(s.id);
                  const active = (p.cosmetics.chartSkin ?? null) === s.id;
                  return (
                    <button
                      key={s.label}
                      disabled={!owned}
                      onClick={() => equip('skin', s.id)}
                      className={cn(
                        'h-9 px-3 rounded-lg border-2 text-[12px] font-bold flex items-center gap-1.5',
                        active ? 'border-sky-400 text-sky-300' : 'border-brand-border text-tx-secondary',
                        !owned && 'opacity-40'
                      )}
                    >
                      {!owned && <Lock className="h-3 w-3" />}
                      <span className="h-3 w-3 rounded-full" style={{ background: s.colors.up }} />
                      <span className="h-3 w-3 rounded-full" style={{ background: s.colors.down }} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-tx-muted mt-3">Les cosmétiques se débloquent aux paliers 5, 10, 15, 20, 25 et 30 du pass et restent à toi pour toujours.</p>
        </section>
      </div>
    </KrashShell>
  );
}
