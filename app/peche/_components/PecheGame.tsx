'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft, Anchor, BookOpen, Coins, Fish, Map as MapIcon, Sparkles, Waves, Wrench, Zap, Lock, Check, X,
  HelpCircle, ShoppingBag, Target, Gift, CloudRain, Sun, CloudFog, CloudLightning, Moon, Package, Trophy, Users, Fish as FishShoal,
  Crown, Skull, Radio, Palette, Medal, Ship, User, LayoutGrid, LogOut, Volume2, VolumeX,
} from 'lucide-react';
import AppTabBar, { type TabBarItem } from '@/components/AppTabBar';
import AppSheet, { SheetTile } from '@/components/AppSheet';
import { cn } from '@/lib/utils';
import { BRAWL, BRAWL_SWATCHES } from '@/lib/ui/brawl';
import { sfx, isMuted, setMuted } from '@/lib/casino/sfx';
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
import AquariumPanel from './AquariumPanel';
import CommunityPanel, { type CommunitySection } from './CommunityPanel';
import { PassPanel, AchievementsPanel } from './PassPanel';
import FishingScene from './Scene';
import PlayerCardModal from './PlayerCardModal';
import WeekRecap from './WeekRecap';
import { usePort } from './usePort';

type Phase = 'idle' | 'waiting' | 'reeling' | 'landed' | 'lost';
type Tab = 'peche' | 'quetes' | 'boutique' | 'cosmetiques' | 'aquarium' | 'pass' | 'succes' | 'classement' | 'monstre' | 'jackpot' | 'direct' | 'port' | 'materiel' | 'carte' | 'dex' | 'marees';
type Mode = 'solo' | 'public';
type Api = (action: string, extra?: Record<string, unknown>) => Promise<any>;

interface Landed {
  speciesId: string; rarity: number; weight: number; variant: string;
  quality: 'perfect' | 'good'; value: number; materials: Record<string, number>; isNew: boolean;
}

const TABS: { id: Tab; label: string; icon: typeof Fish }[] = [
  { id: 'peche', label: 'Pêche', icon: Fish },
  { id: 'quetes', label: 'Quêtes', icon: Target },
  { id: 'boutique', label: 'Boutique', icon: ShoppingBag },
  { id: 'cosmetiques', label: 'Look', icon: Palette },
  { id: 'aquarium', label: 'Aquarium', icon: FishShoal },
  { id: 'pass', label: 'Pass', icon: Crown },
  { id: 'succes', label: 'Succès', icon: Trophy },
  { id: 'classement', label: 'Classement', icon: Medal },
  { id: 'monstre', label: 'Monstre', icon: Skull },
  { id: 'jackpot', label: 'Jackpot', icon: Sparkles },
  { id: 'direct', label: 'En direct', icon: Radio },
  { id: 'port', label: 'Au port', icon: Users },
  { id: 'materiel', label: 'Matériel', icon: Wrench },
  { id: 'carte', label: 'Carte', icon: MapIcon },
  { id: 'dex', label: 'Poissodex', icon: BookOpen },
  { id: 'marees', label: 'Marées', icon: Waves },
];

/** On phones and tablets these four sit in the bottom tab bar; the rest open from "Plus". */
const BAR_TABS: Tab[] = ['peche', 'quetes', 'materiel', 'boutique'];

const MODES = [
  { id: 'solo', label: 'Solo', hint: 'Matériaux', icon: User },
  { id: 'public', label: 'Port public', hint: '₶ ×1,5', icon: Ship },
] as const;

const NARROW = '(max-width: 1023.98px)';

const MODE_KEY = 'itollec_peche_mode';

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

