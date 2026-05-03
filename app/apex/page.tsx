'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCloudSave } from '@/hooks/useCloudSave';
import { formatCoins, formatShortNumber } from '@/lib/itollec-clicker/format';
import { drawWithoutReplacement, type DrawState } from '@/lib/apex/draw';
import { generateApexAchievements, isAchievementUnlocked, type ApexAchievementDef } from '@/lib/apex/achievements';
import {
  computeNegotiationBoost,
  computePrestigeHypeDecayMult,
  computePrestigeIncomeMult,
  computePrestigeStartingCash,
  computeStarsFromTotalEarned,
  getPrestigeUpgrades,
  type ApexPrestigeState,
} from '@/lib/apex/prestige';
import {
  buyCrypto,
  buyStock,
  initCryptoState,
  initStockMarket,
  portfolioValue,
  sellCrypto,
  sellStock,
  stepCrypto,
  stepStocks,
  STOCKS,
  type CryptoState,
  type StockId,
  type StockMarketState,
} from '@/lib/apex/markets';
import { Film, Gamepad2, Plus, TrendingUp, Tv, Users, X } from 'lucide-react';

type SectorId = 'cinema' | 'musique' | 'series' | 'live' | 'crypto' | 'games' | 'stocks' | 'platform' | 'meta';

type ApexProjectStatus = 'producing' | 'ready' | 'released';

type ApexDeal = {
  sold: boolean;
  upfront: number;
  perMin: number;
  soldAt?: number;
  buyerName?: string;
};

type ApexBuyerPersonality = 'prudente' | 'standard' | 'genereuse' | 'agressive';

type ApexBuyer = {
  id: string;
  name: string;
  personality: ApexBuyerPersonality;
  refusals: number;
  withdrawn: boolean;
};

type ApexDealNegotiation = {
  sector: Exclude<SectorId, 'crypto' | 'stocks' | 'platform' | 'meta'>;
  projectId: string;
  buyerId: string | null;
  askingPrice: number;
};

type ApexProjectListItem = {
  sector: Exclude<SectorId, 'crypto' | 'stocks' | 'platform' | 'meta'>;
  id: string;
  title: string;
  subtitle: string;
  status: ApexProjectStatus;
  budget: number;
  startedAt: number;
  durationMs: number;
  quality: number;
  perf: number;
  deal: ApexDeal;
  releasedAt?: number;
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
  releasedAt?: number;
  buyers?: ApexBuyer[];
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
  releasedAt?: number;
  buyers?: ApexBuyer[];
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
  onPlatform: boolean;
  releasedAt?: number;
  buyers?: ApexBuyer[];
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
  releasedAt?: number;
  buyers?: ApexBuyer[];
};

type ApexGame = {
  id: string;
  title: string;
  studio: string;
  budget: number;
  startedAt: number;
  durationMs: number;
  status: ApexProjectStatus;
  quality: number;
  sales: number;
  deal: ApexDeal;
  releasedAt?: number;
  buyers?: ApexBuyer[];
};

type ApexPlatformState = {
  subscribers: number;
  arpuPerMin: number;
  infraLevel: number;
  marketingLevel: number;
  librarySeasonIds: string[];
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
  projectRef?: { sector: SectorId; projectId: string } | null;
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
  unlockedSectors: Partial<Record<SectorId, boolean>>;
  cinema: { films: ApexFilm[]; selectedId: string | null };
  musique: { releases: ApexMusicRelease[]; selectedId: string | null };
  series: { seasons: ApexSeriesSeason[]; selectedId: string | null };
  live: { events: ApexLiveEvent[]; selectedId: string | null };
  games: { games: ApexGame[]; selectedId: string | null };
  crypto: CryptoState;
  stocks: StockMarketState;
  platform: ApexPlatformState;
  reputation: ApexReputation;
  buffs: ApexBuff[];
  achievementsUnlocked: string[];
  prestige: ApexPrestigeState;
  negotiation: ApexDealNegotiation | null;
  nextAgentAt: number;
  nextEventAt: number;
  activeModal: ApexChoiceModal | null;
};

