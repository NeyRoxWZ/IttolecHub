'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft, Anchor, BookOpen, Coins, Fish, Map as MapIcon, Sparkles, Waves, Wrench, Zap, Lock, Check, X,
  HelpCircle, ShoppingBag, Target, Gift, CloudRain, Sun, CloudFog, CloudLightning, Moon, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import {
  COSMETICS, COSMETIC_BY_ID, COSMETIC_SLOTS, DEPTH_START, GEAR, MATERIALS, MISSION_TEXT, RARITIES, SPECIES, TREE, VARIANTS,
  WEATHER, ZONES, getSpecies, mareeBadge, mareeTitle, speciesOfZone, zoneInfo,
  type CosmeticSlot, type GearId, type MaterialId, type TreeId, type WeatherId,
} from '@/lib/peche/data';
import { CHEST_DAYS, gearCost, lvl, maxGearLevel, rarityOdds, treeCost } from '@/lib/peche/engine';
import { fmtBig, fmtKg } from '@/lib/peche/format';
import type { PecheState } from '@/lib/peche/server';
import FishIcon from './FishIcon';
import ReelGauge from './ReelGauge';
import ChestOpening from './ChestOpening';
import PecheGuide, { GUIDE_KEY } from './PecheGuide';
import CosmeticIcon from './CosmeticIcon';

type Phase = 'idle' | 'waiting' | 'reeling' | 'landed' | 'lost';
type Tab = 'peche' | 'quetes' | 'boutique' | 'materiel' | 'carte' | 'dex' | 'marees';
type Api = (action: string, extra?: Record<string, unknown>) => Promise<any>;

interface Landed {
  speciesId: string; rarity: number; weight: number; variant: string;
  quality: 'perfect' | 'good'; value: number; materials: Record<string, number>; isNew: boolean;
}

const TABS: { id: Tab; label: string; icon: typeof Fish }[] = [
  { id: 'peche', label: 'Pêche', icon: Fish },
  { id: 'quetes', label: 'Quêtes', icon: Target },
  { id: 'boutique', label: 'Boutique', icon: ShoppingBag },
  { id: 'materiel', label: 'Matériel', icon: Wrench },
  { id: 'carte', label: 'Carte', icon: MapIcon },
  { id: 'dex', label: 'Poissodex', icon: BookOpen },
  { id: 'marees', label: 'Marées', icon: Waves },
];

