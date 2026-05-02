'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCloudSave } from '@/hooks/useCloudSave';
import { formatCoins, formatShortNumber } from '@/lib/itollec-clicker/format';
import { drawWithoutReplacement, type DrawState } from '@/lib/apex/draw';
import { acceptNegotiation, createNegotiation, playerCounter, type Negotiation } from '@/lib/apex/negotiation';
import { Film, TrendingUp, Users } from 'lucide-react';

type SectorId = 'cinema' | 'musique' | 'series' | 'live';

type ApexProjectStatus = 'producing' | 'ready' | 'released';

type ApexDeal = {
  sold: boolean;
  upfront: number;
  perMin: number;
};

type ApexFilm = {
  id: string;
  title: string;
  budget: number;
  startedAt: number;
  durationMs: number;
  status: ApexProjectStatus;
  quality: number;
  boxOffice: number;
  deal: ApexDeal;
};

type ApexMusicRelease = {
  id: string;
  title: string;
  artist: string;
  budget: number;
  startedAt: number;
  durationMs: number;
  status: ApexProjectStatus;
  quality: number;
  sales: number;
  deal: ApexDeal;
};

type ApexSeriesSeason = {
  id: string;
  title: string;
  showrunner: string;
  budget: number;
  startedAt: number;
  durationMs: number;
  status: ApexProjectStatus;
  quality: number;
  viewers: number;
  deal: ApexDeal;
};

type ApexLiveEvent = {
  id: string;
  title: string;
  headliner: string;
  budget: number;
  startedAt: number;
  durationMs: number;
  status: ApexProjectStatus;
  quality: number;
  attendance: number;
  deal: ApexDeal;
};

type ApexReputation = {
  public: number;
  critique: number;
  business: number;
  underground: number;
  international: number;
  global: number;
};

type ApexBuff = {
  id: string;
  name: string;
  startedAt: number;
  durationMs: number;
  incomeMult: number;
  hypeDecayMult: number;
};

type ApexChoiceModal = {
  id: string;
  kind: 'agent' | 'event';
  title: string;
  body: string;
  options: Array<{
    label: string;
    body: string;
    cashDelta: number;
    hypeDelta: number;
    repDelta: Partial<Omit<ApexReputation, 'global'>>;
    buff?: Omit<ApexBuff, 'id' | 'startedAt'>;
  }>;
};

type ApexSave = {
  version: number;
  cash: number;
  hype: number;
  lastTickAt: number;
  totalEarned: number;
  totalSpent: number;
  drawByCategory: Partial<Record<string, DrawState>>;
  activeSector: SectorId;
  cinema: { films: ApexFilm[]; selectedId: string | null };
  musique: { releases: ApexMusicRelease[]; selectedId: string | null };
  series: { seasons: ApexSeriesSeason[]; selectedId: string | null };
  live: { events: ApexLiveEvent[]; selectedId: string | null };
  reputation: ApexReputation;
  buffs: ApexBuff[];
  negotiation: Negotiation | null;
  negotiationContext: { sector: SectorId; projectId: string; dealType: 'rights' | 'royalties' | 'streaming' | 'sponsor' } | null;
  nextAgentAt: number;
  nextEventAt: number;
  activeModal: ApexChoiceModal | null;
};