const INITIAL_SAVE: ApexSave = {
  version: 5,
  cash: 5000,
  hype: 0.12,
  lastTickAt: Date.now(),
  totalEarned: 0,
  totalSpent: 0,
  drawByCategory: {},
  activeSector: 'cinema',
  unlockedSectors: { cinema: true },
  cinema: { films: [], selectedId: null },
  musique: { releases: [], selectedId: null },
  series: { seasons: [], selectedId: null },
  live: { events: [], selectedId: null },
  games: { games: [], selectedId: null },
  crypto: initCryptoState(),
  stocks: initStockMarket(),
  platform: { subscribers: 0, arpuPerMin: 0.012, infraLevel: 0, marketingLevel: 0, librarySeasonIds: [] },
  reputation: { public: 0.1, critique: 0.08, business: 0.06, underground: 0.04, international: 0.02, global: 0.06 },
  buffs: [],
  achievementsUnlocked: [],
  prestige: { stars: 0, lifetimeStars: 0, upgrades: {} },
  negotiation: null,
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

function getEnvergureMult(qualityLevel: number): number {
  if (qualityLevel >= 3) return 2;
  if (qualityLevel === 2) return 1.4;
  return 1;
}

function computeProjectTotalBudget(budgetBase: number, marketingPct: number, qualityLevel: number): {
  envergureMult: number;
  productionBudget: number;
  marketingBudget: number;
  totalBudget: number;
} {
  const base = Math.max(0, Math.floor(budgetBase));
  const pct = Math.max(0, Math.min(100, marketingPct));
  const envergureMult = getEnvergureMult(qualityLevel);
  const productionBudget = Math.floor(base * envergureMult);
  const marketingBudget = Math.floor(productionBudget * (pct / 100));
  const totalBudget = Math.floor(productionBudget + marketingBudget);
  return { envergureMult, productionBudget, marketingBudget, totalBudget };
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
  for (const g of save.games.games) {
    if (g.deal.sold) sum += g.deal.perMin;
  }

  const libraryCount = save.platform.librarySeasonIds.length;
  const infraMult = 1 + save.platform.infraLevel * 0.05;
  const libMult = 1 + Math.min(1.5, libraryCount * 0.03);
  const platformIncome = save.platform.subscribers * save.platform.arpuPerMin * infraMult * libMult;
  sum += platformIncome;

  return sum;
}

function areStringArraysEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function computeDealsCount(save: ApexSave): number {
  let n = 0;
  for (const f of save.cinema.films) if (f.deal.sold) n += 1;
  for (const r of save.musique.releases) if (r.deal.sold) n += 1;
  for (const s of save.series.seasons) if (s.deal.sold) n += 1;
  for (const e of save.live.events) if (e.deal.sold) n += 1;
  for (const g of save.games.games) if (g.deal.sold) n += 1;
  return n;
}

function computeReleasedBySector(save: ApexSave): Record<string, number> {
  const out: Record<string, number> = {};
  out.cinema = save.cinema.films.filter((x) => x.status === 'released').length;
  out.musique = save.musique.releases.filter((x) => x.status === 'released').length;
  out.series = save.series.seasons.filter((x) => x.status === 'released').length;
  out.live = save.live.events.filter((x) => x.status === 'released').length;
  out.games = save.games.games.filter((x) => x.status === 'released').length;
  return out;
}

export default function ApexPage() {
  const { data, setData, isLoaded } = useCloudSave<ApexSave>('apex', INITIAL_SAVE, { silent: true });
  const [achievementQuery, setAchievementQuery] = useState('');
  const [mobileSheet, setMobileSheet] = useState<null | 'sectors' | 'actions'>(null);
  const [creationModal, setCreationModal] = useState<SectorId | null>(null);
  const [page, setPage] = useState<'sector' | 'projects'>('sector');
  const [projectsQuery, setProjectsQuery] = useState('');
  const [projectsSector, setProjectsSector] = useState<'all' | ApexProjectListItem['sector']>('all');
  const [projectsStatus, setProjectsStatus] = useState<'all' | ApexProjectStatus>('all');
  const [projectsShowSold, setProjectsShowSold] = useState(true);
  const [projectsSort, setProjectsSort] = useState<'newest' | 'budget' | 'perf' | 'negotiable'>('newest');
  
  // Creation Panel State
  const [creationGenre, setCreationGenre] = useState('Action');
  const [creationBudget, setCreationBudget] = useState('5000');
  const [creationMarketing, setCreationMarketing] = useState('25');
  const [creationQualityLevel, setCreationQualityLevel] = useState(1); // 1, 2, 3

  const [names, setNames] = useState<Record<string, string[]> | null>(null);
  const [namesStatus, setNamesStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const achievements = useMemo(() => generateApexAchievements(), []);
  const achievementById = useMemo(() => new Map(achievements.map((a) => [a.id, a] as const)), [achievements]);
  const prestigeUpgrades = useMemo(() => getPrestigeUpgrades(), []);

  const cashRef = useRef<HTMLDivElement | null>(null);
  const ppsRef = useRef<HTMLDivElement | null>(null);
  const sectorRef = useRef<HTMLDivElement | null>(null);
  const sectorButtonRef = useRef<HTMLButtonElement | null>(null);
  const productionRef = useRef<HTMLDivElement | null>(null);
  const negotiationRef = useRef<HTMLDivElement | null>(null);
  const metaTabRef = useRef<HTMLButtonElement | null>(null);
  const tutorialCardRef = useRef<HTMLDivElement | null>(null);

  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialSpot, setTutorialSpot] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [tutorialCardTop, setTutorialCardTop] = useState(24);

  const tutorialSteps = useMemo(
    () => [
      { key: 'pps', title: '₶/min', body: 'Ton revenu passif. Il augmente surtout grâce aux contrats de droits.' },
      { key: 'cash', title: 'Trésorerie', body: 'Tes ₶ disponibles. Elles servent à financer des projets et payer des coûts.' },
      { key: 'sector', title: 'Secteurs', body: 'Débloque des secteurs (Crypto, Jeux, Bourse, Plateforme) en accumulant des ₶.' },
      { key: 'production', title: 'Production', body: 'Lance un projet, attends la production, puis sors-le pour gagner du cash et de la hype.' },
      { key: 'negociation', title: 'Deals', body: 'Négocie des deals pour un cash immédiat + ₶/min (sauf Crypto/Bourse/Plateforme).' },
      { key: 'meta', title: 'Méta', body: 'Débloque des succès (+bonus) et récupère des Apex Stars pour acheter des upgrades permanentes.' },
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
      if (step?.key === 'sector') return sectorButtonRef.current ?? sectorRef.current;
      if (step?.key === 'production') return productionRef.current;
      if (step?.key === 'negociation') return negotiationRef.current;
      if (step?.key === 'meta') return metaTabRef.current ?? productionRef.current;
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

  const gameStudios = useMemo(() => {
    const list = names?.studios_jv ?? [];
    return Array.isArray(list) ? list : [];
  }, [names]);

  const gameNames = useMemo(() => {
    const list = names?.noms_jeux ?? [];
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
  const achievementsMult = useMemo(() => 1 + Math.max(0, (data.achievementsUnlocked?.length ?? 0)) * 0.01, [data.achievementsUnlocked]);
  const prestigeIncomeMult = useMemo(() => computePrestigeIncomeMult(data.prestige), [data.prestige]);

  const incomePerMin = useMemo(() => {
    const hypeMult = 1 + clamp01(data.hype) * 0.6;
    return passiveIncomePerMin * hypeMult * reputationMult * buffsIncomeMult * achievementsMult * prestigeIncomeMult;
  }, [achievementsMult, buffsIncomeMult, data.hype, passiveIncomePerMin, prestigeIncomeMult, reputationMult]);

  const prevAchievementsUnlockedRef = useRef<string[] | null>(null);
  const toastedAchievementIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isLoaded) return;
    const prev = prevAchievementsUnlockedRef.current;
    const next = data.achievementsUnlocked ?? [];
    if (!prev) {
      prevAchievementsUnlockedRef.current = next;
      return;
    }
    const prevSet = new Set(prev);
    const newly = next.filter((id) => !prevSet.has(id));
    prevAchievementsUnlockedRef.current = next;
    if (newly.length === 0) return;
    newly.slice(0, 4).forEach((id) => {
      if (toastedAchievementIdsRef.current.has(id)) return;
      const a = achievementById.get(id);
      if (!a) return;
      toastedAchievementIdsRef.current.add(id);
      toast('Succès débloqué', { description: a.name, duration: 3500 });
    });
  }, [achievementById, data.achievementsUnlocked, isLoaded]);

  const computeAchievementsUnlockedNow = useCallback(
    (save: ApexSave) => {
      const ctx = {
        cash: save.cash,
        totalEarned: save.totalEarned,
        dealsCount: computeDealsCount(save),
        releasedBySector: computeReleasedBySector(save),
        reputationGlobal: clamp01(save.reputation.global),
        cryptoProfit: save.crypto.realizedProfit,
        stocksProfit: save.stocks.realizedProfit,
        platformSubscribers: save.platform.subscribers,
        prestigeStars: save.prestige.stars,
      };
      const already = new Set(save.achievementsUnlocked ?? []);
      for (const a of achievements) {
        if (isAchievementUnlocked(a, ctx)) already.add(a.id);
      }
      return achievements.filter((a) => already.has(a.id)).map((a) => a.id);
    },
    [achievements]
  );

  useEffect(() => {
    if (!isLoaded) return;
    const now = Date.now();
    setData((prev) => {
      if (prev.version >= 5 && prev.activeSector && prev.unlockedSectors) return prev;

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
      const legacyFilms: ApexFilm[] = legacyMovies.map((m) => ({
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

      const cinemaFilms = Array.isArray((prev as Partial<ApexSave>).cinema?.films) ? (prev as ApexSave).cinema.films : legacyFilms;
      const cinemaSelectedId =
        typeof (prev as Partial<ApexSave>).cinema?.selectedId === 'string' || (prev as Partial<ApexSave>).cinema?.selectedId === null
          ? (prev as ApexSave).cinema.selectedId
          : legacy.sector?.selectedMovieId ?? null;

      const seasonsRaw = Array.isArray((prev as Partial<ApexSave>).series?.seasons) ? (prev as ApexSave).series.seasons : [];
      const seasons: ApexSeriesSeason[] = seasonsRaw.map((s) => ({ ...s, onPlatform: Boolean((s as Partial<ApexSeriesSeason>).onPlatform ?? false) }));

      const prestige: ApexPrestigeState =
        typeof (prev as Partial<ApexSave>).prestige?.stars === 'number'
          ? (prev as ApexSave).prestige
          : { stars: 0, lifetimeStars: 0, upgrades: {} };

      const unlockedSectors: Partial<Record<SectorId, boolean>> =
        typeof (prev as Partial<ApexSave>).unlockedSectors === 'object' && (prev as Partial<ApexSave>).unlockedSectors
          ? (prev as ApexSave).unlockedSectors
          : { cinema: true };

      const achievementsUnlocked = prev.version >= 4 ? ((prev as ApexSave).achievementsUnlocked ?? []) : [];

      const crypto = (prev as Partial<ApexSave>).crypto?.price ? (prev as ApexSave).crypto : initCryptoState();
      const stocks = (prev as Partial<ApexSave>).stocks?.prices ? (prev as ApexSave).stocks : initStockMarket();
      const platform =
        typeof (prev as Partial<ApexSave>).platform?.subscribers === 'number'
          ? (prev as ApexSave).platform
          : { subscribers: 0, arpuPerMin: 0.012, infraLevel: 0, marketingLevel: 0, librarySeasonIds: [] };

      const startingCashBonus = computePrestigeStartingCash(prestige);
      const baseStartingCash = 5000 + startingCashBonus;
      const safeCashRaw = typeof prev.cash === 'number' && Number.isFinite(prev.cash) ? prev.cash : baseStartingCash;
      const safeTotalEarned = typeof prev.totalEarned === 'number' && Number.isFinite(prev.totalEarned) ? prev.totalEarned : 0;
      const safeTotalSpent = typeof prev.totalSpent === 'number' && Number.isFinite(prev.totalSpent) ? prev.totalSpent : 0;
      const safeCash = clampNonNegative(safeCashRaw);
      const shouldBoostStartCash =
        safeTotalEarned <= 0 &&
        safeTotalSpent <= 0 &&
        safeCash < 2500 &&
        legacyFilms.length === 0 &&
        cinemaFilms.length === 0;

      return {
        ...prev,
        version: 5,
        cash: shouldBoostStartCash ? baseStartingCash : safeCash,
        activeSector: (prev as Partial<ApexSave>).activeSector ?? 'cinema',
        unlockedSectors,
        cinema: { films: cinemaFilms, selectedId: cinemaSelectedId },
        musique: (prev as Partial<ApexSave>).musique ?? { releases: [], selectedId: null },
        series: { ...(prev as Partial<ApexSave>).series ?? { seasons: [], selectedId: null }, seasons },
        live: (prev as Partial<ApexSave>).live ?? { events: [], selectedId: null },
        games: (prev as Partial<ApexSave>).games ?? { games: [], selectedId: null },
        crypto,
        stocks,
        platform,
        prestige,
        achievementsUnlocked,
        reputation,
        buffs: Array.isArray(prev.buffs) ? prev.buffs : [],
        negotiation: null,
        nextAgentAt: prev.nextAgentAt ?? now + (6 + Math.random() * 6) * 60_000,
        nextEventAt: prev.nextEventAt ?? now + (3 + Math.random() * 4) * 60_000,
        activeModal: prev.activeModal ?? null,
      } as ApexSave;
    });
  }, [isLoaded, setData]);

  useEffect(() => {
    if (!isLoaded) return;

    let raf = 0;
    const tick = () => {
      setData((prev) => {
        if (prev.version < 5) return prev;
        const epochNow = Date.now();
        const elapsedMs = Math.max(0, epochNow - prev.lastTickAt);
        const steps = Math.min(10, Math.floor(elapsedMs / 1000));
        if (steps <= 0) return prev;

        const buffs = (prev.buffs ?? []).filter((b) => epochNow < b.startedAt + b.durationMs);
        const buffIncomeMult = buffs.reduce((acc, b) => acc * b.incomeMult, 1);
        const buffHypeDecayMult = buffs.reduce((acc, b) => acc * b.hypeDecayMult, 1);
        const prestigeIncomeMultNow = computePrestigeIncomeMult(prev.prestige);
        const prestigeHypeDecayMultNow = computePrestigeHypeDecayMult(prev.prestige);
        const achievementsMultNow = 1 + Math.max(0, (prev.achievementsUnlocked?.length ?? 0)) * 0.01;

        const crypto = stepCrypto(prev.crypto, steps);
        const stocks = stepStocks(prev.stocks, steps);

        let platform = prev.platform;
        const libCount = platform.librarySeasonIds.length;
        if (libCount > 0) {
          const repPublic = clamp01(prev.reputation.public);
          const repIntl = clamp01(prev.reputation.international);
          const growthPerMin =
            2 + platform.marketingLevel * 4 + repPublic * 22 + repIntl * 14 + Math.min(300, libCount * 8 + platform.infraLevel * 2);
          const growth = (growthPerMin / 60) * steps;
          platform = { ...platform, subscribers: Math.floor(Math.max(0, platform.subscribers + growth)) };
        }

        const basePerMin = computePassiveIncomePerMin({ ...prev, crypto, stocks, platform });
        const hype = clamp01(prev.hype);
        const repGlobal = clamp01(prev.reputation?.global ?? 0);
        const hypeMult = 1 + hype * 0.6;
        const repMult = 1 + repGlobal * 0.5;
        const incomePerSec = ((basePerMin * hypeMult * repMult * buffIncomeMult * achievementsMultNow * prestigeIncomeMultNow) / 60) * steps;

        const nextCash = clampNonNegative(prev.cash + incomePerSec);
        const nextEarned = clampNonNegative(prev.totalEarned + incomePerSec);

        const denom = 300 * (1 + repGlobal * 0.8);
        const decay = Math.exp(-((steps / denom) * buffHypeDecayMult * prestigeHypeDecayMultNow));
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
        const games = prev.games.games.map((g) => {
          if (g.status !== 'producing') return g;
          if (epochNow < g.startedAt + g.durationMs) return g;
          changed = true;
          return { ...g, status: 'ready' as const };
        });

        let activeModal = prev.activeModal;
        let nextAgentAt = prev.nextAgentAt;
        let nextEventAt = prev.nextEventAt;

        if (!activeModal && epochNow >= prev.nextAgentAt) {
          // Agent intelligent
          // Chercher des projets sortis non vendus (opportunités)
          const unsold: { sector: SectorId, id: string, title: string, budget: number, type: string }[] = [];
          prev.cinema.films.forEach(f => { if (f.status === 'released' && !f.deal.sold) unsold.push({ sector: 'cinema', id: f.id, title: f.title, budget: f.budget, type: 'Film' }); });
          prev.musique.releases.forEach(r => { if (r.status === 'released' && !r.deal.sold) unsold.push({ sector: 'musique', id: r.id, title: r.title, budget: r.budget, type: 'Morceau' }); });
          prev.series.seasons.forEach(s => { if (s.status === 'released' && !s.deal.sold) unsold.push({ sector: 'series', id: s.id, title: s.title, budget: s.budget, type: 'Série' }); });
          prev.live.events.forEach(e => { if (e.status === 'released' && !e.deal.sold) unsold.push({ sector: 'live', id: e.id, title: e.title, budget: e.budget, type: 'Événement' }); });
          prev.games.games.forEach(g => { if (g.status === 'released' && !g.deal.sold) unsold.push({ sector: 'games', id: g.id, title: g.title, budget: g.budget, type: 'Jeu' }); });
          
          let generated = false;

          if (unsold.length > 0 && Math.random() < 0.6) {
            const p = unsold[Math.floor(Math.random() * unsold.length)];
            const offer = Math.max(500, Math.floor(p.budget * (0.8 + Math.random() * 0.7)));
            activeModal = {
              id: createId(),
              kind: 'agent',
              title: `Offre directe pour ${p.title}`,
              body: `J'ai un contact sérieux qui veut acheter les droits de ton ${p.type.toLowerCase()} immédiatement pour ${formatShortNumber(offer)} ₶. Pas de négociation, à prendre ou à laisser.`,
              projectRef: { sector: p.sector, projectId: p.id },
              options: [
                {
                  label: 'Vendre',
                  body: `+${formatShortNumber(offer)} ₶ immédiat.`,
                  cashDelta: offer,
                  hypeDelta: 0,
                  repDelta: { business: 0.02 },
                },
                {
                  label: 'Refuser',
                  body: 'On trouvera mieux plus tard.',
                  cashDelta: 0,
                  hypeDelta: 0,
                  repDelta: { critique: 0.01 },
                }
              ]
            };
            generated = true;
          } else if (prev.cash > 5000 && Math.random() < 0.5) {
             activeModal = {
              id: createId(),
              kind: 'agent',
              title: 'Campagne de Hype',
              body: 'On peut injecter 2500 ₶ dans une campagne de relations publiques agressive pour booster la Hype globale de 20%.',
              projectRef: null,
              options: [
                {
                  label: 'Payer 2500 ₶',
                  body: 'Hype +20%.',
                  cashDelta: -2500,
                  hypeDelta: 0.20,
                  repDelta: { public: 0.03 },
                },
                {
                  label: 'Ignorer',
                  body: 'On garde le cash.',
                  cashDelta: 0,
                  hypeDelta: 0,
                  repDelta: {},
                }
              ]
            };
            generated = true;
          }

          if (!generated) {
            const t = agentTemplates[Math.floor(Math.random() * agentTemplates.length)]!;
            activeModal = {
              id: createId(),
              kind: 'agent',
              title: t.title,
              body: t.body,
              projectRef: null,
              options: t.options.map((o) => ({
                label: o.label,
                body: o.body,
                cashDelta: o.cashDelta,
                hypeDelta: o.hypeDelta,
                repDelta: o.repDelta,
                buff: 'buff' in o && o.buff ? o.buff : undefined,
              })),
            };
          }
          nextAgentAt = epochNow + (6 + Math.random() * 6) * 60_000;
          changed = true;
        } else if (!activeModal && epochNow >= prev.nextEventAt) {
          const t = eventTemplates[Math.floor(Math.random() * eventTemplates.length)]!;
          activeModal = {
            id: createId(),
            kind: 'event',
            title: t.title,
            body: t.body,
            projectRef: null,
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

        const nextBase: ApexSave = {
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
          games: { ...prev.games, games },
          crypto,
          stocks,
          platform,
          activeModal,
          nextAgentAt,
          nextEventAt,
        };

        // Condition de faillite (Game Over)
        const isBankrupt = 
          nextBase.cash < 500 && 
          basePerMin <= 0 &&
          films.every((f) => f.status === 'released' && f.deal.sold) &&
          releases.every((r) => r.status === 'released' && r.deal.sold) &&
          seasons.every((s) => s.status === 'released' && s.deal.sold) &&
          events.every((e) => e.status === 'released' && e.deal.sold) &&
          games.every((g) => g.status === 'released' && g.deal.sold) &&
          crypto.holdings * crypto.price < 500 &&
          portfolioValue(stocks) < 500;

        if (isBankrupt && !nextBase.activeModal) {
          nextBase.activeModal = {
            id: createId(),
            kind: 'event',
            title: 'Faillite',
            body: 'Tu n\'as plus d\'argent, plus de revenus passifs, plus de projets à vendre et plus d\'actifs. Ton empire s\'effondre.',
            options: [
              {
                label: 'Recommencer',
                body: 'Tout perdre et repartir à zéro.',
                cashDelta: 0,
                hypeDelta: 0,
                repDelta: {},
              }
            ]
          };
        }

        const nextAchievements = computeAchievementsUnlockedNow(nextBase);
        const next = areStringArraysEqual(nextAchievements, nextBase.achievementsUnlocked)
          ? nextBase
          : { ...nextBase, achievementsUnlocked: nextAchievements };

        return changed ||
          next.cash !== prev.cash ||
          next.hype !== prev.hype ||
          buffs.length !== (prev.buffs ?? []).length ||
          next.crypto !== prev.crypto ||
          next.stocks !== prev.stocks ||
          next.platform !== prev.platform ||
          next.achievementsUnlocked !== prev.achievementsUnlocked
          ? next
          : prev;
      });

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [agentTemplates, computeAchievementsUnlockedNow, eventTemplates, isLoaded, setData]);

  const sectorUnlockCost: Record<SectorId, number> = useMemo(
    () => ({ cinema: 0, musique: 25_000, series: 75_000, live: 150_000, games: 250_000, crypto: 400_000, stocks: 600_000, platform: 900_000, meta: 0 }),
    []
  );

  const isSectorUnlocked = useCallback((id: SectorId) => Boolean(data.unlockedSectors?.[id]) || id === 'cinema', [data.unlockedSectors]);

  const unlockSector = useCallback(
    (id: SectorId) => {
      setData((prev) => {
        if (prev.unlockedSectors?.[id] || id === 'cinema') return prev;
        const cost = sectorUnlockCost[id];
        if (prev.cash < cost) {
          toast('Secteur', { description: `Il te manque ${formatShortNumber(cost - prev.cash)} ₶.`, duration: 3000 });
          return prev;
        }
        toast('Secteur débloqué', { description: id, duration: 3000 });
        return {
          ...prev,
          cash: clampNonNegative(prev.cash - cost),
          totalSpent: clampNonNegative(prev.totalSpent + cost),
          unlockedSectors: { ...prev.unlockedSectors, [id]: true },
          activeSector: id,
        };
      });
    },
    [sectorUnlockCost, setData]
  );

  const setActiveSector = useCallback(
    (id: SectorId) => {
      if (!isSectorUnlocked(id) && id !== 'meta') {
        unlockSector(id);
        return;
      }
      setData((prev) => ({ ...prev, activeSector: id }));
    },
    [isSectorUnlocked, setData, unlockSector]
  );

  const activeSectorTitle = useMemo(() => {
    if (data.activeSector === 'cinema') return 'Cinéma';
    if (data.activeSector === 'musique') return 'Musique';
    if (data.activeSector === 'series') return 'Séries & Streaming';
    if (data.activeSector === 'live') return 'Événements Live';
    if (data.activeSector === 'games') return 'Jeux vidéo';
    if (data.activeSector === 'crypto') return 'Crypto';
    if (data.activeSector === 'stocks') return 'Bourse';
    return 'Plateforme';
  }, [data.activeSector]);

  const activeDealLabel = useMemo(() => {
    if (data.activeSector === 'cinema') return 'Droits';
    if (data.activeSector === 'musique') return 'Royalties';
    if (data.activeSector === 'series') return 'Streaming';
    if (data.activeSector === 'live') return 'Sponsor';
    if (data.activeSector === 'games') return 'Publishing';
    return '';
  }, [data.activeSector]);

  const allProjects = useMemo<ApexProjectListItem[]>(() => {
    const films: ApexProjectListItem[] = data.cinema.films.map((p) => ({
      sector: 'cinema',
      id: p.id,
      title: p.title,
      subtitle: `Qualité ${Math.round(clamp01(p.quality) * 100)}%`,
      status: p.status,
      budget: p.budget,
      startedAt: p.startedAt,
      durationMs: p.durationMs,
      quality: p.quality,
      perf: p.boxOffice,
      deal: p.deal,
      releasedAt: p.releasedAt,
    }));
    const musique: ApexProjectListItem[] = data.musique.releases.map((p) => ({
      sector: 'musique',
      id: p.id,
      title: p.title,
      subtitle: p.artist,
      status: p.status,
      budget: p.budget,
      startedAt: p.startedAt,
      durationMs: p.durationMs,
      quality: p.quality,
      perf: p.sales,
      deal: p.deal,
      releasedAt: p.releasedAt,
    }));
    const series: ApexProjectListItem[] = data.series.seasons.map((p) => ({
      sector: 'series',
      id: p.id,
      title: p.title,
      subtitle: p.showrunner,
      status: p.status,
      budget: p.budget,
      startedAt: p.startedAt,
      durationMs: p.durationMs,
      quality: p.quality,
      perf: p.viewers,
      deal: p.deal,
      releasedAt: p.releasedAt,
    }));
    const live: ApexProjectListItem[] = data.live.events.map((p) => ({
      sector: 'live',
      id: p.id,
      title: p.title,
      subtitle: p.headliner,
      status: p.status,
      budget: p.budget,
      startedAt: p.startedAt,
      durationMs: p.durationMs,
      quality: p.quality,
      perf: p.attendance,
      deal: p.deal,
      releasedAt: p.releasedAt,
    }));
    const games: ApexProjectListItem[] = data.games.games.map((p) => ({
      sector: 'games',
      id: p.id,
      title: p.title,
      subtitle: p.studio,
      status: p.status,
      budget: p.budget,
      startedAt: p.startedAt,
      durationMs: p.durationMs,
      quality: p.quality,
      perf: p.sales,
      deal: p.deal,
      releasedAt: p.releasedAt,
    }));
    return [...films, ...musique, ...series, ...live, ...games];
  }, [data.cinema.films, data.games.games, data.live.events, data.musique.releases, data.series.seasons]);

  const projectsFiltered = useMemo(() => {
    const q = projectsQuery.trim().toLowerCase();
    const now = Date.now();
    const filtered = allProjects.filter((p) => {
      if (!projectsShowSold && p.deal.sold) return false;
      if (projectsSector !== 'all' && p.sector !== projectsSector) return false;
      if (projectsStatus !== 'all' && p.status !== projectsStatus) return false;
      if (!q) return true;
      return `${p.title} ${p.subtitle}`.toLowerCase().includes(q);
    });

    const sectorWeight: Record<ApexProjectListItem['sector'], number> = { cinema: 1, musique: 2, series: 3, live: 4, games: 5 };
    const statusWeight: Record<ApexProjectStatus, number> = { producing: 1, ready: 2, released: 3 };

    const sorted = [...filtered].sort((a, b) => {
      if (projectsSort === 'budget') return b.budget - a.budget || b.startedAt - a.startedAt;
      if (projectsSort === 'perf') return b.perf - a.perf || b.startedAt - a.startedAt;
      if (projectsSort === 'negotiable') {
        const aNeg = a.status === 'released' && !a.deal.sold && now >= (a.releasedAt ?? 0) + 300_000 ? 1 : 0;
        const bNeg = b.status === 'released' && !b.deal.sold && now >= (b.releasedAt ?? 0) + 300_000 ? 1 : 0;
        return bNeg - aNeg || b.startedAt - a.startedAt;
      }
      const aKey = statusWeight[a.status] * 10 + sectorWeight[a.sector];
      const bKey = statusWeight[b.status] * 10 + sectorWeight[b.sector];
      return b.startedAt - a.startedAt || bKey - aKey;
    });

    return sorted;
  }, [allProjects, projectsQuery, projectsSector, projectsShowSold, projectsSort, projectsStatus]);

  const activeProjects = useMemo(() => {
    if (data.activeSector === 'cinema') return data.cinema.films;
    if (data.activeSector === 'musique') return data.musique.releases;
    if (data.activeSector === 'series') return data.series.seasons;
    if (data.activeSector === 'live') return data.live.events;
    if (data.activeSector === 'games') return data.games.games;
    return [];
  }, [data.activeSector, data.cinema.films, data.games.games, data.live.events, data.musique.releases, data.series.seasons]);

  const activeSelectedId = useMemo(() => {
    if (data.activeSector === 'cinema') return data.cinema.selectedId;
    if (data.activeSector === 'musique') return data.musique.selectedId;
    if (data.activeSector === 'series') return data.series.selectedId;
    if (data.activeSector === 'live') return data.live.selectedId;
    if (data.activeSector === 'games') return data.games.selectedId;
    return null;
  }, [data.activeSector, data.cinema.selectedId, data.games.selectedId, data.live.selectedId, data.musique.selectedId, data.series.selectedId]);

  const selectProject = useCallback(
    (id: string) => {
      setData((prev) => {
        if (prev.activeSector === 'cinema') return { ...prev, cinema: { ...prev.cinema, selectedId: id } };
        if (prev.activeSector === 'musique') return { ...prev, musique: { ...prev.musique, selectedId: id } };
        if (prev.activeSector === 'series') return { ...prev, series: { ...prev.series, selectedId: id } };
        if (prev.activeSector === 'live') return { ...prev, live: { ...prev.live, selectedId: id } };
        if (prev.activeSector === 'games') return { ...prev, games: { ...prev.games, selectedId: id } };
        return prev;
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

        const soldDeal: ApexDeal = { sold: true, upfront: Math.max(0, choice.cashDelta), perMin: 0 };
        const shouldApplyDirectSale = modal.kind === 'agent' && choice.label === 'Vendre' && Boolean(modal.projectRef);
        const updatedCinema = shouldApplyDirectSale && modal.projectRef?.sector === 'cinema'
          ? prev.cinema.films.map((x) => (x.id === modal.projectRef?.projectId ? ({ ...x, deal: soldDeal } as ApexFilm) : x))
          : prev.cinema.films;
        const updatedMusique = shouldApplyDirectSale && modal.projectRef?.sector === 'musique'
          ? prev.musique.releases.map((x) => (x.id === modal.projectRef?.projectId ? ({ ...x, deal: soldDeal } as ApexMusicRelease) : x))
          : prev.musique.releases;
        const updatedSeries = shouldApplyDirectSale && modal.projectRef?.sector === 'series'
          ? prev.series.seasons.map((x) => (x.id === modal.projectRef?.projectId ? ({ ...x, deal: soldDeal } as ApexSeriesSeason) : x))
          : prev.series.seasons;
        const updatedLive = shouldApplyDirectSale && modal.projectRef?.sector === 'live'
          ? prev.live.events.map((x) => (x.id === modal.projectRef?.projectId ? ({ ...x, deal: soldDeal } as ApexLiveEvent) : x))
          : prev.live.events;
        const updatedGames = shouldApplyDirectSale && modal.projectRef?.sector === 'games'
          ? prev.games.games.map((x) => (x.id === modal.projectRef?.projectId ? ({ ...x, deal: soldDeal } as ApexGame) : x))
          : prev.games.games;

        // Si faillite recommencer
        if (modal.title === 'Faillite' && choice.label === 'Recommencer') {
          return {
            ...INITIAL_SAVE,
            prestige: prev.prestige,
            achievementsUnlocked: prev.achievementsUnlocked,
            cash: 5000 + computePrestigeStartingCash(prev.prestige),
          };
        }

        toast(modal.kind === 'agent' ? 'Agent' : 'Événement', { description: choice.label, duration: 3000 });
        const minNextAt = now + 45_000;

        return {
          ...prev,
          cash: nextCash,
          totalEarned: nextEarned,
          totalSpent: nextSpent,
          hype: clamp01(prev.hype + choice.hypeDelta),
          reputation,
          buffs,
          activeModal: null,
          cinema: { ...prev.cinema, films: updatedCinema },
          musique: { ...prev.musique, releases: updatedMusique },
          series: { ...prev.series, seasons: updatedSeries },
          live: { ...prev.live, events: updatedLive },
          games: { ...prev.games, games: updatedGames },
          nextAgentAt: Math.max(prev.nextAgentAt, minNextAt),
          nextEventAt: Math.max(prev.nextEventAt, minNextAt),
        };
      });
    },
    [setData, updateReputation]
  );

  const startCinema = useCallback(
    (budgetBase: number, marketingPct: number, qualityLevel: number) => {
      if (namesStatus !== 'ready') return;
      if (filmNames.length === 0) return;

      const { totalBudget } = computeProjectTotalBudget(budgetBase, marketingPct, qualityLevel);

      setData((prev) => {
        if (prev.cash < totalBudget) {
          toast('Cinéma', { description: `Il te manque ${formatShortNumber(totalBudget - prev.cash)} ₶.`, duration: 3000 });
          return prev;
        }

        const drawPrev = prev.drawByCategory.films;
        const drawn = drawWithoutReplacement({ list: filmNames, prev: drawPrev });
        
        // Quality Level (1 = Débutant, 2 = Confirmé, 3 = Star) adds base quality but costs more.
        // Actually, we just use the qualityLevel to boost quality.
        const baseQ = qualityLevel === 3 ? 0.6 : qualityLevel === 2 ? 0.45 : 0.35;
        const quality = Math.min(1, baseQ + Math.random() * 0.4 + (marketingPct / 100) * 0.1);
        const durationMs = Math.round((18_000 + Math.random() * 12_000) * (0.85 + Math.min(1, totalBudget / 200_000) * 0.5));

        const film: ApexFilm = {
          id: createId(),
          title: drawn.value,
          budget: totalBudget,
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
          cash: clampNonNegative(prev.cash - totalBudget),
          totalSpent: clampNonNegative(prev.totalSpent + totalBudget),
          drawByCategory: { ...prev.drawByCategory, films: drawn.next },
          cinema: { ...prev.cinema, films: [film, ...prev.cinema.films], selectedId: film.id },
        };
      });
      setCreationModal(null);
    },
    [filmNames, namesStatus, setData]
  );

  const startMusique = useCallback(
    (budgetBase: number, marketingPct: number, qualityLevel: number) => {
      if (namesStatus !== 'ready') return;
      if (artistNames.length === 0) return;

      const { totalBudget } = computeProjectTotalBudget(budgetBase, marketingPct, qualityLevel);

      setData((prev) => {
        if (prev.cash < totalBudget) {
          toast('Musique', { description: `Il te manque ${formatShortNumber(totalBudget - prev.cash)} ₶.`, duration: 3000 });
          return prev;
        }

        const artistDraw = drawWithoutReplacement({ list: artistNames, prev: prev.drawByCategory.artistes });
        const titleDraw =
          filmNames.length > 0 ? drawWithoutReplacement({ list: filmNames, prev: prev.drawByCategory.films_alt ?? prev.drawByCategory.films }) : null;

        const artist = artistDraw.value;
        const title = titleDraw ? titleDraw.value : `Single — ${artist}`;
        const baseQ = qualityLevel === 3 ? 0.6 : qualityLevel === 2 ? 0.45 : 0.35;
        const quality = Math.min(1, baseQ + Math.random() * 0.4 + (marketingPct / 100) * 0.1);
        const durationMs = Math.round((16_000 + Math.random() * 10_000) * (0.85 + Math.min(1, totalBudget / 200_000) * 0.5));

        const release: ApexMusicRelease = {
          id: createId(),
          title,
          artist,
          budget: totalBudget,
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
          cash: clampNonNegative(prev.cash - totalBudget),
          totalSpent: clampNonNegative(prev.totalSpent + totalBudget),
          drawByCategory: {
            ...prev.drawByCategory,
            artistes: artistDraw.next,
            ...(titleDraw ? { films_alt: titleDraw.next } : {}),
          },
          musique: { ...prev.musique, releases: [release, ...prev.musique.releases], selectedId: release.id },
        };
      });
      setCreationModal(null);
    },
    [artistNames, filmNames, namesStatus, setData]
  );

  const startSeries = useCallback(
    (budgetBase: number, marketingPct: number, qualityLevel: number) => {
      if (namesStatus !== 'ready') return;
      if (seriesNames.length === 0) return;

      const { totalBudget } = computeProjectTotalBudget(budgetBase, marketingPct, qualityLevel);

      setData((prev) => {
        if (prev.cash < totalBudget) {
          toast('Séries', { description: `Il te manque ${formatShortNumber(totalBudget - prev.cash)} ₶.`, duration: 3000 });
          return prev;
        }

        const titleDraw = drawWithoutReplacement({ list: seriesNames, prev: prev.drawByCategory.noms_series });
        const showrunnerDraw =
          showrunnerNames.length > 0 ? drawWithoutReplacement({ list: showrunnerNames, prev: prev.drawByCategory.showrunners }) : null;

        const baseQ = qualityLevel === 3 ? 0.6 : qualityLevel === 2 ? 0.45 : 0.35;
        const quality = Math.min(1, baseQ + Math.random() * 0.4 + (marketingPct / 100) * 0.1);
        const durationMs = Math.round((22_000 + Math.random() * 14_000) * (0.85 + Math.min(1, totalBudget / 200_000) * 0.5));

        const season: ApexSeriesSeason = {
          id: createId(),
          title: titleDraw.value,
          showrunner: showrunnerDraw ? showrunnerDraw.value : 'Showrunner',
          budget: totalBudget,
          startedAt: Date.now(),
          durationMs,
          status: 'producing',
          quality,
          viewers: 0,
          deal: { sold: false, upfront: 0, perMin: 0 },
          onPlatform: false,
        };

        toast('Séries', { description: `Production lancée: ${season.title}`, duration: 3500 });
        return {
          ...prev,
          cash: clampNonNegative(prev.cash - totalBudget),
          totalSpent: clampNonNegative(prev.totalSpent + totalBudget),
          drawByCategory: {
            ...prev.drawByCategory,
            noms_series: titleDraw.next,
            ...(showrunnerDraw ? { showrunners: showrunnerDraw.next } : {}),
          },
          series: { ...prev.series, seasons: [season, ...prev.series.seasons], selectedId: season.id },
        };
      });
      setCreationModal(null);
    },
    [namesStatus, seriesNames, setData, showrunnerNames]
  );

  const startLive = useCallback(
    (budgetBase: number, marketingPct: number, qualityLevel: number) => {
      if (namesStatus !== 'ready') return;
      if (artistNames.length === 0) return;

      const { totalBudget } = computeProjectTotalBudget(budgetBase, marketingPct, qualityLevel);

      setData((prev) => {
        if (prev.cash < totalBudget) {
          toast('Live', { description: `Il te manque ${formatShortNumber(totalBudget - prev.cash)} ₶.`, duration: 3000 });
          return prev;
        }

        const headlinerDraw = drawWithoutReplacement({ list: artistNames, prev: prev.drawByCategory.artistes_live ?? prev.drawByCategory.artistes });
        const headliner = headlinerDraw.value;
        
        const baseQ = qualityLevel === 3 ? 0.6 : qualityLevel === 2 ? 0.45 : 0.35;
        const quality = Math.min(1, baseQ + Math.random() * 0.4 + (marketingPct / 100) * 0.1);
        const durationMs = Math.round((14_000 + Math.random() * 10_000) * (0.85 + Math.min(1, totalBudget / 200_000) * 0.5));

        const e: ApexLiveEvent = {
          id: createId(),
          title: `Live: ${headliner}`,
          headliner,
          budget: totalBudget,
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
          cash: clampNonNegative(prev.cash - totalBudget),
          totalSpent: clampNonNegative(prev.totalSpent + totalBudget),
          drawByCategory: { ...prev.drawByCategory, artistes_live: headlinerDraw.next },
          live: { ...prev.live, events: [e, ...prev.live.events], selectedId: e.id },
        };
      });
      setCreationModal(null);
    },
    [artistNames, namesStatus, setData]
  );

  const startGame = useCallback(
    (budgetBase: number, marketingPct: number, qualityLevel: number) => {
      if (namesStatus !== 'ready') return;
      if (gameNames.length === 0) return;

      const { totalBudget } = computeProjectTotalBudget(budgetBase, marketingPct, qualityLevel);

      setData((prev) => {
        if (prev.cash < totalBudget) {
          toast('Jeux vidéo', { description: `Il te manque ${formatShortNumber(totalBudget - prev.cash)} ₶.`, duration: 3000 });
          return prev;
        }

        const titleDraw = drawWithoutReplacement({ list: gameNames, prev: prev.drawByCategory.noms_jeux });
        const studioDraw = gameStudios.length > 0 ? drawWithoutReplacement({ list: gameStudios, prev: prev.drawByCategory.studios_jv }) : null;

        const baseQ = qualityLevel === 3 ? 0.6 : qualityLevel === 2 ? 0.45 : 0.35;
        const quality = Math.min(1, baseQ + Math.random() * 0.4 + (marketingPct / 100) * 0.1);
        const durationMs = Math.round((20_000 + Math.random() * 16_000) * (0.85 + Math.min(1, totalBudget / 400_000) * 0.6));

        const g: ApexGame = {
          id: createId(),
          title: titleDraw.value,
          studio: studioDraw ? studioDraw.value : 'Studio',
          budget: totalBudget,
          startedAt: Date.now(),
          durationMs,
          status: 'producing',
          quality,
          sales: 0,
          deal: { sold: false, upfront: 0, perMin: 0 },
        };

        toast('Jeux vidéo', { description: `Développement lancé: ${g.title}`, duration: 3500 });
        return {
          ...prev,
          cash: clampNonNegative(prev.cash - totalBudget),
          totalSpent: clampNonNegative(prev.totalSpent + totalBudget),
          drawByCategory: {
            ...prev.drawByCategory,
            noms_jeux: titleDraw.next,
            ...(studioDraw ? { studios_jv: studioDraw.next } : {}),
          },
          games: { ...prev.games, games: [g, ...prev.games.games], selectedId: g.id },
        };
      });
      setCreationModal(null);
    },
    [gameNames, gameStudios, namesStatus, setData]
  );

  const releaseProjectById = useCallback(
    (sector: SectorId, projectId: string) => {
      setData((prev) => {
        const now = Date.now();
        const rep = prev.reputation;
        const hype = clamp01(prev.hype);

        if (sector === 'cinema') {
          const m = prev.cinema.films.find((x) => x.id === projectId);
          if (!m || m.status !== 'ready') return prev;

          const repMult = 0.9 + rep.public * 0.25 + rep.critique * 0.15;
          const hypeMult = 1 + hype * 1.1;
          const roll = 0.8 + Math.random() * 1.7;
          const boxOffice = m.budget * roll * (0.9 + m.quality * 0.5) * repMult * hypeMult;

          const nextFilms: ApexFilm[] = prev.cinema.films.map((x) =>
            x.id === projectId ? ({ ...x, status: 'released' as const, boxOffice, releasedAt: x.releasedAt ?? now } as ApexFilm) : x
          );
          const reputation = updateReputation(prev.reputation, { public: 0.01, critique: 0.005 + m.quality * 0.01 });
          toast('Box-office', { description: `+${formatShortNumber(boxOffice)} ₶`, duration: 3500 });

          return {
            ...prev,
            cash: clampNonNegative(prev.cash + boxOffice),
            totalEarned: clampNonNegative(prev.totalEarned + boxOffice),
            hype: clamp01(prev.hype + 0.05 + m.quality * 0.04),
            reputation,
            cinema: { ...prev.cinema, films: nextFilms, selectedId: projectId },
          };
        }

        if (sector === 'musique') {
          const r = prev.musique.releases.find((x) => x.id === projectId);
          if (!r || r.status !== 'ready') return prev;

          const repMult = 0.85 + rep.public * 0.35 + rep.underground * 0.1;
          const roll = 0.7 + Math.random() * 1.6;
          const sales = r.budget * roll * (0.85 + r.quality * 0.45) * repMult * (1 + hype * 0.7);

          const nextReleases: ApexMusicRelease[] = prev.musique.releases.map((x) =>
            x.id === projectId ? ({ ...x, status: 'released' as const, sales, releasedAt: x.releasedAt ?? now } as ApexMusicRelease) : x
          );
          const reputation = updateReputation(prev.reputation, { public: 0.01, underground: 0.01 + r.quality * 0.01 });
          toast('Ventes', { description: `+${formatShortNumber(sales)} ₶`, duration: 3500 });

          return {
            ...prev,
            cash: clampNonNegative(prev.cash + sales),
            totalEarned: clampNonNegative(prev.totalEarned + sales),
            hype: clamp01(prev.hype + 0.04 + r.quality * 0.03),
            reputation,
            musique: { ...prev.musique, releases: nextReleases, selectedId: projectId },
          };
        }

        if (sector === 'series') {
          const s = prev.series.seasons.find((x) => x.id === projectId);
          if (!s || s.status !== 'ready') return prev;

          const repMult = 0.85 + rep.international * 0.35 + rep.business * 0.1;
          const roll = 0.75 + Math.random() * 1.55;
          const viewers = s.budget * roll * (0.85 + s.quality * 0.45) * repMult * (1 + hype * 0.6);
          const cash = viewers;

          const nextSeasons: ApexSeriesSeason[] = prev.series.seasons.map((x) =>
            x.id === projectId ? ({ ...x, status: 'released' as const, viewers, releasedAt: x.releasedAt ?? now } as ApexSeriesSeason) : x
          );
          const reputation = updateReputation(prev.reputation, { international: 0.015, business: 0.005 });
          toast('Audiences', { description: `+${formatShortNumber(cash)} ₶`, duration: 3500 });

          return {
            ...prev,
            cash: clampNonNegative(prev.cash + cash),
            totalEarned: clampNonNegative(prev.totalEarned + cash),
            hype: clamp01(prev.hype + 0.04 + s.quality * 0.03),
            reputation,
            series: { ...prev.series, seasons: nextSeasons, selectedId: projectId },
          };
        }

        if (sector === 'games') {
          const g = prev.games.games.find((x) => x.id === projectId);
          if (!g || g.status !== 'ready') return prev;

          const repMult = 0.85 + rep.business * 0.25 + rep.critique * 0.1;
          const roll = 0.75 + Math.random() * 1.65;
          const sales = g.budget * roll * (0.88 + g.quality * 0.42) * repMult * (1 + hype * 0.65);
          const cash = sales;

          const nextGames: ApexGame[] = prev.games.games.map((x) =>
            x.id === projectId ? ({ ...x, status: 'released' as const, sales, releasedAt: x.releasedAt ?? now } as ApexGame) : x
          );
          const reputation = updateReputation(prev.reputation, { business: 0.01, critique: 0.004 + g.quality * 0.01 });
          toast('Ventes', { description: `+${formatShortNumber(cash)} ₶`, duration: 3500 });

          return {
            ...prev,
            cash: clampNonNegative(prev.cash + cash),
            totalEarned: clampNonNegative(prev.totalEarned + cash),
            hype: clamp01(prev.hype + 0.045 + g.quality * 0.03),
            reputation,
            games: { ...prev.games, games: nextGames, selectedId: projectId },
          };
        }

        if (sector !== 'live') return prev;
        const e = prev.live.events.find((x) => x.id === projectId);
        if (!e || e.status !== 'ready') return prev;

        const repMult = 0.95 + rep.public * 0.25 + rep.international * 0.1;
        const roll = 0.8 + Math.random() * 1.4;
        const attendance = e.budget * roll * (0.9 + e.quality * 0.4) * repMult * (1 + hype * 0.5);
        const cash = attendance;

        const nextEvents: ApexLiveEvent[] = prev.live.events.map((x) =>
          x.id === projectId ? ({ ...x, status: 'released' as const, attendance, releasedAt: x.releasedAt ?? now } as ApexLiveEvent) : x
        );
        const reputation = updateReputation(prev.reputation, { public: 0.02, international: 0.005 });
        toast('Billetterie', { description: `+${formatShortNumber(cash)} ₶`, duration: 3500 });

        return {
          ...prev,
          cash: clampNonNegative(prev.cash + cash),
          totalEarned: clampNonNegative(prev.totalEarned + cash),
          hype: clamp01(prev.hype + 0.05 + e.quality * 0.03),
          reputation,
          live: { ...prev.live, events: nextEvents, selectedId: projectId },
        };
      });
    },
    [setData, updateReputation]
  );

  const releaseSelected = useCallback(() => {
    const sector = data.activeSector;
    const id = activeSelectedId;
    if (!id) return;
    if (sector === 'crypto' || sector === 'stocks' || sector === 'platform' || sector === 'meta') return;
    releaseProjectById(sector, id);
  }, [activeSelectedId, data.activeSector, releaseProjectById]);

  const openDealNegotiationFor = useCallback(
    (sector: SectorId, projectId: string) => {
      if (sector === 'crypto' || sector === 'stocks' || sector === 'platform' || sector === 'meta') return;

      setData((prev) => {
        const now = Date.now();
        const getProject = () => {
          if (sector === 'cinema') return prev.cinema.films.find((x) => x.id === projectId) ?? null;
          if (sector === 'musique') return prev.musique.releases.find((x) => x.id === projectId) ?? null;
          if (sector === 'series') return prev.series.seasons.find((x) => x.id === projectId) ?? null;
          if (sector === 'live') return prev.live.events.find((x) => x.id === projectId) ?? null;
          if (sector === 'games') return prev.games.games.find((x) => x.id === projectId) ?? null;
          return null;
        };

        const p = getProject();
        if (!p || p.status !== 'released' || p.deal.sold) return prev;
        const canNegotiateAt = (p.releasedAt ?? 0) + 300_000;
        if (now < canNegotiateAt) {
          const leftSec = Math.ceil((canNegotiateAt - now) / 1000);
          const mm = Math.floor(leftSec / 60);
          const ss = String(leftSec % 60).padStart(2, '0');
          toast('Négociation', { description: `Disponible dans ${mm}:${ss}.`, duration: 2500 });
          return prev;
        }

        const perf = 'boxOffice' in p ? p.boxOffice : 'sales' in p ? p.sales : 'viewers' in p ? p.viewers : p.attendance;
        const hype = clamp01(prev.hype);
        const rep = prev.reputation;
        const sectorRep =
          sector === 'cinema'
            ? clamp01((rep.public + rep.critique) / 2)
            : sector === 'musique'
              ? clamp01((rep.public + rep.underground) / 2)
              : sector === 'series'
                ? clamp01((rep.international + rep.business) / 2)
                : sector === 'live'
                  ? clamp01((rep.public + rep.international) / 2)
                  : clamp01((rep.business + rep.critique) / 2);

        const ageMin = Math.max(0, Math.floor((now - (p.releasedAt ?? now)) / 60_000));
        const ageFactor = Math.max(0.6, 1 - (ageMin / 180) * 0.25);
        const base = Math.max(350, perf * 0.12 + p.budget * 0.35);
        const qualityFactor = 0.85 + clamp01(p.quality) * 0.35;
        const hypeFactor = 0.9 + hype * 0.6;
        const repFactor = 0.85 + sectorRep * 0.5;
        const rawRecommended = base * qualityFactor * hypeFactor * repFactor * ageFactor;
        const boost = computeNegotiationBoost(prev.prestige);
        const recommended = Math.max(350, Math.floor((rawRecommended * (1 + boost)) / 50) * 50);

        const generateBuyers = (): ApexBuyer[] => {
          const count = 3 + Math.floor(Math.random() * 3);
          const personalityPool: ApexBuyerPersonality[] = ['standard', 'standard', 'prudente', 'genereuse', 'agressive'];
          const makeName = () => {
            const prefix = sector === 'cinema' ? 'Studio' : sector === 'musique' ? 'Label' : sector === 'series' ? 'Stream' : sector === 'live' ? 'Sponsor' : 'Publisher';
            const suffix = Math.floor(100 + Math.random() * 900);
            return `${prefix} ${suffix}`;
          };
          return Array.from({ length: count }).map(() => ({
            id: createId(),
            name: makeName(),
            personality: personalityPool[Math.floor(Math.random() * personalityPool.length)] ?? 'standard',
            refusals: 0,
            withdrawn: false,
          }));
        };

        const nextBuyers = (p.buyers && p.buyers.length > 0) ? p.buyers : generateBuyers();
        const firstAvailable = nextBuyers.find((b) => !b.withdrawn)?.id ?? null;

        const applyBuyers = <T extends { id: string; buyers?: ApexBuyer[] }>(items: T[]): T[] =>
          items.map((x) => (x.id === projectId ? ({ ...x, buyers: nextBuyers } as T) : x));

        if (!p.buyers || p.buyers.length === 0) {
          if (sector === 'cinema') return { ...prev, cinema: { ...prev.cinema, films: applyBuyers(prev.cinema.films) }, negotiation: { sector, projectId, buyerId: firstAvailable, askingPrice: recommended } };
          if (sector === 'musique') return { ...prev, musique: { ...prev.musique, releases: applyBuyers(prev.musique.releases) }, negotiation: { sector, projectId, buyerId: firstAvailable, askingPrice: recommended } };
          if (sector === 'series') return { ...prev, series: { ...prev.series, seasons: applyBuyers(prev.series.seasons) }, negotiation: { sector, projectId, buyerId: firstAvailable, askingPrice: recommended } };
          if (sector === 'live') return { ...prev, live: { ...prev.live, events: applyBuyers(prev.live.events) }, negotiation: { sector, projectId, buyerId: firstAvailable, askingPrice: recommended } };
          return { ...prev, games: { ...prev.games, games: applyBuyers(prev.games.games) }, negotiation: { sector, projectId, buyerId: firstAvailable, askingPrice: recommended } };
        }

        return { ...prev, negotiation: { sector, projectId, buyerId: firstAvailable, askingPrice: recommended } };
      });
    },
    [setData]
  );

  const openDealNegotiation = useCallback(() => {
    const sector = data.activeSector;
    const id = activeSelectedId;
    if (!id) return;
    openDealNegotiationFor(sector, id);
  }, [activeSelectedId, data.activeSector, openDealNegotiationFor]);

  const setNegotiationBuyer = useCallback(
    (buyerId: string) => {
      setData((prev) => {
        if (!prev.negotiation) return prev;
        return { ...prev, negotiation: { ...prev.negotiation, buyerId } };
      });
    },
    [setData]
  );

  const setNegotiationAskingPrice = useCallback(
    (askingPrice: number) => {
      setData((prev) => {
        if (!prev.negotiation) return prev;
        const next = Math.max(1, Math.floor(askingPrice));
        return { ...prev, negotiation: { ...prev.negotiation, askingPrice: next } };
      });
    },
    [setData]
  );

  const closeNegotiation = useCallback(() => {
    setData((prev) => ({ ...prev, negotiation: null }));
  }, [setData]);

  const attemptDeal = useCallback(() => {
    setData((prev) => {
      const n = prev.negotiation;
      if (!n) return prev;

      const sector = n.sector;
      const projectId = n.projectId;
      const now = Date.now();

      const getProject = () => {
        if (sector === 'cinema') return prev.cinema.films.find((x) => x.id === projectId) ?? null;
        if (sector === 'musique') return prev.musique.releases.find((x) => x.id === projectId) ?? null;
        if (sector === 'series') return prev.series.seasons.find((x) => x.id === projectId) ?? null;
        if (sector === 'live') return prev.live.events.find((x) => x.id === projectId) ?? null;
        return prev.games.games.find((x) => x.id === projectId) ?? null;
      };

      const p = getProject();
      if (!p || p.status !== 'released' || p.deal.sold) return { ...prev, negotiation: null };
      const buyers = p.buyers ?? [];
      const buyer = buyers.find((b) => b.id === n.buyerId) ?? null;
      if (!buyer || buyer.withdrawn) return prev;

      const perf = 'boxOffice' in p ? p.boxOffice : 'sales' in p ? p.sales : 'viewers' in p ? p.viewers : p.attendance;
      const hype = clamp01(prev.hype);
      const rep = prev.reputation;
      const sectorRep =
        sector === 'cinema'
          ? clamp01((rep.public + rep.critique) / 2)
          : sector === 'musique'
            ? clamp01((rep.public + rep.underground) / 2)
            : sector === 'series'
              ? clamp01((rep.international + rep.business) / 2)
              : sector === 'live'
                ? clamp01((rep.public + rep.international) / 2)
                : clamp01((rep.business + rep.critique) / 2);

      const ageMin = Math.max(0, Math.floor((now - (p.releasedAt ?? now)) / 60_000));
      const ageFactor = Math.max(0.6, 1 - (ageMin / 180) * 0.25);
      const base = Math.max(350, perf * 0.12 + p.budget * 0.35);
      const qualityFactor = 0.85 + clamp01(p.quality) * 0.35;
      const hypeFactor = 0.9 + hype * 0.6;
      const repFactor = 0.85 + sectorRep * 0.5;
      const rawRecommended = base * qualityFactor * hypeFactor * repFactor * ageFactor;
      const boost = computeNegotiationBoost(prev.prestige);
      const recommended = Math.max(350, Math.floor((rawRecommended * (1 + boost)) / 50) * 50);

      const personality = buyer.personality;
      const baseProb = personality === 'genereuse' ? 0.88 : personality === 'prudente' ? 0.82 : personality === 'agressive' ? 0.78 : 0.85;
      const maxMult = personality === 'genereuse' ? 1.18 : personality === 'prudente' ? 0.95 : personality === 'agressive' ? 1.05 : 1.0;
      const target = Math.max(200, Math.floor((recommended * maxMult) / 50) * 50);
      const asking = Math.max(1, Math.floor(n.askingPrice));

      let prob = 0;
      if (asking <= target) {
        prob = Math.min(0.95, baseProb + (1 - asking / target) * 0.12);
      } else {
        const ratio = asking / target;
        prob = baseProb * Math.exp(-(ratio - 1) * 2.2);
      }
      prob = clamp01(prob - buyer.refusals * 0.08);

      const success = Math.random() < prob;
      if (success) {
        const factor = sector === 'live' ? 0.015 : sector === 'series' ? 0.021 : sector === 'games' ? 0.019 : 0.02;
        const incomeMult = 1 + hype * 0.45 + sectorRep * 0.35;
        const perMin = Math.max(0, Math.floor(asking * factor * incomeMult));
        const deal: ApexDeal = { sold: true, upfront: asking, perMin, soldAt: now, buyerName: buyer.name };

        const applyDeal = <T extends { id: string; deal: ApexDeal }>(items: T[]): T[] =>
          items.map((x) => (x.id === projectId ? ({ ...x, deal } as T) : x));

        toast('Deal', { description: `Vendu à ${formatShortNumber(asking)} ₶`, duration: 3000 });
        const nextBase: ApexSave = {
          ...prev,
          cash: clampNonNegative(prev.cash + asking),
          totalEarned: clampNonNegative(prev.totalEarned + asking),
          negotiation: null,
          reputation: updateReputation(prev.reputation, { business: 0.01 }),
        };

        if (sector === 'cinema') return { ...nextBase, cinema: { ...nextBase.cinema, films: applyDeal(nextBase.cinema.films) } };
        if (sector === 'musique') return { ...nextBase, musique: { ...nextBase.musique, releases: applyDeal(nextBase.musique.releases) } };
        if (sector === 'series') return { ...nextBase, series: { ...nextBase.series, seasons: applyDeal(nextBase.series.seasons) } };
        if (sector === 'live') return { ...nextBase, live: { ...nextBase.live, events: applyDeal(nextBase.live.events) } };
        return { ...nextBase, games: { ...nextBase.games, games: applyDeal(nextBase.games.games) } };
      }

      const nextBuyers = buyers.map((b) => {
        if (b.id !== buyer.id) return b;
        const refusals = b.refusals + 1;
        const withdrawn = refusals >= 3;
        return { ...b, refusals, withdrawn };
      });

      const applyBuyers = <T extends { id: string; buyers?: ApexBuyer[] }>(items: T[]): T[] =>
        items.map((x) => (x.id === projectId ? ({ ...x, buyers: nextBuyers } as T) : x));

      toast('Deal refusé', { description: nextBuyers.find((b) => b.id === buyer.id)?.withdrawn ? 'L’acheteur se retire.' : 'Tu peux réessayer.', duration: 2500 });

      if (sector === 'cinema') return { ...prev, cinema: { ...prev.cinema, films: applyBuyers(prev.cinema.films) } };
      if (sector === 'musique') return { ...prev, musique: { ...prev.musique, releases: applyBuyers(prev.musique.releases) } };
      if (sector === 'series') return { ...prev, series: { ...prev.series, seasons: applyBuyers(prev.series.seasons) } };
      if (sector === 'live') return { ...prev, live: { ...prev.live, events: applyBuyers(prev.live.events) } };
      return { ...prev, games: { ...prev.games, games: applyBuyers(prev.games.games) } };
    });
  }, [setData, updateReputation]);

  const canOpenDeal = useMemo(() => {
    if (!selectedProject || selectedProject.status !== 'released' || selectedProject.deal.sold) return false;
    const now = Date.now();
    return now >= (selectedProject.releasedAt ?? 0) + 300_000;
  }, [selectedProject]);

  const canRelease = useMemo(() => Boolean(currentReady), [currentReady]);

  const startByActiveSector = useCallback(
    (budgetBase: number, marketingPct: number, qualityLevel: number) => {
      if (data.activeSector === 'cinema') startCinema(budgetBase, marketingPct, qualityLevel);
      else if (data.activeSector === 'musique') startMusique(budgetBase, marketingPct, qualityLevel);
      else if (data.activeSector === 'series') startSeries(budgetBase, marketingPct, qualityLevel);
      else if (data.activeSector === 'live') startLive(budgetBase, marketingPct, qualityLevel);
      else if (data.activeSector === 'games') startGame(budgetBase, marketingPct, qualityLevel);
    },
    [data.activeSector, startCinema, startGame, startLive, startMusique, startSeries]
  );

  const buyCryptoCash = useCallback(
    (amount: number) => {
      setData((prev) => {
        const cash = Math.max(0, Math.floor(amount));
        if (cash <= 0) return prev;
        if (prev.cash < cash) {
          toast('Crypto', { description: `Il te manque ${formatShortNumber(cash - prev.cash)} ₶.`, duration: 3000 });
          return prev;
        }
        const { next } = buyCrypto(prev.crypto, cash);
        toast('Crypto', { description: `Achat: ${formatShortNumber(cash)} ₶`, duration: 2500 });
        return { ...prev, cash: clampNonNegative(prev.cash - cash), crypto: next };
      });
    },
    [setData]
  );

  const sellCryptoPct = useCallback(
    (pct: number) => {
      setData((prev) => {
        const p = Math.max(0, Math.min(1, pct));
        if (prev.crypto.holdings <= 0) return prev;
        const units = prev.crypto.holdings * p;
        const { next, gained } = sellCrypto(prev.crypto, units);
        toast('Crypto', { description: `Vente: +${formatShortNumber(gained)} ₶`, duration: 2500 });
        return { ...prev, cash: clampNonNegative(prev.cash + gained), crypto: next };
      });
    },
    [setData]
  );

  const buyStockCash = useCallback(
    (id: StockId, amount: number) => {
      setData((prev) => {
        const cash = Math.max(0, Math.floor(amount));
        if (cash <= 0) return prev;
        if (prev.cash < cash) {
          toast('Bourse', { description: `Il te manque ${formatShortNumber(cash - prev.cash)} ₶.`, duration: 3000 });
          return prev;
        }
        const { next } = buyStock(prev.stocks, id, cash);
        return { ...prev, cash: clampNonNegative(prev.cash - cash), stocks: next };
      });
    },
    [setData]
  );

  const sellStockPct = useCallback(
    (id: StockId, pct: number) => {
      setData((prev) => {
        const held = prev.stocks.shares[id] ?? 0;
        if (held <= 0) return prev;
        const p = Math.max(0, Math.min(1, pct));
        const { next, gained } = sellStock(prev.stocks, id, held * p);
        return { ...prev, cash: clampNonNegative(prev.cash + gained), stocks: next };
      });
    },
    [setData]
  );

  const upgradePlatform = useCallback(
    (kind: 'infra' | 'marketing') => {
      setData((prev) => {
        if (!prev.unlockedSectors.platform) {
          toast('Plateforme', { description: 'Débloque le secteur Plateforme.', duration: 3000 });
          return prev;
        }
        const level = kind === 'infra' ? prev.platform.infraLevel : prev.platform.marketingLevel;
        const base = kind === 'infra' ? 40_000 : 25_000;
        const cost = Math.floor(base * Math.pow(1.7, level));
        if (prev.cash < cost) {
          toast('Plateforme', { description: `Il te manque ${formatShortNumber(cost - prev.cash)} ₶.`, duration: 3000 });
          return prev;
        }
        const platform =
          kind === 'infra'
            ? { ...prev.platform, infraLevel: prev.platform.infraLevel + 1 }
            : { ...prev.platform, marketingLevel: prev.platform.marketingLevel + 1 };
        return { ...prev, cash: clampNonNegative(prev.cash - cost), totalSpent: clampNonNegative(prev.totalSpent + cost), platform };
      });
    },
    [setData]
  );

  const addSeasonToPlatform = useCallback(
    (seasonId: string) => {
      setData((prev) => {
        if (!prev.unlockedSectors.platform) {
          toast('Plateforme', { description: 'Débloque le secteur Plateforme.', duration: 3000 });
          return prev;
        }
        const s = prev.series.seasons.find((x) => x.id === seasonId);
        if (!s || s.status !== 'released' || s.onPlatform) return prev;
        const nextSeasons = prev.series.seasons.map((x) => (x.id === seasonId ? ({ ...x, onPlatform: true } as ApexSeriesSeason) : x));
        const already = prev.platform.librarySeasonIds.includes(seasonId);
        const librarySeasonIds = already ? prev.platform.librarySeasonIds : [...prev.platform.librarySeasonIds, seasonId];
        const platform = { ...prev.platform, librarySeasonIds, subscribers: prev.platform.subscribers + 50 };
        toast('Plateforme', { description: `Ajout: ${s.title}`, duration: 3000 });
        return { ...prev, series: { ...prev.series, seasons: nextSeasons }, platform };
      });
    },
    [setData]
  );

  const achievementsFiltered = useMemo(() => {
    const q = achievementQuery.trim().toLowerCase();
    const unlockedSet = new Set(data.achievementsUnlocked ?? []);
    const list = q
      ? achievements.filter((a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q))
      : achievements;
    return [...list].sort((a, b) => Number(unlockedSet.has(b.id)) - Number(unlockedSet.has(a.id)) || a.id.localeCompare(b.id));
  }, [achievementQuery, achievements, data.achievementsUnlocked]);

  const claimableStars = useMemo(() => {
    const total = computeStarsFromTotalEarned(data.totalEarned);
    return Math.max(0, total - data.prestige.lifetimeStars);
  }, [data.prestige.lifetimeStars, data.totalEarned]);

  const prestigeNow = useCallback(() => {
    setData((prev) => {
      const total = computeStarsFromTotalEarned(prev.totalEarned);
      const claimable = Math.max(0, total - prev.prestige.lifetimeStars);
      if (claimable <= 0) {
        toast('Prestige', { description: 'Aucune Apex Star à récupérer pour le moment.', duration: 3000 });
        return prev;
      }

      const prestige: ApexPrestigeState = {
        ...prev.prestige,
        stars: prev.prestige.stars + claimable,
        lifetimeStars: prev.prestige.lifetimeStars + claimable,
        upgrades: prev.prestige.upgrades ?? {},
      };
      const startingCash = 5000 + computePrestigeStartingCash(prestige);

      toast('Prestige', { description: `+${claimable} Apex Stars`, duration: 3500 });

      return {
        ...prev,
        cash: startingCash,
        hype: 0.12,
        lastTickAt: Date.now(),
        drawByCategory: {},
        activeSector: 'cinema',
        unlockedSectors: { cinema: true },
        cinema: { films: [], selectedId: null },
        musique: { releases: [], selectedId: null },
        series: { seasons: [], selectedId: null },
        live: { events: [], selectedId: null },
        games: { games: [], selectedId: null },
        crypto: initCryptoState(),
        stocks: initStockMarket(),
        platform: { subscribers: 0, arpuPerMin: 0.012, infraLevel: 0, marketingLevel: 0, librarySeasonIds: [] },
        buffs: [],
        negotiation: null,
        nextAgentAt: Date.now() + (6 + Math.random() * 6) * 60_000,
        nextEventAt: Date.now() + (3 + Math.random() * 4) * 60_000,
        activeModal: null,
        prestige,
      };
    });
  }, [setData]);

  const buyPrestigeUpgrade = useCallback(
    (id: string, nextLevelCost: number) => {
      setData((prev) => {
        if (prev.prestige.stars < nextLevelCost) return prev;
        const upgrades = { ...(prev.prestige.upgrades ?? {}) } as Record<string, number>;
        const current = Math.max(0, Math.floor(upgrades[id] ?? 0));
        upgrades[id] = current + 1;
        return { ...prev, prestige: { ...prev.prestige, stars: prev.prestige.stars - nextLevelCost, upgrades } };
      });
    },
    [setData]
  );

  return (
    <main className="min-h-screen px-4 md:px-8 pt-6 pb-24 lg:pb-6">
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
              className="hidden sm:inline-flex items-center justify-center h-[52px] px-4 rounded-xl font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
            >
              Tutoriel
            </button>
            <button
              type="button"
              onClick={() => {
                setTutorialOpen(true);
                setTutorialStep(0);
              }}
              className="sm:hidden inline-flex items-center justify-center h-10 px-3 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
            >
              Tuto
            </button>

            <div ref={ppsRef} className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal px-4 py-2 flex flex-col justify-center h-full min-h-[64px]">
              <div className="text-xs text-tx-secondary font-bold">₶/min</div>
              <div className="text-xl font-display font-black tracking-wider leading-none mt-1">{formatCoins(incomePerMin)}</div>
            </div>

            <div ref={cashRef} className="rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal px-4 py-2 flex flex-col justify-center h-full min-h-[64px]">
              <div className="text-xs text-tx-secondary font-bold">Trésorerie</div>
              <div className="text-xl font-display font-black tracking-wider leading-none mt-1">{formatCoins(data.cash)}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div ref={sectorRef} className="hidden lg:block lg:col-span-3 rounded-xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
            <div className="text-sm font-display font-black tracking-wider uppercase">Secteurs</div>
            <div className="mt-3 space-y-2">
              {([
                { id: 'cinema', label: 'Cinéma', subtitle: 'Production • Box-office • Droits' },
                { id: 'musique', label: 'Musique', subtitle: 'Sorties • Ventes • Royalties' },
                { id: 'series', label: 'Séries & Streaming', subtitle: 'Saisons • Audiences • Streaming' },
                { id: 'live', label: 'Événements Live', subtitle: 'Billetterie • Sponsor' },
                { id: 'crypto', label: 'Crypto', subtitle: 'Cours • Graphique • Portefeuille' },
                { id: 'games', label: 'Jeux vidéo', subtitle: 'Dév • Ventes • Publishing' },
                { id: 'stocks', label: 'Bourse', subtitle: 'Marché • Portefeuille • Profits' },
                { id: 'platform', label: 'Plateforme', subtitle: 'Abonnés • ARPU • Catalogue' },
              ] as Array<{ id: SectorId; label: string; subtitle: string }>).map((s) => {
                const unlocked = isSectorUnlocked(s.id);
                const selected = data.activeSector === s.id;
                const cost = sectorUnlockCost[s.id];
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setPage('sector');
                      setActiveSector(s.id);
                    }}
                    className={cn(
                      'w-full text-left rounded-xl border-2 px-3 py-3 transition-colors',
                      selected
                        ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                        : unlocked
                          ? 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                          : 'bg-brand-inner text-tx-secondary border-brand-border opacity-70 hover:opacity-100'
                    )}
                    aria-disabled={!unlocked}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-display font-black tracking-wider uppercase">{s.label}</div>
                      {selected ? (
                        s.id === 'games' ? (
                          <Gamepad2 className="h-5 w-5" />
                        ) : s.id === 'platform' ? (
                          <Tv className="h-5 w-5" />
                        ) : s.id === 'crypto' || s.id === 'stocks' ? (
                          <TrendingUp className="h-5 w-5" />
                        ) : (
                          <Film className="h-5 w-5" />
                        )
                      ) : null}
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
                <div className="flex items-center gap-2">
                  <button
                    ref={sectorButtonRef}
                    type="button"
                    onClick={() => setMobileSheet('sectors')}
                    className="lg:hidden inline-flex items-center justify-center h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                    aria-label="Changer de secteur"
                  >
                    {activeSectorTitle}
                  </button>
                  <div className="hidden lg:block text-sm font-display font-black tracking-wider uppercase">{activeSectorTitle}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPage('sector')}
                  className={cn(
                    'h-11 rounded-xl border-2 font-display font-black tracking-wider uppercase transition-colors',
                    page === 'sector'
                      ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                      : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                  )}
                >
                  Secteur
                </button>
                <button
                  type="button"
                  onClick={() => setPage('projects')}
                  className={cn(
                    'h-11 rounded-xl border-2 font-display font-black tracking-wider uppercase transition-colors',
                    page === 'projects'
                      ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                      : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                  )}
                >
                  Projets
                </button>
              </div>

              {page === 'sector' && data.activeSector !== 'meta' ? (
                data.activeSector === 'crypto' ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                      <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Cours</div>
                      <div className="mt-2 flex items-end justify-between gap-3">
                        <div className="font-display font-black tracking-wider uppercase text-2xl">{formatShortNumber(data.crypto.price)} ₶</div>
                        <div className="text-right text-xs text-tx-secondary font-bold">
                          {formatShortNumber(data.crypto.holdings)} unités • {formatShortNumber(data.crypto.holdings * data.crypto.price)} ₶
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-tx-secondary font-bold">
                        Profit réalisé: {formatShortNumber(data.crypto.realizedProfit)} ₶
                      </div>
                    </div>

                    <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                      <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Graphique</div>
                      <div className="mt-3 h-24 rounded-lg border-2 border-brand-border bg-brand-card overflow-hidden">
                        {(() => {
                          const h = data.crypto.history;
                          const n = h.length;
                          if (n < 2) return null;
                          const slice = n > 80 ? h.slice(n - 80) : h;
                          const min = Math.min(...slice);
                          const max = Math.max(...slice);
                          const w = 320;
                          const hh = 96;
                          const range = Math.max(1e-9, max - min);
                          const pts = slice
                            .map((v, i) => {
                              const x = (i / (slice.length - 1)) * w;
                              const y = hh - ((v - min) / range) * hh;
                              return `${x.toFixed(2)},${y.toFixed(2)}`;
                            })
                            .join(' ');
                          return (
                            <svg viewBox={`0 0 ${w} ${hh}`} className="w-full h-full text-accent-primary">
                              <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="3" />
                            </svg>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                      <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Actions</div>
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[1000, 5000, 20_000, 100_000].map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => buyCryptoCash(a)}
                            disabled={data.cash < a}
                            className={cn(
                              'h-11 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                              data.cash < a
                                ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                            )}
                          >
                            Acheter {formatShortNumber(a)}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        {[
                          { label: 'Vendre 25%', pct: 0.25 },
                          { label: 'Vendre 50%', pct: 0.5 },
                          { label: 'Vendre 100%', pct: 1 },
                        ].map((b) => (
                          <button
                            key={b.label}
                            type="button"
                            onClick={() => sellCryptoPct(b.pct)}
                            disabled={data.crypto.holdings <= 0}
                            className={cn(
                              'h-11 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                              data.crypto.holdings <= 0
                                ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                            )}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : data.activeSector === 'stocks' ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                      <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Marché</div>
                      <div className="mt-3 space-y-2">
                        {STOCKS.map((s) => {
                          const price = data.stocks.prices[s.id] ?? s.base;
                          const held = data.stocks.shares[s.id] ?? 0;
                          const value = held * price;
                          return (
                            <div key={s.id} className="rounded-xl border-2 border-brand-border bg-brand-card px-3 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-display font-black tracking-wider uppercase text-sm">
                                    {s.id} • {s.name}
                                  </div>
                                  <div className="mt-1 text-xs text-tx-secondary font-bold">
                                    {formatShortNumber(price)} ₶ • {formatShortNumber(held)} parts • {formatShortNumber(value)} ₶
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => buyStockCash(s.id, 2000)}
                                    disabled={data.cash < 2000}
                                    className={cn(
                                      'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                      data.cash < 2000
                                        ? 'bg-brand-inner text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                        : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                    )}
                                  >
                                    +2k
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => buyStockCash(s.id, 10_000)}
                                    disabled={data.cash < 10_000}
                                    className={cn(
                                      'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                      data.cash < 10_000
                                        ? 'bg-brand-inner text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                        : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                    )}
                                  >
                                    +10k
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => sellStockPct(s.id, 0.25)}
                                    disabled={held <= 0}
                                    className={cn(
                                      'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                      held <= 0
                                        ? 'bg-brand-inner text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                        : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                    )}
                                  >
                                    -25%
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => sellStockPct(s.id, 1)}
                                    disabled={held <= 0}
                                    className={cn(
                                      'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                      held <= 0
                                        ? 'bg-brand-inner text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                        : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                    )}
                                  >
                                    -100%
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 text-xs text-tx-secondary font-bold">Profit réalisé: {formatShortNumber(data.stocks.realizedProfit)} ₶</div>
                    </div>
                  </div>
                ) : data.activeSector === 'platform' ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                      <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Plateforme</div>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm font-bold">
                        <div className="rounded-xl border-2 border-brand-border bg-brand-card p-3">
                          <div className="text-xs text-tx-secondary font-bold">Abonnés</div>
                          <div className="mt-1 font-display font-black tracking-wider uppercase">{formatShortNumber(data.platform.subscribers)}</div>
                        </div>
                        <div className="rounded-xl border-2 border-brand-border bg-brand-card p-3">
                          <div className="text-xs text-tx-secondary font-bold">ARPU</div>
                          <div className="mt-1 font-display font-black tracking-wider uppercase">
                            {data.platform.arpuPerMin.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ₶/min
                          </div>
                        </div>
                        <div className="rounded-xl border-2 border-brand-border bg-brand-card p-3">
                          <div className="text-xs text-tx-secondary font-bold">Catalogue</div>
                          <div className="mt-1 font-display font-black tracking-wider uppercase">{data.platform.librarySeasonIds.length} saisons</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                      <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Améliorations</div>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => upgradePlatform('marketing')}
                          className="h-12 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                        >
                          Marketing +1
                        </button>
                        <button
                          type="button"
                          onClick={() => upgradePlatform('infra')}
                          className="h-12 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                        >
                          Infra +1
                        </button>
                      </div>
                      <div className="mt-2 text-xs text-tx-secondary font-bold">
                        Niveaux: Marketing {data.platform.marketingLevel} • Infra {data.platform.infraLevel}
                      </div>
                    </div>
                  </div>
                ) : (
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
                      <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Nouveau projet</div>
                      <button
                        type="button"
                        onClick={() => setCreationModal(data.activeSector)}
                        disabled={namesStatus !== 'ready'}
                        className={cn(
                          'mt-3 w-full h-12 rounded-xl border-2 font-display font-black tracking-wider uppercase transition-colors shadow-brutal',
                          namesStatus !== 'ready'
                            ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                            : 'bg-accent-primary text-brand-bg border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                        )}
                      >
                        Configurer le projet
                      </button>
                      {namesStatus === 'loading' ? <div className="mt-2 text-xs text-tx-secondary font-bold">Chargement des données…</div> : null}
                    </div>
                  </div>
                )
              ) : null}

              {page === 'sector' && data.activeSector !== 'meta' ? (
                data.activeSector === 'crypto' ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                      <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Portefeuille</div>
                      <div className="mt-2 text-sm text-tx-secondary font-bold">
                        Holdings: <span className="text-tx-base">{formatShortNumber(data.crypto.holdings)}</span> • Valeur:{' '}
                        <span className="text-tx-base">{formatShortNumber(data.crypto.holdings * data.crypto.price)} ₶</span>
                      </div>
                      <div className="mt-1 text-sm text-tx-secondary font-bold">
                        Cost basis: <span className="text-tx-base">{formatShortNumber(data.crypto.costBasis)} ₶</span>
                      </div>
                    </div>
                  </div>
                ) : data.activeSector === 'stocks' ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                      <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Portefeuille</div>
                      <div className="mt-2 text-sm text-tx-secondary font-bold">
                        Valeur: <span className="text-tx-base">{formatShortNumber(portfolioValue(data.stocks))} ₶</span>
                      </div>
                      <div className="mt-1 text-sm text-tx-secondary font-bold">
                        Profit réalisé: <span className="text-tx-base">{formatShortNumber(data.stocks.realizedProfit)} ₶</span>
                      </div>
                    </div>
                  </div>
                ) : data.activeSector === 'platform' ? (
                  <div className="mt-4 space-y-2">
                    <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3 text-sm text-tx-secondary font-bold">
                      Catalogue plateforme: <span className="text-tx-base">{data.platform.librarySeasonIds.length}</span> saisons
                    </div>
                    {data.series.seasons.filter((s) => s.onPlatform).length === 0 ? (
                      <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3 text-sm text-tx-secondary font-bold">
                        Aucune saison ajoutée. Va dans Séries & Streaming &rarr; Catalogue &rarr; ajouter.
                      </div>
                    ) : (
                      data.series.seasons
                        .filter((s) => s.onPlatform)
                        .slice(0, 30)
                        .map((s) => (
                          <div key={s.id} className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                            <div className="font-display font-black tracking-wider uppercase text-sm">{s.title}</div>
                            <div className="mt-1 text-xs text-tx-secondary font-bold">Showrunner: {s.showrunner}</div>
                          </div>
                        ))
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {activeProjects.filter((p) => !p.deal.sold).length === 0 ? (
                      <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3 text-sm text-tx-secondary font-bold">
                        Aucun projet. Lance une production.
                      </div>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Derniers projets (secteur)</div>
                          <button
                            type="button"
                            onClick={() => setPage('projects')}
                            className="text-xs font-bold tracking-widest uppercase text-tx-base hover:text-tx-secondary transition-colors"
                          >
                            Voir tout
                          </button>
                        </div>
                        <div className="space-y-2">
                          {activeProjects
                            .filter((p) => !p.deal.sold)
                            .sort((a, b) => b.startedAt - a.startedAt)
                            .slice(0, 6)
                            .map((p) => {
                              const selected = p.id === activeSelectedId;
                              const perf = 'boxOffice' in p ? p.boxOffice : 'sales' in p ? p.sales : 'viewers' in p ? p.viewers : p.attendance;
                              const showPlatform = data.activeSector === 'series' && 'onPlatform' in p && p.status === 'released' && !p.onPlatform;
                              
                              // Timer for negotiation (5 minutes = 300_000 ms)
                              const releasedAt = p.releasedAt ?? 0;
                              const canNegotiateTime = releasedAt + 300_000;
                              const now = Date.now();
                              const embargoActive = p.status === 'released' && !p.deal.sold && now < canNegotiateTime;
                              const embargoLeftMs = Math.max(0, canNegotiateTime - now);
                              const embargoLeftSec = Math.ceil(embargoLeftMs / 1000);
                              const embargoStr = `${Math.floor(embargoLeftSec / 60)}:${(embargoLeftSec % 60).toString().padStart(2, '0')}`;

                              return (
                                <div
                                  key={p.id}
                                  className={cn(
                                    'rounded-xl border-2 px-3 py-3',
                                    selected
                                      ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                                      : 'bg-brand-inner text-tx-base border-brand-border'
                                  )}
                                >
                                  <button
                                    type="button"
                                    onClick={() => selectProject(p.id)}
                                    className={cn(
                                      'w-full text-left rounded-lg transition-colors',
                                      selected ? 'text-brand-bg' : 'text-tx-base'
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="font-display font-black tracking-wider uppercase text-sm">{p.title}</div>
                                        <div className={cn('mt-1 text-xs font-bold', selected ? 'text-brand-bg' : 'text-tx-secondary')}>
                                          {p.status === 'producing' ? 'En production' : p.status === 'ready' ? 'Prêt' : 'Sorti'}
                                          {p.deal.sold ? ` • Deal: +${formatShortNumber(p.deal.perMin)} ₶/min` : ''}
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
                                  
                                  {/* Action Buttons right in the card! */}
                                  {p.status === 'producing' ? (
                                    <div className="mt-3 h-2 rounded-full border-2 border-brand-border bg-brand-card overflow-hidden">
                                      <div className="h-full bg-accent-primary" style={{ width: `${Math.max(0, Math.min(100, Math.round(((now - p.startedAt) / p.durationMs) * 100)))}%` }} />
                                    </div>
                                  ) : p.status === 'ready' ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        releaseProjectById(data.activeSector, p.id);
                                      }}
                                      className="mt-3 w-full h-11 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                                    >
                                      Sortir le projet
                                    </button>
                                  ) : p.status === 'released' && !p.deal.sold ? (
                                    <button
                                      type="button"
                                      disabled={embargoActive}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        selectProject(p.id);
                                        openDealNegotiationFor(data.activeSector, p.id);
                                      }}
                                      className={cn(
                                        'mt-3 w-full h-11 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 flex items-center justify-center gap-2',
                                        embargoActive
                                          ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                          : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                      )}
                                    >
                                      {embargoActive ? `Négociable dans ${embargoStr}` : 'Négocier les droits'}
                                    </button>
                                  ) : null}

                                  {showPlatform && data.unlockedSectors.platform ? (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); addSeasonToPlatform(p.id); }}
                                      className={cn(
                                        'mt-3 w-full h-11 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                        selected
                                          ? 'bg-brand-bg text-brand-border border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                          : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                      )}
                                    >
                                      Ajouter à la plateforme
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })}
                        </div>
                      </>
                    )}
                  </div>
                )
              ) : null}

              {page === 'projects' ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Recherche</div>
                    <input
                      value={projectsQuery}
                      onChange={(e) => setProjectsQuery(e.target.value)}
                      placeholder="Titre, artiste, showrunner, studio…"
                      className="mt-2 w-full h-11 rounded-lg border-2 border-brand-border bg-brand-card px-3 text-sm font-bold text-tx-base placeholder:text-tx-secondary focus:outline-none"
                      aria-label="Rechercher un projet"
                    />

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <select
                        value={projectsSector}
                        onChange={(e) => setProjectsSector(e.target.value as typeof projectsSector)}
                        className="h-11 rounded-lg border-2 border-brand-border bg-brand-card px-3 text-sm font-bold focus:outline-none"
                        aria-label="Filtrer par secteur"
                      >
                        <option value="all">Tous secteurs</option>
                        <option value="cinema">Cinéma</option>
                        <option value="musique">Musique</option>
                        <option value="series">Séries</option>
                        <option value="live">Live</option>
                        <option value="games">Jeux</option>
                      </select>

                      <select
                        value={projectsStatus}
                        onChange={(e) => setProjectsStatus(e.target.value as typeof projectsStatus)}
                        className="h-11 rounded-lg border-2 border-brand-border bg-brand-card px-3 text-sm font-bold focus:outline-none"
                        aria-label="Filtrer par statut"
                      >
                        <option value="all">Tous statuts</option>
                        <option value="producing">En production</option>
                        <option value="ready">Prêt</option>
                        <option value="released">Sorti</option>
                      </select>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setProjectsShowSold((v) => !v)}
                        className={cn(
                          'h-11 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                          projectsShowSold
                            ? 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                            : 'bg-brand-card text-tx-secondary border-brand-border opacity-80 hover:opacity-100'
                        )}
                      >
                        {projectsShowSold ? 'Vendus: ON' : 'Vendus: OFF'}
                      </button>

                      <select
                        value={projectsSort}
                        onChange={(e) => setProjectsSort(e.target.value as typeof projectsSort)}
                        className="h-11 rounded-lg border-2 border-brand-border bg-brand-card px-3 text-sm font-bold focus:outline-none"
                        aria-label="Trier les projets"
                      >
                        <option value="newest">Plus récents</option>
                        <option value="budget">Budget</option>
                        <option value="perf">Performance</option>
                        <option value="negotiable">Négociables</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Liste</div>
                      <div className="text-xs text-tx-secondary font-bold">{projectsFiltered.length}</div>
                    </div>
                    {projectsFiltered.length === 0 ? (
                      <div className="mt-3 text-sm text-tx-secondary font-bold">Aucun projet ne correspond.</div>
                    ) : (
                      <div className="mt-3 space-y-2 max-h-[560px] overflow-y-auto pr-2 custom-scrollbar">
                        {projectsFiltered.map((p) => {
                          const now = Date.now();
                          const canNegotiateAt = (p.releasedAt ?? 0) + 300_000;
                          const embargoActive = p.status === 'released' && !p.deal.sold && now < canNegotiateAt;
                          const embargoLeftSec = Math.max(0, Math.ceil((canNegotiateAt - now) / 1000));
                          const embargoStr = `${Math.floor(embargoLeftSec / 60)}:${String(embargoLeftSec % 60).padStart(2, '0')}`;
                          const sectorLabel =
                            p.sector === 'cinema'
                              ? 'Cinéma'
                              : p.sector === 'musique'
                                ? 'Musique'
                                : p.sector === 'series'
                                  ? 'Séries'
                                  : p.sector === 'live'
                                    ? 'Live'
                                    : 'Jeux';
                          return (
                            <div key={`${p.sector}_${p.id}`} className="rounded-xl border-2 border-brand-border bg-brand-card px-3 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-display font-black tracking-wider uppercase text-sm">{p.title}</div>
                                  <div className="mt-1 text-xs text-tx-secondary font-bold">
                                    {sectorLabel} • {p.subtitle} • {p.status === 'producing' ? 'Production' : p.status === 'ready' ? 'Prêt' : 'Sorti'}
                                    {p.deal.sold ? ` • Vendu (+${formatShortNumber(p.deal.perMin)} ₶/min)` : ''}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs font-bold text-tx-base">{formatShortNumber(p.budget)} ₶</div>
                                  <div className="mt-1 text-xs font-bold text-tx-secondary">{p.perf > 0 ? `${formatShortNumber(p.perf)} ₶` : '—'}</div>
                                </div>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPage('sector');
                                    setActiveSector(p.sector);
                                    selectProject(p.id);
                                  }}
                                  className="h-11 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                                >
                                  Ouvrir
                                </button>

                                {p.status === 'ready' ? (
                                  <button
                                    type="button"
                                    onClick={() => releaseProjectById(p.sector, p.id)}
                                    className="h-11 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                                  >
                                    Sortir
                                  </button>
                                ) : p.status === 'released' && !p.deal.sold ? (
                                  <button
                                    type="button"
                                    disabled={embargoActive}
                                    onClick={() => openDealNegotiationFor(p.sector, p.id)}
                                    className={cn(
                                      'h-11 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                      embargoActive
                                        ? 'bg-brand-inner text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                        : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                    )}
                                  >
                                    {embargoActive ? `Négociable ${embargoStr}` : 'Négocier'}
                                  </button>
                                ) : (
                                  <div className="h-11" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : data.activeSector !== 'meta' ? (
                data.activeSector === 'crypto' || data.activeSector === 'stocks' || data.activeSector === 'platform' ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3 text-sm text-tx-secondary font-bold">
                      Pas de deals dans ce secteur.
                    </div>
                  </div>
                ) : (
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
                )
              ) : null}

              {data.activeSector === 'meta' ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Succès</div>
                        <div className="mt-1 text-sm text-tx-secondary font-bold">
                          Débloqués: <span className="text-tx-base">{data.achievementsUnlocked.length}</span> / {achievements.length} • Bonus: ×
                          {achievementsMult.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="text-right text-xs text-tx-secondary font-bold">
                        Apex Stars: <span className="text-tx-base">{data.prestige.stars}</span> • À récupérer:{' '}
                        <span className="text-tx-base">{claimableStars}</span>
                      </div>
                    </div>
                    <input
                      value={achievementQuery}
                      onChange={(e) => setAchievementQuery(e.target.value)}
                      placeholder="Rechercher un succès…"
                      className="mt-3 w-full h-11 rounded-lg border-2 border-brand-border bg-brand-card px-3 text-sm font-bold text-tx-base placeholder:text-tx-secondary focus:outline-none"
                      aria-label="Rechercher un succès"
                    />
                    <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {achievementsFiltered.slice(0, 150).map((a) => {
                        const unlocked = data.achievementsUnlocked.includes(a.id);
                        return (
                          <div
                            key={a.id}
                            className={cn(
                              'rounded-xl border-2 px-3 py-3',
                              unlocked ? 'bg-brand-card text-tx-base border-brand-border shadow-brutal' : 'bg-brand-card text-tx-secondary border-brand-border opacity-70'
                            )}
                          >
                            <div className="font-display font-black tracking-wider uppercase text-sm">{a.name}</div>
                            <div className="mt-1 text-xs font-bold">{a.description}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Prestige</div>
                        <div className="mt-1 text-sm text-tx-secondary font-bold">
                          Claimable: <span className="text-tx-base">{claimableStars}</span> • Total (lifetime):{' '}
                          <span className="text-tx-base">{data.prestige.lifetimeStars}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={prestigeNow}
                        disabled={claimableStars <= 0}
                        className={cn(
                          'h-11 px-4 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                          claimableStars <= 0
                            ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                            : 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                        )}
                      >
                        Prestiger
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      {prestigeUpgrades.map((u) => {
                        const current = Math.max(0, Math.floor((data.prestige.upgrades ?? {})[u.id] ?? 0));
                        const nextLevel = current + 1;
                        const atMax = current >= u.maxLevel;
                        const cost = atMax ? 0 : u.costForLevel(nextLevel);
                        return (
                          <div key={u.id} className="rounded-xl border-2 border-brand-border bg-brand-card p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-display font-black tracking-wider uppercase text-sm">{u.name}</div>
                                <div className="mt-1 text-xs text-tx-secondary font-bold">{u.description}</div>
                                <div className="mt-2 text-xs text-tx-secondary font-bold">
                                  Niveau {current} / {u.maxLevel}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => buyPrestigeUpgrade(u.id, cost)}
                                disabled={atMax || data.prestige.stars < cost}
                                className={cn(
                                  'h-11 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                  atMax || data.prestige.stars < cost
                                    ? 'bg-brand-inner text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                    : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                )}
                              >
                                {atMax ? 'Max' : `Acheter (${cost})`}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
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

              {data.negotiation ? (
                <div className="mt-4 space-y-3">
                  {(() => {
                    const n = data.negotiation;
                    const sector = n.sector;
                    const projectId = n.projectId;
                    const getProject = () => {
                      if (sector === 'cinema') return data.cinema.films.find((x) => x.id === projectId) ?? null;
                      if (sector === 'musique') return data.musique.releases.find((x) => x.id === projectId) ?? null;
                      if (sector === 'series') return data.series.seasons.find((x) => x.id === projectId) ?? null;
                      if (sector === 'live') return data.live.events.find((x) => x.id === projectId) ?? null;
                      return data.games.games.find((x) => x.id === projectId) ?? null;
                    };
                    const p = getProject();
                    if (!p) {
                      return (
                        <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                          <div className="text-sm text-tx-secondary font-bold">Projet introuvable.</div>
                        </div>
                      );
                    }

                    const buyers = p.buyers ?? [];
                    const buyer = buyers.find((b) => b.id === n.buyerId) ?? null;
                    const now = Date.now();
                    const perf = 'boxOffice' in p ? p.boxOffice : 'sales' in p ? p.sales : 'viewers' in p ? p.viewers : p.attendance;
                    const hype = clamp01(data.hype);
                    const rep = data.reputation;
                    const sectorRep =
                      sector === 'cinema'
                        ? clamp01((rep.public + rep.critique) / 2)
                        : sector === 'musique'
                          ? clamp01((rep.public + rep.underground) / 2)
                          : sector === 'series'
                            ? clamp01((rep.international + rep.business) / 2)
                            : sector === 'live'
                              ? clamp01((rep.public + rep.international) / 2)
                              : clamp01((rep.business + rep.critique) / 2);

                    const ageMin = Math.max(0, Math.floor((now - (p.releasedAt ?? now)) / 60_000));
                    const ageFactor = Math.max(0.6, 1 - (ageMin / 180) * 0.25);
                    const base = Math.max(350, perf * 0.12 + p.budget * 0.35);
                    const qualityFactor = 0.85 + clamp01(p.quality) * 0.35;
                    const hypeFactor = 0.9 + hype * 0.6;
                    const repFactor = 0.85 + sectorRep * 0.5;
                    const rawRecommended = base * qualityFactor * hypeFactor * repFactor * ageFactor;
                    const boost = computeNegotiationBoost(data.prestige);
                    const recommended = Math.max(350, Math.floor((rawRecommended * (1 + boost)) / 50) * 50);

                    const personality = buyer?.personality ?? 'standard';
                    const baseProb = personality === 'genereuse' ? 0.88 : personality === 'prudente' ? 0.82 : personality === 'agressive' ? 0.78 : 0.85;
                    const maxMult = personality === 'genereuse' ? 1.18 : personality === 'prudente' ? 0.95 : personality === 'agressive' ? 1.05 : 1.0;
                    const target = Math.max(200, Math.floor((recommended * maxMult) / 50) * 50);
                    const asking = Math.max(1, Math.floor(n.askingPrice));
                    const refusals = buyer?.refusals ?? 0;
                    let prob = 0;
                    if (buyer && !buyer.withdrawn) {
                      if (asking <= target) prob = Math.min(0.95, baseProb + (1 - asking / target) * 0.12);
                      else prob = baseProb * Math.exp(-((asking / target - 1) * 2.2));
                      prob = clamp01(prob - refusals * 0.08);
                    }

                    const sectorLabel =
                      sector === 'cinema'
                        ? 'Cinéma'
                        : sector === 'musique'
                          ? 'Musique'
                          : sector === 'series'
                            ? 'Séries'
                            : sector === 'live'
                              ? 'Live'
                              : 'Jeux';

                    const personalityLabel =
                      personality === 'genereuse'
                        ? 'Offre généreuse — décide vite'
                        : personality === 'prudente'
                          ? 'Offre prudente — rarement pressé'
                          : personality === 'agressive'
                            ? 'Offre agressive — dur en prix'
                            : 'Offre standard';

                    const minPrice = Math.max(50, Math.floor((recommended * 0.5) / 50) * 50);
                    const maxPrice = Math.max(minPrice + 50, Math.floor((recommended * 1.8) / 50) * 50);

                    return (
                      <>
                        <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                          <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Projet</div>
                          <div className="mt-1 font-display font-black tracking-wider uppercase">{p.title}</div>
                          <div className="mt-1 text-xs text-tx-secondary font-bold">{sectorLabel} • {formatShortNumber(perf)} ₶ • Hype {Math.round(hype * 100)}%</div>
                        </div>

                        <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                          <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Acheteurs</div>
                          <div className="mt-3 space-y-2">
                            {buyers.map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                disabled={b.withdrawn}
                                onClick={() => setNegotiationBuyer(b.id)}
                                className={cn(
                                  'w-full text-left rounded-xl border-2 px-3 py-3 transition-colors',
                                  b.withdrawn
                                    ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                    : b.id === n.buyerId
                                      ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                                      : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="font-display font-black tracking-wider uppercase text-sm">{b.name}</div>
                                    <div className={cn('mt-1 text-xs font-bold', b.id === n.buyerId ? 'text-brand-bg' : 'text-tx-secondary')}>
                                      {b.personality === 'genereuse'
                                        ? 'Généreux'
                                        : b.personality === 'prudente'
                                          ? 'Prudent'
                                          : b.personality === 'agressive'
                                            ? 'Agressif'
                                            : 'Standard'} • Refus {b.refusals}/3
                                    </div>
                                  </div>
                                  {b.id === n.buyerId ? <div className="text-xs font-bold">{Math.round(prob * 100)}%</div> : null}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Prix</div>
                            <div className="text-xs text-tx-secondary font-bold">{personalityLabel}</div>
                          </div>
                          <div className="mt-2 text-xs text-tx-secondary font-bold">
                            Prix conseillé: <span className="text-tx-base">{formatShortNumber(recommended)} ₶</span> • Proba: <span className="text-tx-base">{Math.round(prob * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={minPrice}
                            max={maxPrice}
                            step={50}
                            value={Math.max(minPrice, Math.min(maxPrice, asking))}
                            onChange={(e) => setNegotiationAskingPrice(Number(e.target.value))}
                            className="mt-3 w-full"
                            aria-label="Ajuster le prix demandé"
                          />
                          <input
                            type="number"
                            min={1}
                            step={50}
                            value={asking}
                            onChange={(e) => setNegotiationAskingPrice(Number(e.target.value))}
                            className="mt-2 w-full h-11 rounded-lg border-2 border-brand-border bg-brand-card px-3 text-sm font-bold text-tx-base placeholder:text-tx-secondary focus:outline-none"
                            aria-label="Prix demandé"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={!buyer || buyer.withdrawn || prob <= 0}
                          onClick={attemptDeal}
                          className={cn(
                            'w-full h-12 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2',
                            !buyer || buyer.withdrawn || prob <= 0
                              ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                              : 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                          )}
                        >
                          Tenter la vente
                        </button>

                        <button
                          type="button"
                          onClick={closeNegotiation}
                          className="w-full h-11 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-transparent text-tx-secondary border-brand-border hover:text-tx-base hover:border-tx-base"
                        >
                          Fermer
                        </button>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                  <div className="text-sm text-tx-secondary font-bold">
                    Choisis un projet sorti (page Secteur ou Projets), puis clique “Négocier”.
                  </div>
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

        {creationModal ? (
          <div className="fixed inset-0 z-[99998]">
            <div className="absolute inset-0 bg-black/70" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md px-4">
              <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-6 shadow-brutal">
                <div className="flex items-center justify-between gap-3 border-b-2 border-brand-border pb-3 mb-4">
                  <div className="font-display text-xl font-black tracking-wider uppercase text-tx-base">
                    Configurer le projet
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreationModal(null)}
                    className="h-10 w-10 rounded-xl border-2 border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base flex items-center justify-center transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  {(() => {
                    const base = Number(creationBudget) || 0;
                    const pct = Number(creationMarketing) || 0;
                    const computed = computeProjectTotalBudget(base, pct, creationQualityLevel);
                    const totalStr = formatShortNumber(computed.totalBudget);
                    const prodStr = formatShortNumber(computed.productionBudget);
                    const mkStr = formatShortNumber(computed.marketingBudget);
                    return (
                      <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                        <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Coût & impact</div>
                        <div className="mt-2 text-xs text-tx-secondary font-bold leading-relaxed">
                          Envergure ×{computed.envergureMult.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} • Production {prodStr} ₶ • Marketing {mkStr} ₶ • Total {totalStr} ₶
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-tx-secondary tracking-widest uppercase">Genre / Cible</label>
                    <select
                      value={creationGenre}
                      onChange={(e) => setCreationGenre(e.target.value)}
                      className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 text-sm font-bold focus:outline-none"
                    >
                      <option value="Action">Action / Pop</option>
                      <option value="Drame">Drame / Indé</option>
                      <option value="Comedie">Comédie / Feel Good</option>
                      <option value="Auteur">Auteur / Conceptuel</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-tx-secondary tracking-widest uppercase">Envergure (Qualité & Coût)</label>
                    <select
                      value={creationQualityLevel}
                      onChange={(e) => setCreationQualityLevel(Number(e.target.value))}
                      className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 text-sm font-bold focus:outline-none"
                    >
                      <option value={1}>Modeste (Débutants)</option>
                      <option value={2}>Standard (Confirmés)</option>
                      <option value={3}>Ambitieux (Stars)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-tx-secondary tracking-widest uppercase">Budget de base (₶)</label>
                    <input
                      type="number"
                      value={creationBudget}
                      onChange={(e) => setCreationBudget(e.target.value)}
                      min="500"
                      step="500"
                      className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 text-sm font-bold focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-tx-secondary tracking-widest uppercase">Budget Marketing</label>
                      <span className="text-xs font-bold text-tx-base">{creationMarketing}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={creationMarketing}
                      onChange={(e) => setCreationMarketing(e.target.value)}
                      className="w-full"
                    />
                    <div className="text-xs font-bold text-tx-secondary text-right">
                      Marketing calcule sur le budget après envergure.
                    </div>
                  </div>

                  <div className="pt-4 border-t-2 border-brand-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-tx-secondary">Coût Total:</span>
                      <span className="text-lg font-display font-black">
                        {formatShortNumber(computeProjectTotalBudget(Number(creationBudget) || 0, Number(creationMarketing) || 0, creationQualityLevel).totalBudget)} ₶
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const b = Number(creationBudget) || 0;
                        const m = Number(creationMarketing) || 0;
                        if (b < 500) {
                          toast('Erreur', { description: 'Le budget minimum est de 500 ₶.', duration: 3000 });
                          return;
                        }
                        startByActiveSector(b, m, creationQualityLevel);
                      }}
                      className="w-full h-12 rounded-xl font-display font-black tracking-wider uppercase transition-colors border-2 bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                    >
                      Lancer la production
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

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
                      className="group w-full text-left rounded-xl border-2 border-brand-border bg-brand-inner px-4 py-3 hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                    >
                      <div className="font-display font-black tracking-wider uppercase text-sm">{o.label}</div>
                      <div className="mt-1 text-xs font-bold text-tx-secondary group-hover:text-brand-bg">{o.body}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setMobileSheet('actions')}
          className="lg:hidden fixed right-5 bottom-[104px] z-[99990] h-14 w-14 rounded-full border-2 border-brand-border bg-accent-primary text-brand-bg shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors flex items-center justify-center"
          aria-label="Actions rapides"
        >
          <Plus className="h-6 w-6" />
        </button>

        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[99989] px-4 pb-4">
          <div className="rounded-[28px] border-2 border-brand-border bg-brand-card shadow-brutal p-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMobileSheet('sectors')}
                className="h-12 rounded-xl border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase transition-colors hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
              >
                Secteurs
              </button>
              <button
                type="button"
                onClick={() => setPage('projects')}
                className={cn(
                  'h-12 rounded-xl border-2 font-display font-black tracking-wider uppercase transition-colors',
                  page === 'projects'
                    ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                    : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                )}
              >
                Projets
              </button>
              <button
                ref={metaTabRef}
                type="button"
                onClick={() => {
                  setPage('sector');
                  setActiveSector('meta');
                }}
                className={cn(
                  'h-12 rounded-xl border-2 font-display font-black tracking-wider uppercase transition-colors',
                  data.activeSector === 'meta'
                    ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                    : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                )}
              >
                Méta
              </button>
            </div>
          </div>
        </div>

        {mobileSheet ? (
          <div className="lg:hidden fixed inset-0 z-[99997]">
            <button type="button" onClick={() => setMobileSheet(null)} className="absolute inset-0 bg-black/70" aria-label="Fermer" />
            <div className="absolute left-0 right-0 bottom-0 px-4 pb-4">
              <div className="rounded-[32px] border-4 border-brand-border bg-brand-card shadow-brutal overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b-2 border-brand-border bg-brand-inner">
                  <div className="font-display font-black tracking-wider uppercase text-sm text-tx-base">
                    {mobileSheet === 'sectors' ? 'Secteurs' : 'Actions'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileSheet(null)}
                    className="h-10 w-10 rounded-xl border-2 border-brand-border bg-brand-card text-tx-base hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors flex items-center justify-center"
                    aria-label="Fermer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="max-h-[72vh] overflow-y-auto p-4">
                  {mobileSheet === 'sectors' ? (
                    <div className="space-y-2">
                      {([
                        { id: 'cinema', label: 'Cinéma', subtitle: 'Production • Box-office • Droits' },
                        { id: 'musique', label: 'Musique', subtitle: 'Sorties • Ventes • Royalties' },
                        { id: 'series', label: 'Séries & Streaming', subtitle: 'Saisons • Audiences • Streaming' },
                        { id: 'live', label: 'Événements Live', subtitle: 'Billetterie • Sponsor' },
                        { id: 'crypto', label: 'Crypto', subtitle: 'Cours • Graphique • Portefeuille' },
                        { id: 'games', label: 'Jeux vidéo', subtitle: 'Dév • Ventes • Publishing' },
                        { id: 'stocks', label: 'Bourse', subtitle: 'Marché • Portefeuille • Profits' },
                        { id: 'platform', label: 'Plateforme', subtitle: 'Abonnés • ARPU • Catalogue' },
                      ] as Array<{ id: SectorId; label: string; subtitle: string }>).map((s) => {
                        const unlocked = isSectorUnlocked(s.id);
                        const selected = data.activeSector === s.id;
                        const cost = sectorUnlockCost[s.id];
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setPage('sector');
                              setActiveSector(s.id);
                              setMobileSheet(null);
                            }}
                            className={cn(
                              'w-full text-left rounded-xl border-2 px-3 py-3 transition-colors',
                              selected
                                ? 'bg-accent-primary text-brand-bg border-brand-border shadow-brutal'
                                : unlocked
                                  ? 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                  : 'bg-brand-inner text-tx-secondary border-brand-border opacity-70 hover:opacity-100'
                            )}
                            aria-disabled={!unlocked}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-display font-black tracking-wider uppercase">{s.label}</div>
                              {selected ? (
                                s.id === 'games' ? (
                                  <Gamepad2 className="h-5 w-5" />
                                ) : s.id === 'platform' ? (
                                  <Tv className="h-5 w-5" />
                                ) : s.id === 'crypto' || s.id === 'stocks' ? (
                                  <TrendingUp className="h-5 w-5" />
                                ) : (
                                  <Film className="h-5 w-5" />
                                )
                              ) : null}
                            </div>
                            <div className={cn('mt-1 text-xs font-bold', selected ? 'text-brand-bg' : 'text-tx-secondary')}>
                              {unlocked ? s.subtitle : `Débloque à ${formatShortNumber(cost)} ₶`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : data.activeSector === 'crypto' ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                        <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Crypto</div>
                        <div className="mt-2 text-sm text-tx-secondary font-bold">
                          Prix: <span className="text-tx-base">{formatShortNumber(data.crypto.price)} ₶</span> • Holdings:{' '}
                          <span className="text-tx-base">{formatShortNumber(data.crypto.holdings)}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[1000, 5000, 20_000, 100_000].map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => buyCryptoCash(a)}
                            disabled={data.cash < a}
                            className={cn(
                              'h-12 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                              data.cash < a
                                ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                            )}
                          >
                            +{formatShortNumber(a)}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: '-25%', pct: 0.25 },
                          { label: '-50%', pct: 0.5 },
                          { label: '-100%', pct: 1 },
                        ].map((b) => (
                          <button
                            key={b.label}
                            type="button"
                            onClick={() => sellCryptoPct(b.pct)}
                            disabled={data.crypto.holdings <= 0}
                            className={cn(
                              'h-12 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                              data.crypto.holdings <= 0
                                ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                            )}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : data.activeSector === 'stocks' ? (
                    <div className="space-y-3">
                      {STOCKS.map((s) => {
                        const price = data.stocks.prices[s.id] ?? s.base;
                        const held = data.stocks.shares[s.id] ?? 0;
                        return (
                          <div key={s.id} className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-display font-black tracking-wider uppercase text-sm">{s.id}</div>
                                <div className="mt-1 text-xs text-tx-secondary font-bold">
                                  {formatShortNumber(price)} ₶ • Held {formatShortNumber(held)}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => buyStockCash(s.id, 2000)}
                                  disabled={data.cash < 2000}
                                  className={cn(
                                    'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                    data.cash < 2000
                                      ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                      : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                  )}
                                >
                                  +2k
                                </button>
                                <button
                                  type="button"
                                  onClick={() => buyStockCash(s.id, 10_000)}
                                  disabled={data.cash < 10_000}
                                  className={cn(
                                    'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                    data.cash < 10_000
                                      ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                      : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                  )}
                                >
                                  +10k
                                </button>
                                <button
                                  type="button"
                                  onClick={() => sellStockPct(s.id, 0.25)}
                                  disabled={held <= 0}
                                  className={cn(
                                    'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                    held <= 0
                                      ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                      : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                  )}
                                >
                                  -25%
                                </button>
                                <button
                                  type="button"
                                  onClick={() => sellStockPct(s.id, 1)}
                                  disabled={held <= 0}
                                  className={cn(
                                    'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                    held <= 0
                                      ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                                      : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                  )}
                                >
                                  -100%
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : data.activeSector === 'platform' ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                        <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Plateforme</div>
                        <div className="mt-2 text-sm text-tx-secondary font-bold">
                          Abonnés: <span className="text-tx-base">{formatShortNumber(data.platform.subscribers)}</span> • Catalogue:{' '}
                          <span className="text-tx-base">{data.platform.librarySeasonIds.length}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => upgradePlatform('marketing')}
                          className="h-12 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                        >
                          Marketing +1
                        </button>
                        <button
                          type="button"
                          onClick={() => upgradePlatform('infra')}
                          className="h-12 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                        >
                          Infra +1
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentReady ? (
                        <button
                          type="button"
                          onClick={releaseSelected}
                          className="w-full h-12 rounded-lg font-display font-black tracking-wider uppercase transition-colors border-2 bg-accent-primary text-brand-bg border-brand-border shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base"
                        >
                          Sortir (prêt)
                        </button>
                      ) : null}

                      <div className="rounded-xl border-2 border-brand-border bg-brand-inner shadow-brutal p-3">
                        <div className="text-xs text-tx-secondary font-bold tracking-widest uppercase">Nouveau projet</div>
                        <button
                          type="button"
                          onClick={() => {
                            setCreationModal(data.activeSector);
                            setMobileSheet(null);
                          }}
                          disabled={namesStatus !== 'ready'}
                          className={cn(
                            'mt-3 w-full h-12 rounded-xl border-2 font-display font-black tracking-wider uppercase transition-colors shadow-brutal',
                            namesStatus !== 'ready'
                              ? 'bg-brand-card text-tx-secondary border-brand-border opacity-70 cursor-not-allowed'
                              : 'bg-accent-primary text-brand-bg border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                          )}
                        >
                          Configurer le projet
                        </button>
                        {namesStatus === 'loading' ? <div className="mt-2 text-xs text-tx-secondary font-bold">Chargement des données…</div> : null}
                      </div>
                    </div>
                  )}
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
