'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft, Anchor, BookOpen, Coins, Fish, Map as MapIcon, Sparkles, Waves, Wrench, Zap, Lock, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import {
  GEAR, MATERIALS, RARITIES, SPECIES, SPECIES_BY_ID, TREE, VARIANTS, ZONES, mareeBadge, mareeTitle,
  type GearId, type MaterialId, type TreeId,
} from '@/lib/peche/data';
import { gearCost, lvl, maxGearLevel, rarityOdds, treeCost } from '@/lib/peche/engine';
import { fmtBig, fmtKg } from '@/lib/peche/format';
import type { PecheState } from '@/lib/peche/server';
import FishIcon from './FishIcon';
import ReelGauge from './ReelGauge';

type Phase = 'idle' | 'waiting' | 'reeling' | 'landed' | 'lost';
type Tab = 'peche' | 'materiel' | 'carte' | 'dex' | 'marees';

interface Landed {
  speciesId: string; rarity: number; weight: number; variant: string;
  quality: 'perfect' | 'good'; value: number; materials: Record<string, number>; isNew: boolean;
}

const TABS: { id: Tab; label: string; icon: typeof Fish }[] = [
  { id: 'peche', label: 'Pêche', icon: Fish },
  { id: 'materiel', label: 'Matériel', icon: Wrench },
  { id: 'carte', label: 'Carte', icon: MapIcon },
  { id: 'dex', label: 'Poissodex', icon: BookOpen },
  { id: 'marees', label: 'Marées', icon: Waves },
];