const INITIAL_SAVE: ApexSave = {
  version: 2,
  cash: 250,
  hype: 0.12,
  lastTickAt: Date.now(),
  totalEarned: 0,
  totalSpent: 0,
  drawByCategory: {},
  activeSector: 'cinema',
  cinema: { films: [], selectedId: null },
  musique: { releases: [], selectedId: null },
  series: { seasons: [], selectedId: null },
  live: { events: [], selectedId: null },
  reputation: { public: 0.1, critique: 0.08, business: 0.06, underground: 0.04, international: 0.02, global: 0.06 },
  buffs: [],
  negotiation: null,
  negotiationContext: null,
  nextAgentAt: Date.now() + (6 + Math.random() * 6) * 60_000,
  nextEventAt: Date.now() + (3 + Math.random() * 4) * 60_000,
  activeModal: null,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function computePassiveIncomePerMin(save: ApexSave): number {
  let sum = 0;
  for (const m of save.cinema.films) {
    if (m.deal.sold) sum += m.deal.perMin;
  }
  for (const m of save.musique.releases) {
    if (m.deal.sold) sum += m.deal.perMin;
  }
  for (const s of save.series.seasons) {
    if (s.deal.sold) sum += s.deal.perMin;
  }
  for (const e of save.live.events) {
    if (e.deal.sold) sum += e.deal.perMin;
  }
  return sum;
}

export default function ApexPage() {
  const { data, setData, isLoaded } = useCloudSave<ApexSave>('apex', INITIAL_SAVE, { silent: true });
  const [activeTab, setActiveTab] = useState<'production' | 'negociation' | 'catalogue'>('production');

  const [names, setNames] = useState<Record<string, string[]> | null>(null);
  const [namesStatus, setNamesStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const cashRef = useRef<HTMLDivElement | null>(null);
  const ppsRef = useRef<HTMLDivElement | null>(null);
  const sectorRef = useRef<HTMLDivElement | null>(null);
  const productionRef = useRef<HTMLDivElement | null>(null);
  const negotiationRef = useRef<HTMLDivElement | null>(null);
  const tutorialCardRef = useRef<HTMLDivElement | null>(null);

  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialSpot, setTutorialSpot] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [tutorialCardTop, setTutorialCardTop] = useState(24);

  const tutorialSteps = useMemo(
    () => [
      { key: 'pps', title: '₶/min', body: 'Ton revenu passif. Il augmente surtout grâce aux contrats de droits.' },
      { key: 'cash', title: 'Trésorerie', body: 'Tes ₶ disponibles. Elles servent à financer des projets et payer des coûts.' },
      { key: 'sector', title: 'Secteurs', body: 'Cinéma, Musique, Séries & Streaming, Live. Débloque-les en accumulant des ₶.' },
      { key: 'production', title: 'Production', body: 'Lance un projet, attends la production, puis sors-le pour gagner du cash et de la hype.' },
      { key: 'negociation', title: 'Deals', body: 'Négocie des deals (droits/royalties/streaming/sponsor) pour un cash immédiat + ₶/min.' },
    ],
    []
  );

  useEffect(() => {
    if (!isLoaded) return;
    try {
      const done = localStorage.getItem('apex_tutorial_done') === '1';
      if (!done) {
        setTutorialOpen(true);
        setTutorialStep(0);
      }
    } catch {}
  }, [isLoaded]);

  useEffect(() => {
    if (!tutorialOpen) {
      setTutorialSpot(null);
      return;
    }

    const step = tutorialSteps[tutorialStep];
    const getEl = () => {
      if (step?.key === 'pps') return ppsRef.current;
      if (step?.key === 'cash') return cashRef.current;
      if (step?.key === 'sector') return sectorRef.current;
      if (step?.key === 'production') return productionRef.current;
      if (step?.key === 'negociation') return negotiationRef.current;
      return null;
    };

    const update = () => {
      const el = getEl();
      if (!el) {
        setTutorialSpot(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setTutorialSpot({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [tutorialOpen, tutorialStep, tutorialSteps]);

  useEffect(() => {
    if (!tutorialOpen || !tutorialSpot) return;
    const vh = window.innerHeight;
    const cardHeight = tutorialCardRef.current?.getBoundingClientRect().height ?? 280;
    const padding = 16;
    const gap = 16;

    const belowTop = tutorialSpot.top + tutorialSpot.height + gap;
    const aboveTop = tutorialSpot.top - cardHeight - gap;

    let top = belowTop;
    if (belowTop + cardHeight > vh - padding) {
      top = aboveTop >= padding ? aboveTop : Math.max(padding, vh - cardHeight - padding);
    }

    top = Math.max(padding, Math.min(vh - cardHeight - padding, top));
    setTutorialCardTop(top);
  }, [tutorialOpen, tutorialSpot, tutorialStep]);

  const closeTutorial = useCallback(() => {
    setTutorialOpen(false);
    setTutorialStep(0);
    try {
      localStorage.setItem('apex_tutorial_done', '1');
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setNamesStatus('loading');
      try {
        const res = await fetch('/api/apex/names', { cache: 'no-store' });
        if (!res.ok) throw new Error('bad_status');
        const parsed = (await res.json()) as Record<string, string[]>;
        if (cancelled) return;
        setNames(parsed);
        setNamesStatus('ready');
      } catch {
        if (cancelled) return;
        setNames(null);
        setNamesStatus('error');
        toast('Apex', { description: 'Impossible de charger les noms.', duration: 3500 });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const filmNames = useMemo(() => {
    const list = names?.films ?? [];
    return Array.isArray(list) ? list : [];
  }, [names]);

  const artistNames = useMemo(() => {
    const list = names?.artistes ?? [];
    return Array.isArray(list) ? list : [];
  }, [names]);

  const showrunnerNames = useMemo(() => {
    const list = names?.showrunners ?? [];
    return Array.isArray(list) ? list : [];
  }, [names]);

  const seriesNames = useMemo(() => {
    const list = names?.noms_series ?? [];
    return Array.isArray(list) ? list : [];
  }, [names]);

  const agentTemplates = useMemo(
    () =>
      [
        {
          title: 'L’Agent débarque',
          body: 'Une opportunité tombe: tu veux jouer safe ou tenter le gros coup ?',
          options: [
            { label: 'Safe', body: '+₶ immédiats, un peu moins de hype.', cashDelta: 2500, hypeDelta: -0.02, repDelta: { business: 0.02 } },
            {
              label: 'All-in',
              body: '+hype, mais tu prends un risque réputation.',
              cashDelta: 0,
              hypeDelta: 0.08,
              repDelta: { critique: -0.02, public: 0.03 },
              buff: { name: 'Coup de projecteur', durationMs: 3 * 60_000, incomeMult: 1.25, hypeDecayMult: 0.85 },
            },
          ],
        },
        {
          title: 'Nouveau contact',
          body: 'Un réseau te propose un deal discret.',
          options: [
            { label: 'Accepter', body: '+₶/min, mais underground ↑.', cashDelta: 0, hypeDelta: 0.01, repDelta: { underground: 0.05, business: -0.01 } },
            { label: 'Refuser', body: 'Tu restes clean.', cashDelta: 0, hypeDelta: 0, repDelta: { business: 0.01 } },
          ],
        },
        {
          title: 'Plateau TV',
          body: 'Invitation à un plateau: ça peut booster ta réputation grand public.',
          options: [
            { label: 'Y aller', body: 'Public ↑, hype ↑.', cashDelta: 500, hypeDelta: 0.04, repDelta: { public: 0.05 } },
            { label: 'Passer', body: 'Critique ↑ (mystère), hype ↓.', cashDelta: 0, hypeDelta: -0.01, repDelta: { critique: 0.03 } },
          ],
        },
      ] as const,
    []
  );

  const eventTemplates = useMemo(
    () =>
      [
        {
          title: 'Bad buzz',
          body: 'Une polémique te tombe dessus. Tu réponds comment ?',
          options: [
            { label: 'Excuses', body: 'Public remonte, business un peu down.', cashDelta: 0, hypeDelta: -0.03, repDelta: { public: 0.03, business: -0.01 } },
            { label: 'Attaquer', body: 'Hype ↑ mais critique ↓.', cashDelta: 0, hypeDelta: 0.02, repDelta: { critique: -0.03 } },
          ],
        },
        {
          title: 'Bon timing',
          body: 'Une tendance explose pile quand tu sors un projet.',
          options: [
            {
              label: 'Capitaliser',
              body: 'Income ×1.15 pendant 3 min.',
              cashDelta: 0,
              hypeDelta: 0.03,
              repDelta: { public: 0.01 },
              buff: { name: 'Tendance', durationMs: 3 * 60_000, incomeMult: 1.15, hypeDecayMult: 0.9 },
            },
            { label: 'Ignorer', body: 'Critique ↑ (cohérence).', cashDelta: 0, hypeDelta: 0, repDelta: { critique: 0.02 } },
          ],
        },
        {
          title: 'Contrôle fiscal',
          body: 'On te demande des justificatifs sur des dépenses.',
          options: [
            { label: 'Payer', body: '-₶ mais business ↑.', cashDelta: -1200, hypeDelta: 0, repDelta: { business: 0.03 } },
            { label: 'Négocier', body: 'Moins cher, mais risque critique.', cashDelta: -600, hypeDelta: 0, repDelta: { critique: -0.01, business: 0.01 } },
          ],
        },
        {
          title: 'Invitation internationale',
          body: 'Un événement à l’étranger te met en avant.',
          options: [
            { label: 'Participer', body: 'International ↑, cash ↓.', cashDelta: -800, hypeDelta: 0.02, repDelta: { international: 0.05 } },
            { label: 'Refuser', body: 'Business ↑.', cashDelta: 0, hypeDelta: 0, repDelta: { business: 0.02 } },
          ],
        },
      ] as const,
    []
  );

  const passiveIncomePerMin = useMemo(() => computePassiveIncomePerMin(data), [data]);

  const activeBuffs = useMemo(() => {
    const now = Date.now();
    return (data.buffs ?? []).filter((b) => now < b.startedAt + b.durationMs);
  }, [data.buffs]);

  const buffsIncomeMult = useMemo(() => activeBuffs.reduce((acc, b) => acc * b.incomeMult, 1), [activeBuffs]);
  const buffsHypeDecayMult = useMemo(() => activeBuffs.reduce((acc, b) => acc * b.hypeDecayMult, 1), [activeBuffs]);

  const reputationMult = useMemo(() => 1 + clamp01(data.reputation.global) * 0.5, [data.reputation.global]);

  const incomePerMin = useMemo(() => {
    const hypeMult = 1 + clamp01(data.hype) * 0.6;
    return passiveIncomePerMin * hypeMult * reputationMult * buffsIncomeMult;
  }, [buffsIncomeMult, data.hype, passiveIncomePerMin, reputationMult]);

  useEffect(() => {
    if (!isLoaded) return;
    const now = Date.now();
    setData((prev) => {
      if (prev.version >= 2 && prev.activeSector) return prev;

      const reputation: ApexReputation = {
        public: clamp01((prev as Partial<ApexSave>).reputation?.public ?? 0.1),
        critique: clamp01((prev as Partial<ApexSave>).reputation?.critique ?? 0.08),
        business: clamp01((prev as Partial<ApexSave>).reputation?.business ?? 0.06),
        underground: clamp01((prev as Partial<ApexSave>).reputation?.underground ?? 0.04),
        international: clamp01((prev as Partial<ApexSave>).reputation?.international ?? 0.02),
        global: 0,
      };
      reputation.global = clamp01(
        (reputation.public + reputation.critique + reputation.business + reputation.underground + reputation.international) / 5
      );

      const legacy = prev as unknown as { sector?: { movies?: any[]; selectedMovieId?: string | null } };
      const legacyMovies = Array.isArray(legacy.sector?.movies) ? legacy.sector?.movies ?? [] : [];
      const films: ApexFilm[] = legacyMovies.map((m) => ({
        id: String(m.id),
        title: String(m.title ?? 'Film'),
        budget: Number(m.budget ?? 0),
        startedAt: Number(m.startedAt ?? now),
        durationMs: Number(m.durationMs ?? 30_000),
        status: (m.status as ApexProjectStatus) ?? 'released',
        quality: Number(m.quality ?? 0.5),
        boxOffice: Number(m.boxOffice ?? 0),
        deal: {
          sold: Boolean(m.rightsSold ?? false),
          upfront: Number(m.rightsUpfront ?? 0),
          perMin: Number(m.rightsPerMin ?? 0),
        },
      }));

      return {
        ...prev,
        version: 2,
        activeSector: 'cinema',
        cinema: { films, selectedId: legacy.sector?.selectedMovieId ?? null },
        musique: { releases: [], selectedId: null },
        series: { seasons: [], selectedId: null },
        live: { events: [], selectedId: null },
        reputation,
        buffs: [],
        negotiationContext: null,
        nextAgentAt: prev.nextAgentAt ?? now + (6 + Math.random() * 6) * 60_000,
        nextEventAt: prev.nextEventAt ?? now + (3 + Math.random() * 4) * 60_000,
        activeModal: null,
      } as ApexSave;
    });
  }, [isLoaded, setData]);

  useEffect(() => {
    if (!isLoaded) return;

    let raf = 0;
    const tick = () => {
      setData((prev) => {
        const epochNow = Date.now();
        const elapsedMs = Math.max(0, epochNow - prev.lastTickAt);
        const steps = Math.min(10, Math.floor(elapsedMs / 1000));
        if (steps <= 0) return prev;

        const buffs = (prev.buffs ?? []).filter((b) => epochNow < b.startedAt + b.durationMs);
        const buffIncomeMult = buffs.reduce((acc, b) => acc * b.incomeMult, 1);
        const buffHypeDecayMult = buffs.reduce((acc, b) => acc * b.hypeDecayMult, 1);

        const basePerMin = computePassiveIncomePerMin(prev);
        const hype = clamp01(prev.hype);
        const repGlobal = clamp01(prev.reputation?.global ?? 0);
        const hypeMult = 1 + hype * 0.6;
        const repMult = 1 + repGlobal * 0.5;
        const incomePerSec = ((basePerMin * hypeMult * repMult * buffIncomeMult) / 60) * steps;

        const nextCash = clampNonNegative(prev.cash + incomePerSec);
        const nextEarned = clampNonNegative(prev.totalEarned + incomePerSec);

        const denom = 300 * (1 + repGlobal * 0.8);
        const decay = Math.exp(-((steps / denom) * buffHypeDecayMult));
        const nextHype = clamp01(hype * decay);

        let changed = false;

        const films = prev.cinema.films.map((m) => {
          if (m.status !== 'producing') return m;
          if (epochNow < m.startedAt + m.durationMs) return m;
          changed = true;
          return { ...m, status: 'ready' as const };
        });
        const releases = prev.musique.releases.map((m) => {
          if (m.status !== 'producing') return m;
          if (epochNow < m.startedAt + m.durationMs) return m;
          changed = true;
          return { ...m, status: 'ready' as const };
        });
        const seasons = prev.series.seasons.map((s) => {
          if (s.status !== 'producing') return s;
          if (epochNow < s.startedAt + s.durationMs) return s;
          changed = true;
          return { ...s, status: 'ready' as const };
        });
        const events = prev.live.events.map((e) => {
          if (e.status !== 'producing') return e;
          if (epochNow < e.startedAt + e.durationMs) return e;
          changed = true;
          return { ...e, status: 'ready' as const };
        });

        let activeModal = prev.activeModal;
        let nextAgentAt = prev.nextAgentAt;
        let nextEventAt = prev.nextEventAt;

        if (!activeModal && epochNow >= prev.nextAgentAt) {
          const t = agentTemplates[Math.floor(Math.random() * agentTemplates.length)]!;
          activeModal = {
            id: createId(),
            kind: 'agent',
            title: t.title,
            body: t.body,
            options: t.options.map((o) => ({
              label: o.label,
              body: o.body,
              cashDelta: o.cashDelta,
              hypeDelta: o.hypeDelta,
              repDelta: o.repDelta,
              buff: 'buff' in o && o.buff ? o.buff : undefined,
            })),
          };
          nextAgentAt = epochNow + (6 + Math.random() * 6) * 60_000;
          changed = true;
        } else if (!activeModal && epochNow >= prev.nextEventAt) {
          const t = eventTemplates[Math.floor(Math.random() * eventTemplates.length)]!;
          activeModal = {
            id: createId(),
            kind: 'event',
            title: t.title,
            body: t.body,
            options: t.options.map((o) => ({
              label: o.label,
              body: o.body,
              cashDelta: o.cashDelta,
              hypeDelta: o.hypeDelta,
              repDelta: o.repDelta,
              buff: 'buff' in o && o.buff ? o.buff : undefined,
            })),
          };
          nextEventAt = epochNow + (3 + Math.random() * 4) * 60_000;
          changed = true;
        }

        const next: ApexSave = {
          ...prev,
          cash: nextCash,
          hype: nextHype,
          totalEarned: nextEarned,
          lastTickAt: prev.lastTickAt + steps * 1000,
          buffs,
          cinema: { ...prev.cinema, films },
          musique: { ...prev.musique, releases },
          series: { ...prev.series, seasons },
          live: { ...prev.live, events },
          activeModal,
          nextAgentAt,
          nextEventAt,
        };

        return changed || nextCash !== prev.cash || nextHype !== prev.hype || buffs.length !== (prev.buffs ?? []).length ? next : prev;
      });

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [agentTemplates, eventTemplates, isLoaded, setData]);

  const sectorUnlockCost: Record<SectorId, number> = useMemo(
    () => ({ cinema: 0, musique: 25_000, series: 75_000, live: 150_000 }),
    []
  );

  const isSectorUnlocked = useCallback((id: SectorId) => data.cash >= sectorUnlockCost[id], [data.cash, sectorUnlockCost]);

  const setActiveSector = useCallback(
    (id: SectorId) => {
      setData((prev) => ({ ...prev, activeSector: id }));
      setActiveTab('production');
    },
    [setData]
  );

  const activeSectorTitle = useMemo(() => {
    if (data.activeSector === 'cinema') return 'Cinéma';
    if (data.activeSector === 'musique') return 'Musique';
    if (data.activeSector === 'series') return 'Séries & Streaming';
    return 'Événements Live';
  }, [data.activeSector]);

  const activeDealLabel = useMemo(() => {
    if (data.activeSector === 'cinema') return 'Droits';
    if (data.activeSector === 'musique') return 'Royalties';
    if (data.activeSector === 'series') return 'Streaming';
    return 'Sponsor';
  }, [data.activeSector]);

  const activeProjects = useMemo(() => {
    if (data.activeSector === 'cinema') return data.cinema.films;
    if (data.activeSector === 'musique') return data.musique.releases;
    if (data.activeSector === 'series') return data.series.seasons;
    return data.live.events;
  }, [data.activeSector, data.cinema.films, data.live.events, data.musique.releases, data.series.seasons]);

  const activeSelectedId = useMemo(() => {
    if (data.activeSector === 'cinema') return data.cinema.selectedId;
    if (data.activeSector === 'musique') return data.musique.selectedId;
    if (data.activeSector === 'series') return data.series.selectedId;
    return data.live.selectedId;
  }, [data.activeSector, data.cinema.selectedId, data.live.selectedId, data.musique.selectedId, data.series.selectedId]);

  const selectProject = useCallback(
    (id: string) => {
      setData((prev) => {
        if (prev.activeSector === 'cinema') return { ...prev, cinema: { ...prev.cinema, selectedId: id } };
        if (prev.activeSector === 'musique') return { ...prev, musique: { ...prev.musique, selectedId: id } };
        if (prev.activeSector === 'series') return { ...prev, series: { ...prev.series, selectedId: id } };
        return { ...prev, live: { ...prev.live, selectedId: id } };
      });
    },
    [setData]
  );

  const selectedProject = useMemo(() => {
    const id = activeSelectedId;
    return id ? activeProjects.find((p) => p.id === id) ?? null : null;
  }, [activeProjects, activeSelectedId]);

  const currentProducing = useMemo(() => activeProjects.find((p) => p.status === 'producing') ?? null, [activeProjects]);
  const currentReady = useMemo(() => activeProjects.find((p) => p.status === 'ready') ?? null, [activeProjects]);

  const producingProgress = useMemo(() => {
    if (!currentProducing) return 0;
    const now = Date.now();
    const p = (now - currentProducing.startedAt) / currentProducing.durationMs;
    return Math.max(0, Math.min(1, p));
  }, [currentProducing]);

  const updateReputation = useCallback((prev: ApexReputation, delta: Partial<Omit<ApexReputation, 'global'>>): ApexReputation => {
    const next: ApexReputation = {
      public: clamp01(prev.public + (delta.public ?? 0)),
      critique: clamp01(prev.critique + (delta.critique ?? 0)),
      business: clamp01(prev.business + (delta.business ?? 0)),
      underground: clamp01(prev.underground + (delta.underground ?? 0)),
      international: clamp01(prev.international + (delta.international ?? 0)),
      global: 0,
    };
    next.global = clamp01((next.public + next.critique + next.business + next.underground + next.international) / 5);
    return next;
  }, []);

  const applyModalChoice = useCallback(
    (choiceIndex: number) => {
      setData((prev) => {
        const modal = prev.activeModal;
        if (!modal) return prev;
        const choice = modal.options[choiceIndex];
        if (!choice) return prev;

        const now = Date.now();
        const buffs = [...(prev.buffs ?? [])];
        if (choice.buff) {
          buffs.push({ id: createId(), name: choice.buff.name, startedAt: now, durationMs: choice.buff.durationMs, incomeMult: choice.buff.incomeMult, hypeDecayMult: choice.buff.hypeDecayMult });
        }

        const nextCash = clampNonNegative(prev.cash + choice.cashDelta);
        const nextEarned = choice.cashDelta > 0 ? clampNonNegative(prev.totalEarned + choice.cashDelta) : prev.totalEarned;
        const nextSpent = choice.cashDelta < 0 ? clampNonNegative(prev.totalSpent + Math.abs(choice.cashDelta)) : prev.totalSpent;
        const reputation = updateReputation(prev.reputation, choice.repDelta);

        toast(modal.kind === 'agent' ? 'Agent' : 'Événement', { description: choice.label, duration: 3000 });

        return {
          ...prev,
          cash: nextCash,
          totalEarned: nextEarned,
          totalSpent: nextSpent,
          hype: clamp01(prev.hype + choice.hypeDelta),
          reputation,
          buffs,
          activeModal: null,
        };
      });
    },
    [setData, updateReputation]
  );

  const [counterOffer, setCounterOffer] = useState('');

  const startCinema = useCallback(
    (budget: number) => {
      if (namesStatus !== 'ready') return;
      if (filmNames.length === 0) return;

      setData((prev) => {
        if (prev.cash < budget) {
          toast('Cinéma', { description: `Il te manque ${formatShortNumber(budget - prev.cash)} ₶.`, duration: 3000 });
          return prev;
        }

        const drawPrev = prev.drawByCategory.films;
        const drawn = drawWithoutReplacement({ list: filmNames, prev: drawPrev });
        const quality = 0.35 + Math.random() * 0.65;
        const durationMs = Math.round((18_000 + Math.random() * 12_000) * (0.85 + Math.min(1, budget / 200_000) * 0.5));

        const film: ApexFilm = {
          id: createId(),
          title: drawn.value,
          budget,
          startedAt: Date.now(),
          durationMs,
          status: 'producing',
          quality,
          boxOffice: 0,
          deal: { sold: false, upfront: 0, perMin: 0 },
        };

        toast('Cinéma', { description: `Production lancée: ${film.title}`, duration: 3500 });
        return {
          ...prev,
          cash: clampNonNegative(prev.cash - budget),
          totalSpent: clampNonNegative(prev.totalSpent + budget),
          drawByCategory: { ...prev.drawByCategory, films: drawn.next },
          cinema: { ...prev.cinema, films: [film, ...prev.cinema.films], selectedId: film.id },
        };
      });
    },
    [filmNames, namesStatus, setData]
  );

  const startMusique = useCallback(
    (budget: number) => {
      if (namesStatus !== 'ready') return;
      if (artistNames.length === 0) return;

      setData((prev) => {
        if (prev.cash < budget) {
          toast('Musique', { description: `Il te manque ${formatShortNumber(budget - prev.cash)} ₶.`, duration: 3000 });
          return prev;
        }

        const artistDraw = drawWithoutReplacement({ list: artistNames, prev: prev.drawByCategory.artistes });
        const titleDraw =
          filmNames.length > 0 ? drawWithoutReplacement({ list: filmNames, prev: prev.drawByCategory.films_alt ?? prev.drawByCategory.films }) : null;

        const artist = artistDraw.value;
        const title = titleDraw ? titleDraw.value : `Single — ${artist}`;
        const quality = 0.35 + Math.random() * 0.65;
        const durationMs = Math.round(16_000 + Math.random() * 10_000);

        const release: ApexMusicRelease = {
          id: createId(),
          title,
          artist,
          budget,
          startedAt: Date.now(),
          durationMs,
          status: 'producing',
          quality,
          sales: 0,
          deal: { sold: false, upfront: 0, perMin: 0 },
        };

        toast('Musique', { description: `Sortie en préparation: ${release.artist}`, duration: 3500 });
        return {
          ...prev,
          cash: clampNonNegative(prev.cash - budget),
          totalSpent: clampNonNegative(prev.totalSpent + budget),
          drawByCategory: {
            ...prev.drawByCategory,
            artistes: artistDraw.next,
            ...(titleDraw ? { films_alt: titleDraw.next } : {}),
          },
          musique: { ...prev.musique, releases: [release, ...prev.musique.releases], selectedId: release.id },
        };
      });
    },
    [artistNames, filmNames, namesStatus, setData]
  );

  const startSeries = useCallback(
    (budget: number) => {
      if (namesStatus !== 'ready') return;
      if (seriesNames.length === 0) return;

      setData((prev) => {
        if (prev.cash < budget) {
          toast('Séries', { description: `Il te manque ${formatShortNumber(budget - prev.cash)} ₶.`, duration: 3000 });
          return prev;
        }

        const titleDraw = drawWithoutReplacement({ list: seriesNames, prev: prev.drawByCategory.noms_series });
        const showrunnerDraw =
          showrunnerNames.length > 0 ? drawWithoutReplacement({ list: showrunnerNames, prev: prev.drawByCategory.showrunners }) : null;

        const quality = 0.35 + Math.random() * 0.65;
        const durationMs = Math.round(22_000 + Math.random() * 14_000);

        const season: ApexSeriesSeason = {
          id: createId(),
          title: titleDraw.value,
          showrunner: showrunnerDraw ? showrunnerDraw.value : 'Showrunner',
          budget,
          startedAt: Date.now(),
          durationMs,
          status: 'producing',
          quality,
          viewers: 0,
          deal: { sold: false, upfront: 0, perMin: 0 },
        };

        toast('Séries', { description: `Production lancée: ${season.title}`, duration: 3500 });
        return {
          ...prev,
          cash: clampNonNegative(prev.cash - budget),
          totalSpent: clampNonNegative(prev.totalSpent + budget),
          drawByCategory: {
            ...prev.drawByCategory,
            noms_series: titleDraw.next,
            ...(showrunnerDraw ? { showrunners: showrunnerDraw.next } : {}),
          },
          series: { ...prev.series, seasons: [season, ...prev.series.seasons], selectedId: season.id },
        };
      });
    },
    [namesStatus, seriesNames, setData, showrunnerNames]
  );

  const startLive = useCallback(
    (budget: number) => {
      if (namesStatus !== 'ready') return;
      if (artistNames.length === 0) return;

      setData((prev) => {
        if (prev.cash < budget) {
          toast('Live', { description: `Il te manque ${formatShortNumber(budget - prev.cash)} ₶.`, duration: 3000 });
          return prev;
        }

        const headlinerDraw = drawWithoutReplacement({ list: artistNames, prev: prev.drawByCategory.artistes_live ?? prev.drawByCategory.artistes });
        const headliner = headlinerDraw.value;
        const quality = 0.35 + Math.random() * 0.65;
        const durationMs = Math.round(14_000 + Math.random() * 10_000);

        const e: ApexLiveEvent = {
          id: createId(),
          title: `Live: ${headliner}`,
          headliner,
          budget,
          startedAt: Date.now(),
          durationMs,
          status: 'producing',
          quality,
          attendance: 0,
          deal: { sold: false, upfront: 0, perMin: 0 },
        };

        toast('Live', { description: `Événement planifié: ${headliner}`, duration: 3500 });
        return {
          ...prev,
          cash: clampNonNegative(prev.cash - budget),
          totalSpent: clampNonNegative(prev.totalSpent + budget),
          drawByCategory: { ...prev.drawByCategory, artistes_live: headlinerDraw.next },
          live: { ...prev.live, events: [e, ...prev.live.events], selectedId: e.id },
        };
      });
    },
    [artistNames, namesStatus, setData]
  );

  const releaseSelected = useCallback(() => {
    setData((prev) => {
      const rep = prev.reputation;
      const hype = clamp01(prev.hype);

      if (prev.activeSector === 'cinema') {
        const id = prev.cinema.selectedId;
        if (!id) return prev;
        const m = prev.cinema.films.find((x) => x.id === id);
        if (!m || m.status !== 'ready') return prev;

        const repMult = 0.9 + rep.public * 0.25 + rep.critique * 0.15;
        const hypeMult = 1 + hype * 1.1;
        const roll = 0.8 + Math.random() * 1.7;
        const boxOffice = m.budget * roll * (0.9 + m.quality * 0.5) * repMult * hypeMult;

        const nextFilms: ApexFilm[] = prev.cinema.films.map((x) => (x.id === id ? ({ ...x, status: 'released' as const, boxOffice } as ApexFilm) : x));
        const reputation = updateReputation(prev.reputation, { public: 0.01, critique: 0.005 + m.quality * 0.01 });
        toast('Box-office', { description: `+${formatShortNumber(boxOffice)} ₶`, duration: 3500 });

        return {
          ...prev,
          cash: clampNonNegative(prev.cash + boxOffice),
          totalEarned: clampNonNegative(prev.totalEarned + boxOffice),
          hype: clamp01(prev.hype + 0.05 + m.quality * 0.04),
          reputation,
          cinema: { ...prev.cinema, films: nextFilms },
        };
      }

      if (prev.activeSector === 'musique') {
        const id = prev.musique.selectedId;
        if (!id) return prev;
        const r = prev.musique.releases.find((x) => x.id === id);
        if (!r || r.status !== 'ready') return prev;

        const repMult = 0.85 + rep.public * 0.35 + rep.underground * 0.1;
        const roll = 0.7 + Math.random() * 1.6;
        const sales = r.budget * roll * (0.85 + r.quality * 0.45) * repMult * (1 + hype * 0.7);

        const nextReleases: ApexMusicRelease[] = prev.musique.releases.map((x) => (x.id === id ? ({ ...x, status: 'released' as const, sales } as ApexMusicRelease) : x));
        const reputation = updateReputation(prev.reputation, { public: 0.01, underground: 0.01 + r.quality * 0.01 });
        toast('Ventes', { description: `+${formatShortNumber(sales)} ₶`, duration: 3500 });

        return {
          ...prev,
          cash: clampNonNegative(prev.cash + sales),
          totalEarned: clampNonNegative(prev.totalEarned + sales),
          hype: clamp01(prev.hype + 0.04 + r.quality * 0.03),
          reputation,
          musique: { ...prev.musique, releases: nextReleases },
        };
      }

      if (prev.activeSector === 'series') {
        const id = prev.series.selectedId;
        if (!id) return prev;
        const s = prev.series.seasons.find((x) => x.id === id);
        if (!s || s.status !== 'ready') return prev;

        const repMult = 0.85 + rep.international * 0.35 + rep.business * 0.1;
        const roll = 0.75 + Math.random() * 1.55;
        const viewers = s.budget * roll * (0.85 + s.quality * 0.45) * repMult * (1 + hype * 0.6);
        const cash = viewers;

        const nextSeasons: ApexSeriesSeason[] = prev.series.seasons.map((x) => (x.id === id ? ({ ...x, status: 'released' as const, viewers } as ApexSeriesSeason) : x));
        const reputation = updateReputation(prev.reputation, { international: 0.015, business: 0.005 });
        toast('Audiences', { description: `+${formatShortNumber(cash)} ₶`, duration: 3500 });

        return {
          ...prev,
          cash: clampNonNegative(prev.cash + cash),
          totalEarned: clampNonNegative(prev.totalEarned + cash),
          hype: clamp01(prev.hype + 0.04 + s.quality * 0.03),
          reputation,
          series: { ...prev.series, seasons: nextSeasons },
        };
      }

      const id = prev.live.selectedId;
      if (!id) return prev;
      const e = prev.live.events.find((x) => x.id === id);
      if (!e || e.status !== 'ready') return prev;

      const repMult = 0.95 + rep.public * 0.25 + rep.international * 0.1;
      const roll = 0.8 + Math.random() * 1.4;
      const attendance = e.budget * roll * (0.9 + e.quality * 0.4) * repMult * (1 + hype * 0.5);
      const cash = attendance;

      const nextEvents: ApexLiveEvent[] = prev.live.events.map((x) => (x.id === id ? ({ ...x, status: 'released' as const, attendance } as ApexLiveEvent) : x));
      const reputation = updateReputation(prev.reputation, { public: 0.02, international: 0.005 });
      toast('Billetterie', { description: `+${formatShortNumber(cash)} ₶`, duration: 3500 });

      return {
        ...prev,
        cash: clampNonNegative(prev.cash + cash),
        totalEarned: clampNonNegative(prev.totalEarned + cash),
        hype: clamp01(prev.hype + 0.05 + e.quality * 0.03),
        reputation,
        live: { ...prev.live, events: nextEvents },
      };
    });
  }, [setData, updateReputation]);

  const openDealNegotiation = useCallback(() => {
    setData((prev) => {
      const sector = prev.activeSector;

      const getProject = () => {
        if (sector === 'cinema') return prev.cinema.films.find((x) => x.id === prev.cinema.selectedId);
        if (sector === 'musique') return prev.musique.releases.find((x) => x.id === prev.musique.selectedId);
        if (sector === 'series') return prev.series.seasons.find((x) => x.id === prev.series.selectedId);
        return prev.live.events.find((x) => x.id === prev.live.selectedId);
      };

      const p = getProject();
      if (!p || p.status !== 'released' || p.deal.sold) return prev;

      const dealType: 'rights' | 'royalties' | 'streaming' | 'sponsor' =
        sector === 'cinema' ? 'rights' : sector === 'musique' ? 'royalties' : sector === 'series' ? 'streaming' : 'sponsor';

      const performance = 'boxOffice' in p ? p.boxOffice : 'sales' in p ? p.sales : 'viewers' in p ? p.viewers : p.attendance;
      const baseValue = Math.max(350, p.budget * (0.7 + p.quality * 0.7) + performance * 0.08);

      const partner = sector === 'cinema' ? 'Distributeur' : sector === 'musique' ? 'Label' : sector === 'series' ? 'Plateforme' : 'Sponsor';
      const difficulty = sector === 'live' ? 0.6 : 0.55;
      const n = createNegotiation({ kind: 'generic', partner, baseValue, difficulty, maxRounds: 4 });

      return {
        ...prev,
        negotiation: n,
        negotiationContext: { sector, projectId: p.id, dealType },
      };
    });
    setActiveTab('negociation');
  }, [setData]);

  const acceptCurrentNegotiation = useCallback(() => {
    setData((prev) => {
      if (!prev.negotiation || prev.negotiation.status !== 'active') return prev;
      if (!prev.negotiationContext) return prev;

      const n = acceptNegotiation(prev.negotiation);
      const { sector, projectId, dealType } = prev.negotiationContext;

      const factor = dealType === 'sponsor' ? 0.015 : dealType === 'streaming' ? 0.021 : dealType === 'royalties' ? 0.02 : 0.02;
      const upfront = n.offer;
      const perMin = Math.max(1, Math.floor(n.offer * factor));

      const applyDeal = <T extends { id: string; deal: ApexDeal }>(items: T[]): T[] =>
        items.map((x) => (x.id === projectId ? ({ ...x, deal: { sold: true, upfront, perMin } } as T) : x));

      const next: ApexSave = {
        ...prev,
        cash: clampNonNegative(prev.cash + upfront),
        totalEarned: clampNonNegative(prev.totalEarned + upfront),
        negotiation: n,
        reputation: updateReputation(prev.reputation, { business: 0.02, international: 0.005 }),
      };

      if (sector === 'cinema') {
        return { ...next, cinema: { ...next.cinema, films: applyDeal(next.cinema.films) }, negotiationContext: null };
      }
      if (sector === 'musique') {
        return { ...next, musique: { ...next.musique, releases: applyDeal(next.musique.releases) }, negotiationContext: null };
      }
      if (sector === 'series') {
        return { ...next, series: { ...next.series, seasons: applyDeal(next.series.seasons) }, negotiationContext: null };
      }
      return { ...next, live: { ...next.live, events: applyDeal(next.live.events) }, negotiationContext: null };
    });
  }, [setData, updateReputation]);

  const counterCurrentNegotiation = useCallback(() => {
    const value = Number(counterOffer.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return;

    setData((prev) => {
      const n = prev.negotiation;
      if (!n || n.status !== 'active') return prev;
      const result = playerCounter(n, value);
      toast('Négociation', { description: result.message, duration: 2500 });
      return { ...prev, negotiation: result.next };
    });
  }, [counterOffer, setData]);

  const closeNegotiation = useCallback(() => {
    setData((prev) => ({ ...prev, negotiation: null, negotiationContext: null }));
  }, [setData]);

  const canOpenDeal = useMemo(() => {
    return Boolean(selectedProject && selectedProject.status === 'released' && !selectedProject.deal.sold);
  }, [selectedProject]);

  const canRelease = useMemo(() => Boolean(currentReady), [currentReady]);

  const startByActiveSector = useCallback(
    (budget: number) => {
      if (data.activeSector === 'cinema') startCinema(budget);
      else if (data.activeSector === 'musique') startMusique(budget);
      else if (data.activeSector === 'series') startSeries(budget);
      else startLive(budget);
    },
    [data.activeSector, startCinema, startLive, startMusique, startSeries]
  );

  return (
    <main className="min-h-screen px-4 md:px-8 py-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center h-10 px-4 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
            >
              Accueil
            </Link>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-black tracking-wider uppercase">Apex</h1>
              <div className="text-tx-secondary font-bold text-sm">Business & négociation</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setTutorialOpen(true);
                setTutorialStep(0);
              }}
              className="hidden md:inline-flex items-center justify-center h-[52px] px-4 rounded-xl font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
            >
              Tutoriel
            </button>

            <div ref={ppsRef} className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal px-4 py-3">
              <div className="text-xs text-tx-secondary font-bold">₶/min</div>
              <div className="text-xl font-display font-black tracking-wider">{formatCoins(incomePerMin)}</div>
              <div className="text-xs text-tx-secondary font-bold">Base: {formatShortNumber(passiveIncomePerMin)} • Mult: ×{reputationMult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</div>
            </div>

            <div ref={cashRef} className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal px-4 py-3">
              <div className="text-xs text-tx-secondary font-bold">Trésorerie</div>
              <div className="text-xl font-display font-black tracking-wider">{formatCoins(data.cash)}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div ref={sectorRef} className="lg:col-span-3 rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
            <div className="text-sm font-display font-black tracking-wider uppercase">Secteurs</div>
            <div className="mt-3 space-y-2">
              {([
                { id: 'cinema', label: 'Cinéma', subtitle: 'Production • Box-office • Droits' },
                { id: 'musique', label: 'Musique', subtitle: 'Sorties • Ventes • Royalties' },
                { id: 'series', label: 'Séries & Streaming', subtitle: 'Saisons • Audiences • Streaming' },
                { id: 'live', label: 'Événements Live', subtitle: 'Billetterie • Sponsor' },
              ] as Array<{ id: SectorId; label: string; subtitle: string }>).map((s) => {
                const unlocked = isSectorUnlocked(s.id);
                const selected = data.activeSector === s.id;
                const cost = sectorUnlockCost[s.id];
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSector(s.id)}
                    disabled={!unlocked}
                    className={cn(
                      'w-full text-left rounded-xl border-2 px-3 py-3 transition-colors',
                      selected
                        ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                        : unlocked
                          ? 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                          : 'bg-brand-inner text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-display font-black tracking-wider uppercase">{s.label}</div>
                      {selected ? <Film className="h-5 w-5" /> : null}
                    </div>
                    <div className={cn('mt-1 text-xs font-bold', selected ? 'text-brand-bg' : 'text-tx-secondary')}>
                      {unlocked ? s.subtitle : `Débloque à ${formatShortNumber(cost)} ₶`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <div ref={productionRef} className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-display font-black tracking-wider uppercase">{activeSectorTitle}</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('production')}
                    className={cn(
                      'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                      activeTab === 'production'
                        ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                        : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                    )}
                  >
                    Production
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('catalogue')}
                    className={cn(
                      'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                      activeTab === 'catalogue'
                        ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                        : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                    )}
                  >
                    Catalogue
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('negociation')}
                    className={cn(
                      'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                      activeTab === 'negociation'
                        ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                        : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                    )}
                  >
                    Deals
                  </button>
                </div>
              </div>

              {activeTab === 'production' ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-tx-secondary font-bold">Hype</div>
                      <div className="text-xs text-tx-secondary font-bold">{Math.round(clamp01(data.hype) * 100)}%</div>
                    </div>
                    <div className="mt-2 h-3 rounded-full border-2 border-brand-border bg-brand-card overflow-hidden">
                      <div className="h-full bg-accent-primary" style={{ width: `${Math.round(clamp01(data.hype) * 100)}%` }} />
                    </div>
                  </div>

                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Projet en cours</div>
                    {currentProducing ? (
                      <>
                        <div className="mt-2 font-display font-black tracking-wider uppercase">{currentProducing.title}</div>
                        <div className="mt-2 h-3 rounded-full border-2 border-brand-border bg-brand-card overflow-hidden">
                          <div className="h-full bg-accent-primary" style={{ width: `${Math.round(producingProgress * 100)}%` }} />
                        </div>
                      </>
                    ) : currentReady ? (
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-display font-black tracking-wider uppercase">{currentReady.title}</div>
                          <div className="text-xs text-tx-secondary font-bold">Prêt à sortir</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            selectProject(currentReady.id);
                            releaseSelected();
                          }}
                          className="h-11 px-4 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                        >
                          Sortir
                        </button>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-tx-secondary font-bold">Aucun projet en cours.</div>
                    )}
                  </div>

                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Lancer un projet</div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { label: 'Petit', budget: 2500 },
                        { label: 'Standard', budget: 20_000 },
                        { label: 'Gros', budget: 120_000 },
                      ].map((b) => (
                        <button
                          key={b.label}
                          type="button"
                          onClick={() => startByActiveSector(b.budget)}
                          disabled={namesStatus !== 'ready' || data.cash < b.budget}
                          className={cn(
                            'h-12 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                            namesStatus !== 'ready' || data.cash < b.budget
                              ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                              : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                          )}
                        >
                          {b.label} ({formatShortNumber(b.budget)} ₶)
                        </button>
                      ))}
                    </div>
                    {namesStatus === 'loading' ? <div className="mt-2 text-xs text-tx-secondary font-bold">Chargement des noms…</div> : null}
                  </div>
                </div>
              ) : null}

              {activeTab === 'catalogue' ? (
                <div className="mt-4 space-y-2">
                  {activeProjects.length === 0 ? (
                    <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3 text-sm text-tx-secondary font-bold">
                      Aucun projet. Lance une production.
                    </div>
                  ) : (
                    activeProjects.slice(0, 24).map((p) => {
                      const selected = p.id === activeSelectedId;
                      const perf = 'boxOffice' in p ? p.boxOffice : 'sales' in p ? p.sales : 'viewers' in p ? p.viewers : p.attendance;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectProject(p.id)}
                          className={cn(
                            'w-full text-left rounded-xl border-2 px-3 py-3 transition-colors',
                            selected
                              ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                              : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-display font-black tracking-wider uppercase text-sm">{p.title}</div>
                              <div className={cn('mt-1 text-xs font-bold', selected ? 'text-brand-bg' : 'text-tx-secondary')}>
                                {p.status === 'producing' ? 'En production' : p.status === 'ready' ? 'Prêt' : 'Sorti'}
                                {p.deal.sold ? ` • ${activeDealLabel}: +${formatShortNumber(p.deal.perMin)} ₶/min` : ''}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold">{formatShortNumber(p.budget)} ₶</div>
                              <div className={cn('mt-1 text-xs font-bold', selected ? 'text-brand-bg' : 'text-tx-secondary')}>
                                {perf > 0 ? `${formatShortNumber(perf)} ₶` : '—'}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              ) : null}

              {activeTab === 'negociation' ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">{activeDealLabel}</div>
                    <div className="mt-2 text-sm text-tx-secondary font-bold">
                      Négocie un deal sur un projet sorti pour obtenir un cash immédiat + un revenu passif (₶/min).
                    </div>
                    <button
                      type="button"
                      onClick={openDealNegotiation}
                      disabled={!canOpenDeal}
                      className={cn(
                        'mt-3 w-full h-12 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                        !canOpenDeal
                          ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                          : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                      )}
                    >
                      Ouvrir négociation
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={releaseSelected}
                    disabled={!canRelease}
                    className={cn(
                      'w-full h-12 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                      !canRelease
                        ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                        : 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                    )}
                  >
                    Sortir (si prêt)
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div ref={negotiationRef} className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-display font-black tracking-wider uppercase">Négociation</div>
                <Users className="h-5 w-5 text-tx-secondary" />
              </div>

              {data.negotiation && data.negotiation.status === 'active' ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold">Partenaire</div>
                    <div className="mt-1 font-display font-black tracking-wider uppercase">{data.negotiation.partner}</div>
                    <div className="mt-2 text-xs text-tx-secondary font-bold">
                      Tour {data.negotiation.round} / {data.negotiation.maxRounds}
                    </div>
                  </div>

                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold">Offre actuelle</div>
                    <div className="mt-1 text-2xl font-display font-black tracking-wider">{formatShortNumber(data.negotiation.offer)} ₶</div>
                  </div>

                  <button
                    type="button"
                    onClick={acceptCurrentNegotiation}
                    className="w-full h-12 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                  >
                    Accepter
                  </button>

                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold">Contre-offre (₶)</div>
                    <input
                      value={counterOffer}
                      onChange={(e) => setCounterOffer(e.target.value)}
                      inputMode="decimal"
                      className="mt-2 w-full h-11 rounded-lg border-2 border-brand-border bg-brand-card px-3 text-sm font-bold text-tx-base placeholder:text-tx-secondary focus:outline-none"
                      placeholder="Ex: 50000"
                      aria-label="Contre-offre"
                    />
                    <button
                      type="button"
                      onClick={counterCurrentNegotiation}
                      className="mt-2 w-full h-11 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                    >
                      Proposer
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={closeNegotiation}
                    className="w-full h-11 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-transparent text-tx-secondary border-brand-border hover:text-tx-base hover:border-tx-base"
                  >
                    Fermer
                  </button>
                </div>
              ) : data.negotiation && data.negotiation.status === 'accepted' ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold">Accord conclu</div>
                    <div className="mt-1 text-2xl font-display font-black tracking-wider">{formatShortNumber(data.negotiation.offer)} ₶</div>
                  </div>
                  <button
                    type="button"
                    onClick={closeNegotiation}
                    className="w-full h-12 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                  >
                    OK
                  </button>
                </div>
              ) : data.negotiation && data.negotiation.status === 'walked' ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold">Échec</div>
                    <div className="mt-1 text-sm text-tx-secondary font-bold">{data.negotiation.partner} s’est retiré.</div>
                  </div>
                  <button
                    type="button"
                    onClick={closeNegotiation}
                    className="w-full h-12 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                  <div className="text-sm text-tx-secondary font-bold">Aucune négociation en cours.</div>
                </div>
              )}
            </div>

            <div className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-display font-black tracking-wider uppercase">Réputation</div>
                <TrendingUp className="h-5 w-5 text-tx-secondary" />
              </div>

              <div className="mt-3 space-y-2 text-sm font-bold">
                {(
                  [
                    { key: 'public', label: 'Public' },
                    { key: 'critique', label: 'Critique' },
                    { key: 'business', label: 'Business' },
                    { key: 'underground', label: 'Underground' },
                    { key: 'international', label: 'International' },
                  ] as Array<{ key: keyof Omit<ApexReputation, 'global'>; label: string }>
                ).map((r) => {
                  const v = clamp01(data.reputation[r.key]);
                  return (
                    <div key={r.key} className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-tx-secondary">{r.label}</span>
                        <span className="font-mono text-tx-base">{Math.round(v * 100)}%</span>
                      </div>
                      <div className="mt-2 h-3 rounded-full border-2 border-brand-border bg-brand-card overflow-hidden">
                        <div className="h-full bg-accent-primary" style={{ width: `${Math.round(v * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-tx-secondary">Global</span>
                    <span className="font-mono text-tx-base">{Math.round(clamp01(data.reputation.global) * 100)}%</span>
                  </div>
                  <div className="mt-2 text-xs text-tx-secondary font-bold">Income ×{reputationMult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-display font-black tracking-wider uppercase">Buffs</div>
                <TrendingUp className="h-5 w-5 text-tx-secondary" />
              </div>
              <div className="mt-3 rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3 space-y-2 text-sm font-bold">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-tx-secondary">Income</span>
                  <span className="font-mono text-tx-base">×{buffsIncomeMult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-tx-secondary">Décroissance hype</span>
                  <span className="font-mono text-tx-base">×{buffsHypeDecayMult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-tx-secondary">Actifs</span>
                  <span className="font-mono text-tx-base">{activeBuffs.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {data.activeModal ? (
          <div className="fixed inset-0 z-[99998]">
            <div className="absolute inset-0 bg-black/70" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md px-4">
              <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal">
                <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">
                  {data.activeModal.kind === 'agent' ? 'Agent' : 'Événement'}
                </div>
                <div className="mt-2 font-display text-2xl font-black tracking-wider uppercase text-tx-base">{data.activeModal.title}</div>
                <div className="mt-3 text-sm text-tx-secondary font-bold leading-relaxed">{data.activeModal.body}</div>
                <div className="mt-6 space-y-2">
                  {data.activeModal.options.map((o, idx) => (
                    <button
                      key={o.label}
                      type="button"
                      onClick={() => applyModalChoice(idx)}
                      className="w-full text-left rounded-xl border-2 border-brand-border bg-brand-inner px-4 py-3 hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                    >
                      <div className="font-display font-black tracking-wider uppercase text-sm">{o.label}</div>
                      <div className="mt-1 text-xs font-bold text-tx-secondary">{o.body}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tutorialOpen && tutorialSpot ? (
          <div className="fixed inset-0 z-[99999]">
            <div
              className="absolute rounded-[28px] border-2 border-tx-base pointer-events-none"
              style={{
                top: Math.max(8, tutorialSpot.top - 8),
                left: Math.max(8, tutorialSpot.left - 8),
                width: Math.max(0, tutorialSpot.width + 16),
                height: Math.max(0, tutorialSpot.height + 16),
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.72)',
              }}
            />

            <div
              ref={tutorialCardRef}
              className="absolute left-1/2 -translate-x-1/2 w-full max-w-md bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal"
              style={{ top: tutorialCardTop }}
            >
              <div className="text-xs font-bold tracking-widest uppercase text-tx-secondary">
                Tutoriel {tutorialStep + 1} / {tutorialSteps.length}
              </div>
              <div className="mt-2 font-display text-2xl font-black tracking-wider uppercase text-tx-base">{tutorialSteps[tutorialStep]?.title}</div>
              <div className="mt-3 text-sm text-tx-secondary font-bold leading-relaxed">{tutorialSteps[tutorialStep]?.body}</div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setTutorialStep((s) => Math.max(0, s - 1))}
                  disabled={tutorialStep === 0}
                  className={cn(
                    'h-11 px-4 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                    tutorialStep === 0
                      ? 'bg-transparent text-tx-secondary border-brand-border/40 opacity-60 cursor-not-allowed'
                      : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                  )}
                >
                  Retour
                </button>

                <button
                  type="button"
                  onClick={closeTutorial}
                  className="h-11 px-4 rounded-lg border-2 border-brand-border bg-transparent text-tx-secondary font-display font-black tracking-wider uppercase hover:text-tx-base hover:border-tx-base transition-colors"
                >
                  Passer
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (tutorialStep >= tutorialSteps.length - 1) {
                      closeTutorial();
                      return;
                    }
                    setTutorialStep((s) => Math.min(tutorialSteps.length - 1, s + 1));
                  }}
                  className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                >
                  {tutorialStep >= tutorialSteps.length - 1 ? 'Terminer' : 'Suivant'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