const WEATHER_ICON: Record<WeatherId, typeof Sun> = { soleil: Sun, pluie: CloudRain, brume: CloudFog, orage: CloudLightning, lune: Moon };

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function PecheGame({ userId }: { userId: string }) {
  const [state, setState] = useState<PecheState | null>(null);
  const [tab, setTab] = useState<Tab>('peche');
  const [phase, setPhase] = useState<Phase>('idle');
  const [castInfo, setCastInfo] = useState<{ id: string; rarity: number; green: number; speed: number; fill: number; drain: number } | null>(null);
  const [autoNextAt, setAutoNextAt] = useState<number | null>(null);
  const [autoPops, setAutoPops] = useState<{ key: number; speciesId: string; rarity: number; value: number; variant: string }[]>([]);
  const [landed, setLanded] = useState<Landed | null>(null);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const [autoFeed, setAutoFeed] = useState<{ key: number; speciesId: string; rarity: number; value: number; variant: string }[]>([]);
  const [guide, setGuide] = useState(false);
  const [opening, setOpening] = useState(false);
  const stateRef = useRef<PecheState | null>(null);
  stateRef.current = state;

  const api: Api = useCallback(async (action, extra = {}) => {
    const { silent, ...payload } = extra as { silent?: boolean };
    const res = await fetch('/api/peche', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action, ...payload }),
    });
    const data = await res.json();
    // The auto rod polls in the background: a clash with a manual catch just
    // waits for the next tick instead of flashing an error.
    if (!res.ok) { if (!silent) toast.error(data.error || 'Erreur'); return null; }
    if (data.state) setState(data.state);
    return data.result;
  }, [userId]);

  const reload = useCallback(() => {
    fetch(`/api/peche?user_id=${userId}`)
      .then((r) => r.json())
      .then((d) => { if (d.state) setState(d.state); else toast.error(d.error || 'Erreur'); });
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { try { if (!localStorage.getItem(GUIDE_KEY)) setGuide(true); } catch {} }, []);

  // Weather and timed boosts change on their own: re-read when the weather turns.
  useEffect(() => {
    if (!state) return;
    const wait = Math.max(1000, state.weather.endsAt - Date.now() + 500);
    const t = setTimeout(reload, wait);
    return () => clearTimeout(t);
  }, [state?.weather.endsAt, reload, state]);

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
    const wait = 600 + Math.random() * 1400;
    setTimeout(() => { sfx.tick(); vibrate(HAPTIC.MEDIUM); setPhase('reeling'); }, wait);
  };

  const onReelDone = async (quality: 'perfect' | 'good' | 'fail') => {
    if (!castInfo) return;
    const before = new Set((stateRef.current?.dex || []).map((d) => d.speciesId));
    const r = await api('reel', { cast_id: castInfo.id, quality });
    setCastInfo(null);
    if (!r || !r.caught) { setPhase('lost'); sfx.lose(); vibrate(HAPTIC.ERROR); return; }
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
    let inFlight = false;
    const tick = async () => {
      if (stop || inFlight) return;
      inFlight = true;
      const r = await api('auto', { silent: true });
      inFlight = false;
      if (r?.nextAt) setAutoNextAt(r.nextAt);
      if (r?.catches?.length) {
        sfx.coin();
        const items = r.catches.map((c: { speciesId: string; rarity: number; value: number; variant: string }) => ({ key: Date.now() + n++, ...c }));
        setAutoFeed((prev) => [...items, ...prev].slice(0, 8));
        // Shown on the scene too, whatever tab is open: the feed in the panel
        // was out of sight most of the time.
        setAutoPops((prev) => [...items, ...prev].slice(0, 4));
        items.forEach((it: { key: number }) => setTimeout(() => setAutoPops((p) => p.filter((x) => x.key !== it.key)), 3500));
      }
    };
    void tick();
    // Poll often and let the server decide: the old timer fired on the exact
    // interval, lost the race by a few ms and only caught every other time.
    const id = setInterval(tick, 2000);
    return () => { stop = true; clearInterval(id); setAutoNextAt(null); };
  }, [auto, hasAuto, autoInterval, api]);

  if (!state) return <div className="h-[520px] rounded-[22px] border-4 border-brand-border bg-brand-card animate-pulse" />;

  const zone = zoneInfo(state.zone);
  const badge = mareeBadge(state.maree);
  const WeatherIcon = WEATHER_ICON[state.weather.id];
  const questsReady = (state.chest.claimedToday ? 0 : 1)
    + [...state.missions.daily, ...state.missions.weekly].filter((m) => !m.claimed && m.progress >= m.target).length
    + state.orders.filter((o) => o.have >= o.count).length;

  return (
    <div>
      {guide && <PecheGuide onClose={() => setGuide(false)} />}
      {opening && (
        <ChestOpening
          packsLeft={state.packs}
          equipped={state.equipped}
          onOpen={(count) => api('open_pack', { count })}
          onEquip={async (id) => { const c = COSMETIC_BY_ID.get(id); if (c && await api('equip', { slot: c.slot, cosmetic_id: id })) toast.success(`${c.name} équipé`); }}
          onClose={() => setOpening(false)}
        />
      )}

      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/?mode=solo" aria-label="Retour" className={cn(BRAWL.pink, 'h-12 w-12 shrink-0')}>
            <ArrowLeft className="h-6 w-6" strokeWidth={3} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-3xl sm:text-4xl leading-none">Frenly Pêche</h1>
            <p className="text-sm font-bold text-tx-secondary mt-0.5">{zone.region} · {zone.name}</p>
          </div>
          <button onClick={() => setGuide(true)} aria-label="Guide" className={cn(BRAWL.dark, 'h-12 w-12 shrink-0')}>
            <HelpCircle className="h-6 w-6" />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={BRAWL.pill} title={WEATHER[state.weather.id].hint}>
            <span className="h-8 w-8 rounded-xl bg-accent-info border-2 border-brand-border flex items-center justify-center"><WeatherIcon className="h-5 w-5 text-white" /></span>
            {WEATHER[state.weather.id].label}
            <WeatherCountdown endsAt={state.weather.endsAt} />
          </span>
          <span
            className="h-12 inline-flex items-center gap-2 rounded-2xl border-[3px] border-brand-border px-3 font-display text-lg"
            style={{ background: badge.fill, color: badge.text, boxShadow: `inset 0 -4px 0 ${badge.shade}` }}
            title={`Marée ${state.maree} · ${badge.label}`}
          >
            <Waves className="h-5 w-5" /> Marée {state.maree} · {mareeTitle(state.maree)}
          </span>
          <span className={BRAWL.pill} title="Niveau de pêcheur">
            <span className="h-8 min-w-8 px-1 rounded-xl bg-accent-info border-2 border-brand-border flex items-center justify-center text-base">{state.level.level}</span>
            <span className="w-16 h-3 rounded-full bg-[#2B3170] border-2 border-brand-border overflow-hidden">
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


      {/* Fixed height: switching tabs must never resize the game. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_440px] gap-4 lg:h-[700px]">
        <section className={cn(BRAWL.panel, 'relative overflow-hidden h-[480px] lg:h-full flex flex-col')}>
          <Scene zoneId={state.zone} phase={phase} weather={state.weather.id} equipped={state.equipped} />
          {/* Boosts float over the scene: showing them never changes the page's size. */}
          <div className="absolute top-3 left-3 right-3 z-20 pointer-events-none"><ActiveEffects effects={state.effects} /></div>
          {auto && hasAuto && <AutoProgress nextAt={autoNextAt} interval={autoInterval} />}
          <div className="absolute right-3 top-14 z-20 flex flex-col items-end gap-1.5 pointer-events-none">
            {autoPops.map((p) => {
              const sp = getSpecies(p.speciesId);
              if (!sp) return null;
              return (
                <div key={p.key} className="animate-in slide-in-from-right-6 fade-in duration-300 flex items-center gap-2 rounded-xl border-[3px] border-brand-border bg-brand-card/95 pl-1 pr-2.5 py-1 shadow-[0_3px_0_#05061A]"
                  style={{ boxShadow: `inset 4px 0 0 ${RARITIES[p.rarity].color}, 0 3px 0 #05061A` }}
                >
                  <FishIcon color={sp.color} rarity={sp.rarity} size={40} variant={p.variant} />
                  <div className="leading-tight">
                    <div className="font-display text-sm">{sp.name}{p.variant ? ` · ${VARIANTS[p.variant as keyof typeof VARIANTS].label}` : ''}</div>
                    <div className="text-xs font-black text-accent-success tabular-nums">+{fmtBig(p.value)} ₶ · auto</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative z-10 flex-1 flex items-center justify-center p-4">
            {phase === 'reeling' && castInfo && (
              <div className="rounded-[22px] border-4 border-brand-border bg-brand-card/95 p-4 shadow-[0_6px_0_#05061A] animate-in zoom-in-95 duration-150">
                <ReelGauge key={castInfo.id} green={castInfo.green} speed={castInfo.speed} fill={castInfo.fill} drain={castInfo.drain} onDone={onReelDone} />
              </div>
            )}
            {phase === 'landed' && landed && (
              <LandedCard landed={landed} effect={state.equipped.effet} onClose={() => { setLanded(null); setPhase('idle'); }} />
            )}
            {phase === 'lost' && (
              <button onClick={() => setPhase('idle')} className="rounded-2xl border-[3px] border-brand-border bg-accent-secondary text-white px-5 py-3 font-display text-2xl shadow-[inset_0_-4px_0_#C92D63,0_4px_0_#05061A] animate-in zoom-in-90">
                Il s’est échappé…
              </button>
            )}
            {phase === 'waiting' && (
              <div className="rounded-2xl border-[3px] border-brand-border bg-brand-card/90 px-5 py-3 font-display text-2xl animate-pulse">Attends la touche…</div>
            )}
          </div>

          <div className="relative z-10 p-4 pt-0 flex gap-2">
            <button onClick={castLine} disabled={busy || phase === 'waiting' || phase === 'reeling'} className={cn(BRAWL.yellow, 'flex-1 h-16 text-2xl rounded-2xl')}>
              <Fish className="h-7 w-7" /> {phase === 'landed' || phase === 'lost' ? 'Relancer' : 'Lancer la ligne'}
            </button>
            <button
              onClick={() => { if (!hasAuto) { toast.info('Achète une canne auto dans Matériel.'); return; } sfx.click(); setAuto((a) => !a); }}
              className={cn(auto ? BRAWL.green : BRAWL.dark, 'h-16 px-4 rounded-2xl text-lg flex-col gap-0 leading-none')}
              title={hasAuto ? `Un poisson toutes les ${autoInterval.toFixed(1)} s, à ${Math.round(state.autoEfficiency * 100)} % de la valeur` : 'Pas encore de canne auto'}
            >
              <Zap className="h-5 w-5" />
              <span className="text-sm">{auto ? 'Auto ON' : 'Auto'}</span>
            </button>
          </div>
        </section>

        <section className={cn(BRAWL.panel, 'p-4 flex flex-col gap-3 h-[640px] lg:h-full min-h-0')}>
          <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-4 gap-1 rounded-[18px] border-[3px] border-brand-border bg-brand-bg p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => { sfx.click(); setTab(t.id); }}
                className={cn(
                  'relative h-14 rounded-xl flex flex-col items-center justify-center gap-0.5 font-display text-xs sm:text-sm leading-none transition-transform active:translate-y-[2px]',
                  tab === t.id ? 'bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00]' : 'text-tx-secondary hover:text-white hover:bg-[#2B3170]'
                )}
              >
                <t.icon className="h-5 w-5" />
                {t.label}
                {t.id === 'quetes' && questsReady > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-accent-secondary border-2 border-brand-border text-white text-[11px] flex items-center justify-center">{questsReady}</span>
                )}
                {t.id === 'boutique' && state.packs > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-accent-primary border-2 border-brand-border text-brand-bg text-[11px] flex items-center justify-center">{state.packs}</span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            {tab === 'peche' && <PechePanel state={state} api={api} autoFeed={autoFeed} />}
            {tab === 'quetes' && <QuestsPanel state={state} api={api} />}
            {tab === 'boutique' && <ShopPanel state={state} api={api} onOpen={() => setOpening(true)} />}
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

/** A bar under the scene's top edge filling up to the auto rod's next catch. */
function AutoProgress({ nextAt, interval }: { nextAt: number | null; interval: number }) {
  const now = useNow(200);
  const left = nextAt ? Math.max(0, nextAt - now) : interval * 1000;
  const pct = Math.max(0, Math.min(100, 100 - (left / (interval * 1000)) * 100));
  return (
    <div className="absolute bottom-24 left-4 right-4 z-20 pointer-events-none">
      <div className="flex items-center gap-2 rounded-xl border-[3px] border-brand-border bg-brand-card/90 px-2 py-1">
        <Zap className="h-4 w-4 text-accent-success shrink-0" />
        <div className="flex-1 h-3 rounded-full bg-brand-bg border-2 border-brand-border overflow-hidden">
          <div className="h-full bg-accent-success" style={{ width: `${pct}%`, transition: 'width 200ms linear' }} />
        </div>
        <span className="font-display text-sm tabular-nums">{(left / 1000).toFixed(1).replace('.', ',')} s</span>
      </div>
    </div>
  );
}

function WeatherCountdown({ endsAt }: { endsAt: number }) {
  const now = useNow();
  return <span className="text-sm text-tx-secondary tabular-nums">{mmss(endsAt - now)}</span>;
}

function ActiveEffects({ effects }: { effects: Record<string, number | undefined> }) {
  const now = useNow();
  const labels: Record<string, string> = { appat: 'Appât doré', criee: 'Criée VIP', moulinet: 'Moulinet huilé', turbo: 'Canne turbo', boussole: 'Boussole des marées' };
  const active = Object.entries(effects).filter(([, t]) => Number(t) > now);
  if (!active.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map(([id, t]) => (
        <span key={id} className="h-9 inline-flex items-center gap-1.5 rounded-xl border-[3px] border-brand-border bg-accent-success text-brand-bg px-2.5 font-display shadow-[inset_0_-3px_0_#1E9A55]">
          <Sparkles className="h-4 w-4" /> {labels[id] || id} · <span className="tabular-nums">{mmss(Number(t) - now)}</span>
        </span>
      ))}
    </div>
  );
}

function Scene({ zoneId, phase, weather, equipped }: { zoneId: number; phase: Phase; weather: WeatherId; equipped: Partial<Record<CosmeticSlot, string>> }) {
  const z = zoneInfo(zoneId);
  const out = phase === 'waiting' || phase === 'reeling';
  const floatX = out ? 300 : 150;
  const decor = equipped.decor ? COSMETIC_BY_ID.get(equipped.decor) : undefined;
  const floatC = (equipped.flotteur ? COSMETIC_BY_ID.get(equipped.flotteur)?.colors : undefined) || ['#FF4F8B', '#FFFFFF'];
  const rodC = (equipped.canne ? COSMETIC_BY_ID.get(equipped.canne)?.colors[0] : undefined) || '#05061A';
  const dark = weather === 'orage' || weather === 'lune';
  const sky = decor ? decor.colors[0] : dark ? '#1A1E3A' : z.sky;
  const sun = weather === 'lune' ? '#F4F4FF' : decor ? decor.colors[1] : '#FFE27A';

  return (
    <div className="absolute inset-0">
      <style>{`
        @keyframes pecheBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(4px) } }
        @keyframes pecheBite { 0%,100% { transform: translateY(0) } 30% { transform: translateY(14px) } 60% { transform: translateY(4px) } }
        @keyframes pecheWave { from { transform: translateX(0) } to { transform: translateX(-80px) } }
        @keyframes pecheRain { from { transform: translateY(-40px) } to { transform: translateY(400px) } }
        @keyframes pecheFlash { 0%, 92%, 100% { opacity: 0 } 94% { opacity: .5 } }
        .peche-bob { animation: pecheBob 1.6s ease-in-out infinite; transform-box: fill-box; }
        .peche-bite { animation: pecheBite 0.45s ease-in-out infinite; transform-box: fill-box; }
        .peche-wave { animation: pecheWave 4s linear infinite; }
        .peche-rain { animation: pecheRain .7s linear infinite; }
        .peche-flash { animation: pecheFlash 6s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .peche-bob, .peche-bite, .peche-wave, .peche-rain, .peche-flash { animation: none; } }
      `}</style>
      <svg viewBox="0 0 480 360" preserveAspectRatio="xMidYMid slice" className="w-full h-full block">
        <defs>
          <linearGradient id="pecheWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={z.top} />
            <stop offset="1" stopColor={z.bottom} />
          </linearGradient>
        </defs>
        <rect width="480" height="360" fill={sky} />
        {(weather === 'lune' || decor?.id === 'de-nuit') && [[60, 40], [120, 70], [220, 30], [300, 60], [340, 20], [180, 90]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="#FFFFFF" />
        ))}
        {decor?.id === 'de-aurore' && <path d="M0 60 Q 120 10 240 60 T 480 50 L 480 90 Q 360 50 240 100 T 0 100 Z" fill="#33D17A" opacity="0.5" />}
        {weather !== 'orage' && <circle cx="400" cy="60" r="30" fill={sun} stroke="#05061A" strokeWidth="5" />}
        <rect y="150" width="480" height="210" fill="url(#pecheWater)" />
        <g className="peche-wave">
          <path d="M0 150 Q 20 140 40 150 T 80 150 T 120 150 T 160 150 T 200 150 T 240 150 T 280 150 T 320 150 T 360 150 T 400 150 T 440 150 T 480 150 T 520 150 T 560 150" fill="none" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="5" />
        </g>
        <rect x="-10" y="130" width="120" height="22" rx="4" fill="#C2632B" stroke="#05061A" strokeWidth="5" />
        {[20, 70].map((x) => <rect key={x} x={x} y="148" width="14" height="70" fill="#8E4418" stroke="#05061A" strokeWidth="5" />)}
        <line x1="60" y1="130" x2="130" y2="40" stroke="#05061A" strokeWidth="9" strokeLinecap="round" />
        <line x1="60" y1="130" x2="130" y2="40" stroke={rodC} strokeWidth="5" strokeLinecap="round" />
        <line x1="130" y1="40" x2={floatX} y2="150" stroke="#05061A" strokeWidth="2" style={{ transition: 'all 400ms ease-out' }} />
        <g transform={`translate(${floatX} 150)`} style={{ transition: 'transform 400ms ease-out' }}>
          <g className={phase === 'reeling' ? 'peche-bite' : 'peche-bob'}>
            <circle r="11" fill={floatC[1]} stroke="#05061A" strokeWidth="5" />
            <path d="M-11 0 A11 11 0 0 1 11 0 Z" fill={floatC[0]} stroke="#05061A" strokeWidth="5" strokeLinejoin="round" />
          </g>
        </g>
        {(weather === 'pluie' || weather === 'orage') && (
          <g className="peche-rain">
            {Array.from({ length: 40 }, (_, i) => (
              <line key={i} x1={(i * 53) % 480} y1={(i * 97) % 360 - 360} x2={(i * 53) % 480 - 6} y2={(i * 97) % 360 - 345} stroke="#DDEFFF" strokeOpacity="0.7" strokeWidth="2.5" />
            ))}
            {Array.from({ length: 40 }, (_, i) => (
              <line key={`b${i}`} x1={(i * 53) % 480} y1={(i * 97) % 360} x2={(i * 53) % 480 - 6} y2={(i * 97) % 360 + 15} stroke="#DDEFFF" strokeOpacity="0.7" strokeWidth="2.5" />
            ))}
          </g>
        )}
        {weather === 'brume' && <rect width="480" height="360" fill="#FFFFFF" opacity="0.35" />}
        {weather === 'orage' && <rect className="peche-flash" width="480" height="360" fill="#FFFFFF" />}
      </svg>
    </div>
  );
}

function CatchBurst({ effectId }: { effectId?: string }) {
  const effect = effectId ? COSMETIC_BY_ID.get(effectId) : undefined;
  const colors = effect?.colors || ['#9EE7FF', '#FFFFFF'];
  const star = effect?.id === 'ef-etoiles';
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      <style>{`@keyframes burst { from { transform: translate(0,0) scale(.4); opacity: 1 } to { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 0 } } .burst { animation: burst .9s ease-out forwards; }`}</style>
      {Array.from({ length: 18 }, (_, i) => {
        const a = (i / 18) * Math.PI * 2;
        const d = 90 + (i % 3) * 30;
        return (
          <span key={i} className="burst absolute left-1/2 top-1/2 border-2 border-brand-border"
            style={{ width: star ? 12 : 10, height: star ? 12 : 10, borderRadius: star ? 3 : 999, background: colors[i % colors.length], transform: star ? 'rotate(45deg)' : undefined, ['--dx' as string]: `${Math.cos(a) * d}px`, ['--dy' as string]: `${Math.sin(a) * d}px` }}
          />
        );
      })}
    </div>
  );
}

function LandedCard({ landed, effect, onClose }: { landed: Landed; effect?: string; onClose: () => void }) {
  const sp = getSpecies(landed.speciesId);
  if (!sp) return null;
  const r = RARITIES[landed.rarity];
  return (
    <div className="relative w-full max-w-sm rounded-[22px] border-4 border-brand-border bg-brand-card p-5 text-center shadow-[0_8px_0_#05061A] animate-in zoom-in-90 duration-200">
      <CatchBurst effectId={effect} />
      <button onClick={onClose} aria-label="Fermer" className={cn(BRAWL.dark, 'absolute top-3 right-3 h-10 w-10')}>
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center justify-center gap-2 mb-2 flex-wrap px-10">
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

function Box({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="font-display text-xl">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function PechePanel({ state, api, autoFeed }: { state: PecheState; api: Api; autoFeed: { key: number; speciesId: string; rarity: number; value: number }[] }) {
  const bagTotal = state.bag.reduce((s, b) => s + b.price, 0);
  const bagCount = state.bag.reduce((s, b) => s + b.count, 0);
  return (
    <div className="space-y-3">
      <Materials materials={state.materials} />
      <Box
        title={`Bourriche (${bagCount})`}
        right={
          <button
            onClick={async () => { const r = await api('sell'); if (r) { sfx.cashout(); toast.success(`Vendu +${fmtBig(r.earned)} ₶`); } }}
            disabled={bagCount === 0}
            className={cn(BRAWL.green, 'h-10 px-3 text-base')}
          >
            Tout vendre · {fmtBig(bagTotal)} ₶
          </button>
        }
      >
        {state.bag.length === 0 ? (
          <p className="text-sm font-bold text-tx-secondary">Vide. Lance ta ligne !</p>
        ) : (
          <div className="space-y-1.5">
            {[...state.bag].sort((a, b) => b.price - a.price).map((b) => {
              const sp = getSpecies(b.speciesId);
              if (!sp) return null;
              return (
                <div key={b.key} className="flex items-center gap-2 rounded-xl border-2 border-brand-border bg-brand-card px-2 py-1">
                  <FishIcon color={sp.color} rarity={sp.rarity} size={40} variant={b.variant} />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base leading-tight truncate">{sp.name}{b.variant ? ` · ${VARIANTS[b.variant].label}` : ''}</div>
                    <div className="text-xs font-black" style={{ color: RARITIES[sp.rarity].color }}>{RARITIES[sp.rarity].label} · ×{b.count}</div>
                  </div>
                  <button onClick={() => api('sell', { key: b.key })} className={cn(BRAWL.dark, 'h-9 px-2 text-sm')}>{fmtBig(b.price)} ₶</button>
                </div>
              );
            })}
          </div>
        )}
      </Box>

      <Box title="Criée du jour">
        <div className="space-y-1.5">
          {state.market.deals.map((d) => {
            const sp = getSpecies(d.speciesId);
            if (!sp) return null;
            return (
              <div key={d.speciesId} className="flex items-center gap-2 rounded-xl border-2 border-brand-border bg-brand-card px-2 py-1">
                <FishIcon color={sp.color} rarity={sp.rarity} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base leading-tight truncate">{sp.name}</div>
                  <div className="text-xs font-bold text-tx-secondary">{zoneInfo(sp.zone).name}</div>
                </div>
                <span className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-primary text-brand-bg font-display">×{d.mult}</span>
              </div>
            );
          })}
          <div className="flex items-center justify-between rounded-xl border-2 border-brand-border bg-brand-card px-3 py-1.5">
            <span className="font-display text-base">Marée haute : {zoneInfo(state.market.zone).name}</span>
            <span className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-info text-white font-display">×{state.market.zoneMult}</span>
          </div>
        </div>
      </Box>

      {autoFeed.length > 0 && (
        <Box title="Canne auto">
          <div className="space-y-1">
            {autoFeed.map((c) => (
              <div key={c.key} className="flex items-center gap-2 text-sm font-bold animate-in slide-in-from-top-1 fade-in">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: RARITIES[c.rarity].color }} />
                <span className="truncate flex-1">{getSpecies(c.speciesId)?.name}</span>
                <span className="tabular-nums text-accent-success">+{fmtBig(c.value)} ₶</span>
              </div>
            ))}
          </div>
        </Box>
      )}
    </div>
  );
}

function QuestsPanel({ state, api }: { state: PecheState; api: Api }) {
  const c = state.chest;
  return (
    <div className="space-y-3">
      <Box title="Coffre du jour" right={<span className="text-sm font-black text-tx-secondary">Jour {c.nextDay}/{CHEST_DAYS}</span>}>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {Array.from({ length: CHEST_DAYS }, (_, i) => {
            const day = i + 1;
            const done = c.claimedToday ? day <= c.day : day < c.nextDay;
            const today = !c.claimedToday && day === c.nextDay;
            return (
              <div key={day} className={cn('h-14 rounded-xl border-[3px] border-brand-border flex flex-col items-center justify-center font-display', done ? 'bg-accent-success text-brand-bg' : today ? 'bg-accent-primary text-brand-bg' : 'bg-brand-card text-tx-secondary')}>
                {day === CHEST_DAYS ? <Gift className="h-5 w-5" /> : done ? <Check className="h-5 w-5" /> : <span className="text-lg">{day}</span>}
              </div>
            );
          })}
        </div>
        <p className="text-xs font-bold text-tx-secondary mb-2">Reviens chaque jour : un jour manqué et la série repart à 1. Le jour 7 donne en plus 2 coffres au trésor.</p>
        <button
          onClick={async () => { const r = await api('chest'); if (r) { sfx.jackpot(); toast.success(`Jour ${r.day} : +${fmtBig(r.coins)} ₶${r.packs ? ` et ${r.packs} coffres` : ''}`); } }}
          disabled={c.claimedToday}
          className={cn(BRAWL.yellow, 'w-full h-12 text-lg')}
        >
          {c.claimedToday ? 'Reviens demain' : `Ouvrir · +${fmtBig(c.reward.coins)} ₶${c.reward.packs ? ` + ${c.reward.packs} coffres` : ''}`}
        </button>
      </Box>

      {(['daily', 'weekly'] as const).map((scope) => (
        <Box key={scope} title={scope === 'daily' ? 'Missions du jour' : 'Missions de la semaine'}
          right={<span className="text-xs font-black text-tx-secondary">{fmtBig(state.missionRewards[scope].coins)} ₶{state.missionRewards[scope].packs ? ' + 1 coffre' : ''} chacune</span>}
        >
          <div className="space-y-1.5">
            {state.missions[scope].map((m, i) => {
              const done = m.progress >= m.target;
              return (
                <div key={i} className="rounded-xl border-2 border-brand-border bg-brand-card px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-base leading-tight">{MISSION_TEXT[m.type](m.target)}{m.type === 'sell' ? ` (${fmtBig(m.target)} ₶)` : ''}</span>
                    {m.claimed ? (
                      <span className="text-accent-success font-display flex items-center gap-1"><Check className="h-4 w-4" /> Fait</span>
                    ) : (
                      <button onClick={async () => { const r = await api('mission', { scope, index: i }); if (r) sfx.coin(); }} disabled={!done} className={cn(BRAWL.green, 'h-9 px-3 text-sm shrink-0')}>
                        Réclamer
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-brand-bg border-2 border-brand-border overflow-hidden">
                    <div className="h-full bg-accent-primary" style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }} />
                  </div>
                  <div className="text-[11px] font-black text-tx-secondary tabular-nums mt-0.5">{fmtBig(m.progress)} / {fmtBig(m.target)}</div>
                </div>
              );
            })}
          </div>
        </Box>
      ))}

      <Box title="Commandes de la criée">
        <p className="text-xs font-bold text-tx-secondary mb-2">Des clients veulent des poissons précis et paient trois fois le prix. Une nouvelle commande arrive dès qu’une est livrée.</p>
        <div className="space-y-1.5">
          {state.orders.map((o) => {
            const sp = getSpecies(o.speciesId);
            if (!sp) return null;
            return (
              <div key={o.id} className="flex items-center gap-2 rounded-xl border-2 border-brand-border bg-brand-card px-2 py-1.5">
                <FishIcon color={sp.color} rarity={sp.rarity} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base leading-tight truncate">{o.count} × {sp.name}</div>
                  <div className="text-xs font-bold text-tx-secondary">{zoneInfo(sp.zone).name} · tu en as {o.have}</div>
                </div>
                <button onClick={async () => { const r = await api('deliver', { order_id: o.id }); if (r) { sfx.cashout(); toast.success(`Livré +${fmtBig(r.reward)} ₶`); } }} disabled={o.have < o.count} className={cn(BRAWL.yellow, 'h-10 px-2.5 text-sm shrink-0')}>
                  Livrer · {fmtBig(o.reward)} ₶
                </button>
              </div>
            );
          })}
        </div>
      </Box>
    </div>
  );
}

function ShopPanel({ state, api, onOpen }: { state: PecheState; api: Api; onOpen: () => void }) {
  const owned = new Set(state.cosmetics);
  return (
    <div className="space-y-3">
      <Box title="Boutique du jour" right={<span className="text-xs font-black text-tx-secondary">Change chaque jour</span>}>
        <div className="space-y-1.5">
          {state.shop.items.map((it) => (
            <div key={it.id} className={cn('rounded-xl border-2 border-brand-border px-2.5 py-2 flex items-center gap-2', it.promo ? 'bg-[#3A2150]' : 'bg-brand-card')}>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base leading-tight flex items-center gap-1.5">
                  {it.label}
                  {it.promo && <span className="px-1.5 rounded-md bg-accent-secondary text-white border-2 border-brand-border text-xs">Promo −{Math.round(state.shop.promoDiscount * 100)} %</span>}
                </div>
                <p className="text-xs font-bold text-tx-secondary">{it.hint}</p>
              </div>
              <button onClick={async () => { const r = await api('buy_item', { item: it.id }); if (r) { sfx.coin(); toast.success(`${it.label} activé`); } }} disabled={it.bought || state.balance < it.cost} className={cn(BRAWL.yellow, 'h-10 px-2.5 text-sm shrink-0')}>
                {it.bought ? 'Acheté' : `${fmtBig(it.cost)} ₶`}
              </button>
            </div>
          ))}
        </div>
      </Box>

      <Box title="Coffres au trésor" right={<span className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-primary text-brand-bg font-display flex items-center gap-1"><Package className="h-4 w-4" /> {state.packs}</span>}>
        <p className="text-xs font-bold text-tx-secondary mb-2">Uniquement des cosmétiques. Un doublon est converti en ₶.</p>
        <div className="flex gap-2">
          <button onClick={async () => { const r = await api('buy_pack'); if (r) sfx.coin(); }} disabled={state.balance < state.shop.packPrice} className={cn(BRAWL.dark, 'flex-1 h-12 text-base')}>
            Acheter · {fmtBig(state.shop.packPrice)} ₶
          </button>
          <button onClick={onOpen} disabled={state.packs <= 0} className={cn(BRAWL.yellow, 'flex-1 h-12 text-lg')}>
            Ouvrir
          </button>
        </div>
      </Box>

      <Box title={`Cosmétiques (${owned.size}/${COSMETICS.length})`}>
        {(Object.keys(COSMETIC_SLOTS) as CosmeticSlot[]).map((slot) => (
          <div key={slot} className="mb-3 last:mb-0">
            <div className="font-display text-base mb-1">{COSMETIC_SLOTS[slot]}</div>
            <div className="grid grid-cols-4 gap-1.5">
              {COSMETICS.filter((c) => c.slot === slot).map((c) => {
                const has = owned.has(c.id);
                const on = state.equipped[slot] === c.id;
                return (
                  <button
                    key={c.id}
                    disabled={!has}
                    title={has ? c.name : '???'}
                    onClick={async () => { await api('equip', { slot, cosmetic_id: on ? null : c.id }); sfx.select(); }}
                    className={cn('relative rounded-xl border-[3px] p-1 flex flex-col items-center gap-0.5', on ? 'border-accent-primary bg-[#3A3A20]' : 'border-brand-border bg-brand-card', !has && 'opacity-60')}
                  >
                    <CosmeticIcon cosmetic={c} size={48} hidden={!has} />
                    <span className="text-[10px] font-black leading-tight text-center line-clamp-1" style={{ color: has ? RARITIES[c.rarity].color : undefined }}>{has ? c.name : '???'}</span>
                    {on && <Check className="absolute top-0.5 right-0.5 h-4 w-4 text-accent-primary" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </Box>
    </div>
  );
}

function CostLine({ coins, mats, state }: { coins: number; mats: Record<string, number | undefined>; state: PecheState }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={cn('px-2 py-0.5 rounded-lg border-2 border-brand-border bg-brand-bg text-xs font-black', state.balance >= coins ? 'text-accent-primary' : 'text-accent-secondary')}>{fmtBig(coins)} ₶</span>
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
              <button onClick={async () => { const r = await api('upgrade', { gear: g }); if (r) sfx.coin(); }} disabled={maxed} className={cn(BRAWL.yellow, 'h-11 px-3 text-base shrink-0')}>
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
              <p className="mt-2 text-xs font-bold text-tx-secondary">Un poisson toutes les {state.autoInterval.toFixed(1)} s, payé {Math.round(state.autoEfficiency * 100)} %.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MapPanel({ state, api }: { state: PecheState; api: Api }) {
  const boat = lvl(state.gear, 'bateau');
  const known = new Set(state.dex.map((d) => d.speciesId));
  const lastShown = Math.max(DEPTH_START - 1, boat + 1);
  const zones = Array.from({ length: lastShown + 1 }, (_, i) => zoneInfo(i));
  const regions = Array.from(new Set(zones.map((z) => z.region)));

  return (
    <div className="space-y-3">
      {regions.map((region) => (
        <div key={region}>
          <div className="font-display text-lg mb-1">{region}</div>
          <div className="space-y-1.5">
            {zones.filter((z) => z.region === region).map((z) => {
              const open = z.id <= boat;
              const here = z.id === state.zone;
              const list = speciesOfZone(z.id);
              const caught = list.filter((s) => known.has(s.id)).length;
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
                  <span className="h-11 w-14 shrink-0 rounded-xl border-[3px] border-brand-border" style={{ background: `linear-gradient(${z.sky} 0 35%, ${z.top} 35%, ${z.bottom})` }} />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-lg leading-tight">{z.name}</div>
                    <div className={cn('text-xs font-bold', here ? 'text-brand-bg/80' : 'text-tx-secondary')}>{caught}/{list.length} espèces</div>
                  </div>
                  {here ? <Anchor className="h-5 w-5" /> : open ? null : (
                    <span className="flex items-center gap-1 text-xs font-black text-tx-secondary"><Lock className="h-4 w-4" /> Bateau {z.id}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DexPanel({ state }: { state: PecheState }) {
  const known = new Map(state.dex.map((d) => [d.speciesId, d]));
  const handmade = SPECIES.filter((s) => known.has(s.id)).length;
  const regions = Array.from(new Set(ZONES.map((z) => z.region)));
  return (
    <div className="space-y-2">
      <div className="font-display text-xl">{handmade}/{SPECIES.length} espèces</div>
      {regions.map((region, ri) => {
        const zones = ZONES.filter((z) => z.region === region);
        const total = zones.reduce((s, z) => s + speciesOfZone(z.id).length, 0);
        const got = zones.reduce((s, z) => s + speciesOfZone(z.id).filter((sp) => known.has(sp.id)).length, 0);
        return (
          <details key={region} open={ri === 0} className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-2">
            <summary className="cursor-pointer font-display text-lg flex items-center justify-between">{region} <span className="text-sm text-tx-secondary">{got}/{total}</span></summary>
            {zones.map((z) => (
              <div key={z.id} className="mt-2">
                <div className="font-display text-base mb-1">{z.name}</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {speciesOfZone(z.id).map((s) => {
                    const d = known.get(s.id);
                    return (
                      <div key={s.id} title={d ? `${s.name} · record ${fmtKg(d.bestWeight)} · ${d.caught} prises` : s.tide ? 'Espèce de marée' : '???'} className="rounded-xl border-2 border-brand-border bg-brand-card p-1 flex flex-col items-center">
                        <FishIcon color={s.color} rarity={s.rarity} size={42} unknown={!d} />
                        <span className="text-[10px] font-black text-center leading-tight line-clamp-2 min-h-[2.2em]" style={{ color: d ? RARITIES[s.rarity].color : undefined }}>
                          {d ? s.name : s.tide ? 'Marée' : '???'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </details>
        );
      })}
    </div>
  );
}

function MareesPanel({ state, api }: { state: PecheState; api: Api }) {
  const pct = Math.min(100, (state.runEarned / state.threshold) * 100);
  return (
    <div className="space-y-3">
      <Box title={`Grande Marée ${state.maree + 1}`}>
        <p className="text-xs font-bold text-tx-secondary mb-2">
          Gagne {fmtBig(state.threshold)} ₶ dans cette partie. Tu repars de zéro (argent, matériel, matériaux), mais tu gardes tes Perles, ton Poissodex, tes cosmétiques et ton niveau.
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
      </Box>

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
            <button onClick={async () => { const r = await api('tree', { node: n }); if (r) sfx.coin(); }} disabled={maxed || state.perles < cost} className={cn(BRAWL.yellow, 'h-11 px-3 text-base shrink-0')}>
              {maxed ? <Check className="h-5 w-5" /> : `${fmtBig(cost)} Perles`}
            </button>
          </div>
        );
      })}
      <p className="text-xs font-bold text-tx-secondary">
        Chaque Marée ajoute ×0,5 sur toutes tes ventes (×{(1 + 0.5 * state.maree).toFixed(1).replace('.', ',')} aujourd’hui) et débloque l’espèce de marée d’un coin de plus.
      </p>
    </div>
  );
}