export default function PecheGame({ userId }: { userId: string }) {
  const [state, setState] = useState<PecheState | null>(null);
  const [tab, setTab] = useState<Tab>('peche');
  const [phase, setPhase] = useState<Phase>('idle');
  const [castInfo, setCastInfo] = useState<{ id: string; rarity: number; green: number; speed: number } | null>(null);
  const [landed, setLanded] = useState<Landed | null>(null);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const [autoFeed, setAutoFeed] = useState<{ key: number; speciesId: string; rarity: number; value: number; variant: string }[]>([]);
  const stateRef = useRef<PecheState | null>(null);
  stateRef.current = state;

  const api = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch('/api/peche', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error || 'Erreur'); return null; }
    if (data.state) setState(data.state);
    return data.result;
  }, [userId]);

  useEffect(() => {
    fetch(`/api/peche?user_id=${userId}`)
      .then((r) => r.json())
      .then((d) => { if (d.state) setState(d.state); else toast.error(d.error || 'Erreur'); });
  }, [userId]);

  /* ---- manual fishing ---- */

  const castLine = async () => {
    if (busy || phase === 'waiting' || phase === 'reeling') return;
    setBusy(true); setLanded(null);
    sfx.bet(); vibrate(HAPTIC.SOFT);
    const r = await api('cast');
    setBusy(false);
    if (!r) return;
    setCastInfo(r);
    setPhase('waiting');
    // The bite comes after a short wait; the server already knows the fish.
    const wait = 600 + Math.random() * 1600;
    setTimeout(() => { sfx.tick(); vibrate(HAPTIC.MEDIUM); setPhase('reeling'); }, wait);
  };

  const onReelDone = async (quality: 'perfect' | 'good' | 'fail') => {
    if (!castInfo) return;
    const before = new Set((stateRef.current?.dex || []).map((d) => d.speciesId));
    const r = await api('reel', { cast_id: castInfo.id, quality });
    setCastInfo(null);
    if (!r || !r.caught) {
      setPhase('lost'); sfx.lose(); vibrate(HAPTIC.ERROR);
      return;
    }
    const c = r.caught;
    setLanded({ ...c, isNew: !before.has(c.speciesId) });
    setPhase('landed');
    if (c.rarity >= 3 || c.variant) { sfx.bigWin(); vibrate(HAPTIC.SUCCESS); } else { sfx.win(); vibrate(HAPTIC.SOFT); }
  };

  /* ---- auto rod ---- */

  const autoInterval = state?.autoInterval ?? Infinity;
  const hasAuto = Number.isFinite(autoInterval);

  useEffect(() => {
    if (!auto || !hasAuto) return;
    let stop = false;
    let n = 0;
    const tick = async () => {
      if (stop) return;
      const r = await api('auto');
      if (r?.catches?.length) {
        setAutoFeed((prev) => [
          ...r.catches.map((c: { speciesId: string; rarity: number; value: number; variant: string }) => ({ key: Date.now() + n++, ...c })),
          ...prev,
        ].slice(0, 8));
      }
    };
    void tick();
    // Browsers slow timers in background tabs; the server catches up on the
    // missed casts (within a cap), so the rod keeps fishing either way.
    const id = setInterval(tick, Math.max(2000, autoInterval * 1000));
    return () => { stop = true; clearInterval(id); };
  }, [auto, hasAuto, autoInterval, api]);

  if (!state) {
    return <div className="h-[520px] rounded-[22px] border-4 border-brand-border bg-brand-card animate-pulse" />;
  }

  const zone = ZONES[state.zone];
  const badge = mareeBadge(state.maree);
  const bagTotal = state.bag.reduce((s, b) => s + b.price, 0);
  const bagCount = state.bag.reduce((s, b) => s + b.count, 0);

  return (
    <div>
      {/* Header */}
      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/?mode=solo" aria-label="Retour" className={cn(BRAWL.pink, 'h-12 w-12 shrink-0')}>
            <ArrowLeft className="h-6 w-6" strokeWidth={3} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-3xl sm:text-4xl leading-none">Frenly Pêche</h1>
            <p className="text-sm font-bold text-tx-secondary mt-0.5">{zone.region} · {zone.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="h-12 inline-flex items-center gap-2 rounded-2xl border-[3px] border-brand-border px-3 font-display text-lg"
            style={{ background: badge.fill, color: badge.text, boxShadow: `inset 0 -4px 0 ${badge.shade}` }}
            title={`Marée ${state.maree} · ${badge.label}`}
          >
            <Waves className="h-5 w-5" /> Marée {state.maree} · {mareeTitle(state.maree)}
          </span>
          <span className={BRAWL.pill} title="Niveau de pêcheur">
            <span className="h-8 min-w-8 px-1 rounded-xl bg-accent-info border-2 border-brand-border flex items-center justify-center text-base">{state.level.level}</span>
            <span className="w-20 h-3 rounded-full bg-[#2B3170] border-2 border-brand-border overflow-hidden">
              <span className="block h-full bg-accent-info" style={{ width: `${(state.level.into / state.level.needed) * 100}%` }} />
            </span>
          </span>
          <span className={BRAWL.pill}>
            <span className="h-8 w-8 rounded-full bg-accent-primary border-2 border-brand-border flex items-center justify-center shadow-[inset_0_-3px_0_#D98E00]">
              <Coins className="h-4 w-4 text-brand-bg" strokeWidth={2.5} />
            </span>
            <span className="tabular-nums">{fmtBig(state.balance)}</span>
            <span className="text-tx-secondary text-sm">₶</span>
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-4">
        {/* Scene */}
        <section className={cn(BRAWL.panel, 'relative overflow-hidden min-h-[460px] flex flex-col')}>
          <Scene zoneId={state.zone} phase={phase} />

          <div className="relative z-10 flex-1 flex items-center justify-center p-4">
            {phase === 'reeling' && castInfo && (
              <div className="rounded-[22px] border-4 border-brand-border bg-brand-card/95 p-4 shadow-[0_6px_0_#05061A] animate-in zoom-in-95 duration-150">
                <ReelGauge key={castInfo.id} green={castInfo.green} speed={castInfo.speed} onDone={onReelDone} />
              </div>
            )}
            {phase === 'landed' && landed && <LandedCard landed={landed} />}
            {phase === 'lost' && (
              <div className="rounded-2xl border-[3px] border-brand-border bg-accent-secondary text-white px-5 py-3 font-display text-2xl shadow-[inset_0_-4px_0_#C92D63,0_4px_0_#05061A] animate-in zoom-in-90">
                Il s’est échappé…
              </div>
            )}
            {phase === 'waiting' && (
              <div className="rounded-2xl border-[3px] border-brand-border bg-brand-card/90 px-5 py-3 font-display text-2xl animate-pulse">
                Attends la touche…
              </div>
            )}
          </div>

          <div className="relative z-10 p-4 pt-0 flex gap-2">
            <button
              onClick={castLine}
              disabled={busy || phase === 'waiting' || phase === 'reeling'}
              className={cn(BRAWL.yellow, 'flex-1 h-16 text-2xl rounded-2xl')}
            >
              <Fish className="h-7 w-7" /> {phase === 'landed' || phase === 'lost' ? 'Relancer' : 'Lancer la ligne'}
            </button>
            <button
              onClick={() => { if (!hasAuto) { toast.info('Achète une canne auto dans Matériel.'); return; } sfx.click(); setAuto((a) => !a); }}
              className={cn(auto ? BRAWL.green : BRAWL.dark, 'h-16 px-4 rounded-2xl text-lg flex-col gap-0 leading-none')}
              title={hasAuto ? `Un poisson toutes les ${autoInterval.toFixed(1)} s, à ${Math.round((state.autoEfficiency) * 100)} % de la valeur` : 'Pas encore de canne auto'}
            >
              <Zap className="h-5 w-5" />
              <span className="text-sm">{auto ? 'Auto ON' : 'Auto'}</span>
            </button>
          </div>
        </section>

        {/* Panel */}
        <section className={cn(BRAWL.panel, 'p-4 flex flex-col gap-3 min-h-0')}>
          <div className="grid grid-cols-5 gap-1 rounded-[18px] border-[3px] border-brand-border bg-brand-bg p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { sfx.click(); setTab(t.id); }}
                className={cn(
                  'h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 font-display text-xs sm:text-sm leading-none transition-transform active:translate-y-[2px]',
                  tab === t.id ? 'bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00]' : 'text-tx-secondary hover:text-white hover:bg-[#2B3170]'
                )}
              >
                <t.icon className="h-5 w-5" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 lg:max-h-[560px]">
            {tab === 'peche' && (
              <div className="space-y-3">
                <Materials materials={state.materials} />

                <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-display text-xl">Bourriche <span className="text-tx-secondary text-base">({bagCount})</span></div>
                    <button
                      onClick={async () => { const r = await api('sell'); if (r) { sfx.cashout(); toast.success(`Vendu +${fmtBig(r.earned)} ₶`); } }}
                      disabled={bagCount === 0}
                      className={cn(BRAWL.green, 'h-10 px-3 text-base')}
                    >
                      Tout vendre · {fmtBig(bagTotal)} ₶
                    </button>
                  </div>
                  {state.bag.length === 0 ? (
                    <p className="text-sm font-bold text-tx-secondary">Vide. Lance ta ligne !</p>
                  ) : (
                    <div className="space-y-1.5">
                      {[...state.bag].sort((a, b) => b.price - a.price).map((b) => {
                        const sp = SPECIES_BY_ID.get(b.speciesId);
                        if (!sp) return null;
                        return (
                          <div key={b.key} className="flex items-center gap-2 rounded-xl border-2 border-brand-border bg-brand-card px-2 py-1">
                            <FishIcon color={sp.color} rarity={sp.rarity} size={40} variant={b.variant} />
                            <div className="min-w-0 flex-1">
                              <div className="font-display text-base leading-tight truncate">
                                {sp.name}{b.variant ? ` · ${VARIANTS[b.variant].label}` : ''}
                              </div>
                              <div className="text-xs font-black" style={{ color: RARITIES[sp.rarity].color }}>
                                {RARITIES[sp.rarity].label} · ×{b.count}
                              </div>
                            </div>
                            <button onClick={() => api('sell', { key: b.key })} className={cn(BRAWL.dark, 'h-9 px-2 text-sm')}>
                              {fmtBig(b.price)} ₶
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Market state={state} />

                {autoFeed.length > 0 && (
                  <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
                    <div className="font-display text-lg mb-1.5">Canne auto</div>
                    <div className="space-y-1">
                      {autoFeed.map((c) => {
                        const sp = SPECIES_BY_ID.get(c.speciesId);
                        return (
                          <div key={c.key} className="flex items-center gap-2 text-sm font-bold animate-in slide-in-from-top-1 fade-in">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: RARITIES[c.rarity].color }} />
                            <span className="truncate flex-1">{sp?.name}</span>
                            <span className="tabular-nums text-accent-success">+{fmtBig(c.value)} ₶</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'materiel' && <GearPanel state={state} api={api} />}
            {tab === 'carte' && <MapPanel state={state} api={api} />}
            {tab === 'dex' && <DexPanel state={state} />}
            {tab === 'marees' && <MareesPanel state={state} api={api} />}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Scene({ zoneId, phase }: { zoneId: number; phase: Phase }) {
  const z = ZONES[zoneId];
  const out = phase === 'waiting' || phase === 'reeling';
  const floatX = out ? 300 : 150;
  return (
    <div className="absolute inset-0">
      <style>{`
        @keyframes pecheBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(4px) } }
        @keyframes pecheBite { 0%,100% { transform: translateY(0) } 30% { transform: translateY(14px) } 60% { transform: translateY(4px) } }
        @keyframes pecheWave { from { transform: translateX(0) } to { transform: translateX(-80px) } }
        .peche-bob { animation: pecheBob 1.6s ease-in-out infinite; transform-box: fill-box; }
        .peche-bite { animation: pecheBite 0.45s ease-in-out infinite; transform-box: fill-box; }
        .peche-wave { animation: pecheWave 4s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .peche-bob, .peche-bite, .peche-wave { animation: none; } }
      `}</style>
      <svg viewBox="0 0 480 360" preserveAspectRatio="xMidYMid slice" className="w-full h-full block">
        <defs>
          <linearGradient id="pecheWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={z.top} />
            <stop offset="1" stopColor={z.bottom} />
          </linearGradient>
        </defs>
        <rect width="480" height="360" fill={z.sky} />
        <circle cx="400" cy="60" r="30" fill="#FFE27A" stroke="#05061A" strokeWidth="5" />
        <rect y="150" width="480" height="210" fill="url(#pecheWater)" />
        <g className="peche-wave">
          <path d="M0 150 Q 20 140 40 150 T 80 150 T 120 150 T 160 150 T 200 150 T 240 150 T 280 150 T 320 150 T 360 150 T 400 150 T 440 150 T 480 150 T 520 150 T 560 150" fill="none" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="5" />
        </g>
        {/* dock */}
        <rect x="-10" y="130" width="120" height="22" rx="4" fill="#C2632B" stroke="#05061A" strokeWidth="5" />
        {[20, 70].map((x) => <rect key={x} x={x} y="148" width="14" height="70" fill="#8E4418" stroke="#05061A" strokeWidth="5" />)}
        {/* rod and line */}
        <line x1="60" y1="130" x2="130" y2="40" stroke="#05061A" strokeWidth="7" strokeLinecap="round" />
        <line x1="130" y1="40" x2={floatX} y2="150" stroke="#05061A" strokeWidth="2" style={{ transition: 'all 400ms ease-out' }} />
        <g transform={`translate(${floatX} 150)`} style={{ transition: 'transform 400ms ease-out' }}>
          <g className={phase === 'reeling' ? 'peche-bite' : 'peche-bob'}>
            <circle r="11" fill="#FFFFFF" stroke="#05061A" strokeWidth="5" />
            <path d="M-11 0 A11 11 0 0 1 11 0 Z" fill="#FF4F8B" stroke="#05061A" strokeWidth="5" strokeLinejoin="round" />
          </g>
        </g>
      </svg>
    </div>
  );
}

function LandedCard({ landed }: { landed: Landed }) {
  const sp = SPECIES_BY_ID.get(landed.speciesId);
  if (!sp) return null;
  const r = RARITIES[landed.rarity];
  return (
    <div className="w-full max-w-sm rounded-[22px] border-4 border-brand-border bg-brand-card p-5 text-center shadow-[0_8px_0_#05061A] animate-in zoom-in-90 duration-200">
      <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
        <span className="px-2.5 py-0.5 rounded-lg border-2 border-brand-border font-display text-sm text-brand-bg" style={{ background: r.color }}>{r.label}</span>
        {landed.variant && <span className="px-2.5 py-0.5 rounded-lg border-2 border-brand-border bg-accent-primary text-brand-bg font-display text-sm">{VARIANTS[landed.variant as keyof typeof VARIANTS].label}</span>}
        {landed.isNew && <span className="px-2.5 py-0.5 rounded-lg border-2 border-brand-border bg-accent-secondary text-white font-display text-sm">Nouvelle espèce !</span>}
        {sp.tide && <span className="px-2.5 py-0.5 rounded-lg border-2 border-brand-border bg-[#9EE7FF] text-brand-bg font-display text-sm">Espèce de marée</span>}
      </div>
      <div className="flex justify-center my-2"><FishIcon color={sp.color} rarity={sp.rarity} size={130} variant={landed.variant} /></div>
      <div className="font-display text-3xl leading-tight">{sp.name}</div>
      <div className="text-sm font-bold text-tx-secondary">{fmtKg(landed.weight)}{landed.quality === 'perfect' ? ' · Prise parfaite ×1,5' : ''}</div>
      <div className="mt-2 font-display text-2xl text-accent-success">+{fmtBig(landed.value)} ₶ <span className="text-sm text-tx-secondary">avant la criée</span></div>
      {Object.keys(landed.materials).length > 0 && (
        <div className="mt-2 flex justify-center gap-1.5 flex-wrap">
          {Object.entries(landed.materials).map(([m, q]) => (
            <span key={m} className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-brand-bg text-xs font-black" style={{ color: MATERIALS[m as MaterialId].color }}>
              +{q} {MATERIALS[m as MaterialId].label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Materials({ materials }: { materials: Record<string, number> }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {(Object.keys(MATERIALS) as MaterialId[]).map((m) => (
        <div key={m} className="rounded-xl border-[3px] border-brand-border bg-brand-inner px-2 py-1.5 text-center">
          <div className="text-[11px] font-black" style={{ color: MATERIALS[m].color }}>{MATERIALS[m].label}</div>
          <div className="font-display text-lg tabular-nums leading-tight">{fmtBig(materials[m] || 0)}</div>
        </div>
      ))}
    </div>
  );
}

function Market({ state }: { state: PecheState }) {
  return (
    <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
      <div className="font-display text-xl mb-1">Criée du jour</div>
      <p className="text-xs font-bold text-tx-secondary mb-2">Ces poissons se vendent plus cher aujourd’hui.</p>
      <div className="space-y-1.5">
        {state.market.deals.map((d) => {
          const sp = SPECIES_BY_ID.get(d.speciesId);
          if (!sp) return null;
          return (
            <div key={d.speciesId} className="flex items-center gap-2 rounded-xl border-2 border-brand-border bg-brand-card px-2 py-1">
              <FishIcon color={sp.color} rarity={sp.rarity} size={36} />
              <div className="min-w-0 flex-1">
                <div className="font-display text-base leading-tight truncate">{sp.name}</div>
                <div className="text-xs font-bold text-tx-secondary">{ZONES[sp.zone].name}</div>
              </div>
              <span className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-primary text-brand-bg font-display">×{d.mult}</span>
            </div>
          );
        })}
        <div className="flex items-center justify-between rounded-xl border-2 border-brand-border bg-brand-card px-3 py-1.5">
          <span className="font-display text-base">Marée haute : {ZONES[state.market.zone].name}</span>
          <span className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-info text-white font-display">×{state.market.zoneMult}</span>
        </div>
      </div>
    </div>
  );
}

type Api = (action: string, extra?: Record<string, unknown>) => Promise<any>;

function CostLine({ coins, mats, state }: { coins: number; mats: Record<string, number | undefined>; state: PecheState }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={cn('px-2 py-0.5 rounded-lg border-2 border-brand-border text-xs font-black', state.balance >= coins ? 'bg-brand-bg text-accent-primary' : 'bg-brand-bg text-accent-secondary')}>
        {fmtBig(coins)} ₶
      </span>
      {Object.entries(mats).map(([m, q]) => (
        <span key={m} className={cn('px-2 py-0.5 rounded-lg border-2 border-brand-border bg-brand-bg text-xs font-black', (state.materials[m as MaterialId] || 0) >= (q || 0) ? '' : 'opacity-60')} style={{ color: MATERIALS[m as MaterialId].color }}>
          {fmtBig(q || 0)} {MATERIALS[m as MaterialId].label}
        </span>
      ))}
    </div>
  );
}

function GearPanel({ state, api }: { state: PecheState; api: Api }) {
  const odds = rarityOdds(state.gear, state.tree);
  return (
    <div className="space-y-2.5">
      <Materials materials={state.materials} />
      {(Object.keys(GEAR) as GearId[]).map((g) => {
        const level = lvl(state.gear, g);
        const maxed = level >= maxGearLevel(g);
        const cost = gearCost(g, level);
        return (
          <div key={g} className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-display text-xl leading-tight">{GEAR[g].label} <span className="text-accent-primary">niv. {level}</span></div>
                <p className="text-xs font-bold text-tx-secondary">{GEAR[g].hint}</p>
              </div>
              <button
                onClick={async () => { const r = await api('upgrade', { gear: g }); if (r) { sfx.coin(); } }}
                disabled={maxed}
                className={cn(BRAWL.yellow, 'h-11 px-3 text-base shrink-0')}
              >
                {maxed ? 'Max' : 'Améliorer'}
              </button>
            </div>
            {!maxed && <div className="mt-2"><CostLine coins={cost.coins} mats={cost.mats} state={state} /></div>}
            {g === 'hamecon' && (
              <div className="mt-2 flex gap-1 flex-wrap">
                {RARITIES.map((r, i) => (
                  <span key={r.id} className="px-1.5 py-0.5 rounded-md bg-brand-bg border-2 border-brand-border text-[11px] font-black" style={{ color: r.color }}>
                    {r.label} {(odds[i] * 100).toFixed(i >= 3 ? 1 : 0)} %
                  </span>
                ))}
              </div>
            )}
            {g === 'auto' && level > 0 && (
              <p className="mt-2 text-xs font-bold text-tx-secondary">
                Un poisson toutes les {state.autoInterval.toFixed(1)} s, payé {Math.round(state.autoEfficiency * 100)} %.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MapPanel({ state, api }: { state: PecheState; api: Api }) {
  const boat = lvl(state.gear, 'bateau');
  return (
    <div className="space-y-2">
      {ZONES.map((z) => {
        const open = z.id <= boat;
        const here = z.id === state.zone;
        const caught = SPECIES.filter((s) => s.zone === z.id && state.dex.some((d) => d.speciesId === s.id)).length;
        const total = SPECIES.filter((s) => s.zone === z.id).length;
        return (
          <button
            key={z.id}
            disabled={!open || here}
            onClick={async () => { const r = await api('travel', { zone: z.id }); if (r) sfx.select(); }}
            className={cn(
              'w-full flex items-center gap-3 rounded-2xl border-[3px] border-brand-border p-2 text-left transition-transform',
              here ? 'bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00]' : open ? 'bg-[#2B3170] hover:bg-[#333A80] active:translate-y-[2px] shadow-[inset_0_-4px_0_#1A1F52]' : 'bg-brand-inner opacity-70'
            )}
          >
            <span className="h-12 w-16 shrink-0 rounded-xl border-[3px] border-brand-border" style={{ background: `linear-gradient(${z.sky} 0 35%, ${z.top} 35%, ${z.bottom})` }} />
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg leading-tight">{z.name}</div>
              <div className={cn('text-xs font-bold', here ? 'text-brand-bg/80' : 'text-tx-secondary')}>{z.region} · {caught}/{total} espèces</div>
            </div>
            {here ? <Anchor className="h-5 w-5" /> : open ? null : (
              <span className="flex items-center gap-1 text-xs font-black text-tx-secondary"><Lock className="h-4 w-4" /> Bateau {z.id}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function DexPanel({ state }: { state: PecheState }) {
  const known = new Map(state.dex.map((d) => [d.speciesId, d]));
  return (
    <div className="space-y-3">
      <div className="font-display text-xl">{known.size}/{SPECIES.length} espèces</div>
      {ZONES.map((z) => (
        <div key={z.id}>
          <div className="font-display text-lg mb-1">{z.name}</div>
          <div className="grid grid-cols-4 gap-1.5">
            {SPECIES.filter((s) => s.zone === z.id).map((s) => {
              const d = known.get(s.id);
              return (
                <div key={s.id} title={d ? `${s.name} · record ${fmtKg(d.bestWeight)} · ${d.caught} prises` : s.tide ? 'Espèce de marée' : '???'} className="rounded-xl border-2 border-brand-border bg-brand-inner p-1 flex flex-col items-center">
                  <FishIcon color={s.color} rarity={s.rarity} size={44} unknown={!d} />
                  <span className="text-[10px] font-black text-center leading-tight line-clamp-2 min-h-[2.2em]" style={{ color: d ? RARITIES[s.rarity].color : undefined }}>
                    {d ? s.name : s.tide ? `Marée ${z.id + 1}` : '???'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MareesPanel({ state, api }: { state: PecheState; api: Api }) {
  const pct = Math.min(100, (state.runEarned / state.threshold) * 100);
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
        <div className="font-display text-xl">Grande Marée {state.maree + 1}</div>
        <p className="text-xs font-bold text-tx-secondary mb-2">
          Gagne {fmtBig(state.threshold)} ₶ dans cette partie. Tu repars de zéro (argent, matériel, matériaux), mais tu gardes tes Perles, ton Poissodex et ton niveau.
        </p>
        <div className="h-4 rounded-full bg-brand-bg border-[3px] border-brand-border overflow-hidden">
          <div className="h-full bg-accent-info" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-xs font-black text-tx-secondary tabular-nums">{fmtBig(state.runEarned)} / {fmtBig(state.threshold)} ₶</div>
        <button
          onClick={async () => {
            if (!confirm(`Lancer la Grande Marée ? Tu gagnes ${state.perlesIfPrestige} Perles et tu repars de zéro.`)) return;
            const r = await api('prestige');
            if (r) { sfx.jackpot(); toast.success(`Marée ${r.maree} ! +${r.perles} Perles de marée`); }
          }}
          disabled={state.perlesIfPrestige <= 0}
          className={cn(BRAWL.blue, 'mt-3 w-full h-14 text-xl')}
        >
          <Waves className="h-6 w-6" /> {state.perlesIfPrestige > 0 ? `Grande Marée · +${state.perlesIfPrestige} Perles` : 'Pas encore'}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="font-display text-xl">Arbre des Marées</div>
        <span className="px-2.5 py-1 rounded-xl border-[3px] border-brand-border bg-[#9EE7FF] text-brand-bg font-display flex items-center gap-1">
          <Sparkles className="h-4 w-4" /> {fmtBig(state.perles)} Perles
        </span>
      </div>
      {(Object.keys(TREE) as TreeId[]).map((n) => {
        const level = lvl(state.tree, n);
        const max = TREE[n].max;
        const maxed = max !== undefined && level >= max;
        const cost = treeCost(n, level);
        return (
          <div key={n} className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg leading-tight">{TREE[n].label} <span className="text-accent-primary">niv. {level}</span></div>
              <p className="text-xs font-bold text-tx-secondary">{TREE[n].hint(level)}{maxed ? '' : ` → ${TREE[n].hint(level + 1)}`}</p>
            </div>
            <button
              onClick={async () => { const r = await api('tree', { node: n }); if (r) sfx.coin(); }}
              disabled={maxed || state.perles < cost}
              className={cn(BRAWL.yellow, 'h-11 px-3 text-base shrink-0')}
            >
              {maxed ? <Check className="h-5 w-5" /> : `${fmtBig(cost)} Perles`}
            </button>
          </div>
        );
      })}
      <p className="text-xs font-bold text-tx-secondary">
        Chaque Marée compte aussi ×{(1 + 0.5 * (state.maree + 1)).toFixed(1).replace('.', ',')} sur toutes tes ventes (au lieu de ×{(1 + 0.5 * state.maree).toFixed(1).replace('.', ',')}), et débloque une espèce de marée dans un nouveau coin.
      </p>
    </div>
  );
}
