'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Crown, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { KRASH_DAILY_TRADE_XP_CAP, KRASH_PASS_XP, KRASH_PASS_TIERS } from '@/lib/krash/pass';
import KrashShell from '../_components/KrashShell';
import KrashRewardCard from '../_components/KrashRewardCard';
import { unclaimedCount, useKrashPass } from '../_lib/useKrashPass';
import { useKrashWallet } from '../_lib/useKrashWallet';

function countdown(iso: string, now: number) {
  const s = Math.max(0, Math.floor((Date.parse(iso) - now) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d} j ${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
}

/**
 * Pass Krash: the Frenly Pass's layout — a free track and a premium track
 * side by side over a hundred tiers, the month's countdown, the day's XP.
 */
export default function KrashPassPage() {
  const { pass: p, claim, claimAll, buyPremium } = useKrashPass(true);
  const wallet = useKrashWallet();
  const trackRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  if (!p) {
    return <KrashShell title="Pass Krash"><p className="text-tx-muted text-center py-16">Chargement…</p></KrashShell>;
  }

  const waiting = unclaimedCount(p);
  const jump = () => {
    const el = trackRef.current?.querySelector<HTMLElement>(`[data-tier="${Math.max(1, p.tier)}"]`);
    if (!el || !trackRef.current) return;
    sfx.click();
    trackRef.current.scrollTo({ left: Math.max(0, el.offsetLeft - trackRef.current.clientWidth / 2), behavior: 'smooth' });
  };

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <KrashShell title="Pass Krash" wide>
      <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-5 shadow-brutal mb-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-tx-muted flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" /> Saison {p.season} · fin dans {countdown(p.endsAt, now)}
            </div>
            <div className="font-display text-4xl font-black leading-none mt-1">
              Palier {p.tier}<span className="text-tx-muted text-xl">/{KRASH_PASS_TIERS}</span>
            </div>
          </div>

          <div className="flex-1 min-w-[220px]">
            <div className="flex justify-between text-[10px] font-black text-tx-muted mb-1">
              <span>Prochain palier</span>
              <span className="tabular-nums">{p.tier >= KRASH_PASS_TIERS ? 'MAX' : `${p.intoTier}/${p.needed} XP`}</span>
            </div>
            <div className="h-3 rounded-full bg-brand-border overflow-hidden">
              <div className="h-full bg-fuchsia-500 rounded-full transition-all" style={{ width: p.tier >= KRASH_PASS_TIERS ? '100%' : `${(p.intoTier / Math.max(1, p.needed)) * 100}%` }} />
            </div>
            <div className="flex justify-between text-[10px] font-black text-tx-muted mt-2 mb-1">
              <span>XP du jour</span>
              <span className="tabular-nums">{p.dayXp}/{p.dayCap}</span>
            </div>
            <div className="h-1.5 rounded-full bg-brand-border overflow-hidden">
              <div className="h-full bg-accent-primary rounded-full" style={{ width: `${Math.min(100, (p.dayXp / p.dayCap) * 100)}%` }} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={jump} className="h-11 px-4 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-xs tracking-wider hover:border-tx-base">
              MON PALIER
            </button>
            {waiting > 0 && (
              <button
                onClick={() => run(claimAll)}
                disabled={busy}
                className="h-11 px-4 rounded-xl bg-fuchsia-500 text-white border-2 border-brand-border shadow-brutal font-display font-black text-xs tracking-wider animate-pulse disabled:opacity-50"
              >
                TOUT RÉCUPÉRER ({waiting})
              </button>
            )}
          </div>
        </div>

        {!p.premium ? (
          <div className="mt-4 rounded-2xl border-2 border-accent-primary/60 bg-accent-primary/5 p-3 flex flex-wrap items-center gap-3">
            <Crown className="h-6 w-6 text-accent-primary" />
            <div className="flex-1 min-w-[200px]">
              <div className="font-display font-black">Pass premium du mois</div>
              <div className="text-[11px] text-tx-muted">
                Double les récompenses : une deuxième ligne avec plus de ₶, de caisses et de cosmétiques. Les paliers déjà atteints se débloquent tout de suite.
              </div>
            </div>
            <button
              onClick={() => run(buyPremium)}
              disabled={busy || wallet.balance < p.premiumPrice}
              className="h-11 px-5 rounded-xl bg-accent-primary text-brand-bg border-2 border-brand-border shadow-brutal font-display font-black tracking-wider disabled:opacity-40"
            >
              DÉBLOQUER · {p.premiumPrice.toLocaleString('fr-FR')} ₶
            </button>
          </div>
        ) : (
          <div className="mt-4 text-[11px] font-black text-accent-primary flex items-center gap-1.5"><Crown className="h-4 w-4" /> Pass premium actif ce mois-ci</div>
        )}

        <p className="text-[11px] text-tx-muted mt-3">
          XP : +{KRASH_PASS_XP.trade} par trade fermé (même perdant), +{KRASH_PASS_XP.win} s’il gagne, +{KRASH_PASS_XP.flash} par pari flash,
          +{KRASH_PASS_XP.mission} par mission, +{KRASH_PASS_XP.chest} pour le coffre. Les trades rapportent au plus {KRASH_DAILY_TRADE_XP_CAP} XP par jour.
          Les récompenses non récupérées en fin de mois te sont versées automatiquement.
        </p>
      </section>

      <section className="bg-brand-card border-4 border-brand-border rounded-[24px] p-4 shadow-brutal">
        <div className="flex gap-2">
          <div className="shrink-0 w-20 flex flex-col gap-2 pt-7">
            <div className="h-[118px] rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-tx-secondary">Gratuit</div>
            <div className="h-[118px] rounded-xl border-2 border-accent-primary/60 bg-accent-primary/5 flex flex-col items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest text-accent-primary">
              <Crown className="h-4 w-4" /> Premium
            </div>
          </div>

          <div ref={trackRef} className="flex gap-2 overflow-x-auto pb-2 min-w-0">
            {p.track.map((t) => {
              const reached = p.tier >= t.tier;
              const freeClaimed = p.claimed.free.includes(t.tier);
              const premiumClaimed = p.claimed.premium.includes(t.tier);
              const cell = (track: 'free' | 'premium', claimed: boolean) => {
                const reward = track === 'free' ? t.free : t.premium;
                const locked = !reached || (track === 'premium' && !p.premium);
                const ready = !locked && !claimed;
                return (
                  <button
                    onClick={() => ready && run(() => claim(t.tier, track))}
                    disabled={!ready || busy}
                    className={cn(
                      'relative h-[118px] w-full rounded-xl border-2 p-2 flex flex-col items-center justify-center transition-colors',
                      claimed ? 'border-brand-border bg-brand-inner opacity-45'
                        : ready ? 'border-fuchsia-400 bg-fuchsia-500/15 hover:bg-fuchsia-500/25 cursor-pointer'
                          : track === 'premium' ? 'border-accent-primary/30 bg-brand-inner' : 'border-brand-border bg-brand-inner'
                    )}
                  >
                    <KrashRewardCard reward={reward} size={52} />
                    <span className="absolute top-1 right-1">
                      {claimed ? <Check className="h-3.5 w-3.5 text-accent-success" /> : locked ? <Lock className="h-3 w-3 text-tx-muted" /> : null}
                    </span>
                  </button>
                );
              };
              return (
                <div key={t.tier} data-tier={t.tier} className="shrink-0 w-[112px] flex flex-col gap-2">
                  <div className={cn(
                    'h-5 text-center text-[11px] font-black tabular-nums rounded-md',
                    t.milestone ? 'bg-accent-primary text-brand-bg' : reached ? 'text-fuchsia-300' : 'text-tx-muted'
                  )}>
                    {t.tier}
                  </div>
                  {cell('free', freeClaimed)}
                  {cell('premium', premiumClaimed)}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </KrashShell>
  );
}