export default function PecheGame({ userId, pseudo }: { userId: string; pseudo: string }) {
  const [state, setState] = useState<PecheState | null>(null);
  const [tab, setTab] = useState<Tab>('peche');
  const [phase, setPhase] = useState<Phase>('idle');
  const [castInfo, setCastInfo] = useState<{ id: string; rarity: number; green: number; speed: number; fill: number; drain: number; seed: number } | null>(null);
  const [autoNextAt, setAutoNextAt] = useState<number | null>(null);
  const [autoPops, setAutoPops] = useState<{ key: number; speciesId: string; rarity: number; value: number; variant: string; materials?: Record<string, number> }[]>([]);
  const [landed, setLanded] = useState<Landed | null>(null);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const [autoFeed, setAutoFeed] = useState<{ key: number; speciesId: string; rarity: number; value: number; variant: string }[]>([]);
  const [guide, setGuide] = useState(false);
  const [opening, setOpening] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('solo');
  const [more, setMore] = useState(false);
  const closeMore = useCallback(() => setMore(false), []);
  useEffect(() => { try { if (localStorage.getItem(MODE_KEY) === 'public') setMode('public'); } catch {} }, []);
  const switchMode = (m: Mode) => { sfx.select(); setMode(m); try { localStorage.setItem(MODE_KEY, m); } catch {} };
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
    const r = await api('cast', { mode });
    setBusy(false);
    if (!r) return;
    setCastInfo(r);
    setPhase('waiting');
    const wait = 600 + Math.random() * 1400;
    setTimeout(() => {
      sfx.tick(); vibrate(HAPTIC.MEDIUM); setPhase('reeling');
      // On a phone the scene only shows on the Pêche tab: bring it back for the bite.
      if (window.matchMedia(NARROW).matches) setTab('peche');
    }, wait);
  };

  const onReelDone = async (_quality: 'perfect' | 'good' | 'fail', input: { toggles: number[]; steps: number }) => {
    if (!castInfo) return;
    const before = new Set((stateRef.current?.dex || []).map((d) => d.speciesId));
    const r = await api('reel', { cast_id: castInfo.id, toggles: input.toggles, steps: input.steps });
    setCastInfo(null);
    if (!r || !r.caught) { setPhase('lost'); sfx.lose(); vibrate(HAPTIC.ERROR); return; }
    const c = r.caught;
    sendRef.current({ speciesId: c.speciesId, rarity: c.rarity, variant: c.variant });
    if (r.jackpot) { sfx.jackpot(); toast.success(`JACKPOT DU POISSON DORÉ : +${fmtBig(r.jackpot)} ₶ !`, { duration: 8000 }); }
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
      const r = await api('auto', { silent: true, mode });
      inFlight = false;
      if (r?.nextAt) setAutoNextAt(r.nextAt);
      if (r?.jackpot) { sfx.jackpot(); toast.success(`JACKPOT DU POISSON DORÉ : +${fmtBig(r.jackpot)} ₶ !`, { duration: 8000 }); }
      if (r?.catches?.length) {
        sfx.coin();
        r.catches.slice(0, 3).forEach((c: { speciesId: string; rarity: number; variant: string }) => sendRef.current(c));
        const items = r.catches.map((c: { speciesId: string; rarity: number; value: number; variant: string; materials?: Record<string, number> }) => ({ key: Date.now() + n++, ...c }));
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
  }, [auto, hasAuto, autoInterval, api, mode]);

  const { players: port, events: portEvents, send: sendPort } = usePort(state ? { userId, pseudo, zone: state.zone, maree: state.maree, mode } : null);
  const sendRef = useRef(sendPort);
  sendRef.current = sendPort;

  if (!state) return <div className="mt-3 lg:mt-0 h-[520px] rounded-[22px] border-4 border-brand-border bg-brand-card animate-pulse" />;

  const zone = zoneInfo(state.zone);
  const badge = mareeBadge(state.maree);
  const WeatherIcon = WEATHER_ICON[state.weather.id];
  const questsReady = (state.chest.claimedToday ? 0 : 1)
    + [...state.missions.daily, ...state.missions.weekly].filter((m) => !m.claimed && m.progress >= m.target).length
    + state.orders.filter((o) => o.have >= o.count).length;
  const passClaimable = state.pass.tiers.filter((t) => t.tier <= state.pass.tier && (!state.pass.claimed.includes(t.tier) || (state.pass.premium && !state.pass.claimedPremium.includes(t.tier)))).length;
  const achClaimable = state.achievements.filter((a) => !a.claimed && a.progress >= a.target).length;
  const shoalHere = state.shoal.zone === state.zone;
  const badgeOf = (t: Tab) => t === 'quetes' ? questsReady
    : t === 'pass' ? passClaimable
    : t === 'succes' ? achClaimable
    : t === 'boutique' ? state.packs
    : t === 'port' && port.length > 1 ? port.length : 0;

  const selectTab = (t: Tab) => {
    sfx.click(); setTab(t); setMore(false);
    if (window.matchMedia(NARROW).matches) window.scrollTo({ top: 0 });
  };

  const barItems: TabBarItem[] = [
    ...BAR_TABS.map((id) => {
      const t = TABS.find((x) => x.id === id)!;
      return { id, label: t.label, icon: t.icon, badge: badgeOf(id), active: tab === id && !more, onSelect: () => selectTab(id) };
    }),
    { id: 'plus', label: 'Plus', icon: LayoutGrid, badge: passClaimable + achClaimable, active: more || !BAR_TABS.includes(tab), onSelect: () => { sfx.click(); setMore(true); } },
  ];
  const tabLabel = TABS.find((t) => t.id === tab)?.label;

  return (
    <div>
      {guide && <PecheGuide onClose={() => setGuide(false)} />}
      {!guide && state.recap && <WeekRecap recap={state.recap} onClose={() => { void api('recap_seen', { silent: true }); }} />}
      {cardId && <PlayerCardModal viewerId={userId} targetId={cardId} onClose={() => setCardId(null)} />}
      {opening && (
        <ChestOpening
          packsLeft={state.packs}
          equipped={state.equipped}
          onOpen={(count) => api('open_pack', { count })}
          onEquip={async (id) => { const c = COSMETIC_BY_ID.get(id); if (c && await api('equip', { slot: c.slot, cosmetic_id: id })) toast.success(`${c.name} équipé`); }}
          onClose={() => setOpening(false)}
        />
      )}

      {/* Phones and tablets: an app bar pinned under the status bar, over a strip of status chips. */}
      <div aria-hidden className="lg:hidden fixed top-0 inset-x-0 h-[env(safe-area-inset-top)] bg-brand-page z-[140]" />
      <header className="lg:hidden sticky top-[env(safe-area-inset-top)] z-[140] -mx-3 sm:-mx-6 px-3 sm:px-6 pt-2 pb-2.5 mb-3 bg-brand-page/95 backdrop-blur border-b-[3px] border-brand-border">
        <div className="flex items-center gap-2">
          <Link href="/?mode=solo" aria-label="Retour" className={cn(BRAWL.pink, 'h-10 w-10 shrink-0')}>
            <ArrowLeft className="h-5 w-5" strokeWidth={3} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl leading-none flex items-center gap-1.5">
              Pêche
              <span className="rounded-md border-2 border-brand-border bg-accent-info px-1 py-px text-[10px] text-white">BÊTA</span>
            </h1>
            <p className="text-[11px] font-bold text-tx-secondary truncate mt-0.5">{zone.region} · {zone.name}</p>
          </div>
          <span className="h-10 inline-flex items-center gap-1.5 rounded-2xl bg-brand-bg border-[3px] border-brand-border pl-1 pr-2.5 font-display text-base text-white shrink-0">
            <span className="h-7 w-7 rounded-full bg-accent-primary border-2 border-brand-border flex items-center justify-center shadow-[inset_0_-3px_0_#D98E00]">
              <Coins className="h-3.5 w-3.5 text-brand-bg" strokeWidth={2.5} />
            </span>
            <span className="tabular-nums">{fmtBig(state.balance)}</span>
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <div className="flex shrink-0 gap-0.5 rounded-xl border-[3px] border-brand-border bg-brand-bg p-0.5" role="radiogroup" aria-label="Mode de pêche">
            {MODES.map((m) => (
              <button key={m.id} role="radio" aria-checked={mode === m.id} onClick={() => switchMode(m.id)}
                className={cn('h-8 px-2 rounded-lg flex items-center gap-1 font-display text-sm leading-none whitespace-nowrap',
                  mode === m.id ? (m.id === 'public' ? 'bg-accent-info text-white shadow-[inset_0_-3px_0_#2F5BD0]' : 'bg-accent-primary text-brand-bg shadow-[inset_0_-3px_0_#D98E00]') : 'text-tx-secondary')}>
                <m.icon className="h-4 w-4" /> {m.label}
              </button>
            ))}
          </div>
          <span className="h-9 shrink-0 inline-flex items-center gap-1.5 rounded-xl border-[3px] border-brand-border bg-brand-bg px-2 font-display text-sm whitespace-nowrap">
            <WeatherIcon className="h-4 w-4 text-accent-info" /> {WEATHER[state.weather.id].label} <WeatherCountdown endsAt={state.weather.endsAt} />
          </span>
          <span className="h-9 shrink-0 inline-flex items-center gap-1.5 rounded-xl border-[3px] border-brand-border px-2 font-display text-sm whitespace-nowrap"
            style={{ background: badge.fill, color: badge.text, boxShadow: `inset 0 -3px 0 ${badge.shade}` }}>
            <Waves className="h-4 w-4" /> Marée {state.maree}
          </span>
          <span className="h-9 shrink-0 inline-flex items-center gap-1.5 rounded-xl border-[3px] border-brand-border bg-brand-bg px-2 font-display text-sm whitespace-nowrap">
            Niv. {state.level.level}
            <span className="w-12 h-2.5 rounded-full bg-[#2B3170] border-2 border-brand-border overflow-hidden">
              <span className="block h-full bg-accent-info" style={{ width: `${(state.level.into / state.level.needed) * 100}%` }} />
            </span>
          </span>
        </div>
      </header>

      <header className="hidden lg:flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap">
          <Link href="/?mode=solo" aria-label="Retour" className={cn(BRAWL.pink, 'h-12 w-12 shrink-0')}>
            <ArrowLeft className="h-6 w-6" strokeWidth={3} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-4xl leading-none flex items-center gap-2">
              Pêche
              <span title="Le jeu est en bêta : l’équilibrage peut encore changer." className="rounded-lg border-[3px] border-brand-border bg-accent-info px-2 py-0.5 text-sm text-white shadow-[inset_0_-3px_0_#2F5BD0]">BÊTA</span>
            </h1>
            <p className="text-sm font-bold text-tx-secondary mt-0.5">{zone.region} · {zone.name}</p>
          </div>
          <div className="flex gap-1 rounded-[22px] border-[3px] border-brand-border bg-brand-bg p-1.5" role="radiogroup" aria-label="Mode de pêche">
            {MODES.map((m) => (
              <button key={m.id} role="radio" aria-checked={mode === m.id} onClick={() => switchMode(m.id)}
                title={m.id === 'solo' ? 'Solo : tes prises donnent des matériaux pour améliorer ton matériel.' : 'Port public : pas de matériaux, mais chaque prise vaut ×1,5 et tu pêches avec les autres joueurs.'}
                className={cn('h-10 px-2 sm:px-3 rounded-[13px] flex items-center gap-1.5 font-display leading-none transition-transform active:translate-y-[2px]',
                  mode === m.id ? (m.id === 'public' ? 'bg-accent-info text-white shadow-[inset_0_-4px_0_#2F5BD0]' : 'bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00]') : 'text-tx-secondary hover:text-white')}>
                <m.icon className="h-5 w-5" />
                <span className="flex flex-col items-start"><span className="text-base">{m.label}</span><span className="text-[10px] opacity-80">{m.hint}</span></span>
              </button>
            ))}
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
        {/* Phones: the scene is the Pêche tab, full width, and steps aside for the other tabs. */}
        <section className={cn(BRAWL.panel, 'relative overflow-hidden h-[min(62dvh,520px)] min-h-[380px] lg:min-h-0 lg:h-full flex-col', tab === 'peche' ? 'flex' : 'hidden lg:flex')}>
          <FishingScene
            zoneId={state.zone} phase={phase} weather={state.weather.id} equipped={state.equipped}
            others={mode === 'public' ? port.filter((p) => p.mode === 'public' && p.zone === state.zone && p.userId !== userId) : []}
            events={portEvents}
            landedColor={landed ? getSpecies(landed.speciesId)?.color : undefined}
          />
          {shoalHere && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center gap-1.5 rounded-xl border-[3px] border-brand-border bg-accent-info text-white px-3 py-1 font-display shadow-[inset_0_-3px_0_#2F5BD0,0_3px_0_#05061A]" style={{ bottom: auto ? 140 : 96 }}>
              <FishShoal className="h-4 w-4" /> Banc de poissons ici : prises ×{state.shoal.mult}
            </div>
          )}
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
                  <FishIcon speciesId={sp.id} color={sp.color} rarity={sp.rarity} size={40} variant={p.variant} />
                  <div className="leading-tight">
                    <div className="font-display text-sm">{sp.name}{p.variant ? ` · ${VARIANTS[p.variant as keyof typeof VARIANTS].label}` : ''}</div>
                    <div className="text-xs font-black text-accent-success tabular-nums">+{fmtBig(p.value)} ₶ · auto</div>
                    {p.materials && Object.keys(p.materials).length > 0 && (
                      <div className="text-[11px] font-black tabular-nums flex gap-1.5">
                        {Object.entries(p.materials).map(([m, q]) => (
                          <span key={m} style={{ color: MATERIALS[m as MaterialId].color }}>+{q} {MATERIALS[m as MaterialId].label}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative z-10 flex-1 flex items-center justify-center p-4">
            {phase === 'reeling' && castInfo && (
              <div className="rounded-[22px] border-4 border-brand-border bg-brand-card/95 p-4 shadow-[0_6px_0_#05061A] animate-in zoom-in-95 duration-150">
                <ReelGauge key={castInfo.id} green={castInfo.green} speed={castInfo.speed} fill={castInfo.fill} drain={castInfo.drain} seed={castInfo.seed} onDone={onReelDone} />
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
            <button onClick={castLine} disabled={busy || phase === 'waiting' || phase === 'reeling'} className={cn(BRAWL.yellow, 'flex-1 h-16 text-xl sm:text-2xl rounded-2xl')}>
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

        <section className={cn(BRAWL.panel, 'p-3 sm:p-4 flex flex-col gap-3 lg:h-full min-h-0')}>
          {tab !== 'peche' && <h2 className="lg:hidden font-display text-3xl leading-none px-1 pt-1">{tabLabel}</h2>}
          <div className="hidden lg:block shrink-0 rounded-[18px] border-[3px] border-brand-border bg-brand-inner p-2.5">
            <div className="font-display text-lg leading-none sm:mb-2">Aller à</div>
            {/* Phones: one row that scrolls sideways. Wider: rows of eight, or six in the narrow side column, so no label is cut. */}
            <div className="flex gap-1 overflow-x-auto pt-2 pb-1 -mx-1 px-1 sm:grid sm:grid-cols-8 lg:grid-cols-6 sm:gap-x-1 sm:gap-y-2 sm:overflow-visible sm:pb-0">
              {TABS.map((t, i) => {
                const swatch = BRAWL_SWATCHES[i % BRAWL_SWATCHES.length];
                const on = tab === t.id;
                const badge = badgeOf(t.id);
                return (
                  <button key={t.id} onClick={() => selectTab(t.id)} aria-current={on ? 'page' : undefined}
                    className="group flex flex-col items-center gap-1 text-center focus:outline-none shrink-0 min-w-[56px] px-0.5 sm:min-w-0 sm:px-0">
                    <span
                      className={cn(BRAWL.iconTile, 'h-9 w-9 text-white transition-transform group-hover:-translate-y-0.5 group-active:translate-y-[2px]', on && 'ring-[3px] ring-accent-primary ring-offset-2 ring-offset-brand-inner -translate-y-0.5')}
                      style={{ background: swatch.fill, boxShadow: `inset 0 -4px 0 ${swatch.shade}, 0 3px 0 #05061A` }}
                    >
                      <t.icon className="h-5 w-5" strokeWidth={2.5} />
                      {badge > 0 && (
                        <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-accent-secondary border-2 border-brand-border text-white font-display text-[11px] flex items-center justify-center">{badge}</span>
                      )}
                    </span>
                    <span className={cn('text-[10px] font-black leading-tight whitespace-nowrap', on ? 'text-accent-primary' : 'text-tx-secondary group-hover:text-white')}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            {tab === 'peche' && <PechePanel state={state} api={api} autoFeed={autoFeed} mode={mode} />}
            {tab === 'quetes' && <QuestsPanel state={state} api={api} />}
            {tab === 'boutique' && <ShopPanel state={state} api={api} onOpen={() => setOpening(true)} />}
            {tab === 'cosmetiques' && <CosmeticsPanel state={state} api={api} />}
            {tab === 'aquarium' && <AquariumPanel state={state} api={api} />}
            {tab === 'pass' && <PassPanel state={state} api={api} />}
            {tab === 'succes' && <AchievementsPanel state={state} api={api} />}
            {(['classement', 'monstre', 'jackpot', 'direct', 'port'] as Tab[]).includes(tab) && (
              <CommunityPanel section={tab as CommunitySection} userId={userId} api={api} port={port} onOpenCard={setCardId} />
            )}
            {tab === 'materiel' && <GearPanel state={state} api={api} />}
            {tab === 'carte' && <MapPanel state={state} api={api} />}
            {tab === 'dex' && <DexPanel state={state} />}
            {tab === 'marees' && <MareesPanel state={state} api={api} />}
          </div>
        </section>
      </div>

      <AppTabBar items={barItems} label="Navigation de la Pêche" />
      <AppSheet open={more} onClose={closeMore} title="Pêche">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {TABS.filter((t) => !BAR_TABS.includes(t.id)).map((t) => {
            const swatch = BRAWL_SWATCHES[TABS.indexOf(t) % BRAWL_SWATCHES.length];
            return (
              <SheetTile key={t.id} label={t.label} icon={t.icon} fill={swatch.fill} shade={swatch.shade}
                badge={badgeOf(t.id)} active={tab === t.id} onSelect={() => selectTab(t.id)} />
            );
          })}
        </div>
        <div className="mt-4 rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3 flex items-center justify-between gap-3">
          <div className="leading-tight">
            <div className="font-display text-base">Réglages</div>
            <div className="text-[11px] font-bold text-tx-muted">son du jeu</div>
          </div>
          <SoundToggle />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => { setMore(false); setGuide(true); }} className={cn(BRAWL.dark, 'h-12 text-base')}>
            <HelpCircle className="h-4 w-4" /> Guide
          </button>
          <Link href="/?mode=solo" className={cn(BRAWL.pink, 'h-12 text-base')}>
            <LogOut className="h-4 w-4" /> Quitter
          </Link>
        </div>
      </AppSheet>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Sound on or off, shared with the casino (same setting). */
function SoundToggle() {
  const [muted, setMutedState] = useState(false);
  // Read on mount only: localStorage is not available during the server render.
  useEffect(() => { setMutedState(isMuted()); }, []);
  const toggle = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
    if (!next) sfx.click();
    vibrate(HAPTIC.SOFT);
  };
  return (
    <button onClick={toggle} aria-label={muted ? 'Réactiver le son' : 'Couper le son'} className={cn(muted ? BRAWL.pink : BRAWL.dark, 'h-12 px-3 text-base shrink-0')}>
      {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      {muted ? 'Son coupé' : 'Son activé'}
    </button>
  );
}

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
      <div className="flex justify-center my-2"><FishIcon speciesId={sp.id} color={sp.color} rarity={sp.rarity} size={130} variant={landed.variant} /></div>
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
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="font-display text-xl">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function PechePanel({ state, api, autoFeed, mode }: { state: PecheState; api: Api; autoFeed: { key: number; speciesId: string; rarity: number; value: number }[]; mode: Mode }) {
  const bagTotal = state.bag.reduce((s, b) => s + b.price, 0);
  const bagCount = state.bag.reduce((s, b) => s + b.count, 0);
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner p-3">
        <div className="font-display text-xl mb-1">Mes matériaux</div>
        <p className="text-xs font-bold text-tx-secondary mb-2">
          {mode === 'solo'
            ? 'En solo, chaque poisson pêché (à la main ou en auto) rapporte des matériaux en plus des ₶. Ils servent à améliorer ta canne et ton bateau dans Matériel.'
            : 'Au port public, les prises ne donnent pas de matériaux, mais valent ×1,5. Repasse en Solo (en haut) pour en gagner.'}
        </p>
        <Materials materials={state.materials} />
      </div>
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
                  <FishIcon speciesId={sp.id} color={sp.color} rarity={sp.rarity} size={40} variant={b.variant} />
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
                <FishIcon speciesId={sp.id} color={sp.color} rarity={sp.rarity} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base leading-tight truncate">{sp.name}</div>
                  <div className="text-xs font-bold text-tx-secondary">{zoneInfo(sp.zone).name}</div>
                </div>
                <span className="px-2 py-0.5 rounded-lg border-2 border-brand-border bg-accent-primary text-brand-bg font-display">×{d.mult}</span>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-brand-border bg-brand-card px-3 py-1.5">
            <span className="font-display text-base min-w-0">Marée haute : {zoneInfo(state.market.zone).name}</span>
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
                <FishIcon speciesId={sp.id} color={sp.color} rarity={sp.rarity} size={40} />
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
                <div className="font-display text-base leading-tight flex flex-wrap items-center gap-1.5">
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


    </div>
  );
}

function CosmeticsPanel({ state, api }: { state: PecheState; api: Api }) {
  const owned = new Set(state.cosmetics);
  return (
    <div className="space-y-3">
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
                    <div className={cn('text-xs font-bold', here ? 'text-brand-bg/80' : 'text-tx-secondary')}>{caught}/{list.length} espèces{state.shoal.zone === z.id ? ' · banc ×2' : ''}</div>
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
                        <FishIcon speciesId={s.id} color={s.color} rarity={s.rarity} size={42} unknown={!d} />
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

      <div className="flex flex-wrap items-center justify-between gap-2">
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
