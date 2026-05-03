'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCloudSave } from '@/hooks/useCloudSave';
import { formatShortNumber } from '@/lib/itollec-clicker/format';
import { drawWithoutReplacement } from '@/lib/apex/draw';
import { generateApexAchievements, isAchievementUnlocked } from '@/lib/apex/achievements';
import {
  computeNegotiationBoost,
  computePrestigeStartingCash,
  computeStarsFromRun,
  getPrestigeUpgrades,
  hasPrestigeUpgrade,
  type ApexPrestigeState,
} from '@/lib/apex/prestige';
import {
  STOCKS,
  applyExternalCryptoImpact,
  buyCrypto,
  buyStock,
  initCryptoState,
  initStockMarket,
  portfolioValue,
  sellCrypto,
  sellStock,
  stepCrypto,
  stepStocks,
} from '@/lib/apex/markets';
import type {
  ApexBuyer,
  ApexCinemaGenre,
  ApexCryptoId,
  ApexFilmProject,
  ApexGameGenre,
  ApexMusicArtist,
  ApexMusicProject,
  ApexProjectStatus,
  ApexRightsDeal,
  ApexSave,
  ApexSectorId,
  ApexLiveProject,
  ApexSeriesProject,
  ApexStockId,
} from '@/types/apex';
import SpotlightTutorial, { type SpotlightTutorialStep } from '@/components/ui/SpotlightTutorial';
import { ChevronDown, Coins, Crown, Film, Gamepad2, HelpCircle, LineChart, Menu, Music2, Plus, ShieldCheck, Star, Tv, Users } from 'lucide-react';

type ApexNames = {
  films: string[];
  artistes: string[];
  realisateurs: string[];
  acteurs: string[];
  showrunners: string[];
  studios_jv: string[];
  noms_series: string[];
  noms_jeux: string[];
};

type ApexAgentOfferDef = {
  id: string;
  title: string;
  description: string;
  apply: (state: ApexSave) => ApexSave;
};

const APEX_AGENT_OFFERS: ApexAgentOfferDef[] = [
  {
    id: 'dir5',
    title: 'Un réalisateur niveau 5 est disponible 5 minutes — 8 000 ₶',
    description: "Un deal rare. Si tu acceptes, ton prochain film aura +15 hype et +10 qualité.",
    apply: (st) => {
      if (st.cash < 8000) return st;
      return {
        ...st,
        cash: st.cash - 8000,
        buffs: {
          ...st.buffs,
          nextFilmHypeBonus: st.buffs.nextFilmHypeBonus + 15,
          nextFilmQualityBonus: st.buffs.nextFilmQualityBonus + 10,
        },
      };
    },
  },
  {
    id: 'dogestar_hint',
    title: 'Fuite interne : DogeStar va crasher dans 3 min — info vérifiée à 80%',
    description: 'Information partielle. À toi de décider.',
    apply: (st) => ({
      ...st,
      buffs: { ...st.buffs, dogeStarCrashHintUntil: st.lastActionAt + 3 * 60 * 1000 },
    }),
  },
  {
    id: 'coprod',
    title: 'Un concurrent veut co-produire ton prochain film',
    description: 'Il paie 50% du budget, prend 40% des revenus.',
    apply: (st) => ({ ...st, buffs: { ...st.buffs, nextFilmCoprod: true } }),
  },
];

function getAgentOfferById(id: string | undefined): ApexAgentOfferDef | null {
  if (!id) return null;
  return APEX_AGENT_OFFERS.find((o) => o.id === id) ?? null;
}

function applyAgentOffer(state: ApexSave, offerId: string | undefined): ApexSave {
  const offer = getAgentOfferById(offerId);
  if (!offer) return state;
  return offer.apply(state);
}

function pickAgentOffer(state: ApexSave): ApexAgentOfferDef {
  const quality = clamp(state.agent.acceptCount / Math.max(1, state.agent.acceptCount + state.agent.refuseStreak), 0, 1);
  const idx = Math.floor(clamp(Math.random() * APEX_AGENT_OFFERS.length + quality * 0.4, 0, APEX_AGENT_OFFERS.length - 1));
  return APEX_AGENT_OFFERS[idx] ?? APEX_AGENT_OFFERS[0]!;
}

function scheduleNextAgent(a: ApexSave['agent'], t: number, prestige: ApexPrestigeState): ApexSave['agent'] {
  const baseMin = a.refuseStreak >= 3 ? 30 : 8;
  const baseMax = a.refuseStreak >= 3 ? 30 : 20;
  const faster = hasPrestigeUpgrade(prestige, 'agent_confiance');
  const min = faster ? Math.max(4, Math.floor(baseMin / 2)) : baseMin;
  const max = faster ? Math.max(min, Math.floor(baseMax / 2)) : baseMax;
  const nextAt = t + (min * 60 + Math.floor(Math.random() * (max * 60 - min * 60 + 1))) * 1000;
  return { ...a, nextAt };
}

const CINEMA_GENRES: ApexCinemaGenre[] = ['Action', 'Drame', 'Comédie', 'Horreur', 'SF', 'Animation', 'Documentaire', 'Romance'];
const GAME_GENRES: ApexGameGenre[] = ['RPG', 'FPS', 'Mobile', 'Simulation', 'Indé', 'MMO'];

const UNLOCKS: Record<ApexSectorId | 'platform', number> = {
  cinema: 0,
  musique: 50_000,
  series: 200_000,
  live: 500_000,
  crypto: 100_000,
  jv: 5_000_000,
  bourse: 10_000_000,
  platform: 2_000_000,
};

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function computeGlobalRep(rep: ApexSave['reputation']): number {
  const values = [rep.cinema, rep.musique, rep.series, rep.live, rep.jv];
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return clamp(avg, 0, 100);
}

function buyoutMult(s: ApexSave, sector: 'cinema' | 'musique' | 'series' | 'live' | 'jv' | 'global'): number {
  const b = s.buyouts ?? {};
  const global = b.APEXMEDIA ? 1.03 : 1;
  if (sector === 'global') return global;
  if (sector === 'cinema') return global * (b.CINEGLOBE ? 1.05 : 1);
  if (sector === 'musique') return global * (b.SOUNDWAVE ? 1.05 : 1);
  if (sector === 'series') return global * (b.PRIMEVISION ? 1.05 : 1);
  if (sector === 'live') return global * (b.LIVENATION ? 1.05 : 1);
  return global * (b.PIXELFORGE ? 1.05 : 1);
}

function hypeColor(hype: number): string {
  if (hype >= 66) return 'bg-accent-success';
  if (hype >= 33) return 'bg-accent-primary';
  return 'bg-accent-secondary';
}

function getProjectStatusLabel(status: ApexProjectStatus): string {
  return status === 'producing' ? 'En production' : 'Sorti';
}

function computeHypeDecayMultiplier(args: { hype: number; ageMin: number }): number {
  const h = clamp(args.hype, 0, 100);
  const ageMin = Math.max(0, args.ageMin);
  const base = ageMin <= 10 ? 0.996 : 0.99;
  const lowHype = h <= 15 ? 0.985 : 1;
  return clamp(base * lowHype, 0.96, 0.999);
}

function makeBuyers(args: { names: string[]; min: number; max: number }): ApexBuyer[] {
  const count = Math.floor(clamp(args.min + Math.random() * (args.max - args.min + 1), args.min, args.max));
  const personalities: ApexBuyer['personality'][] = ['prudente', 'standard', 'genereuse', 'agressive'];
  const fixed: Record<string, ApexBuyer['personality']> = {
    'CinéStream': 'standard',
    'MégaVision': 'agressive',
    'ArcLight': 'genereuse',
    'PrimeVision': 'prudente',
    'SoundWave': 'standard',
    'BeatFlow': 'agressive',
    'EuroVision': 'prudente',
    'TechStream': 'genereuse',
  };
  const out: ApexBuyer[] = [];
  for (let i = 0; i < count; i += 1) {
    const name = args.names[i % args.names.length] ?? `Acheteur ${i + 1}`;
    const personality = fixed[name] ?? personalities[Math.floor(Math.random() * personalities.length)] ?? 'standard';
    out.push({ id: createId('buyer'), name, personality, refusals: 0, withdrawn: false });
  }
  return out;
}

function initDeal(args: { buyers: ApexBuyer[]; embargoUntil?: number }): ApexRightsDeal {
  return {
    sold: false,
    buyers: args.buyers,
    embargoUntil: args.embargoUntil,
    negotiation: { buyerId: null, askingPrice: 0 },
  };
}

function estimateDealPrice(args: {
  base: number;
  hype: number;
  rep: number;
  ageMin: number;
  buyer: ApexBuyer;
  macroMult: number;
}): number {
  const hype = clamp(args.hype, 0, 100) / 100;
  const rep = clamp(args.rep, 0, 100) / 100;
  const agePenalty = clamp(1 - args.ageMin * 0.012, 0.35, 1);
  const personalityMult =
    args.buyer.personality === 'genereuse'
      ? 1.08
      : args.buyer.personality === 'agressive'
        ? 0.93
        : args.buyer.personality === 'prudente'
          ? 0.97
          : 1;

  const raw = args.base * (0.55 + hype * 0.7 + rep * 0.35) * agePenalty * personalityMult * args.macroMult;
  return Math.max(1, Math.floor(raw));
}

function acceptanceProbability(args: {
  asking: number;
  estimate: number;
  buyer: ApexBuyer;
  negotiationBoost: number;
}): number {
  if (args.estimate <= 0) return 0;
  const ratio = args.asking / args.estimate;
  const personalityBonus =
    args.buyer.personality === 'genereuse'
      ? 0.07
      : args.buyer.personality === 'agressive'
        ? -0.07
        : args.buyer.personality === 'prudente'
          ? -0.03
          : 0;

  const base = 0.85 + personalityBonus;
  const prob = ratio <= 1 ? base + (1 - ratio) * 0.18 : base - (ratio - 1) * 0.65;
  const withRefusals = prob - args.buyer.refusals * 0.08;
  return clamp(withRefusals + args.negotiationBoost, 0.02, 0.95);
}

function canNegotiate(args: { now: number; hype: number; deal: ApexRightsDeal }): { ok: boolean; reason?: string } {
  if (args.deal.sold) return { ok: false, reason: 'Déjà vendu.' };
  if (args.deal.embargoUntil && args.now < args.deal.embargoUntil) return { ok: false, reason: 'Embargo en cours (30 min après sortie).' };
  if (args.hype < 10) return { ok: false, reason: "Trop vieux, plus d'intérêt commercial." };
  return { ok: true };
}

function filmProductionDurationMs(budget: number): number {
  if (budget < 1_000) return 2 * 60 * 1000;
  if (budget < 10_000) return 5 * 60 * 1000;
  if (budget < 100_000) return 10 * 60 * 1000;
  if (budget < 500_000) return 20 * 60 * 1000;
  return 35 * 60 * 1000;
}

function computeFilmQuality(args: { productionBudget: number; directorLevel: number; castCount: number }): number {
  const budgetScore = clamp(Math.log10(Math.max(500, args.productionBudget)) / 6, 0, 1);
  const directorScore = clamp(args.directorLevel / 5, 0, 1);
  const castScore = clamp(args.castCount / 5, 0, 1);
  const randomScore = Math.random();
  const score =
    budgetScore * 0.3 * 100 +
    directorScore * 0.25 * 100 +
    castScore * 0.2 * 100 +
    randomScore * 0.25 * 100;
  return Math.floor(clamp(score, 0, 100));
}

function marketingToInitialHype(marketingPct: number): number {
  const pct = clamp(marketingPct, 0, 100);
  if (pct <= 0) return 5;
  if (pct <= 25) return 30;
  if (pct <= 50) return 55;
  if (pct >= 100) return 90;
  return Math.round(30 + (pct - 25) * 0.5);
}

function computeCashPerMinValue(s: ApexSave, args: { productionMult: number }): number {
  const now = s.lastActionAt;
  let perMin = 0;

  for (const f of s.films) {
    if (f.status !== 'released' || !f.boxOfficePerMin || !f.boxOfficeEndsAt) continue;
    if (now > f.boxOfficeEndsAt) continue;
    if (f.frozenUntil && now < f.frozenUntil) continue;
    const sequelMult = (f.sequelIndex ?? 0) > 0 ? 2.5 : 1;
    perMin +=
      f.boxOfficePerMin *
      sequelMult *
      args.productionMult *
      (Number.isFinite(f.revenueShare) ? f.revenueShare : 1) *
      buyoutMult(s, 'cinema');
    if (f.merchUnlocked && f.merchEndsAt && now <= f.merchEndsAt && f.merchPerMin) {
      perMin += f.merchPerMin * args.productionMult * (Number.isFinite(f.revenueShare) ? f.revenueShare : 1) * buyoutMult(s, 'cinema');
    }
  }

  for (const p of s.musicProjects) {
    if (p.status !== 'released' || !p.payoutPerMin || !p.payoutEndsAt) continue;
    if (now > p.payoutEndsAt) continue;
    const mult = p.viralBoostEndsAt && now <= p.viralBoostEndsAt ? 10 : 1;
    perMin += p.payoutPerMin * mult * args.productionMult * buyoutMult(s, 'musique');
    if (p.syncEndsAt && now <= p.syncEndsAt && p.syncPayoutPerMin) {
      perMin += p.syncPayoutPerMin * args.productionMult * buyoutMult(s, 'musique');
    }
    if (p.streamingRights.sold && p.streamingRights.amount) {
      perMin += (p.streamingRights.amount / 5) * args.productionMult * buyoutMult(s, 'musique');
    }
  }

  if (s.platform.unlocked) {
    perMin += s.platform.subscribers * 0.6 * args.productionMult * buyoutMult(s, 'series');
    perMin -= s.platform.hostingCostPerMin;
  }

  return Math.floor(perMin);
}

export default function ApexPage() {
  const now0 = useMemo(() => Date.now(), []);
  const achievementsDefs = useMemo(() => generateApexAchievements(), []);

  const initialPrestige: ApexPrestigeState = useMemo(() => ({ stars: 0, lifetimeStars: 0, upgrades: {} }), []);
  const initialSave: ApexSave = useMemo(() => {
    const startingCash = computePrestigeStartingCash(initialPrestige);
    const repStart = hasPrestigeUpgrade(initialPrestige, 'reputation_heritee') ? 10 : 0;
    const now = now0;
    return {
      version: 1,
      cash: startingCash,
      totalEarned: startingCash,
      createdAt: now,
      lastActionAt: now,
      sectorTab: 'cinema',
      reputation: { cinema: repStart, musique: repStart, series: repStart, live: repStart, jv: repStart },
      prestige: { ...initialPrestige, count: initialPrestige.count ?? 0, upgrades: {} },
      buffs: { nextFilmHypeBonus: 0, nextFilmQualityBonus: 0, nextFilmCoprod: false, dogeStarCrashHintUntil: null, partnershipUntil: null },
      achievements: [],
      draw: {},
      films: [],
      artists: [],
      artistMarket: [],
      musicProjects: [],
      seriesProjects: [],
      liveProjects: [],
      studios: [],
      studioMarket: [],
      gameProjects: [],
      crypto: initCryptoState(),
      stocks: initStockMarket(now),
      buyouts: {},
      marketAnalysis: null,
      platform: { unlocked: false, subscribers: 0, hostingCostPerMin: 120, nextPayoutAt: now + 5 * 60 * 1000 },
      agent: { active: false, refuseStreak: 0, acceptCount: 0, nextAt: now + (8 * 60 + Math.floor(Math.random() * 12 * 60)) * 1000 },
      event: { active: false, nextAt: now + (5 * 60 + Math.floor(Math.random() * 7 * 60)) * 1000 },
    };
  }, [initialPrestige, now0]);

  const { data, setData, isLoaded } = useCloudSave<ApexSave>('apex', initialSave, { silent: true });
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const [names, setNames] = useState<ApexNames | null>(null);
  const [namesError, setNamesError] = useState<string | null>(null);
  const namesRef = useRef<ApexNames | null>(null);

  useEffect(() => {
    namesRef.current = names;
  }, [names]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch('/data/apex-names.json', { cache: 'force-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ApexNames;
        if (!cancelled) setNames(json);
      } catch (e) {
        if (!cancelled) setNamesError('Impossible de charger les données de noms.');
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const unlocked = useMemo(() => {
    const earned = data.totalEarned;
    return {
      musique: earned >= UNLOCKS.musique,
      series: earned >= UNLOCKS.series,
      live: earned >= UNLOCKS.live,
      crypto: earned >= UNLOCKS.crypto,
      jv: earned >= UNLOCKS.jv,
      bourse: earned >= UNLOCKS.bourse,
      platform: earned >= UNLOCKS.platform,
    };
  }, [data.totalEarned]);

  const globalRep = useMemo(() => computeGlobalRep(data.reputation), [data.reputation]);
  const globalRepPct = useMemo(() => clamp(globalRep / 100, 0, 1), [globalRep]);

  const unlockedAchievements = useMemo(() => {
    const ctx = {
      cash: data.cash,
      totalEarned: data.totalEarned,
      dealsCount:
        data.films.reduce((acc, f) => acc + (f.broadcastRights.sold ? 1 : 0) + (f.intlRights.europe.sold ? 1 : 0) + (f.intlRights.americas.sold ? 1 : 0) + (f.intlRights.asia.sold ? 1 : 0), 0) +
        data.musicProjects.reduce((acc, p) => acc + (p.streamingRights.sold ? 1 : 0) + ((p.adsRights?.sold ?? false) ? 1 : 0), 0) +
        data.seriesProjects.reduce(
          (acc, p) =>
            acc +
            (p.distributionRights.sold ? 1 : 0) +
            (p.territoryRights?.europe?.sold ? 1 : 0) +
            (p.territoryRights?.americas?.sold ? 1 : 0) +
            (p.territoryRights?.asia?.sold ? 1 : 0),
          0
        ) +
        data.gameProjects.reduce((acc, p) => acc + (p.distributionRights.sold ? 1 : 0), 0) +
        data.liveProjects.reduce((acc, p) => acc + (p.tvRights.sold ? 1 : 0) + (p.sponsorship.sold ? 1 : 0) + (p.recordingRights.sold ? 1 : 0), 0),
      releasedBySector: {
        cinema: data.films.filter((f) => f.status === 'released').length,
        musique: data.musicProjects.filter((p) => p.status === 'released').length,
        series: data.seriesProjects.filter((p) => p.status === 'released').length,
        live: data.liveProjects.filter((p) => p.status === 'done').length,
        jv: data.gameProjects.filter((p) => p.status === 'released').length,
      },
      reputationGlobal: globalRepPct,
      cryptoProfit: Object.values(data.crypto.coins).reduce((acc, c) => acc + c.realizedProfit, 0),
      stocksProfit: data.stocks.realizedProfit,
      platformSubscribers: data.platform.subscribers,
      prestigeStars: data.prestige.stars,
    };

    const unlockedIds = new Set(data.achievements);
    const newlyUnlocked: string[] = [];
    for (const def of achievementsDefs) {
      if (unlockedIds.has(def.id)) continue;
      if (isAchievementUnlocked(def, ctx)) newlyUnlocked.push(def.id);
    }
    return newlyUnlocked;
  }, [
    achievementsDefs,
    data.achievements,
    data.cash,
    data.crypto.coins,
    data.films,
    data.gameProjects,
    data.liveProjects,
    data.musicProjects,
    data.platform.subscribers,
    data.prestige.stars,
    data.seriesProjects,
    data.stocks.realizedProfit,
    data.totalEarned,
    globalRepPct,
  ]);

  const productionMult = useMemo(() => 1 + data.achievements.length * 0.005, [data.achievements.length]);

  const [createOpen, setCreateOpen] = useState(false);
  const [negotiateOpen, setNegotiateOpen] = useState(false);
  const [activeNegotiation, setActiveNegotiation] = useState<
    | { kind: 'film_broadcast'; filmId: string }
    | { kind: 'film_intl'; filmId: string; zone: 'europe' | 'americas' | 'asia' }
    | { kind: 'music_streaming'; projectId: string }
    | { kind: 'music_ads'; projectId: string }
    | { kind: 'music_catalog'; artistId: string }
    | { kind: 'series_distribution'; projectId: string }
    | { kind: 'series_territory'; projectId: string; zone: 'europe' | 'americas' | 'asia' }
    | { kind: 'series_renewal'; projectId: string }
    | { kind: 'game_distribution'; projectId: string }
    | { kind: 'live_tv'; projectId: string }
    | { kind: 'live_sponsor'; projectId: string }
    | { kind: 'live_recording'; projectId: string }
    | null
  >(null);

  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [choiceEventModalOpen, setChoiceEventModalOpen] = useState(false);
  const [prestigeOpen, setPrestigeOpen] = useState(false);
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [signingOfferId, setSigningOfferId] = useState<string | null>(null);
  const [signingSalary, setSigningSalary] = useState<number>(0);
  const [signingMonths, setSigningMonths] = useState<number>(6);

  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const cashSpotRef = useRef<HTMLDivElement | null>(null);
  const tabsSpotRef = useRef<HTMLDivElement | null>(null);
  const createSpotRef = useRef<HTMLButtonElement | null>(null);
  const projectsSpotRef = useRef<HTMLDivElement | null>(null);
  const contractsSpotRef = useRef<HTMLDivElement | null>(null);
  const reputationSpotRef = useRef<HTMLDivElement | null>(null);
  const portfoliosSpotRef = useRef<HTMLDivElement | null>(null);
  const agentSpotRef = useRef<HTMLDivElement | null>(null);
  const eventSpotRef = useRef<HTMLDivElement | null>(null);
  const mobileFabSpotRef = useRef<HTMLButtonElement | null>(null);

  const tutorialSteps = useMemo<SpotlightTutorialStep[]>(
    () => [
      { key: 'cash', title: 'Tes Apex Coins', body: 'Ton argent (₶). Il augmente avec tes projets et tes deals.' },
      { key: 'tabs', title: 'Secteurs', body: 'Chaque onglet débloque un nouveau levier. Garde toujours un objectif proche (débloquer le secteur suivant).' },
      { key: 'create', title: 'Lancer un projet', body: 'C’est ta boucle principale: produire → sortir → vendre les droits → réinvestir.' },
      { key: 'projects', title: 'Projets', body: 'Surveille le statut + la hype. La hype baisse avec le temps et impacte tout.' },
      { key: 'contracts', title: 'Contrats', body: 'Quand un contrat est dispo, tu peux négocier un prix. Plus tu demandes, plus la proba baisse.' },
      { key: 'reputation', title: 'Réputation', body: 'Plus elle est haute, plus les deals deviennent faciles. Les flops et scandales la font chuter.' },
      { key: 'portfolios', title: 'Portefeuilles', body: 'Crypto et bourse sont des boosts/risques. Tu influences aussi le marché.' },
      { key: 'agent', title: 'L’Agent', body: 'Il arrive avec des offres exclusives. 90 secondes pour décider.' },
      { key: 'event', title: 'Événements', body: 'Un événement toutes les 5–12 minutes. Certains demandent un choix.' },
      { key: 'mobile', title: 'Menu mobile', body: 'Sur mobile, ouvre le menu pour voir contrats, réputation, agent et stats.' },
    ],
    []
  );

  const tutorialTargetEl = useMemo(() => {
    const key = tutorialSteps[tutorialStep]?.key;
    if (key === 'cash') return cashSpotRef.current;
    if (key === 'tabs') return tabsSpotRef.current;
    if (key === 'create') return createSpotRef.current;
    if (key === 'projects') return projectsSpotRef.current;
    if (key === 'contracts') return contractsSpotRef.current;
    if (key === 'reputation') return reputationSpotRef.current;
    if (key === 'portfolios') return portfoliosSpotRef.current;
    if (key === 'agent') return agentSpotRef.current;
    if (key === 'event') return eventSpotRef.current;
    if (key === 'mobile') return mobileFabSpotRef.current;
    return null;
  }, [tutorialStep, tutorialSteps]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      const done = localStorage.getItem('apex_tutorial_done_v1') === '1';
      if (!done) {
        setTutorialOpen(true);
        setTutorialStep(0);
      }
    } catch {}
  }, [isLoaded]);

  useEffect(() => {
    if (!tutorialOpen) return;
    const key = tutorialSteps[tutorialStep]?.key;
    const isMobile = typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false;
    if (!isMobile) return;
    if (key === 'contracts' || key === 'reputation' || key === 'portfolios' || key === 'agent' || key === 'event') setMobileSheetOpen(true);
    if (key === 'mobile') {
      setMobileSheetOpen(false);
    }
  }, [tutorialOpen, tutorialStep, tutorialSteps]);

  const rosterMax = useMemo(() => 5 + (hasPrestigeUpgrade(data.prestige as ApexPrestigeState, 'tete_reseau') ? 3 : 0), [data.prestige]);

  useEffect(() => {
    if (!isLoaded) return;
    if (unlockedAchievements.length === 0) return;
    setData((prev) => ({ ...prev, achievements: [...prev.achievements, ...unlockedAchievements] }));
    for (const id of unlockedAchievements.slice(0, 3)) {
      const def = achievementsDefs.find((d) => d.id === id);
      if (def) toast.success(`Succès débloqué: ${def.name}`);
    }
  }, [achievementsDefs, isLoaded, setData, unlockedAchievements]);

  useEffect(() => {
    if (!isLoaded) return;
    let rafId = 0;
    let lastTs = performance.now();
    let acc = 0;

    const loop = (ts: number) => {
      const dt = ts - lastTs;
      lastTs = ts;
      acc += dt;

      const steps = Math.min(10, Math.floor(acc / 1000));
      if (steps > 0) {
        acc -= steps * 1000;
        setData((prev) => {
          let s = prev;
          for (let i = 0; i < steps; i += 1) s = stepOnce(s, { productionMult });
          return s;
        });
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isLoaded, productionMult, setData]);

  useEffect(() => {
    if (!isLoaded) return;
    if (data.agent.active && !agentModalOpen) setAgentModalOpen(true);
  }, [agentModalOpen, data.agent.active, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    if (data.event.active && data.event.kind === 'choice' && !choiceEventModalOpen) setChoiceEventModalOpen(true);
  }, [choiceEventModalOpen, data.event.active, data.event.kind, isLoaded]);

  const cashPerMin = useMemo(() => computeCashPerMinValue(data, { productionMult }), [data, productionMult]);

  const sectorTabs = useMemo(() => {
    const tabs: { id: ApexSectorId; label: string; icon: React.ReactNode; locked?: boolean; required?: number }[] = [
      { id: 'cinema', label: 'Cinéma', icon: <Film className="h-4 w-4" /> },
      { id: 'musique', label: 'Musique', icon: <Music2 className="h-4 w-4" />, locked: !unlocked.musique, required: UNLOCKS.musique },
      { id: 'series', label: 'Séries', icon: <Tv className="h-4 w-4" />, locked: !unlocked.series, required: UNLOCKS.series },
      { id: 'live', label: 'Live', icon: <Users className="h-4 w-4" />, locked: !unlocked.live, required: UNLOCKS.live },
      { id: 'jv', label: 'JV', icon: <Gamepad2 className="h-4 w-4" />, locked: !unlocked.jv, required: UNLOCKS.jv },
      { id: 'crypto', label: 'Crypto', icon: <LineChart className="h-4 w-4" />, locked: !unlocked.crypto, required: UNLOCKS.crypto },
      { id: 'bourse', label: 'Bourse', icon: <LineChart className="h-4 w-4" />, locked: !unlocked.bourse, required: UNLOCKS.bourse },
    ];
    return tabs;
  }, [unlocked.bourse, unlocked.crypto, unlocked.jv, unlocked.live, unlocked.musique, unlocked.series]);

  const openNegotiation = (next: NonNullable<typeof activeNegotiation>) => {
    setActiveNegotiation(next);
    setNegotiateOpen(true);
  };

  const closeNegotiation = () => {
    setNegotiateOpen(false);
    setActiveNegotiation(null);
  };

  const openSignArtist = (offerId: string) => {
    const offer = data.artistMarket.find((a) => a.id === offerId);
    if (!offer) return;
    const estimate = Math.floor(offer.baseSalaryPerMonth * (1 - clamp(data.reputation.musique / 250, 0, 0.35)));
    setSigningOfferId(offerId);
    setSigningSalary(Math.max(1, estimate));
    setSigningMonths(6);
    setSignModalOpen(true);
  };

  const attemptSignArtist = () => {
    if (!signingOfferId) return;
    setData((prev) => {
      const offer = prev.artistMarket.find((a) => a.id === signingOfferId);
      if (!offer || offer.withdrawn || offer.availableUntil <= prev.lastActionAt) return prev;
      if (prev.artists.length >= rosterMax) return prev;
      if (prev.cash < offer.signatureFee) return prev;

      const estimate = Math.floor(offer.baseSalaryPerMonth * (1 - clamp(prev.reputation.musique / 250, 0, 0.35)));
      const ratio = signingSalary / Math.max(1, estimate);
      const durationPenalty = clamp((signingMonths - 6) * 0.012, -0.04, 0.07);
      const baseProb = ratio <= 1 ? 0.85 + (1 - ratio) * 0.18 : 0.85 - (ratio - 1) * 0.6;
      const prob = clamp(baseProb - offer.refusals * 0.08 - durationPenalty, 0.05, 0.95);

      const roll = Math.random();
      if (roll < prob) {
        toast.success(`Artiste signé: ${offer.name}`);
        const monthMs = 5 * 60 * 1000;
        const artist: ApexMusicArtist = {
          id: createId('artist'),
          name: offer.name,
          notoriety: offer.notoriety,
          notorietyBoost: 0,
          style: offer.style,
          signedAt: prev.lastActionAt,
          contractEndsAt: prev.lastActionAt + signingMonths * monthMs,
          salaryPerMonth: Math.max(1, Math.floor(signingSalary)),
        };
        return {
          ...prev,
          cash: prev.cash - offer.signatureFee,
          artists: [artist, ...prev.artists],
          artistMarket: prev.artistMarket.filter((a) => a.id !== offer.id),
        };
      }

      const nextMarket = prev.artistMarket.map((a) => {
        if (a.id !== offer.id) return a;
        const refusals = a.refusals + 1;
        const withdrawn = refusals >= 3;
        return { ...a, refusals, withdrawn };
      });
      const withdrawn = nextMarket.find((a) => a.id === offer.id)?.withdrawn ?? false;
      toast(withdrawn ? `${offer.name} se retire.` : `${offer.name} refuse.`, { description: withdrawn ? 'Nous ne sommes plus intéressés.' : 'Tu peux retenter.' });
      return { ...prev, artistMarket: nextMarket };
    });
    setSignModalOpen(false);
    setSigningOfferId(null);
  };

  const startFilm = (args: { genre: ApexCinemaGenre; productionBudget: number; marketingPercent: number; premiere: boolean; directorLevel: 1 | 2 | 3 | 4 | 5; directorName: string; directorSpecialty: ApexCinemaGenre; cast: string[] }) => {
    setData((prev) => {
      const now = prev.lastActionAt;
      const coprod = prev.buffs.nextFilmCoprod;
      const marketingBudget = Math.floor(args.productionBudget * (clamp(args.marketingPercent, 0, 100) / 100));
      const productionCost = coprod ? Math.floor(args.productionBudget * 0.5) : args.productionBudget;
      const cast = args.cast.slice(0, 5);
      if (cast.length < 1) return prev;
      const directorCost = Math.floor(350 * args.directorLevel * args.directorLevel);
      const castCost = Math.floor(cast.length * 180);
      const totalCost = productionCost + marketingBudget + directorCost + castCost + (args.premiere ? 200 : 0);
      if (prev.cash < totalCost) return prev;

      const n = namesRef.current;
      let titlePick = `Film ${prev.films.length + 1}`;
      let nextDraw = prev.draw.films;
      if (n?.films?.length) {
        const pick = drawWithoutReplacement({ list: n.films, prev: prev.draw.films });
        titlePick = pick.value;
        nextDraw = pick.next;
      }

      const startedAt = now;
      const productionEndsAt = now + filmProductionDurationMs(args.productionBudget);
      const embargo = productionEndsAt + 30 * 60 * 1000;

      const buyersBroadcast = makeBuyers({ names: ['CinéStream', 'MégaVision', 'ArcLight'], min: 3, max: 3 });
      const buyersIntl = makeBuyers({ names: ['EuropeMax', 'AmeriDeal', 'AsiaPrime', 'GlobeRights', 'SilverScreen'], min: 3, max: 5 });

      const baseDeal = initDeal({ buyers: buyersBroadcast, embargoUntil: embargo });
      const intlDeal = () => initDeal({ buyers: buyersIntl.map((b) => ({ ...b, id: createId('buyer') })), embargoUntil: embargo });

      const initialHype = clamp(
        marketingToInitialHype(args.marketingPercent) +
          (args.premiere ? 15 : 0) +
          prev.buffs.nextFilmHypeBonus +
          (hasPrestigeUpgrade(prev.prestige as ApexPrestigeState, 'hype_machine') ? 10 : 0),
        0,
        100
      );
      const revenueShare = coprod ? 0.6 : 1;

      const film: ApexFilmProject = {
        id: createId('film'),
        title: titlePick,
        genre: args.genre,
        productionBudget: Math.floor(args.productionBudget),
        marketingPercent: Math.floor(args.marketingPercent),
        marketingBudget,
        premiere: args.premiere,
        revenueShare,
        qualityBonus: prev.buffs.nextFilmQualityBonus,
        director: { name: args.directorName, level: args.directorLevel, specialty: args.directorSpecialty },
        cast,
        status: 'producing',
        startedAt,
        productionEndsAt,
        hype: initialHype,
        lastHypeAt: startedAt,
        broadcastRights: baseDeal,
        intlRights: { europe: intlDeal(), americas: intlDeal(), asia: intlDeal() },
        merchUnlocked: false,
      };

      return {
        ...prev,
        cash: prev.cash - totalCost,
        draw: { ...prev.draw, films: nextDraw },
        buffs: { ...prev.buffs, nextFilmHypeBonus: 0, nextFilmQualityBonus: 0, nextFilmCoprod: false },
        films: [film, ...prev.films],
      };
    });
  };

  const submitFilmFestival = (filmId: string) => {
    setData((prev) => {
      const film = prev.films.find((f) => f.id === filmId);
      if (!film || film.status !== 'released') return prev;
      if (film.festival && !film.festival.resolved) return prev;
      if (prev.cash < 200) return prev;
      toast('Soumission au festival', { description: 'Résultat dans 5 min.' });
      const now = prev.lastActionAt;
      return {
        ...prev,
        cash: prev.cash - 200,
        films: prev.films.map((f) =>
          f.id === filmId
            ? { ...f, festival: { submittedAt: now, resolvesAt: now + 5 * 60 * 1000, resolved: false, won: false } }
            : f
        ),
      };
    });
  };

  const startSequel = (filmId: string) => {
    setData((prev) => {
      const baseFilm = prev.films.find((f) => f.id === filmId);
      if (!baseFilm || baseFilm.status !== 'released') return prev;
      const quality = baseFilm.qualityScore ?? 0;
      const totalBox = baseFilm.totalBoxOffice ?? 0;
      const threshold = Math.max(1000, Math.floor(baseFilm.productionBudget * 0.6));
      if (quality <= 75 || totalBox < threshold) return prev;
      if (prev.films.some((f) => f.sequelOfFilmId === baseFilm.id)) return prev;

      const now = prev.lastActionAt;
      const rootId = baseFilm.franchiseRootId ?? baseFilm.id;
      const sequelIndex = (baseFilm.sequelIndex ?? 0) + 1;
      const productionBudget = Math.floor(baseFilm.productionBudget * 1.5);
      const marketingPercent = baseFilm.marketingPercent;
      const marketingBudget = Math.floor(productionBudget * (clamp(marketingPercent, 0, 100) / 100));
      const productionEndsAt = now + Math.floor(filmProductionDurationMs(productionBudget) * 1.3);
      const embargo = productionEndsAt + 30 * 60 * 1000;

      const directorCost = Math.floor(350 * baseFilm.director.level * baseFilm.director.level);
      const castCost = Math.floor(baseFilm.cast.slice(0, 5).length * 180);
      const totalCost = productionBudget + marketingBudget + directorCost + castCost;
      if (prev.cash < totalCost) return prev;

      const buyersBroadcast = makeBuyers({ names: ['CinéStream', 'MégaVision', 'ArcLight'], min: 3, max: 3 });
      const buyersIntl = makeBuyers({ names: ['EuropeMax', 'AmeriDeal', 'AsiaPrime', 'GlobeRights', 'SilverScreen'], min: 3, max: 5 });
      const baseDeal = initDeal({ buyers: buyersBroadcast, embargoUntil: embargo });
      const intlDeal = () => initDeal({ buyers: buyersIntl.map((b) => ({ ...b, id: createId('buyer') })), embargoUntil: embargo });

      const hype = clamp(
        marketingToInitialHype(marketingPercent) + prev.buffs.nextFilmHypeBonus + (hasPrestigeUpgrade(prev.prestige as ApexPrestigeState, 'hype_machine') ? 10 : 0),
        0,
        100
      );

      const film: ApexFilmProject = {
        id: createId('film'),
        title: `${baseFilm.title} II`,
        genre: baseFilm.genre,
        productionBudget,
        marketingPercent,
        marketingBudget,
        premiere: false,
        revenueShare: 1,
        qualityBonus: prev.buffs.nextFilmQualityBonus,
        director: baseFilm.director,
        cast: baseFilm.cast.slice(0, 5),
        status: 'producing',
        startedAt: now,
        productionEndsAt,
        hype,
        lastHypeAt: now,
        broadcastRights: baseDeal,
        intlRights: { europe: intlDeal(), americas: intlDeal(), asia: intlDeal() },
        merchUnlocked: false,
        franchiseRootId: rootId,
        sequelOfFilmId: baseFilm.id,
        sequelIndex,
        frozenUntil: null,
      };

      toast('Suite lancée');
      return {
        ...prev,
        cash: prev.cash - totalCost,
        buffs: { ...prev.buffs, nextFilmHypeBonus: 0, nextFilmQualityBonus: 0, nextFilmCoprod: false },
        films: [film, ...prev.films],
      };
    });
  };

  const startMusicProject = (args: {
    kind: ApexMusicProject['kind'];
    artistId: string;
    featuringArtistId?: string;
    budget: number;
    marketingBudget: number;
    tourVenue?: 'petite' | 'moyenne' | 'grande' | 'stade';
    tourCities?: number;
  }) => {
    setData((prev) => {
      if (prev.totalEarned < UNLOCKS.musique) return prev;
      const now = prev.lastActionAt;
      const artist = prev.artists.find((a) => a.id === args.artistId);
      if (!artist) return prev;
      const featuringArtist = args.featuringArtistId ? prev.artists.find((a) => a.id === args.featuringArtistId) ?? null : null;
      if (featuringArtist && featuringArtist.id === artist.id) return prev;

      const musicLevel = Math.floor(clamp(prev.reputation.musique, 0, 100) / 20) + 1;
      if (args.kind === 'tour_mondiale' && musicLevel < 3) return prev;

      const durationMs =
        args.kind === 'single'
          ? 1 * 60 * 1000
          : args.kind === 'album'
            ? 8 * 60 * 1000
            : args.kind === 'tour_nationale'
              ? 10 * 60 * 1000
              : 20 * 60 * 1000;

      const budget = Math.max(0, Math.floor(args.budget));
      const marketing = Math.max(0, Math.floor(args.marketingBudget));
      const totalCost = budget + marketing;
      if (prev.cash < totalCost) return prev;

      const startedAt = now;
      const productionEndsAt = now + durationMs;
      const embargo = productionEndsAt + 30 * 60 * 1000;

      const singlesReleased = prev.musicProjects.filter((p) => p.artistId === artist.id && p.kind === 'single' && p.status === 'released').length;
      const prereqSinglesMet = args.kind !== 'album' ? true : singlesReleased >= 2;

      const mainBoost = Number.isFinite(artist.notorietyBoost) ? artist.notorietyBoost : 0;
      const featBoost = featuringArtist && Number.isFinite(featuringArtist.notorietyBoost) ? featuringArtist.notorietyBoost : 0;
      const mainPower = artist.notoriety * 10 + Math.max(0, mainBoost);
      const featPower = featuringArtist ? featuringArtist.notoriety * 10 + Math.max(0, featBoost) : 0;
      const baseHype = 10 + Math.floor((mainPower + featPower) * 0.9) + Math.min(30, Math.floor(marketing / 120));
      const initialHype = clamp(baseHype + (hasPrestigeUpgrade(prev.prestige as ApexPrestigeState, 'hype_machine') ? 10 : 0), 0, 100);

      const buyers = makeBuyers({ names: ['SoundWave', 'BeatFlow', 'TuneVault'], min: 3, max: 3 });
      const streamingRights = initDeal({ buyers, embargoUntil: embargo });
      const adsRights = initDeal({ buyers: makeBuyers({ names: ['GlobalAds Corp', 'ApexCola', 'GlobeWear', 'NovaEnergy'], min: 3, max: 4 }), embargoUntil: embargo });

      const title = args.kind === 'album' ? `Album — ${artist.name}` : args.kind === 'single' ? `Single — ${artist.name}` : args.kind === 'tour_nationale' ? `Tournée nationale — ${artist.name}` : `Tournée mondiale — ${artist.name}`;

      const project: ApexMusicProject = {
        id: createId('music'),
        kind: args.kind,
        title,
        artistId: artist.id,
        artistName: artist.name,
        featuringArtistId: featuringArtist?.id,
        featuringArtistName: featuringArtist?.name,
        tourVenue: args.kind === 'tour_nationale' || args.kind === 'tour_mondiale' ? (args.tourVenue ?? 'moyenne') : undefined,
        tourCities: args.kind === 'tour_mondiale' ? clamp(Math.floor(args.tourCities ?? 3), 3, 5) : undefined,
        startedAt,
        productionEndsAt,
        status: 'producing',
        hype: initialHype,
        lastHypeAt: startedAt,
        prereqSinglesMet,
        streamingRights,
        adsRights,
      };

      return {
        ...prev,
        cash: prev.cash - totalCost,
        musicProjects: [project, ...prev.musicProjects],
      };
    });
  };

  const startSeriesProject = (args: {
    genre: string;
    seasonsPlanned: number;
    episodesPerSeason: 6 | 12 | 24;
    budgetPerEpisode: number;
    showrunnerLevel: 1 | 2 | 3 | 4 | 5;
    releaseStrategy: 'mondiale' | 'territoires';
  }) => {
    setData((prev) => {
      if (prev.totalEarned < UNLOCKS.series) return prev;
      const n = namesRef.current;
      if (!n) return prev;
      const now = prev.lastActionAt;
      const seasonsPlanned = clamp(Math.floor(args.seasonsPlanned), 1, 5);
      const episodesPerSeason = args.episodesPerSeason;
      const budgetPerEpisode = Math.max(1, Math.floor(args.budgetPerEpisode));
      const seasonBudget = budgetPerEpisode * episodesPerSeason;
      if (prev.cash < seasonBudget) return prev;

      const titleDraw = drawWithoutReplacement({ list: n.noms_series, prev: prev.draw.noms_series });
      const showrunnerDraw = drawWithoutReplacement({ list: n.showrunners, prev: prev.draw.showrunners });

      const productionEndsAt = now + episodesPerSeason * 3 * 60 * 1000;
      const embargo = productionEndsAt + 30 * 60 * 1000;

      const hypeBase = 25 + args.showrunnerLevel * 6 + Math.min(20, Math.floor(budgetPerEpisode / 500));
      const hype = clamp(hypeBase + (hasPrestigeUpgrade(prev.prestige as ApexPrestigeState, 'hype_machine') ? 10 : 0), 0, 100);

      const buyers = makeBuyers({ names: ['PrimeVision', 'ArcLight', 'CinéStream', 'MégaVision', 'StreamNova'], min: 3, max: 5 });
      const distributionRights = initDeal({ buyers, embargoUntil: embargo });
      const territoryRights =
        args.releaseStrategy === 'territoires'
          ? {
              europe: initDeal({ buyers: makeBuyers({ names: ['EuroVision', 'CinéStream EU', 'PrimeVision EU'], min: 3, max: 3 }), embargoUntil: embargo }),
              americas: initDeal({ buyers: makeBuyers({ names: ['ArcLight US', 'MegaVision US', 'StreamNova US'], min: 3, max: 3 }), embargoUntil: embargo }),
              asia: initDeal({ buyers: makeBuyers({ names: ['NovaAsia', 'PrimeVision APAC', 'ArcLight APAC'], min: 3, max: 3 }), embargoUntil: embargo }),
            }
          : undefined;

      const project: ApexSeriesProject = {
        id: createId('series'),
        title: titleDraw.value,
        genre: args.genre,
        seasonsPlanned,
        episodesPerSeason,
        budgetPerEpisode,
        showrunner: { name: showrunnerDraw.value, level: args.showrunnerLevel },
        season: 1,
        cancelled: false,
        releaseStrategy: args.releaseStrategy,
        territoryRights,
        renewalOffer: null,
        startedAt: now,
        productionEndsAt,
        status: 'producing',
        hype,
        lastHypeAt: now,
        distributionRights,
      };

      return {
        ...prev,
        cash: prev.cash - seasonBudget,
        draw: { ...prev.draw, noms_series: titleDraw.next, showrunners: showrunnerDraw.next },
        seriesProjects: [project, ...prev.seriesProjects],
      };
    });
  };

  const startNextSeriesSeasonAutonomy = (projectId: string) => {
    setData((prev) => {
      const project = prev.seriesProjects.find((p) => p.id === projectId);
      if (!project) return prev;
      if (project.status !== 'released') return prev;
      if (project.cancelled) return prev;
      const season = project.season ?? 1;
      if (season >= project.seasonsPlanned) return prev;

      const seasonBudget = project.budgetPerEpisode * project.episodesPerSeason;
      if (prev.cash < seasonBudget) return prev;

      const startedAt = prev.lastActionAt;
      const productionEndsAt = startedAt + project.episodesPerSeason * 3 * 60 * 1000;
      const embargo = productionEndsAt + 30 * 60 * 1000;

      const buyers = makeBuyers({ names: ['PrimeVision', 'ArcLight', 'CinéStream', 'MégaVision', 'StreamNova'], min: 3, max: 5 });
      const distributionRights = initDeal({ buyers, embargoUntil: embargo });
      const territoryRights =
        project.releaseStrategy === 'territoires'
          ? {
              europe: initDeal({ buyers: makeBuyers({ names: ['EuroVision', 'CinéStream EU', 'PrimeVision EU'], min: 3, max: 3 }), embargoUntil: embargo }),
              americas: initDeal({ buyers: makeBuyers({ names: ['ArcLight US', 'MegaVision US', 'StreamNova US'], min: 3, max: 3 }), embargoUntil: embargo }),
              asia: initDeal({ buyers: makeBuyers({ names: ['NovaAsia', 'PrimeVision APAC', 'ArcLight APAC'], min: 3, max: 3 }), embargoUntil: embargo }),
            }
          : undefined;

      toast('Saison suivante lancée');
      return {
        ...prev,
        cash: prev.cash - seasonBudget,
        seriesProjects: prev.seriesProjects.map((p) =>
          p.id === project.id
            ? {
                ...p,
                season: season + 1,
                status: 'producing' as const,
                startedAt,
                productionEndsAt,
                releasedAt: undefined,
                qualityScore: undefined,
                lastHypeAt: startedAt,
                distributionRights,
                territoryRights,
                renewalOffer: null,
                renewalOffered: false,
                cancelled: false,
              }
            : p
        ),
      };
    });
  };

  const startLiveProject = (args: { kind: ApexLiveProject['kind']; venue: ApexLiveProject['venue']; artistIds: string[]; cities: number; outdoor: boolean }) => {
    setData((prev) => {
      if (prev.totalEarned < UNLOCKS.live) return prev;
      const now = prev.lastActionAt;

      const globalLevel = Math.floor(clamp(computeGlobalRep(prev.reputation), 0, 100) / 20) + 1;
      if (args.kind === 'ceremonie' && globalLevel < 3) return prev;

      const venue = args.venue;
      const venueCost = venue === 'petite' ? 600 : venue === 'moyenne' ? 2400 : venue === 'grande' ? 8000 : 30000;
      const venueCap = venue === 'petite' ? 150 : venue === 'moyenne' ? 400 : venue === 'grande' ? 1200 : 5000;

      const artists = prev.artists.filter((a) => args.artistIds.includes(a.id));
      if ((args.kind === 'concert' || args.kind === 'festival' || args.kind === 'tour_multi' || args.kind === 'corporatif') && artists.length === 0) return prev;

      const cities = args.kind === 'tour_multi' ? clamp(Math.floor(args.cities), 3, 5) : 1;
      const outdoor = Boolean(args.outdoor);
      const annual = args.kind === 'ceremonie';

      const artistsFee = artists.reduce((acc, a) => acc + 500 * a.notoriety * a.notoriety, 0);
      const kindCost =
        args.kind === 'festival'
          ? 15000
          : args.kind === 'ceremonie'
            ? 50000
            : args.kind === 'corporatif'
              ? 5000
              : 0;
      const cost = Math.floor(venueCost + artistsFee * cities + kindCost);
      if (prev.cash < cost) return prev;

      const durationMin = args.kind === 'concert' ? 4 : args.kind === 'festival' ? 12 : args.kind === 'ceremonie' ? 8 : args.kind === 'tour_multi' ? 16 : 5;
      const endsAt = now + durationMin * 60 * 1000;

      const avgNotoriety = artists.length > 0 ? artists.reduce((acc, a) => acc + a.notoriety, 0) / artists.length : 0;
      const hypeBase = args.kind === 'corporatif' ? 0 : 18 + avgNotoriety * 12 + (venueCap >= 1200 ? 8 : venueCap >= 400 ? 4 : 0) + clamp(prev.reputation.live / 10, 0, 10);
      const hype = clamp(hypeBase + (hasPrestigeUpgrade(prev.prestige as ApexPrestigeState, 'hype_machine') ? 10 : 0), 0, 100);

      const tvRights = initDeal({ buyers: makeBuyers({ names: ['ArcTV', 'MegaVision Live', 'PrimeSports', 'NovaChannel', 'CinéStream Live'], min: 3, max: 5 }) });
      const sponsorship = initDeal({ buyers: makeBuyers({ names: ['GlobalAds Corp', 'ApexCola', 'NovaEnergy', 'TechStream', 'GlobeWear'], min: 3, max: 5 }) });
      const recordingRights = initDeal({ buyers: makeBuyers({ names: ['CinéStream', 'PrimeVision', 'SoundWave', 'BeatFlow', 'ArcLight'], min: 3, max: 5 }), embargoUntil: endsAt });

      const title =
        args.kind === 'festival'
          ? `Festival — ${artists.map((a) => a.name).slice(0, 2).join(' & ') || 'Line-up'}`
          : args.kind === 'ceremonie'
            ? 'Cérémonie — Apex Awards'
            : args.kind === 'tour_multi'
              ? `Tournée — ${artists[0]?.name ?? 'Artiste'}`
              : args.kind === 'corporatif'
                ? `Corporatif — ${artists[0]?.name ?? 'Artiste'}`
                : `Concert — ${artists[0]?.name ?? 'Artiste'}`;

      const project: ApexLiveProject = {
        id: createId('live'),
        kind: args.kind,
        title,
        venue,
        artistIds: artists.map((a) => a.id),
        artistNames: artists.map((a) => a.name),
        cities,
        outdoor,
        annual,
        nextAnnualAt: annual ? endsAt + 30 * 60 * 1000 : undefined,
        cost,
        startedAt: now,
        endsAt,
        status: 'active',
        hype,
        lastHypeAt: now,
        tvRights,
        sponsorship,
        recordingRights,
      };

      return { ...prev, cash: prev.cash - cost, liveProjects: [project, ...prev.liveProjects] };
    });
  };

  const startGameProject = (args: { genre: ApexGameGenre; model: ApexSave['gameProjects'][number]['model']; devBudget: number; marketingBudget: number }) => {
    setData((prev) => {
      if (prev.totalEarned < UNLOCKS.jv) return prev;
      if (prev.studios.length === 0) return prev;
      const n = namesRef.current;
      if (!n) return prev;
      const now = prev.lastActionAt;
      const devBudget = Math.max(1, Math.floor(args.devBudget));
      const marketingBudget = Math.max(0, Math.floor(args.marketingBudget));
      const totalBudget = devBudget + marketingBudget;
      if (prev.cash < totalBudget) return prev;

      const titleDraw = drawWithoutReplacement({ list: n.noms_jeux, prev: prev.draw.noms_jeux });
      const total = devBudget + marketingBudget;
      const durationMin = total < 50_000 ? 10 : total < 200_000 ? 20 : total < 1_000_000 ? 30 : 40;
      const productionEndsAt = now + durationMin * 60 * 1000;
      const embargo = productionEndsAt + 30 * 60 * 1000;

      const hypeBase = 20 + Math.min(35, Math.floor(marketingBudget / 5000));
      const hype = clamp(hypeBase + (hasPrestigeUpgrade(prev.prestige as ApexPrestigeState, 'hype_machine') ? 10 : 0), 0, 100);

      const buyers = makeBuyers({ names: ['PixelPublish', 'GameForge', 'ArcPlay', 'MegaStore', 'NovaGames'], min: 3, max: 5 });
      const distributionRights = initDeal({ buyers, embargoUntil: embargo });

      const project = {
        id: createId('game'),
        title: titleDraw.value,
        genre: args.genre,
        model: args.model,
        devBudget,
        marketingBudget,
        startedAt: now,
        productionEndsAt,
        status: 'producing' as const,
        hype,
        lastHypeAt: now,
        distributionRights,
      };

      return {
        ...prev,
        cash: prev.cash - totalBudget,
        draw: { ...prev.draw, noms_jeux: titleDraw.next },
        gameProjects: [project, ...prev.gameProjects],
      };
    });
  };

  const startGamePort = (projectId: string, platform: 'ArcBox' | 'NovaStation' | 'PocketPlay') => {
    setData((prev) => {
      if (prev.totalEarned < UNLOCKS.jv) return prev;
      const p = prev.gameProjects.find((x) => x.id === projectId);
      if (!p || p.status !== 'released') return prev;
      if (p.port && !p.port.done) return prev;
      if (p.port?.done) return prev;
      const cost = Math.max(10_000, Math.floor(p.devBudget * 0.22));
      if (prev.cash < cost) return prev;
      const startedAt = prev.lastActionAt;
      const endsAt = startedAt + 8 * 60 * 1000;
      toast('Port console lancé');
      return {
        ...prev,
        cash: prev.cash - cost,
        gameProjects: prev.gameProjects.map((x) =>
          x.id === p.id ? { ...x, port: { platform, startedAt, endsAt, done: false } } : x
        ),
      };
    });
  };

  const stepOnce = (prev: ApexSave, args: { productionMult: number }): ApexSave => {
    const now = prev.lastActionAt + 1000;
    const partnershipMult = prev.buffs.partnershipUntil !== null && now < prev.buffs.partnershipUntil ? 0.92 : 1;
    const macroMult =
      (prev.event.active && prev.event.title === 'Crise économique' ? 0.8 : prev.event.active && prev.event.title === 'Golden Age of Cinema' ? 1.5 : 1) *
      partnershipMult;
    const cinemaMult = buyoutMult(prev, 'cinema');
    const musiqueMult = buyoutMult(prev, 'musique');
    const seriesMult = buyoutMult(prev, 'series');
    const liveMult = buyoutMult(prev, 'live');
    const jvMult = buyoutMult(prev, 'jv');

    let cashDelta = 0;
    let earnedDelta = 0;
    let repCinemaDelta = 0;
    let repMusicDelta = 0;
    let repSeriesDelta = 0;
    let repLiveDelta = 0;
    let repJvDelta = 0;

    let cryptoState = stepCrypto(prev.crypto, 1, now, { predictable: hasPrestigeUpgrade(prev.prestige as ApexPrestigeState, 'memoire_marche') });
    for (const [id, coin] of Object.entries(cryptoState.coins) as Array<[ApexCryptoId, (typeof cryptoState.coins)[ApexCryptoId]]>) {
      const suspended = coin.suspendedUntil && now < coin.suspendedUntil;
      const rate = suspended ? 0 : Math.max(0, coin.miningRatePerMin);
      if (rate <= 0) continue;
      const units = rate / 60;
      cryptoState = {
        ...cryptoState,
        coins: {
          ...cryptoState.coins,
          [id]: { ...coin, holdings: coin.holdings + units },
        },
      };
    }
    let stockStep = stepStocks({ state: prev.stocks, seconds: 1, now, sentiment: buildStockSentiment(prev) });
    let stocksState = stockStep.next;
    if (stockStep.dividends > 0) {
      cashDelta += stockStep.dividends;
      earnedDelta += stockStep.dividends;
    }

    const recentGenreCounts = new Map<ApexCinemaGenre, number>();
    for (const f of prev.films) {
      if (f.status === 'released' && f.releasedAt && now - f.releasedAt <= 60 * 1000) {
        recentGenreCounts.set(f.genre, (recentGenreCounts.get(f.genre) ?? 0) + 1);
      }
      if (f.status === 'producing' && now >= f.productionEndsAt) {
        recentGenreCounts.set(f.genre, (recentGenreCounts.get(f.genre) ?? 0) + 1);
      }
    }

    const films = prev.films.map((f) => {
      if (prev.event.active && prev.event.eventId === 'hollywood_strike' && f.status === 'producing') {
        return { ...f, productionEndsAt: f.productionEndsAt + 1000 };
      }
      if (f.status === 'producing' && now >= f.productionEndsAt) {
        const qualityBonus = Number.isFinite(f.qualityBonus) ? f.qualityBonus : 0;
        const quality = Math.floor(clamp(computeFilmQuality({ productionBudget: f.productionBudget, directorLevel: f.director.level, castCount: f.cast.length }) + qualityBonus, 0, 100));
        const basePerMin = f.productionBudget * 0.18 * (quality / 100) * (f.hype / 100);
        const boxOfficePerMin = Math.max(1, Math.floor(basePerMin));
        const boxOfficeEndsAt = now + 20 * 60 * 1000;
        const flop = quality < 30;
        const repDelta = flop ? -5 : quality >= 80 ? 3 : quality >= 60 ? 1 : 0;
        repCinemaDelta += repDelta;
        const merchGlobalUnlocked = prev.films.filter((x) => x.status === 'released').length >= 9;
        const merchPerMin = merchGlobalUnlocked ? Math.max(1, Math.floor(f.productionBudget * 0.03 * (quality / 100) * (f.hype / 100))) : undefined;
        return {
          ...f,
          status: 'released' as const,
          releasedAt: now,
          qualityScore: quality,
          boxOfficeEndsAt,
          boxOfficePerMin: flop ? Math.floor(boxOfficePerMin / 3) : boxOfficePerMin,
          totalBoxOffice: 0,
          lastHypeAt: now,
          hype: clamp(f.hype + (f.director.specialty === f.genre ? 6 : 0), 0, 100),
          frozenUntil: null,
          merchUnlocked: merchGlobalUnlocked,
          merchEndsAt: merchGlobalUnlocked ? now + 60 * 60 * 1000 : undefined,
          merchPerMin,
        };
      }

      if (f.status === 'released' && f.releasedAt) {
        let festival = f.festival;
        if (festival && !festival.resolved && now >= festival.resolvesAt) {
          const quality = f.qualityScore ?? 0;
          const winProb = clamp(0.1 + (quality / 100) * 0.35 + (prev.reputation.cinema / 100) * 0.15, 0.1, 0.6);
          const won = Math.random() < winProb;
          festival = { ...festival, resolved: true, won };
          if (won) {
            repCinemaDelta += 8;
            toast('Festival gagné', { description: 'Réputation +8, droits revalorisés.' });
          } else {
            toast('Festival perdu');
          }
        }

        let frozenUntil = f.frozenUntil ?? null;
        if (frozenUntil === null && Math.random() < 0.00005) {
          frozenUntil = now + 5 * 60 * 1000;
          repCinemaDelta -= 10;
          toast('Accusation de plagiat', { description: 'Projet gelé 5 min.' });
        }

        let baseHype = f.hype;
        let broadcastRights = f.broadcastRights;
        let intlRights = f.intlRights;
        if (Math.random() < 0.00008 && f.hype > 20 && f.cast.length > 0) {
          const embargoUntil = now + 10 * 60 * 1000;
          broadcastRights = { ...broadcastRights, embargoUntil: Math.max(broadcastRights.embargoUntil ?? 0, embargoUntil) };
          intlRights = {
            europe: { ...intlRights.europe, embargoUntil: Math.max(intlRights.europe.embargoUntil ?? 0, embargoUntil) },
            americas: { ...intlRights.americas, embargoUntil: Math.max(intlRights.americas.embargoUntil ?? 0, embargoUntil) },
            asia: { ...intlRights.asia, embargoUntil: Math.max(intlRights.asia.embargoUntil ?? 0, embargoUntil) },
          };
          baseHype = 0;
          toast('Scandale acteur', { description: 'Hype à 0, droits invendables 10 min.' });
        }

        const ageMin = (now - f.releasedAt) / 60000;
        const hype = clamp(baseHype * computeHypeDecayMultiplier({ hype: baseHype, ageMin }), 0, 100);
        const isFrozen = frozenUntil !== null && now < frozenUntil;
        const canBox = !isFrozen && (f.boxOfficeEndsAt ? now <= f.boxOfficeEndsAt : false);
        const sameGenre = recentGenreCounts.get(f.genre) ?? 1;
        const competitionMult = sameGenre > 1 ? 1 / sameGenre : 1;
        const sequelMult = (f.sequelIndex ?? 0) > 0 ? 2.5 : 1;
        if (canBox && f.boxOfficePerMin) {
          const share = Number.isFinite(f.revenueShare) ? f.revenueShare : 1;
          const add = (f.boxOfficePerMin / 60) * args.productionMult * macroMult * share * cinemaMult * competitionMult * sequelMult;
          cashDelta += add;
          earnedDelta += add;
        }
        if (!isFrozen && f.merchUnlocked && f.merchEndsAt && now <= f.merchEndsAt && f.merchPerMin) {
          const share = Number.isFinite(f.revenueShare) ? f.revenueShare : 1;
          const add = (f.merchPerMin / 60) * args.productionMult * macroMult * share * cinemaMult;
          cashDelta += add;
          earnedDelta += add;
        }
        return {
          ...f,
          hype,
          lastHypeAt: now,
          totalBoxOffice:
            (f.totalBoxOffice ?? 0) +
            (canBox && f.boxOfficePerMin
              ? (f.boxOfficePerMin / 60) * (Number.isFinite(f.revenueShare) ? f.revenueShare : 1) * cinemaMult * competitionMult * sequelMult
              : 0),
          festival,
          frozenUntil,
          broadcastRights,
          intlRights,
        };
      }
      return f;
    });

    const monthMs = 5 * 60 * 1000;
    let artists: ApexMusicArtist[] = prev.artists.filter((a) => a.contractEndsAt > now);
    if (artists.length > 0) {
      artists = artists.map((a) => {
        cashDelta -= a.salaryPerMonth / (monthMs / 1000);
        const market = 120 * a.notoriety * a.notoriety;
        const underpaid = a.salaryPerMonth < market * 0.85;
        const underpaidSince = underpaid ? (a.underpaidSince ?? now) : null;
        if ((a.underpaidSince ?? null) === underpaidSince) return a;
        return { ...a, underpaidSince };
      });

      const repLow = prev.reputation.musique < 15;
      const leavingIds: string[] = [];
      for (const a of artists) {
        const market = 120 * a.notoriety * a.notoriety;
        const underpaid = a.salaryPerMonth < market * 0.85;
        const since = a.underpaidSince ?? null;
        const underpaidLong = underpaid && since !== null && now - since > 3 * 60 * 1000;
        const prob = repLow ? 0.0007 : underpaidLong ? 0.0005 : 0;
        if (prob > 0 && Math.random() < prob) leavingIds.push(a.id);
      }
      if (leavingIds.length > 0) {
        const leaving = artists.find((a) => a.id === leavingIds[0]);
        if (leaving) toast(`${leaving.name} quitte le roster`, { description: 'Salaire/reputation insuffisants.' });
        artists = artists.filter((a) => !leavingIds.includes(a.id));
      }
    }

    let musicProjects = prev.musicProjects.map((p) => {
      if (p.status === 'producing' && now >= p.productionEndsAt) {
        const baseQuality = Math.floor(clamp(45 + Math.random() * 45, 0, 100));
        const quality = p.kind === 'album' && p.prereqSinglesMet === false ? Math.max(0, baseQuality - 20) : baseQuality;
        const viral = p.kind === 'single' && Math.random() < 0.05;
        const featShare = p.featuringArtistId ? 0.85 : 1;
        const payoutEndsAt = now + (p.kind === 'single' ? 10 : 30) * 60 * 1000;
        const payoutPerMin = Math.max(1, Math.floor((p.kind === 'single' ? 120 : 420) * (quality / 100) * (p.hype / 100) * featShare));
        repMusicDelta += quality >= 80 ? 2 : quality < 30 ? -3 : 0;
        if (p.featuringArtistId) {
          const mainIdx = artists.findIndex((a) => a.id === p.artistId);
          const featIdx = artists.findIndex((a) => a.id === p.featuringArtistId);
          if (mainIdx >= 0) {
            const cur = Number.isFinite(artists[mainIdx]!.notorietyBoost) ? artists[mainIdx]!.notorietyBoost : 0;
            artists[mainIdx] = { ...artists[mainIdx]!, notorietyBoost: cur + 10 };
          }
          if (featIdx >= 0) {
            const cur = Number.isFinite(artists[featIdx]!.notorietyBoost) ? artists[featIdx]!.notorietyBoost : 0;
            artists[featIdx] = { ...artists[featIdx]!, notorietyBoost: cur + 10 };
          }
        }
        if (p.kind === 'tour_nationale' || p.kind === 'tour_mondiale') {
          const artist = artists.find((a) => a.id === p.artistId) ?? null;
          const venue = p.tourVenue ?? 'moyenne';
          const cap = venue === 'petite' ? 150 : venue === 'moyenne' ? 400 : venue === 'grande' ? 1200 : 5000;
          const cities = p.kind === 'tour_mondiale' ? clamp(Math.floor(p.tourCities ?? 3), 3, 5) : 2;
          const power = (artist?.notoriety ?? 1) * 10 + Math.max(0, artist?.notorietyBoost ?? 0);
          const ticketBase = 18 + clamp(prev.reputation.musique / 7, 0, 16) + clamp(power / 60, 0, 8);
          const fill = clamp(0.35 + (p.hype / 100) * 0.55, 0.35, 0.95);
          const grossTickets = cap * ticketBase * fill * cities;
          const merch = grossTickets * 0.18;
          const revenue = Math.floor((grossTickets + merch) * args.productionMult * macroMult * musiqueMult);
          cashDelta += revenue;
          earnedDelta += revenue;
          return {
            ...p,
            status: 'released' as const,
            releasedAt: now,
            qualityScore: quality,
            payoutEndsAt: undefined,
            payoutPerMin: undefined,
            viralBoostEndsAt: undefined,
            lastHypeAt: now,
            hype: clamp(p.hype + 8, 0, 100),
          };
        }

        return {
          ...p,
          status: 'released' as const,
          releasedAt: now,
          qualityScore: quality,
          payoutEndsAt,
          payoutPerMin,
          viralBoostEndsAt: viral ? now + 3 * 60 * 1000 : undefined,
          lastHypeAt: now,
        };
      }

      if (p.status === 'released' && p.releasedAt) {
        const ageMin = (now - p.releasedAt) / 60000;
        const hype = clamp(p.hype * computeHypeDecayMultiplier({ hype: p.hype, ageMin }), 0, 100);
        if (p.payoutEndsAt && now <= p.payoutEndsAt && p.payoutPerMin) {
          const mult = p.viralBoostEndsAt && now <= p.viralBoostEndsAt ? 10 : 1;
          const featShare = p.featuringArtistId ? 0.85 : 1;
          const add = (p.payoutPerMin / 60) * mult * featShare * args.productionMult * macroMult * musiqueMult;
          cashDelta += add;
          earnedDelta += add;
        }
        if (p.syncEndsAt && now <= p.syncEndsAt && p.syncPayoutPerMin) {
          const add = (p.syncPayoutPerMin / 60) * args.productionMult * macroMult * musiqueMult;
          cashDelta += add;
          earnedDelta += add;
        }
        if (p.streamingRights.sold && p.nextStreamingPayoutAt && now >= p.nextStreamingPayoutAt) {
          const payout = Math.max(0, Math.floor((p.streamingRights.amount ?? 0) * args.productionMult * macroMult * musiqueMult));
          cashDelta += payout;
          earnedDelta += payout;
          return { ...p, hype, lastHypeAt: now, nextStreamingPayoutAt: now + 5 * 60 * 1000 };
        }
        return { ...p, hype, lastHypeAt: now };
      }
      return p;
    });

    let artistMarket = prev.artistMarket.filter((a) => a.availableUntil > now && !a.withdrawn);
    let draw = prev.draw;
    if (prev.totalEarned >= UNLOCKS.musique) {
      const n = namesRef.current;
      if (n && n.artistes.length > 0) {
        while (artistMarket.length < 6) {
          const { value, next } = drawWithoutReplacement({ list: n.artistes, prev: draw.artistes });
          draw = { ...draw, artistes: next };
          const notoriety = clamp(1 + Math.floor(Math.random() * 5), 1, 5) as 1 | 2 | 3 | 4 | 5;
          const styles = ['Rap', 'Pop', 'Rock', 'Électro', 'Variété', 'Jazz'];
          const style = styles[Math.floor(Math.random() * styles.length)] ?? 'Pop';
          const signatureFee = Math.floor(450 * notoriety * notoriety);
          const baseSalaryPerMonth = Math.floor(120 * notoriety * notoriety);
          artistMarket = [
            ...artistMarket,
            {
              id: createId('artist_offer'),
              name: value,
              notoriety,
              style,
              signatureFee,
              baseSalaryPerMonth,
              availableUntil: now + 10 * 60 * 1000,
              refusals: 0,
              withdrawn: false,
            },
          ];
        }
      }
    }

    let studioMarket = prev.studioMarket.filter((s) => s.availableUntil > now);
    let studios = prev.studios.map((s) => {
      if (!s.buyoutOffer) return s;
      if (now >= s.buyoutOffer.expiresAt) return { ...s, buyoutOffer: undefined };
      return s;
    });
    if (prev.totalEarned >= UNLOCKS.jv) {
      const n = namesRef.current;
      if (n && n.studios_jv.length > 0) {
        while (studioMarket.length < 4) {
          const { value, next } = drawWithoutReplacement({ list: n.studios_jv, prev: draw.studios_jv });
          draw = { ...draw, studios_jv: next };
          const roll = Math.random();
          const tier = roll < 0.35 ? 'inconnu' : roll < 0.7 ? 'inde' : roll < 0.92 ? 'aa' : 'aaa';
          const price = tier === 'inconnu' ? 120_000 : tier === 'inde' ? 550_000 : tier === 'aa' ? 2_200_000 : 8_500_000;
          studioMarket = [
            ...studioMarket,
            { id: createId('studio_offer'), name: value, tier, price, availableUntil: now + 10 * 60 * 1000 },
          ];
        }
      }
    }

    const seriesProducingCount = prev.seriesProjects.filter((x) => x.status === 'producing').length;
    const seriesReleaseGenreCounts = new Map<string, number>();
    for (const p of prev.seriesProjects) {
      if (p.status !== 'producing') continue;
      if (now < p.productionEndsAt) continue;
      seriesReleaseGenreCounts.set(p.genre, (seriesReleaseGenreCounts.get(p.genre) ?? 0) + 1);
    }
    const seriesProjects = prev.seriesProjects.map((p) => {
      const renewalExpired = p.renewalOffer && now >= p.renewalOffer.expiresAt;
      if (renewalExpired) p = { ...p, renewalOffer: null, renewalOffered: false };

      if (p.status === 'producing' && now >= p.productionEndsAt) {
        const overload = seriesProducingCount >= 3 ? 0.78 : 1;
        const quality = Math.floor(clamp((40 + p.showrunner.level * 10 + Math.random() * 30) * overload, 0, 100));
        const season = p.season ?? 1;
        const genreSim = seriesReleaseGenreCounts.get(p.genre) ?? 1;
        const competitionMult = genreSim > 1 ? 0.5 : 1;
        if (season === 1 && quality < 40) {
          repSeriesDelta -= 3;
          const seasonBudget = p.budgetPerEpisode * p.episodesPerSeason;
          const remainingBudget = Math.max(0, (p.seasonsPlanned - 1) * seasonBudget);
          if (remainingBudget > 0) cashDelta -= remainingBudget;
          return {
            ...p,
            status: 'released' as const,
            releasedAt: now,
            qualityScore: quality,
            cancelled: true,
            renewalOffer: null,
            renewalOffered: false,
            lastHypeAt: now,
            hype: 0,
          };
        }

        repSeriesDelta += quality >= 80 ? 2 : quality < 30 ? -3 : 0;
        const canOfferRenewal = quality >= 65 && (p.season ?? 1) < p.seasonsPlanned;
        const offer =
          canOfferRenewal && !p.renewalOffer
            ? {
                offeredAt: now,
                expiresAt: now + 8 * 60 * 1000,
                deal: initDeal({ buyers: makeBuyers({ names: ['PrimeVision', 'ArcLight', 'CinéStream', 'MégaVision'], min: 1, max: 1 }) }),
              }
            : p.renewalOffer ?? null;
        if (offer && !p.renewalOffered) toast('Offre de renouvellement', { description: 'Temps limité.' });
        return {
          ...p,
          status: 'released' as const,
          releasedAt: now,
          qualityScore: quality,
          renewalOffer: offer,
          renewalOffered: Boolean(offer),
          lastHypeAt: now,
          hype: clamp((p.hype + (p.releaseStrategy === 'territoires' ? 2 : 5)) * competitionMult, 0, 100),
        };
      }

      if (p.status === 'released' && p.releasedAt) {
        const ageMin = (now - p.releasedAt) / 60000;
        const hype = clamp(p.hype * computeHypeDecayMultiplier({ hype: p.hype, ageMin }), 0, 100);
        return { ...p, hype, lastHypeAt: now };
      }
      return p;
    });

    const liveProjects = prev.liveProjects.map((p) => {
      const venue = p.venue ?? 'moyenne';
      const baseCap = venue === 'petite' ? 150 : venue === 'moyenne' ? 400 : venue === 'grande' ? 1200 : 5000;
      const cap = p.kind === 'festival' ? Math.floor(baseCap * 1.8) : baseCap;
      const cities = Number.isFinite(p.cities) ? Math.max(1, Math.floor(p.cities)) : 1;
      const overbookPenalty = prev.liveProjects.filter((x) => x.status === 'active').length >= 3 ? 0.85 : 1;

      if (p.status === 'active' && now >= p.endsAt) {
        const hypePct = clamp(p.hype, 0, 100) / 100;
        const ticketBase = 25 + clamp(prev.reputation.live / 6, 0, 14);
        const fill = clamp(0.35 + hypePct * 0.55, 0.35, 0.95);
        const grossTickets = cap * ticketBase * fill * (p.kind === 'tour_multi' ? clamp(cities, 3, 5) : 1);
        const merch = p.kind === 'corporatif' ? 0 : grossTickets * 0.15;
        const guaranteed = p.kind === 'corporatif' ? grossTickets * 0.9 : grossTickets + merch;

        const weatherCancel = Boolean(p.outdoor) && (p.kind === 'concert' || p.kind === 'festival') && Math.random() < 0.08;
        const artistAbsent = (p.kind === 'concert' || p.kind === 'festival' || p.kind === 'tour_multi') && Math.random() < 0.06;
        const gross = weatherCancel ? guaranteed * 0.2 : artistAbsent ? guaranteed * 0.6 : guaranteed;
        const revenue = Math.floor(gross * args.productionMult * macroMult * overbookPenalty * liveMult);

        cashDelta += revenue;
        earnedDelta += Math.max(0, revenue);

        const cost = Number.isFinite(p.cost) ? p.cost : 0;
        repLiveDelta += revenue >= cost ? 2 : -2;
        if (p.kind === 'ceremonie') repLiveDelta += 3;

        return {
          ...p,
          status: 'done' as const,
          revenue,
          hype: clamp(weatherCancel || artistAbsent ? 0 : p.hype, 0, 100),
          lastHypeAt: now,
          nextAnnualAt: p.annual ? (p.nextAnnualAt ?? now + 30 * 60 * 1000) : p.nextAnnualAt,
        };
      }

      if (p.status === 'done') {
        const ageMin = (now - p.endsAt) / 60000;
        const hype = clamp(p.hype * computeHypeDecayMultiplier({ hype: p.hype, ageMin }), 0, 100);
        let nextAnnualAt = p.nextAnnualAt;
        if (p.annual && nextAnnualAt && now >= nextAnnualAt && Number.isFinite(p.revenue) && (p.revenue ?? 0) > 0) {
          const payout = Math.floor((p.revenue ?? 0) * 0.25 * args.productionMult * macroMult * liveMult);
          cashDelta += payout;
          earnedDelta += payout;
          nextAnnualAt = now + 30 * 60 * 1000;
        }
        return { ...p, hype, lastHypeAt: now, nextAnnualAt };
      }

      return p;
    });

    const gameProjects = prev.gameProjects.map((p) => {
      if (prev.event.active && prev.event.eventId === 'studio_strike' && p.status === 'producing') {
        return { ...p, productionEndsAt: p.productionEndsAt + 1000 };
      }
      if (p.status === 'producing' && now >= p.productionEndsAt) {
        const budgetScore = clamp(Math.log10(Math.max(2000, p.devBudget + p.marketingBudget)) / 7, 0, 1);
        const quality = Math.floor(clamp(30 + budgetScore * 40 + Math.random() * 30, 0, 100));
        repJvDelta += quality >= 80 ? 2 : quality < 30 ? -4 : 0;
        const similar = Math.random() < 0.1;
        const bug = Math.random() < (quality < 55 ? 0.18 : 0.06);
        if (similar) toast('Un jeu similaire sort en même temps', { description: 'Hype divisée.' });
        if (bug) {
          repJvDelta -= 20;
          toast('Bug majeur à la sortie', { description: 'Ventes divisées pendant 5 min.' });
        }
        if (studios.length > 0 && !studios[0]!.buyoutOffer && Math.random() < 0.12) {
          const amount = Math.floor((p.devBudget + p.marketingBudget) * (0.85 + quality / 160));
          studios = [{ ...studios[0]!, buyoutOffer: { amount, expiresAt: now + 5 * 60 * 1000 } }, ...studios.slice(1)];
          toast('Offre de rachat pour ton studio', { description: 'Temps limité.' });
        }

        if (p.model === 'pay_once') {
          const cash = Math.floor((p.devBudget + p.marketingBudget) * (0.55 + quality / 180) * (p.hype / 100) * (bug ? 0.5 : 1));
          const add = cash * args.productionMult * macroMult * jvMult;
          cashDelta += add;
          earnedDelta += add;
          return {
            ...p,
            status: 'released' as const,
            releasedAt: now,
            qualityScore: quality,
            lastHypeAt: now,
            hype: clamp(p.hype * (similar ? 0.5 : 1), 0, 100),
            bugUntil: bug ? now + 5 * 60 * 1000 : null,
          };
        }

        const payoutEndsAt = now + (p.model === 'f2p' ? 60 : 45) * 60 * 1000;
        const payoutPerMin = Math.max(1, Math.floor((p.model === 'f2p' ? 520 : 360) * (quality / 100) * (p.hype / 100)));
        return {
          ...p,
          status: 'released' as const,
          releasedAt: now,
          qualityScore: quality,
          payoutEndsAt,
          payoutPerMin,
          lastHypeAt: now,
          hype: clamp(p.hype * (similar ? 0.5 : 1), 0, 100),
          bugUntil: bug ? now + 5 * 60 * 1000 : null,
        };
      }

      if (p.status === 'released' && p.releasedAt) {
        const ageMin = (now - p.releasedAt) / 60000;
        const hype = clamp(p.hype * computeHypeDecayMultiplier({ hype: p.hype, ageMin }), 0, 100);
        const bugMult = p.bugUntil && now < p.bugUntil ? 0.5 : 1;

        let port = p.port;
        if (port && !port.done && now >= port.endsAt) {
          const cash = Math.floor((p.devBudget + p.marketingBudget) * 0.22 * ((p.qualityScore ?? 50) / 100) * (p.hype / 100));
          const add = cash * args.productionMult * macroMult * jvMult;
          cashDelta += add;
          earnedDelta += add;
          port = { ...port, done: true };
          toast('Port console terminé', { description: `${port.platform} débloqué.` });
        }

        const portMult = port?.done ? 1.12 : 1;
        if (p.payoutEndsAt && now <= p.payoutEndsAt && p.payoutPerMin) {
          const add = (p.payoutPerMin / 60) * bugMult * portMult * args.productionMult * macroMult * jvMult;
          cashDelta += add;
          earnedDelta += add;
        }
        return { ...p, hype, lastHypeAt: now, port };
      }
      return p;
    });

    let platform = prev.platform;
    if (platform.unlocked) {
      const hosting =
        (platform.hostingCostPerMin / 60) *
        (prev.event.active && prev.event.title === 'Crise économique' ? 1.1 : 1) *
        (prev.buyouts?.TECHSTREAM ? 0.9 : 1);
      cashDelta -= hosting;

      const offlineUntil = platform.offlineUntil ?? null;
      const isOffline = offlineUntil !== null && now < offlineUntil;

      const releasedFilms = films.filter((f) => f.status === 'released').slice(0, 18);
      const releasedSeries = seriesProjects.filter((p) => p.status === 'released' && !p.cancelled).slice(0, 12);
      const catalogScore =
        releasedFilms.reduce((acc, f) => acc + ((f.qualityScore ?? 50) / 100) * (f.hype / 100), 0) +
        releasedSeries.reduce((acc, p) => acc + ((p.qualityScore ?? 50) / 100) * (p.hype / 100), 0);
      const contentCount = releasedFilms.length + releasedSeries.length;
      const baseTarget = Math.floor(50 + catalogScore * 240 + contentCount * 28);
      const target = contentCount < 2 ? Math.floor(baseTarget * 0.45) : baseTarget;
      const diff = target - platform.subscribers;
      const step = diff === 0 ? 0 : Math.sign(diff) * Math.min(Math.abs(diff), Math.max(1, Math.floor(Math.abs(diff) * 0.006)));
      const nextSubscribers = Math.max(0, platform.subscribers + step);

      if (nextSubscribers !== platform.subscribers) platform = { ...platform, subscribers: nextSubscribers };
      if (offlineUntil !== null && now >= offlineUntil && platform.offlineUntil) platform = { ...platform, offlineUntil: null };

      if (!isOffline && now >= platform.nextPayoutAt) {
        const payout = platform.subscribers * 0.6 * args.productionMult * macroMult * seriesMult;
        cashDelta += payout;
        earnedDelta += payout;
        platform = { ...platform, nextPayoutAt: now + 5 * 60 * 1000 };
      }
    }

    let agent = prev.agent;
    if (agent.active && agent.expiresAt && now >= agent.expiresAt) {
      agent = scheduleNextAgent({ ...agent, active: false, offerId: undefined, title: undefined, description: undefined, createdAt: undefined, expiresAt: undefined }, now, prev.prestige as ApexPrestigeState);
    }
    if (!agent.active && now >= agent.nextAt) {
      const offer = pickAgentOffer(prev);
      agent = {
        ...agent,
        active: true,
        offerId: offer.id,
        title: offer.title,
        description: offer.description,
        createdAt: now,
        expiresAt: now + 90 * 1000,
      };
      toast(offer.title, { description: '90 secondes pour décider.' });
    }

    let event = prev.event;
    if (event.active && event.endsAt && now >= event.endsAt) {
      event = { active: false, nextAt: now + (5 * 60 + Math.floor(Math.random() * 7 * 60)) * 1000 };
    }
    if (!event.active && now >= event.nextAt) {
      const picked = pickRandomEvent();
      event = {
        active: true,
        eventId: picked.id,
        title: picked.title,
        description: picked.description,
        kind: picked.kind,
        startedAt: now,
        endsAt: now + picked.durationMs,
        nextAt: now + (5 * 60 + Math.floor(Math.random() * 7 * 60)) * 1000,
        choice: picked.choice,
      };
      if (picked.id === 'bull_run' || picked.id === 'crypto_crash' || picked.id === 'doge_moon') {
        const mult = picked.id === 'bull_run' ? 1.3 : picked.id === 'crypto_crash' ? 0.6 : 5;
        const coins = { ...cryptoState.coins };
        for (const [id, c] of Object.entries(coins) as Array<[ApexCryptoId, (typeof coins)[ApexCryptoId]]>) {
          if (id === 'ApexStable') continue;
          if (picked.id === 'doge_moon' && id !== 'DogeStar') continue;
          const nextPrice = clamp(c.price * mult, 0.0001, Number.MAX_SAFE_INTEGER);
          coins[id] = { ...c, price: nextPrice, history: [...c.history, nextPrice].slice(-300) };
        }
        cryptoState = { ...cryptoState, coins };
      }
      if (picked.id === 'crypto_winter') {
        const coins = { ...cryptoState.coins };
        for (const [id, c] of Object.entries(coins) as Array<[ApexCryptoId, (typeof coins)[ApexCryptoId]]>) {
          if (id === 'ApexStable') continue;
          const nextPrice = clamp(c.price * 0.7, 0.0001, Number.MAX_SAFE_INTEGER);
          coins[id] = { ...c, price: nextPrice, history: [...c.history, nextPrice].slice(-300) };
        }
        cryptoState = { ...cryptoState, coins };
      }
      if (picked.id === 'regulation') {
        const ids: ApexCryptoId[] = ['BitApex', 'EtherGlobe', 'DogeStar'];
        const id = ids[Math.floor(Math.random() * ids.length)] ?? 'EtherGlobe';
        const coin = cryptoState.coins[id];
        if (coin) {
          const coins = { ...cryptoState.coins, [id]: { ...coin, suspendedUntil: now + 10 * 60 * 1000 } };
          cryptoState = { ...cryptoState, coins };
        }
      }
      if (picked.id === 'good_press') {
        repCinemaDelta += 5;
        repMusicDelta += 5;
        repSeriesDelta += 5;
        repLiveDelta += 5;
        repJvDelta += 5;
      }
      if (picked.id === 'scandal_industry') {
        repCinemaDelta -= 5;
        repMusicDelta -= 5;
        repSeriesDelta -= 5;
        repLiveDelta -= 5;
        repJvDelta -= 5;
      }
      if (picked.id === 'festival_viral') {
        musicProjects = musicProjects.map((p) => (p.status === 'released' ? { ...p, hype: clamp(p.hype + 20, 0, 100), lastHypeAt: now } : p));
      }
      if (picked.id === 'boom_subs') {
        if (platform.unlocked) {
          platform = { ...platform, subscribers: Math.max(0, Math.floor(platform.subscribers * 1.3)) };
        }
      }
      if (picked.id === 'cyberattaque') {
        if (platform.unlocked) {
          platform = {
            ...platform,
            subscribers: Math.max(0, Math.floor(platform.subscribers * 0.7)),
            offlineUntil: now + 2 * 60 * 1000,
          };
        }
      }
      if (picked.id === 'bad_buzz') {
        if (artists.length > 0) {
          const idx = event.startedAt ? Math.abs(event.startedAt) % artists.length : 0;
          const a = artists[idx];
          if (a) {
            artists[idx] = { ...a, notorietyBoost: (a.notorietyBoost ?? 0) - 30 };
            musicProjects = musicProjects.map((p) => {
              if (p.artistId !== a.id) return p;
              if (!p.streamingRights.sold) return p;
              const amount = p.streamingRights.amount ?? 0;
              if (amount <= 0) return p;
              return { ...p, streamingRights: { ...p.streamingRights, amount: Math.floor(amount * 0.85) } };
            });
          }
        }
      }
      if (picked.id === 'conflit_artistes') {
        if (artists.length >= 2) {
          const i1 = event.startedAt ? Math.abs(event.startedAt) % artists.length : 0;
          const i2 = (i1 + 1 + Math.floor(Math.random() * (artists.length - 1))) % artists.length;
          const a1 = artists[i1];
          const a2 = artists[i2];
          if (a1) artists[i1] = { ...a1, notorietyBoost: (a1.notorietyBoost ?? 0) - 10 };
          if (a2) artists[i2] = { ...a2, notorietyBoost: (a2.notorietyBoost ?? 0) - 10 };
        }
      }
      if (picked.id === 'record_stock') {
        const ids: ApexStockId[] = ['CINEGLOBE', 'SOUNDWAVE', 'PRIMEVISION', 'LIVENATION', 'PIXELFORGE', 'APEXMEDIA', 'TECHSTREAM', 'GLOBALADS'];
        const id = ids[Math.floor(Math.random() * ids.length)] ?? 'APEXMEDIA';
        const prevPrice = stocksState.prices[id] ?? 10;
        const nextPrice = clamp(prevPrice * 1.2, 0.01, Number.MAX_SAFE_INTEGER);
        stocksState = {
          ...stocksState,
          prices: { ...stocksState.prices, [id]: nextPrice },
          history: { ...stocksState.history, [id]: [...(stocksState.history[id] ?? []), nextPrice].slice(-300) },
        };
      }
      toast(picked.title, { description: picked.kind === 'choice' ? 'Décision requise.' : picked.description });
    }

    const nextCash = clamp(prev.cash + cashDelta, 0, Number.MAX_SAFE_INTEGER);
    const nextEarned = prev.totalEarned + Math.max(0, earnedDelta);
    const nextRep = {
      cinema: clamp(prev.reputation.cinema + repCinemaDelta, 0, 100),
      musique: clamp(prev.reputation.musique + repMusicDelta, 0, 100),
      series: clamp(prev.reputation.series + repSeriesDelta, 0, 100),
      live: clamp(prev.reputation.live + repLiveDelta, 0, 100),
      jv: clamp(prev.reputation.jv + repJvDelta, 0, 100),
    };
    const marketAnalysis = prev.marketAnalysis && now > prev.marketAnalysis.expiresAt ? null : prev.marketAnalysis;

    return {
      ...prev,
      cash: nextCash,
      totalEarned: nextEarned,
      lastActionAt: now,
      draw,
      films,
      artists,
      artistMarket,
      musicProjects,
      seriesProjects,
      liveProjects,
      studios,
      studioMarket,
      gameProjects,
      crypto: cryptoState,
      stocks: stocksState,
      marketAnalysis,
      platform,
      agent,
      event,
      reputation: nextRep,
    };

    function buildStockSentiment(s: ApexSave): Partial<Record<ApexStockId, number>> {
      const cinema = s.films.filter((f) => f.status === 'released').slice(0, 2).reduce((acc, f) => acc + ((f.qualityScore ?? 50) / 100) * (f.hype / 100), 0);
      const musique = s.musicProjects.filter((p) => p.status === 'released').slice(0, 2).reduce((acc, p) => acc + ((p.qualityScore ?? 50) / 100) * (p.hype / 100), 0);
      const series = s.seriesProjects.filter((p) => p.status === 'released').slice(0, 1).reduce((acc, p) => acc + ((p.qualityScore ?? 50) / 100) * (p.hype / 100), 0);
      const live = s.liveProjects.filter((p) => p.status === 'done').slice(0, 1).reduce((acc, p) => acc + (p.hype / 100), 0);
      const jv = s.gameProjects.filter((p) => p.status === 'released').slice(0, 1).reduce((acc, p) => acc + ((p.qualityScore ?? 50) / 100) * (p.hype / 100), 0);
      const global = clamp(computeGlobalRep(s.reputation) / 100, 0, 1);

      return {
        CINEGLOBE: clamp(cinema - 0.4, -1, 1),
        SOUNDWAVE: clamp(musique - 0.35, -1, 1),
        PRIMEVISION: clamp(series - 0.35, -1, 1),
        LIVENATION: clamp(live - 0.25, -1, 1),
        PIXELFORGE: clamp(jv - 0.35, -1, 1),
        APEXMEDIA: clamp(global - 0.5, -1, 1),
        TECHSTREAM: 0.05,
        GLOBALADS: clamp((cinema + musique + series) / 3 - 0.4, -1, 1),
      };
    }

    function pickRandomEvent(): { id: string; title: string; description: string; kind: 'positive' | 'negative' | 'choice'; durationMs: number; choice?: { aLabel: string; bLabel: string } } {
      const events = [
        { id: 'golden', title: 'Golden Age of Cinema', description: 'Revenus cinéma ×1.5 pendant 5 min', kind: 'positive' as const, durationMs: 5 * 60 * 1000 },
        { id: 'crise', title: 'Crise économique', description: 'Tous les revenus -20% pendant 5 min', kind: 'negative' as const, durationMs: 5 * 60 * 1000 },
        { id: 'good_press', title: 'Bonne presse', description: 'Réputation globale +5', kind: 'positive' as const, durationMs: 2 * 60 * 1000 },
        { id: 'scandal_industry', title: 'Scandale industrie', description: 'Réputation globale -5', kind: 'negative' as const, durationMs: 2 * 60 * 1000 },
        { id: 'hollywood_strike', title: 'Grève à Hollywood', description: 'Tous les projets cinéma sont suspendus 3 min', kind: 'negative' as const, durationMs: 3 * 60 * 1000 },
        { id: 'doge_moon', title: 'DogeStar moon', description: 'Valeur ×5 pendant 90 secondes', kind: 'positive' as const, durationMs: 90 * 1000 },
        { id: 'bull_run', title: 'Bull run', description: 'Toutes les cryptos +30% pendant 3 min', kind: 'positive' as const, durationMs: 3 * 60 * 1000 },
        { id: 'crypto_crash', title: 'Crypto crash', description: 'Toutes les cryptos -40% en 30s', kind: 'negative' as const, durationMs: 30 * 1000 },
        { id: 'crypto_winter', title: 'Crypto winter', description: 'Toutes les cryptos -30% pendant 4 min', kind: 'negative' as const, durationMs: 4 * 60 * 1000 },
        { id: 'regulation', title: 'Régulation fictive', description: 'Une crypto est suspendue 10 min', kind: 'negative' as const, durationMs: 10 * 60 * 1000 },
        { id: 'whale', title: 'Whale event', description: 'Un acteur achète/vend massivement', kind: 'choice' as const, durationMs: 90 * 1000, choice: { aLabel: 'Acheteur', bLabel: 'Vendeur' } },
        { id: 'festival_viral', title: 'Festival viral', description: 'Hype de tous les artistes actifs +20 pendant 3 min', kind: 'positive' as const, durationMs: 3 * 60 * 1000 },
        { id: 'boom_subs', title: 'Boom des abonnements', description: 'Plateforme streaming +30% abonnés', kind: 'positive' as const, durationMs: 2 * 60 * 1000 },
        { id: 'cyberattaque', title: 'Cyberattaque', description: 'Plateforme offline 2 min, -30% abonnés temporairement', kind: 'negative' as const, durationMs: 2 * 60 * 1000 },
        { id: 'record_stock', title: 'Résultats record', description: 'Cours bourse d’un secteur +20%', kind: 'positive' as const, durationMs: 2 * 60 * 1000 },
        { id: 'bad_buzz', title: 'Bad buzz', description: 'Un artiste prend un bad buzz: notoriété -30', kind: 'negative' as const, durationMs: 3 * 60 * 1000 },
        { id: 'conflit_artistes', title: 'Conflit d’artistes', description: 'Deux artistes se clashent: -10 notoriété', kind: 'negative' as const, durationMs: 2 * 60 * 1000 },
        { id: 'studio_strike', title: 'Grève en studio', description: 'Production JV suspendue 5 min', kind: 'negative' as const, durationMs: 5 * 60 * 1000 },
        { id: 'partenariat', title: 'Offre de partenariat concurrent', description: 'Accepter = risque partagé / Refuser = solo', kind: 'choice' as const, durationMs: 2 * 60 * 1000, choice: { aLabel: 'Accepter', bLabel: 'Refuser' } },
        {
          id: 'journaliste',
          title: 'Journaliste veut faire un reportage',
          description: 'Accepter = réputation +10 mais concurrents informés / Refuser = statu quo',
          kind: 'choice' as const,
          durationMs: 2 * 60 * 1000,
          choice: { aLabel: 'Accepter', bLabel: 'Refuser' },
        },
      ];
      return events[Math.floor(Math.random() * events.length)] ?? events[0]!;
    }
  };

  const cinematicFormDefaults = useMemo(() => {
    const directorSpecialty = CINEMA_GENRES[Math.floor(Math.random() * CINEMA_GENRES.length)] ?? 'Action';
    return {
      genre: 'Action' as ApexCinemaGenre,
      productionBudget: 2000,
      marketingPercent: 25,
      premiere: false,
      directorLevel: 2 as 1 | 2 | 3 | 4 | 5,
      directorName: 'Réalisateur inconnu',
      directorSpecialty,
      cast: [] as string[],
    };
  }, []);

  const [cinemaForm, setCinemaForm] = useState(cinematicFormDefaults);
  const [musicForm, setMusicForm] = useState<{
    kind: ApexMusicProject['kind'];
    artistId: string;
    featuringArtistId: string;
    budget: number;
    marketingBudget: number;
    tourVenue: 'petite' | 'moyenne' | 'grande' | 'stade';
    tourCities: number;
  }>({
    kind: 'single',
    artistId: '',
    featuringArtistId: '',
    budget: 800,
    marketingBudget: 0,
    tourVenue: 'moyenne',
    tourCities: 3,
  });
  const [seriesForm, setSeriesForm] = useState<{
    genre: string;
    seasonsPlanned: number;
    episodesPerSeason: 6 | 12 | 24;
    budgetPerEpisode: number;
    showrunnerLevel: 1 | 2 | 3 | 4 | 5;
    releaseStrategy: 'mondiale' | 'territoires';
  }>({
    genre: 'Drame',
    seasonsPlanned: 1,
    episodesPerSeason: 6,
    budgetPerEpisode: 2000,
    showrunnerLevel: 2,
    releaseStrategy: 'mondiale',
  });
  const [gameForm, setGameForm] = useState<{ genre: ApexGameGenre; model: 'pay_once' | 'f2p' | 'abonnement'; devBudget: number; marketingBudget: number }>({
    genre: 'RPG',
    model: 'pay_once',
    devBudget: 50_000,
    marketingBudget: 10_000,
  });
  const [liveForm, setLiveForm] = useState<{
    kind: ApexLiveProject['kind'];
    venue: ApexLiveProject['venue'];
    outdoor: boolean;
    cities: number;
    artistIds: string[];
  }>({
    kind: 'concert',
    venue: 'moyenne',
    outdoor: false,
    cities: 3,
    artistIds: [],
  });

  useEffect(() => {
    if (musicForm.artistId) return;
    if (data.artists.length === 0) return;
    setMusicForm((f) => ({ ...f, artistId: data.artists[0]!.id }));
  }, [data.artists, musicForm.artistId]);

  useEffect(() => {
    if (musicForm.kind !== 'single') return;
    if (musicForm.featuringArtistId) return;
    if (data.artists.length < 2) return;
    const alt = data.artists.find((a) => a.id !== musicForm.artistId);
    if (!alt) return;
    setMusicForm((f) => ({ ...f, featuringArtistId: alt.id }));
  }, [data.artists, musicForm.artistId, musicForm.featuringArtistId, musicForm.kind]);

  useEffect(() => {
    if (liveForm.artistIds.length > 0) return;
    if (data.artists.length === 0) return;
    setLiveForm((f) => ({ ...f, artistIds: [data.artists[0]!.id] }));
  }, [data.artists, liveForm.artistIds.length]);

  useEffect(() => {
    if (!names) return;
    if (cinemaForm.directorName !== 'Réalisateur inconnu') return;

    setData((prev) => {
      const { value, next } = drawWithoutReplacement({ list: names.realisateurs, prev: prev.draw.realisateurs });
      const specialty = CINEMA_GENRES[Math.floor(Math.random() * CINEMA_GENRES.length)] ?? 'Action';
      setCinemaForm((f) => ({ ...f, directorName: value, directorSpecialty: specialty }));
      return { ...prev, draw: { ...prev.draw, realisateurs: next } };
    });
  }, [cinemaForm.directorName, names, setData]);

  const addCastMember = () => {
    if (!names) return;
    setData((prev) => {
      const { value, next } = drawWithoutReplacement({ list: names.acteurs, prev: prev.draw.acteurs });
      setCinemaForm((f) => ({ ...f, cast: [...f.cast, value].slice(0, 5) }));
      return { ...prev, draw: { ...prev.draw, acteurs: next } };
    });
  };

  const removeCastMember = (name: string) => {
    setCinemaForm((f) => ({ ...f, cast: f.cast.filter((c) => c !== name) }));
  };

  const launchPlatform = () => {
    setData((prev) => {
      if (!unlocked.platform) return prev;
      if (prev.platform.unlocked) return prev;
      if (prev.cash < 500_000) return prev;
      toast.success('Plateforme lancée');
      return {
        ...prev,
        cash: prev.cash - 500_000,
        platform: { ...prev.platform, unlocked: true, launchedAt: prev.lastActionAt, subscribers: 50, nextPayoutAt: prev.lastActionAt + 5 * 60 * 1000 },
      };
    });
  };

  const makeFestivalAnnual = (projectId: string) => {
    setData((prev) => {
      const project = prev.liveProjects.find((p) => p.id === projectId);
      if (!project) return prev;
      if (project.kind !== 'festival') return prev;
      if (project.status !== 'done') return prev;
      if (project.annual) return prev;
      toast.success('Festival annuel activé');
      return {
        ...prev,
        liveProjects: prev.liveProjects.map((p) => (p.id === projectId ? { ...p, annual: true, nextAnnualAt: prev.lastActionAt + 30 * 60 * 1000 } : p)),
      };
    });
  };

  const startSyncPlacement = (projectId: string) => {
    setData((prev) => {
      const project = prev.musicProjects.find((p) => p.id === projectId);
      if (!project || project.status !== 'released') return prev;
      if (project.syncEndsAt && prev.lastActionAt <= project.syncEndsAt) return prev;
      const film = prev.films.find((f) => f.status === 'released');
      const series = prev.seriesProjects.find((s) => s.status === 'released');
      if (!film && !series) return prev;

      const base = 60 + Math.floor((project.qualityScore ?? 50) * 2) + Math.floor(project.hype * 1.2);
      const perMin = Math.max(20, Math.floor(base));
      toast.success('Placement sync activé');
      return {
        ...prev,
        musicProjects: prev.musicProjects.map((p) =>
          p.id === projectId
            ? { ...p, syncEndsAt: prev.lastActionAt + 45 * 60 * 1000, syncPayoutPerMin: perMin, hype: clamp(p.hype + 6, 0, 100) }
            : p
        ),
      };
    });
  };

  const tryBuyCrypto = (coinId: ApexCryptoId, amount: number) => {
    setData((prev) => {
      if (!unlocked.crypto) return prev;
      if (prev.cash < amount) return prev;
      const coin = prev.crypto.coins[coinId];
      if (coin?.suspendedUntil && prev.lastActionAt < coin.suspendedUntil) return prev;
      const { next, spent } = buyCrypto({ state: prev.crypto, coinId, cash: amount });
      return { ...prev, cash: prev.cash - spent, crypto: next };
    });
  };

  const trySellCrypto = (coinId: ApexCryptoId, pct: number) => {
    setData((prev) => {
      if (!unlocked.crypto) return prev;
      const coin = prev.crypto.coins[coinId];
      if (!coin || coin.holdings <= 0) return prev;
      if (coin.suspendedUntil && prev.lastActionAt < coin.suspendedUntil) return prev;
      const units = coin.holdings * clamp(pct, 0, 1);
      const { next, gained } = sellCrypto({ state: prev.crypto, coinId, units });
      return { ...prev, cash: prev.cash + gained, totalEarned: prev.totalEarned + gained, crypto: next };
    });
  };

  const buyMining = (coinId: ApexCryptoId) => {
    setData((prev) => {
      if (!unlocked.crypto) return prev;
      const coin = prev.crypto.coins[coinId];
      if (!coin) return prev;
      if (coin.suspendedUntil && prev.lastActionAt < coin.suspendedUntil) return prev;
      const cost = 5000;
      if (prev.cash < cost) return prev;
      toast.success('Mining installé');
      return {
        ...prev,
        cash: prev.cash - cost,
        crypto: {
          ...prev.crypto,
          coins: {
            ...prev.crypto.coins,
            [coinId]: { ...coin, miningRatePerMin: coin.miningRatePerMin + 0.02 },
          },
        },
      };
    });
  };

  const buyStudioOffer = (offerId: string) => {
    setData((prev) => {
      if (!unlocked.jv) return prev;
      const offer = prev.studioMarket.find((o) => o.id === offerId);
      if (!offer || offer.availableUntil <= prev.lastActionAt) return prev;
      if (prev.cash < offer.price) return prev;
      toast.success('Studio acquis');
      return {
        ...prev,
        cash: prev.cash - offer.price,
        studios: [{ id: createId('studio'), name: offer.name, tier: offer.tier, purchasedAt: prev.lastActionAt }, ...prev.studios],
        studioMarket: prev.studioMarket.filter((o) => o.id !== offer.id),
      };
    });
  };

  const createStudio = () => {
    setData((prev) => {
      if (!unlocked.jv) return prev;
      const cost = 3_000_000;
      if (prev.cash < cost) return prev;
      toast.success('Studio créé');
      return {
        ...prev,
        cash: prev.cash - cost,
        studios: [{ id: createId('studio'), name: 'Studio Apex', tier: 'inde', purchasedAt: prev.lastActionAt }, ...prev.studios],
      };
    });
  };

  const acceptStudioBuyout = (studioId: string) => {
    setData((prev) => {
      const studio = prev.studios.find((s) => s.id === studioId);
      if (!studio?.buyoutOffer) return prev;
      if (prev.lastActionAt >= studio.buyoutOffer.expiresAt) return prev;
      toast.success('Rachat accepté');
      return {
        ...prev,
        cash: prev.cash + studio.buyoutOffer.amount,
        totalEarned: prev.totalEarned + studio.buyoutOffer.amount,
        studios: prev.studios.filter((s) => s.id !== studioId),
      };
    });
  };

  const tryBuyStock = (id: ApexStockId, amount: number) => {
    setData((prev) => {
      if (!unlocked.bourse) return prev;
      if (prev.cash < amount) return prev;
      const { next, spent } = buyStock(prev.stocks, id, amount);
      return { ...prev, cash: prev.cash - spent, stocks: next };
    });
  };

  const trySellStock = (id: ApexStockId, pct: number) => {
    setData((prev) => {
      if (!unlocked.bourse) return prev;
      const held = prev.stocks.shares[id] ?? 0;
      if (held <= 0) return prev;
      const shares = held * clamp(pct, 0, 1);
      const { next, gained } = sellStock(prev.stocks, id, shares);
      return { ...prev, cash: prev.cash + gained, totalEarned: prev.totalEarned + gained, stocks: next };
    });
  };

  const runMarketAnalysis = (stockId: ApexStockId) => {
    setData((prev) => {
      if (!unlocked.bourse) return prev;
      const cost = 2500;
      if (prev.cash < cost) return prev;
      const hist = prev.stocks.history[stockId] ?? [];
      const a = hist[hist.length - 1] ?? prev.stocks.prices[stockId] ?? 0;
      const b = hist[hist.length - 12] ?? a;
      const slope = a - b;
      const bias = slope >= 0 ? 'haussière' : 'baissière';
      const uncertainty = Math.random() < 0.25 ? ' (incertain)' : '';
      const hint = `Tendance ${bias} probable${uncertainty}`;
      toast.success('Analyse achetée');
      return { ...prev, cash: prev.cash - cost, marketAnalysis: { stockId, hint, expiresAt: prev.lastActionAt + 3 * 60 * 1000 } };
    });
  };

  const buyoutStock = (stockId: ApexStockId) => {
    setData((prev) => {
      if (!unlocked.bourse) return prev;
      if (prev.buyouts?.[stockId]) return prev;
      if (prev.totalEarned < 50_000_000) return prev;
      const price = prev.stocks.prices[stockId] ?? 0;
      const cost = Math.floor(price * 1_000_000);
      if (prev.cash < cost) return prev;
      toast.success('Entreprise rachetée');
      return { ...prev, cash: prev.cash - cost, buyouts: { ...(prev.buyouts ?? {}), [stockId]: true } };
    });
  };

  const acceptAgent = () => {
    setData((prev) => {
      if (!prev.agent.active) return prev;
      toast.success('Deal accepté');
      const acceptCount = prev.agent.acceptCount + 1;
      const applied = applyAgentOffer(prev, prev.agent.offerId);
      const nextAgent = scheduleNextAgent(
        { ...applied.agent, active: false, refuseStreak: 0, acceptCount, offerId: undefined, title: undefined, description: undefined, createdAt: undefined, expiresAt: undefined },
        applied.lastActionAt,
        applied.prestige as ApexPrestigeState
      );
      return { ...applied, agent: nextAgent };
    });
    setAgentModalOpen(false);
  };

  const refuseAgent = () => {
    setData((prev) => {
      if (!prev.agent.active) return prev;
      toast('Deal refusé');
      const refuseStreak = prev.agent.refuseStreak + 1;
      const nextAgent = scheduleNextAgent(
        { ...prev.agent, active: false, refuseStreak, offerId: undefined, title: undefined, description: undefined, createdAt: undefined, expiresAt: undefined },
        prev.lastActionAt,
        prev.prestige as ApexPrestigeState
      );
      return { ...prev, agent: nextAgent };
    });
    setAgentModalOpen(false);
  };

  const resolveChoiceEvent = (choice: 'a' | 'b') => {
    setData((prev) => {
      if (!prev.event.active || prev.event.kind !== 'choice') return prev;
      if (prev.event.title === 'Journaliste veut faire un reportage') {
        if (choice === 'a') {
          toast.success('Réputation +10');
          return {
            ...prev,
            reputation: {
              ...prev.reputation,
              cinema: clamp(prev.reputation.cinema + 10, 0, 100),
              musique: clamp(prev.reputation.musique + 10, 0, 100),
              series: clamp(prev.reputation.series + 10, 0, 100),
              live: clamp(prev.reputation.live + 10, 0, 100),
              jv: clamp(prev.reputation.jv + 10, 0, 100),
            },
            event: { ...prev.event, active: false },
          };
        }
      }
      if (prev.event.eventId === 'partenariat') {
        if (choice === 'a') {
          toast.success('Partenariat signé (5 min)');
          return { ...prev, buffs: { ...prev.buffs, partnershipUntil: prev.lastActionAt + 5 * 60 * 1000 }, event: { ...prev.event, active: false } };
        }
        toast('Partenariat refusé');
        return { ...prev, event: { ...prev.event, active: false } };
      }
      if (prev.event.title === 'Whale event') {
        const ids: ApexCryptoId[] = ['BitApex', 'EtherGlobe', 'DogeStar'];
        const idx = prev.event.startedAt ? Math.abs(prev.event.startedAt) % ids.length : 0;
        const id = ids[idx] ?? 'DogeStar';
        toast.success(choice === 'a' ? `${id} boost` : `${id} dump`);
        const nextCrypto = applyExternalCryptoImpact({
          state: prev.crypto,
          coinId: id,
          direction: choice === 'a' ? 'buy' : 'sell',
          strength: 0.85,
          now: prev.lastActionAt,
        });
        return {
          ...prev,
          crypto: nextCrypto,
          event: { ...prev.event, active: false },
        };
      }
      return { ...prev, event: { ...prev.event, active: false } };
    });
    setChoiceEventModalOpen(false);
  };

  const prestigeAvailable = data.totalEarned >= 100_000_000;

  const doPrestige = () => {
    setData((prev) => {
      if (prev.totalEarned < 100_000_000) return prev;
      const sectorsUnlocked = [
        prev.totalEarned >= UNLOCKS.musique,
        prev.totalEarned >= UNLOCKS.series,
        prev.totalEarned >= UNLOCKS.live,
        prev.totalEarned >= UNLOCKS.crypto,
        prev.totalEarned >= UNLOCKS.jv,
        prev.totalEarned >= UNLOCKS.bourse,
      ].filter(Boolean).length;

      const starsGained = computeStarsFromRun({
        totalEarned: prev.totalEarned,
        sectorsUnlocked,
        achievementsUnlocked: prev.achievements.length,
      });

      const nextStars = prev.prestige.stars + starsGained;
      toast.success(`Prestige: +${starsGained} ★`);
      const nextPrestige = {
        ...prev.prestige,
        stars: nextStars,
        lifetimeStars: prev.prestige.lifetimeStars + starsGained,
        count: (prev.prestige.count ?? 0) + 1,
      };

      const startingCash = computePrestigeStartingCash(nextPrestige as ApexPrestigeState);
      const repStart = hasPrestigeUpgrade(nextPrestige as ApexPrestigeState, 'reputation_heritee') ? 10 : 0;
      const now = prev.lastActionAt;
      return {
        ...initialSave,
        cash: startingCash,
        totalEarned: startingCash,
        createdAt: now,
        lastActionAt: now,
        prestige: nextPrestige,
        reputation: { cinema: repStart, musique: repStart, series: repStart, live: repStart, jv: repStart },
      };
    });
  };

  const buyPrestigeUpgrade = (id: string) => {
    setData((prev) => {
      const upgrades = getPrestigeUpgrades();
      const def = upgrades.find((u) => u.id === id);
      if (!def) return prev;
      if (prev.prestige.upgrades[id]) return prev;
      if (prev.prestige.stars < def.cost) return prev;
      toast.success(`Upgrade acheté: ${def.name}`);
      return {
        ...prev,
        prestige: {
          ...prev.prestige,
          stars: prev.prestige.stars - def.cost,
          upgrades: { ...prev.prestige.upgrades, [id]: true },
        },
      };
    });
  };

  const updateFilmDeal = (filmId: string, update: { broadcast?: ApexRightsDeal; intl?: { zone: 'europe' | 'americas' | 'asia'; deal: ApexRightsDeal } }) => {
    setData((prev) => ({
      ...prev,
      films: prev.films.map((f) => {
        if (f.id !== filmId) return f;
        if (update.broadcast) return { ...f, broadcastRights: update.broadcast };
        if (update.intl) return { ...f, intlRights: { ...f.intlRights, [update.intl.zone]: update.intl.deal } };
        return f;
      }),
    }));
  };

  const updateMusicDeal = (projectId: string, nextDeal: ApexRightsDeal) => {
    setData((prev) => ({
      ...prev,
      musicProjects: prev.musicProjects.map((p) => (p.id === projectId ? { ...p, streamingRights: nextDeal } : p)),
    }));
  };

  const updateMusicAdsDeal = (projectId: string, nextDeal: ApexRightsDeal) => {
    setData((prev) => ({
      ...prev,
      musicProjects: prev.musicProjects.map((p) => (p.id === projectId ? { ...p, adsRights: nextDeal } : p)),
    }));
  };

  const updateMusicCatalogDeal = (artistId: string, nextDeal: ApexRightsDeal) => {
    setData((prev) => ({
      ...prev,
      artists: prev.artists.map((a) => (a.id === artistId ? { ...a, catalogBuyoutDeal: nextDeal } : a)),
    }));
  };

  const updateSeriesDeal = (projectId: string, nextDeal: ApexRightsDeal) => {
    setData((prev) => ({
      ...prev,
      seriesProjects: prev.seriesProjects.map((p) => (p.id === projectId ? { ...p, distributionRights: nextDeal } : p)),
    }));
  };

  const updateSeriesTerritoryDeal = (projectId: string, zone: 'europe' | 'americas' | 'asia', nextDeal: ApexRightsDeal) => {
    setData((prev) => ({
      ...prev,
      seriesProjects: prev.seriesProjects.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          territoryRights: {
            europe: p.territoryRights?.europe ?? p.distributionRights,
            americas: p.territoryRights?.americas ?? p.distributionRights,
            asia: p.territoryRights?.asia ?? p.distributionRights,
            [zone]: nextDeal,
          },
        };
      }),
    }));
  };

  const updateSeriesRenewalDeal = (projectId: string, nextDeal: ApexRightsDeal) => {
    setData((prev) => ({
      ...prev,
      seriesProjects: prev.seriesProjects.map((p) => (p.id === projectId ? { ...p, renewalOffer: p.renewalOffer ? { ...p.renewalOffer, deal: nextDeal } : p.renewalOffer } : p)),
    }));
  };

  const updateGameDeal = (projectId: string, nextDeal: ApexRightsDeal) => {
    setData((prev) => ({
      ...prev,
      gameProjects: prev.gameProjects.map((p) => (p.id === projectId ? { ...p, distributionRights: nextDeal } : p)),
    }));
  };

  const updateLiveDeal = (projectId: string, update: { tv?: ApexRightsDeal; sponsor?: ApexRightsDeal; recording?: ApexRightsDeal }) => {
    setData((prev) => ({
      ...prev,
      liveProjects: prev.liveProjects.map((p) => {
        if (p.id !== projectId) return p;
        if (update.tv) return { ...p, tvRights: update.tv };
        if (update.sponsor) return { ...p, sponsorship: update.sponsor };
        if (update.recording) return { ...p, recordingRights: update.recording };
        return p;
      }),
    }));
  };

  const negotiationTarget = (() => {
    if (!activeNegotiation) return null;
    const now = data.lastActionAt;
    const macroMult = data.event.active && data.event.title === 'Crise économique' ? 0.9 : data.event.active && data.event.title === 'Golden Age of Cinema' ? 1.1 : 1;
    const negotiationBoost = computeNegotiationBoost(data.prestige as ApexPrestigeState);

    if (activeNegotiation.kind === 'film_broadcast') {
      const film = data.films.find((f) => f.id === activeNegotiation.filmId);
      if (!film || film.status !== 'released' || !film.releasedAt) return null;
      if (film.frozenUntil && now < film.frozenUntil) {
        return {
          title: `${film.title} — Droits de diffusion`,
          ok: { ok: false, reason: 'Projet gelé (plagiat).' },
          deal: film.broadcastRights,
          buyer: null,
          base: film.productionBudget,
          hype: film.hype,
          rep: data.reputation.cinema,
          ageMin: (now - film.releasedAt) / 60000,
          macroMult,
          negotiationBoost,
          update: (nextDeal: ApexRightsDeal) => updateFilmDeal(activeNegotiation.filmId, { broadcast: nextDeal }),
        };
      }
      const deal = film.broadcastRights;
      const ok = canNegotiate({ now, hype: film.hype, deal });
      const buyerId = deal.negotiation.buyerId;
      const buyer = buyerId ? deal.buyers.find((b) => b.id === buyerId) ?? null : null;
      return {
        title: `${film.title} — Droits de diffusion`,
        ok,
        deal,
        buyer,
        base: film.productionBudget * (film.festival?.won ? 1.3 : 1),
        hype: film.hype,
        rep: data.reputation.cinema,
        ageMin: (now - film.releasedAt) / 60000,
        macroMult,
        negotiationBoost,
        update: (nextDeal: ApexRightsDeal) => updateFilmDeal(activeNegotiation.filmId, { broadcast: nextDeal }),
      };
    }

    if (activeNegotiation.kind === 'film_intl') {
      const film = data.films.find((f) => f.id === activeNegotiation.filmId);
      if (!film || film.status !== 'released' || !film.releasedAt) return null;
      if (film.frozenUntil && now < film.frozenUntil) {
        const label = activeNegotiation.zone === 'americas' ? 'Amériques' : activeNegotiation.zone === 'asia' ? 'Asie' : 'Europe';
        return {
          title: `${film.title} — Droits internationaux (${label})`,
          ok: { ok: false, reason: 'Projet gelé (plagiat).' },
          deal: film.intlRights[activeNegotiation.zone],
          buyer: null,
          base: film.productionBudget * 0.65,
          hype: film.hype,
          rep: data.reputation.cinema,
          ageMin: (now - film.releasedAt) / 60000,
          macroMult,
          negotiationBoost,
          update: (nextDeal: ApexRightsDeal) => updateFilmDeal(activeNegotiation.filmId, { intl: { zone: activeNegotiation.zone, deal: nextDeal } }),
        };
      }
      const deal = film.intlRights[activeNegotiation.zone];
      const ok = canNegotiate({ now, hype: film.hype, deal });
      const buyerId = deal.negotiation.buyerId;
      const buyer = buyerId ? deal.buyers.find((b) => b.id === buyerId) ?? null : null;
      const label = activeNegotiation.zone === 'americas' ? 'Amériques' : activeNegotiation.zone === 'asia' ? 'Asie' : 'Europe';
      return {
        title: `${film.title} — Droits internationaux (${label})`,
        ok,
        deal,
        buyer,
        base: film.productionBudget * 0.65 * (film.festival?.won ? 1.3 : 1),
        hype: film.hype,
        rep: Math.floor(clamp((data.reputation.cinema + globalRep) / 2, 0, 100)),
        ageMin: (now - film.releasedAt) / 60000,
        macroMult,
        negotiationBoost,
        update: (nextDeal: ApexRightsDeal) => updateFilmDeal(activeNegotiation.filmId, { intl: { zone: activeNegotiation.zone, deal: nextDeal } }),
      };
    }

    if (activeNegotiation.kind === 'music_streaming') {
      const project = data.musicProjects.find((p) => p.id === activeNegotiation.projectId);
      if (!project || project.status !== 'released' || !project.releasedAt) return null;
      const deal = project.streamingRights;
      const ok = canNegotiate({ now, hype: project.hype, deal });
      const buyerId = deal.negotiation.buyerId;
      const buyer = buyerId ? deal.buyers.find((b) => b.id === buyerId) ?? null : null;
      const base = project.kind === 'album' ? 140 : project.kind === 'single' ? 60 : project.kind === 'tour_mondiale' ? 200 : 110;
      return {
        title: `${project.title} — Droits de streaming`,
        ok,
        deal,
        buyer,
        base,
        hype: project.hype,
        rep: data.reputation.musique,
        ageMin: (now - project.releasedAt) / 60000,
        macroMult,
        negotiationBoost,
        update: (nextDeal: ApexRightsDeal) => updateMusicDeal(activeNegotiation.projectId, nextDeal),
      };
    }

    if (activeNegotiation.kind === 'music_ads') {
      const project = data.musicProjects.find((p) => p.id === activeNegotiation.projectId);
      if (!project || project.status !== 'released' || !project.releasedAt) return null;
      const buyers = makeBuyers({ names: ['GlobalAds Corp', 'ApexCola', 'GlobeWear', 'NovaEnergy'], min: 3, max: 4 });
      const deal = project.adsRights ?? initDeal({ buyers, embargoUntil: project.releasedAt + 30 * 60 * 1000 });
      const ok = canNegotiate({ now, hype: project.hype, deal });
      const buyerId = deal.negotiation.buyerId;
      const buyer = buyerId ? deal.buyers.find((b) => b.id === buyerId) ?? null : null;
      const base = project.kind === 'album' ? 320 : project.kind === 'single' ? 180 : project.kind === 'tour_mondiale' ? 520 : 260;
      return {
        title: `${project.title} — Droits publicitaires`,
        ok,
        deal,
        buyer,
        base,
        hype: project.hype,
        rep: data.reputation.musique,
        ageMin: (now - project.releasedAt) / 60000,
        macroMult,
        negotiationBoost,
        update: (nextDeal: ApexRightsDeal) => updateMusicAdsDeal(activeNegotiation.projectId, nextDeal),
      };
    }

    if (activeNegotiation.kind === 'music_catalog') {
      const artist = data.artists.find((a) => a.id === activeNegotiation.artistId);
      if (!artist) return null;
      const works = data.musicProjects.filter((p) => p.status === 'released' && p.artistId === artist.id);
      if (works.length === 0) return null;
      const buyers = makeBuyers({ names: ['TuneVault', 'CatalogueX', 'RightsKing', 'BeatFlow'], min: 3, max: 4 });
      const deal = artist.catalogBuyoutDeal ?? initDeal({ buyers });
      const hype = clamp(20 + works.slice(0, 6).reduce((acc, p) => acc + p.hype, 0) / Math.max(1, Math.min(6, works.length)), 0, 100);
      const ok = { ok: true, reason: undefined as string | undefined };
      const buyerId = deal.negotiation.buyerId;
      const buyer = buyerId ? deal.buyers.find((b) => b.id === buyerId) ?? null : null;
      const catalogValue =
        works.reduce((acc, p) => acc + (p.kind === 'album' ? 500 : p.kind === 'single' ? 250 : p.kind === 'tour_mondiale' ? 650 : 420), 0) *
        (1 + artist.notoriety / 5) *
        clamp(0.85 + (artist.notorietyBoost ?? 0) / 120, 0.5, 1.6);
      const base = Math.floor(catalogValue);
      return {
        title: `${artist.name} — Rachat de catalogue`,
        ok,
        deal,
        buyer,
        base,
        hype,
        rep: data.reputation.musique,
        ageMin: 0,
        macroMult,
        negotiationBoost,
        update: (nextDeal: ApexRightsDeal) => updateMusicCatalogDeal(activeNegotiation.artistId, nextDeal),
      };
    }

    if (activeNegotiation.kind === 'series_distribution') {
      const project = data.seriesProjects.find((p) => p.id === activeNegotiation.projectId);
      if (!project) return null;
      const deal = project.distributionRights;
      const ok =
        project.status === 'producing'
          ? { ok: true, reason: undefined as string | undefined }
          : project.releasedAt
            ? canNegotiate({ now, hype: project.hype, deal })
            : { ok: false, reason: 'Indisponible.' };
      const buyerId = deal.negotiation.buyerId;
      const buyer = buyerId ? deal.buyers.find((b) => b.id === buyerId) ?? null : null;
      const totalBudget = project.budgetPerEpisode * project.episodesPerSeason * project.seasonsPlanned;
      const base = project.status === 'producing' ? totalBudget * 0.18 : totalBudget * 0.35;
      return {
        title: `${project.title} — Vente plateforme`,
        ok,
        deal,
        buyer,
        base,
        hype: project.hype,
        rep: data.reputation.series,
        ageMin: project.releasedAt ? (now - project.releasedAt) / 60000 : 0,
        macroMult,
        negotiationBoost,
        update: (nextDeal: ApexRightsDeal) => updateSeriesDeal(activeNegotiation.projectId, nextDeal),
      };
    }

    if (activeNegotiation.kind === 'series_territory') {
      const project = data.seriesProjects.find((p) => p.id === activeNegotiation.projectId);
      if (!project) return null;
      const seasonBudget = project.budgetPerEpisode * project.episodesPerSeason;
      const label = activeNegotiation.zone === 'americas' ? 'Amériques' : activeNegotiation.zone === 'asia' ? 'Asie' : 'Europe';
      const buyers = makeBuyers({ names: ['PrimeVision', 'ArcLight', 'CinéStream', 'MégaVision', 'StreamNova'], min: 3, max: 5 });
      const deal =
        project.territoryRights?.[activeNegotiation.zone] ??
        initDeal({
          buyers,
          embargoUntil: project.status === 'producing' ? undefined : (project.releasedAt ?? now) + 30 * 60 * 1000,
        });
      const ok =
        project.status === 'producing'
          ? { ok: true, reason: undefined as string | undefined }
          : project.releasedAt
            ? canNegotiate({ now, hype: project.hype, deal })
            : { ok: false, reason: 'Indisponible.' };
      const buyerId = deal.negotiation.buyerId;
      const buyer = buyerId ? deal.buyers.find((b) => b.id === buyerId) ?? null : null;
      const base = project.status === 'producing' ? seasonBudget * 0.14 : seasonBudget * 0.26;
      return {
        title: `${project.title} — Territoires (${label})`,
        ok,
        deal,
        buyer,
        base,
        hype: project.hype,
        rep: data.reputation.series,
        ageMin: project.releasedAt ? (now - project.releasedAt) / 60000 : 0,
        macroMult,
        negotiationBoost,
        update: (nextDeal: ApexRightsDeal) => updateSeriesTerritoryDeal(activeNegotiation.projectId, activeNegotiation.zone, nextDeal),
      };
    }

    if (activeNegotiation.kind === 'series_renewal') {
      const project = data.seriesProjects.find((p) => p.id === activeNegotiation.projectId);
      if (!project || !project.renewalOffer) return null;
      const deal = project.renewalOffer.deal;
      const ok = { ok: true, reason: undefined as string | undefined };
      const buyerId = deal.negotiation.buyerId;
      const buyer = buyerId ? deal.buyers.find((b) => b.id === buyerId) ?? null : null;
      const seasonBudget = project.budgetPerEpisode * project.episodesPerSeason;
      const base = seasonBudget * 0.24;
      return {
        title: `${project.title} — Renouvellement`,
        ok,
        deal,
        buyer,
        base,
        hype: project.hype,
        rep: data.reputation.series,
        ageMin: 0,
        macroMult,
        negotiationBoost,
        update: (nextDeal: ApexRightsDeal) => updateSeriesRenewalDeal(activeNegotiation.projectId, nextDeal),
      };
    }

    if (activeNegotiation.kind === 'game_distribution') {
      const project = data.gameProjects.find((p) => p.id === activeNegotiation.projectId);
      if (!project || project.status !== 'released' || !project.releasedAt) return null;
      const deal = project.distributionRights;
      const ok = canNegotiate({ now, hype: project.hype, deal });
      const buyerId = deal.negotiation.buyerId;
      const buyer = buyerId ? deal.buyers.find((b) => b.id === buyerId) ?? null : null;
      const base = (project.devBudget + project.marketingBudget) * 0.55;
      return {
        title: `${project.title} — Accord de distribution`,
        ok,
        deal,
        buyer,
        base,
        hype: project.hype,
        rep: data.reputation.jv,
        ageMin: (now - project.releasedAt) / 60000,
        macroMult,
        negotiationBoost,
        update: (nextDeal: ApexRightsDeal) => updateGameDeal(activeNegotiation.projectId, nextDeal),
      };
    }

    if (activeNegotiation.kind === 'live_tv') {
      const project = data.liveProjects.find((p) => p.id === activeNegotiation.projectId);
      if (!project) return null;
      const deal = project.tvRights;
      const ok = canNegotiate({ now, hype: project.hype, deal });
      const buyerId = deal.negotiation.buyerId;
      const buyer = buyerId ? deal.buyers.find((b) => b.id === buyerId) ?? null : null;
      const base = (Number.isFinite(project.cost) ? project.cost : 0) * 0.35;
      return {
        title: `${project.title} — Droits TV`,
        ok,
        deal,
        buyer,
        base,
        hype: project.hype,
        rep: data.reputation.live,
        ageMin: (now - project.startedAt) / 60000,
        macroMult,
        negotiationBoost,
        update: (nextDeal: ApexRightsDeal) => updateLiveDeal(activeNegotiation.projectId, { tv: nextDeal }),
      };
    }

    if (activeNegotiation.kind === 'live_sponsor') {
      const project = data.liveProjects.find((p) => p.id === activeNegotiation.projectId);
      if (!project) return null;
      const deal = project.sponsorship;
      const ok = canNegotiate({ now, hype: project.hype, deal });
      const buyerId = deal.negotiation.buyerId;
      const buyer = buyerId ? deal.buyers.find((b) => b.id === buyerId) ?? null : null;
      const base = (Number.isFinite(project.cost) ? project.cost : 0) * 0.25;
      return {
        title: `${project.title} — Sponsoring`,
        ok,
        deal,
        buyer,
        base,
        hype: project.hype,
        rep: data.reputation.live,
        ageMin: (now - project.startedAt) / 60000,
        macroMult,
        negotiationBoost,
        update: (nextDeal: ApexRightsDeal) => updateLiveDeal(activeNegotiation.projectId, { sponsor: nextDeal }),
      };
    }

    if (activeNegotiation.kind === 'live_recording') {
      const project = data.liveProjects.find((p) => p.id === activeNegotiation.projectId);
      if (!project) return null;
      const deal = project.recordingRights;
      const ok = canNegotiate({ now, hype: project.hype, deal });
      const buyerId = deal.negotiation.buyerId;
      const buyer = buyerId ? deal.buyers.find((b) => b.id === buyerId) ?? null : null;
      const base = (Number.isFinite(project.cost) ? project.cost : 0) * 0.22;
      return {
        title: `${project.title} — Captation`,
        ok,
        deal,
        buyer,
        base,
        hype: project.hype,
        rep: data.reputation.live,
        ageMin: (now - project.endsAt) / 60000,
        macroMult,
        negotiationBoost,
        update: (nextDeal: ApexRightsDeal) => updateLiveDeal(activeNegotiation.projectId, { recording: nextDeal }),
      };
    }

    return null;
  })();

  const attemptNegotiate = () => {
    if (!negotiationTarget) return;
    if (!negotiationTarget.ok.ok) return;
    const deal = negotiationTarget.deal;
    const buyer = negotiationTarget.buyer;
    const buyerId = deal.negotiation.buyerId;
    if (!buyerId || !buyer) return;
    const asking = Math.floor(Math.max(1, deal.negotiation.askingPrice));
    const estimate = estimateDealPrice({
      base: negotiationTarget.base,
      hype: negotiationTarget.hype,
      rep: negotiationTarget.rep,
      ageMin: negotiationTarget.ageMin,
      buyer,
      macroMult: negotiationTarget.macroMult,
    });
    const prob = acceptanceProbability({ asking, estimate, buyer, negotiationBoost: negotiationTarget.negotiationBoost });
    const roll = Math.random();

    if (roll < prob) {
      toast.success(`Vendu à ${buyer.name}`);
      if (activeNegotiation?.kind === 'music_streaming') {
        negotiationTarget.update({ ...deal, sold: true, soldAt: data.lastActionAt, buyerName: buyer.name, amount: asking });
        setData((prev) => ({
          ...prev,
          musicProjects: prev.musicProjects.map((p) =>
            p.id === activeNegotiation.projectId ? { ...p, nextStreamingPayoutAt: prev.lastActionAt + 5 * 60 * 1000 } : p
          ),
        }));
        closeNegotiation();
        return;
      }

      if (activeNegotiation?.kind === 'music_catalog') {
        setData((prev) => {
          const artist = prev.artists.find((a) => a.id === activeNegotiation.artistId);
          if (!artist) return prev;
          return {
            ...prev,
            cash: prev.cash + asking,
            totalEarned: prev.totalEarned + asking,
            artists: prev.artists.filter((a) => a.id !== artist.id),
            musicProjects: prev.musicProjects.map((p) => {
              if (p.artistId !== artist.id) return p;
              return { ...p, payoutEndsAt: prev.lastActionAt, payoutPerMin: undefined, nextStreamingPayoutAt: undefined, syncEndsAt: undefined, syncPayoutPerMin: undefined };
            }),
          };
        });
        closeNegotiation();
        return;
      }

      if (activeNegotiation?.kind === 'series_renewal') {
        setData((prev) => {
          const project = prev.seriesProjects.find((p) => p.id === activeNegotiation.projectId);
          if (!project || !project.renewalOffer) return prev;
          const seasonBudget = project.budgetPerEpisode * project.episodesPerSeason;
          const cost = Math.floor(seasonBudget * 0.4);
          if (prev.cash + asking < cost) return prev;

          const startedAt = prev.lastActionAt;
          const productionEndsAt = startedAt + project.episodesPerSeason * 3 * 60 * 1000;
          const embargo = productionEndsAt + 30 * 60 * 1000;

          const buyers = makeBuyers({ names: ['PrimeVision', 'ArcLight', 'CinéStream', 'MégaVision', 'StreamNova'], min: 3, max: 5 });
          const distributionRights = initDeal({ buyers, embargoUntil: embargo });
          const territoryRights =
            project.releaseStrategy === 'territoires'
              ? {
                  europe: initDeal({ buyers: makeBuyers({ names: ['EuroVision', 'CinéStream EU', 'PrimeVision EU'], min: 3, max: 3 }), embargoUntil: embargo }),
                  americas: initDeal({ buyers: makeBuyers({ names: ['ArcLight US', 'MegaVision US', 'StreamNova US'], min: 3, max: 3 }), embargoUntil: embargo }),
                  asia: initDeal({ buyers: makeBuyers({ names: ['NovaAsia', 'PrimeVision APAC', 'ArcLight APAC'], min: 3, max: 3 }), embargoUntil: embargo }),
                }
              : project.territoryRights;

          return {
            ...prev,
            cash: prev.cash + asking - cost,
            totalEarned: prev.totalEarned + asking,
            seriesProjects: prev.seriesProjects.map((p) => {
              if (p.id !== project.id) return p;
              return {
                ...p,
                season: (p.season ?? 1) + 1,
                status: 'producing' as const,
                startedAt,
                productionEndsAt,
                releasedAt: undefined,
                qualityScore: undefined,
                lastHypeAt: startedAt,
                distributionRights,
                territoryRights,
                renewalOffer: null,
                renewalOffered: false,
                cancelled: false,
              };
            }),
          };
        });
        closeNegotiation();
        return;
      }

      negotiationTarget.update({ ...deal, sold: true, soldAt: data.lastActionAt, buyerName: buyer.name, amount: asking });
      if (activeNegotiation?.kind === 'music_ads') {
        setData((prev) => {
          const proj = prev.musicProjects.find((p) => p.id === activeNegotiation.projectId);
          if (!proj) return prev;
          return {
            ...prev,
            cash: prev.cash + asking,
            totalEarned: prev.totalEarned + asking,
            musicProjects: prev.musicProjects.map((p) => (p.id === proj.id ? { ...p, hype: clamp(p.hype + 15, 0, 100), lastHypeAt: prev.lastActionAt } : p)),
            artists: prev.artists.map((a) => (a.id === proj.artistId ? { ...a, notorietyBoost: (a.notorietyBoost ?? 0) + 15 } : a)),
          };
        });
      } else {
        setData((prev) => ({ ...prev, cash: prev.cash + asking, totalEarned: prev.totalEarned + asking }));
      }
      closeNegotiation();
      return;
    }

    const nextBuyers = deal.buyers.map((b) => {
      if (b.id !== buyerId) return b;
      const refusals = b.refusals + 1;
      const withdrawn = refusals >= 3;
      return { ...b, refusals, withdrawn };
    });

    const isWithdrawn = nextBuyers.find((b) => b.id === buyerId)?.withdrawn ?? false;
    toast(isWithdrawn ? `${buyer.name} se retire définitivement.` : `${buyer.name} refuse.`, { description: isWithdrawn ? 'Nous ne sommes plus intéressés.' : 'Tu peux retenter.' });
    negotiationTarget.update({ ...deal, buyers: nextBuyers });
  };

  const totalNetWorth = useMemo(() => {
    const cryptoValue = Object.values(data.crypto.coins).reduce((acc, c) => acc + c.holdings * c.price, 0);
    const stockValue = portfolioValue(data.stocks);
    return data.cash + cryptoValue + stockValue;
  }, [data.cash, data.crypto.coins, data.stocks]);

  const desktopHeader = (
    <div className="sticky top-0 z-20 border-b-2 border-brand-border bg-brand-bg/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-accent-primary" aria-hidden="true" />
          <div className="font-display font-black tracking-wider uppercase">APEX</div>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm font-bold">
          <div ref={cashSpotRef} className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-accent-primary" aria-hidden="true" />
            <span aria-label="Apex Coins actuels">{formatShortNumber(Math.floor(data.cash))} ₶</span>
          </div>
          <div className="text-tx-secondary" aria-label="Production par minute">
            {formatShortNumber(Math.floor(cashPerMin))} ₶/min
          </div>
          <div className="flex items-center gap-2 text-tx-secondary" aria-label="Réputation globale">
            <ShieldCheck className="h-4 w-4 text-accent-success" aria-hidden="true" />
            {Math.round(globalRep)}%
          </div>
          <button
            type="button"
            onClick={() => {
              setTutorialOpen(true);
              setTutorialStep(0);
            }}
            className="hidden md:inline-flex h-9 px-3 items-center gap-2 rounded-lg border-2 border-brand-border bg-brand-inner hover:bg-brand-card transition-colors"
            aria-label="Ouvrir le tutoriel"
          >
            <HelpCircle className="h-4 w-4 text-tx-secondary" aria-hidden="true" />
            Tutoriel
          </button>
          {prestigeAvailable ? (
            <button
              type="button"
              onClick={() => setPrestigeOpen(true)}
              className="h-9 px-3 inline-flex items-center gap-2 rounded-lg border-2 border-brand-border bg-brand-inner hover:bg-brand-card transition-colors"
              aria-label="Ouvrir le prestige"
            >
              <Star className="h-4 w-4 text-accent-primary" aria-hidden="true" />
              Prestige
            </button>
          ) : null}
          <Link href="/profil" className="h-9 px-3 inline-flex items-center rounded-lg border-2 border-brand-border bg-brand-inner hover:bg-brand-card transition-colors" aria-label="Aller au profil">
            Profil
          </Link>
        </div>
      </div>
    </div>
  );

  if (namesError) {
    return (
      <main className="min-h-screen">
        {desktopHeader}
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-2xl border-2 border-brand-border bg-brand-card p-6 shadow-brutal">
            <div className="font-display text-2xl font-black tracking-wider uppercase">Erreur</div>
            <div className="mt-3 text-tx-secondary font-bold">{namesError}</div>
          </div>
        </div>
      </main>
    );
  }

  const leftSidebar = (
    <div className="space-y-3">
      {data.agent.active ? (
        <div ref={agentSpotRef} className="rounded-2xl border-2 border-brand-border bg-brand-inner shadow-brutal p-4">
          <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">L’Agent</div>
          <div className="mt-2 font-display text-lg font-black tracking-wider uppercase">{data.agent.title}</div>
          <div className="mt-2 text-sm text-tx-secondary font-bold leading-relaxed">{data.agent.description}</div>
          <div className="mt-3 text-xs text-tx-secondary font-bold">
            Expire dans {data.agent.expiresAt ? Math.max(0, Math.ceil((data.agent.expiresAt - data.lastActionAt) / 1000)) : 0}s
          </div>
        </div>
      ) : null}

      {data.event.active ? (
        <div ref={eventSpotRef} className="rounded-2xl border-2 border-brand-border bg-brand-inner shadow-brutal p-4">
          <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Événement</div>
          <div className="mt-2 font-display text-lg font-black tracking-wider uppercase">{data.event.title}</div>
          <div className="mt-2 text-sm text-tx-secondary font-bold leading-relaxed">{data.event.description}</div>
          <div className="mt-3 text-xs text-tx-secondary font-bold">
            Durée restante {data.event.endsAt ? Math.max(0, Math.ceil((data.event.endsAt - data.lastActionAt) / 1000)) : 0}s
          </div>
        </div>
      ) : null}

      <div ref={portfoliosSpotRef} className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
        <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Portefeuilles</div>
        <div className="mt-3 space-y-1 text-sm font-bold text-tx-secondary">
          <div className="flex items-center justify-between">
            <span>Crypto</span>
            <span className="text-tx-base">
              {formatShortNumber(Object.values(data.crypto.coins).reduce((acc, c) => acc + c.holdings * c.price, 0))} ₶
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Bourse</span>
            <span className="text-tx-base">{formatShortNumber(portfolioValue(data.stocks))} ₶</span>
          </div>
        </div>
      </div>
    </div>
  );

  const rightSidebar = (
    <div className="space-y-3">
      <div ref={contractsSpotRef} className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
        <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Contrats disponibles</div>
        <div className="mt-3 space-y-2">
          {collectContracts(data).slice(0, 5).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => openNegotiation(c.open)}
              className="w-full text-left rounded-xl border-2 border-brand-border bg-brand-inner hover:bg-brand-card transition-colors p-3"
              aria-label={`Négocier: ${c.label}`}
            >
              <div className="font-display font-black tracking-wider uppercase text-sm">{c.label}</div>
              <div className="mt-1 text-xs text-tx-secondary font-bold">{c.sub}</div>
            </button>
          ))}
          {collectContracts(data).length === 0 ? <div className="text-sm text-tx-secondary font-bold">Aucun contrat disponible.</div> : null}
        </div>
      </div>

      <div ref={reputationSpotRef} className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
        <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Réputation</div>
        <div className="mt-3 space-y-2">
          {(
            [
              ['Cinéma', data.reputation.cinema],
              ['Musique', data.reputation.musique],
              ['Séries', data.reputation.series],
              ['Live', data.reputation.live],
              ['JV', data.reputation.jv],
            ] as const
          ).map(([label, v]) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-black text-tx-secondary">
                <span>{label}</span>
                <span>{Math.round(v)}%</span>
              </div>
              <div className="h-2 rounded-full bg-brand-inner border border-brand-border overflow-hidden">
                <div className={cn('h-full', hypeColor(v))} style={{ width: `${clamp(v, 0, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
        <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Succès récents</div>
        <div className="mt-3 space-y-2">
          {data.achievements.slice(-5).reverse().map((id) => {
            const def = achievementsDefs.find((d) => d.id === id);
            return (
              <div key={id} className="text-sm font-bold text-tx-secondary">
                {def?.name ?? id}
              </div>
            );
          })}
          {data.achievements.length === 0 ? <div className="text-sm text-tx-secondary font-bold">Aucun succès pour le moment.</div> : null}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
        <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Stats rapides</div>
        <div className="mt-2 text-sm font-bold text-tx-secondary">
          Capital cumulé: <span className="text-tx-base">{formatShortNumber(Math.floor(data.totalEarned))} ₶</span>
        </div>
        <div className="mt-1 text-sm font-bold text-tx-secondary">
          Valeur totale: <span className="text-tx-base">{formatShortNumber(Math.floor(totalNetWorth))} ₶</span>
        </div>
        <div className="mt-1 text-sm font-bold text-tx-secondary">
          Bonus succès: <span className="text-tx-base">{Math.round((productionMult - 1) * 1000) / 10}%</span>
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen">
      <div className="hidden lg:block">{desktopHeader}</div>

      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-6">
        <aside className="hidden lg:block">{leftSidebar}</aside>

        <section className="space-y-4">
          <div ref={tabsSpotRef} className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4 lg:static sticky top-14 z-10">
            <div className="flex flex-wrap items-center gap-2">
              {sectorTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (t.locked) return;
                    setData((prev) => ({ ...prev, sectorTab: t.id }));
                  }}
                  className={cn(
                    'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase inline-flex items-center gap-2 transition-colors',
                    data.sectorTab === t.id
                      ? 'bg-accent-primary text-brand-bg border-brand-border'
                      : 'bg-brand-inner text-tx-base border-brand-border hover:bg-brand-card',
                    t.locked ? 'opacity-50 cursor-not-allowed' : ''
                  )}
                  aria-label={t.locked ? `${t.label} verrouillé` : `Ouvrir ${t.label}`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                  {t.locked ? <span className="text-xs text-tx-secondary font-black">({formatShortNumber(t.required ?? 0)} ₶)</span> : null}
                </button>
              ))}

              <div className="ml-auto flex items-center gap-2">
                {unlocked.platform && !data.platform.unlocked ? (
                  <button
                    type="button"
                    onClick={launchPlatform}
                    disabled={data.cash < 500_000}
                    className={cn(
                      'hidden lg:inline-flex h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                      data.cash < 500_000
                        ? 'bg-brand-inner text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                        : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                    )}
                    aria-label="Lancer la plateforme (500 000 ₶)"
                  >
                    Plateforme (500k)
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  ref={createSpotRef}
                  className="hidden lg:inline-flex h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors items-center gap-2"
                  aria-label="Lancer un projet"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Lancer un projet
                </button>
              </div>
            </div>
          </div>

          <div ref={projectsSpotRef} className="grid gap-4 pb-24 lg:pb-0">
            {data.sectorTab === 'cinema' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                  <div className="font-display text-xl font-black tracking-wider uppercase">Projets en cours</div>
                  <div className="mt-3 space-y-3">
                    {data.films.filter((f) => f.status === 'producing').map((f) => (
                      <ProjectCard
                        key={f.id}
                        title={f.title}
                        subtitle={`${f.genre} • ${formatShortNumber(f.productionBudget)} ₶ prod • ${f.marketingPercent}% pub`}
                        status={getProjectStatusLabel(f.status)}
                        hype={f.hype}
                        progress={clamp((data.lastActionAt - f.startedAt) / Math.max(1, f.productionEndsAt - f.startedAt), 0, 1)}
                      />
                    ))}
                    {data.films.filter((f) => f.status === 'producing').length === 0 ? (
                      <div className="text-sm text-tx-secondary font-bold">Aucun film en cours.</div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                  <div className="font-display text-xl font-black tracking-wider uppercase">Projets terminés</div>
                  <div className="mt-3 space-y-3">
                    {data.films
                      .filter((f) => f.status === 'released')
                      .map((f) => {
                        const threshold = Math.max(1000, Math.floor(f.productionBudget * 0.6));
                        const canSequel = (f.qualityScore ?? 0) > 75 && (f.totalBoxOffice ?? 0) >= threshold;
                        const hasSequel = data.films.some((x) => x.sequelOfFilmId === f.id);
                        const festivalPending = f.festival && !f.festival.resolved;
                        const festivalWon = f.festival?.resolved && f.festival.won;
                        const merchActive = Boolean(f.merchUnlocked && f.merchEndsAt && data.lastActionAt <= f.merchEndsAt);
                        return (
                          <div key={f.id} className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="font-display font-black tracking-wider uppercase">{f.title}</div>
                                <div className="mt-1 text-sm text-tx-secondary font-bold">
                                  Hype {Math.round(f.hype)} • Qualité {f.qualityScore ?? 0} • Box-office {formatShortNumber(Math.floor(f.totalBoxOffice ?? 0))} ₶
                                  {festivalPending ? ' • Festival en cours' : festivalWon ? ' • Festival gagné' : ''}
                                  {f.frozenUntil && data.lastActionAt < f.frozenUntil ? ' • Gelé' : ''}
                                  {merchActive ? ' • Merch actif' : ''}
                                  {(f.sequelIndex ?? 0) > 0 ? ' • Suite' : ''}
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-brand-bg border border-brand-border overflow-hidden">
                                  <div className={cn('h-full', hypeColor(f.hype))} style={{ width: `${clamp(f.hype, 0, 100)}%` }} />
                                </div>
                              </div>

                              <div className="flex flex-col gap-2">
                                <div className="flex flex-wrap justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openNegotiation({ kind: 'film_broadcast', filmId: f.id })}
                                    className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                    aria-label="Vendre les droits de diffusion"
                                  >
                                    Droits TV
                                  </button>

                                  {!f.festival ? (
                                    <button
                                      type="button"
                                      onClick={() => submitFilmFestival(f.id)}
                                      disabled={data.cash < 200}
                                      className={cn(
                                        'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                        data.cash < 200
                                          ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                                          : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                      )}
                                      aria-label="Soumettre au festival (200 ₶)"
                                    >
                                      Festival (200)
                                    </button>
                                  ) : null}

                                  {canSequel && !hasSequel ? (
                                    <button
                                      type="button"
                                      onClick={() => startSequel(f.id)}
                                      className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                      aria-label="Produire la suite"
                                    >
                                      Suite
                                    </button>
                                  ) : null}
                                </div>

                                <div className="relative">
                                  <button
                                    type="button"
                                    className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors inline-flex items-center gap-2"
                                    aria-label="Vendre les droits internationaux"
                                  >
                                    Intl <ChevronDown className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                  <div className="mt-2 grid grid-cols-3 gap-2">
                                    {(['europe', 'americas', 'asia'] as const).map((z) => (
                                      <button
                                        key={z}
                                        type="button"
                                        onClick={() => openNegotiation({ kind: 'film_intl', filmId: f.id, zone: z })}
                                        className="h-9 px-2 rounded-lg border-2 border-brand-border bg-brand-inner text-xs font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                        aria-label={`Vendre droits ${z}`}
                                      >
                                        {z === 'americas' ? 'AM' : z === 'asia' ? 'AS' : 'EU'}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    {data.films.filter((f) => f.status === 'released').length === 0 ? <div className="text-sm text-tx-secondary font-bold">Aucun film sorti.</div> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {data.sectorTab === 'live' ? (
              <div className="space-y-4">
                {!unlocked.live ? (
                  <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                    <div className="font-display text-xl font-black tracking-wider uppercase">Live</div>
                    <div className="mt-3 text-sm text-tx-secondary font-bold">Débloque à {formatShortNumber(UNLOCKS.live)} ₶ cumulés.</div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                      <div className="font-display text-xl font-black tracking-wider uppercase">Événements en cours</div>
                      <div className="mt-3 space-y-3">
                        {data.liveProjects
                          .filter((p) => p.status === 'active')
                          .map((p) => (
                            <div key={p.id} className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <ProjectCard
                                    title={p.title}
                                    subtitle={`${p.kind} • ${p.venue}${p.outdoor ? ' • plein air' : ''}`}
                                    status="En cours"
                                    hype={p.hype}
                                    progress={clamp((data.lastActionAt - p.startedAt) / Math.max(1, p.endsAt - p.startedAt), 0, 1)}
                                  />
                                </div>
                                <div className="flex flex-col gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openNegotiation({ kind: 'live_tv', projectId: p.id })}
                                    className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                    aria-label="Négocier les droits TV"
                                  >
                                    Droits TV
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openNegotiation({ kind: 'live_sponsor', projectId: p.id })}
                                    className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                    aria-label="Négocier un sponsoring"
                                  >
                                    Sponsoring
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        {data.liveProjects.filter((p) => p.status === 'active').length === 0 ? (
                          <div className="text-sm text-tx-secondary font-bold">Aucun événement en cours.</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                      <div className="font-display text-xl font-black tracking-wider uppercase">Événements terminés</div>
                      <div className="mt-3 space-y-3">
                        {data.liveProjects
                          .filter((p) => p.status === 'done')
                          .map((p) => (
                            <div key={p.id} className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="font-display font-black tracking-wider uppercase">{p.title}</div>
                                  <div className="mt-1 text-sm text-tx-secondary font-bold">
                                    Revenu {formatShortNumber(Math.floor(p.revenue ?? 0))} ₶ • Hype {Math.round(p.hype)}
                                  </div>
                                  <div className="mt-2 h-2 rounded-full bg-brand-bg border border-brand-border overflow-hidden">
                                    <div className={cn('h-full', hypeColor(p.hype))} style={{ width: `${clamp(p.hype, 0, 100)}%` }} />
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openNegotiation({ kind: 'live_recording', projectId: p.id })}
                                    className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                    aria-label="Vendre la captation"
                                  >
                                    Captation
                                  </button>
                                  {p.kind === 'festival' && !p.annual ? (
                                    <button
                                      type="button"
                                      onClick={() => makeFestivalAnnual(p.id)}
                                      className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                      aria-label="Rendre ce festival annuel"
                                    >
                                      Annuel
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        {data.liveProjects.filter((p) => p.status === 'done').length === 0 ? (
                          <div className="text-sm text-tx-secondary font-bold">Aucun événement terminé.</div>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {data.sectorTab === 'musique' ? (
              <div className="space-y-4">
                {!unlocked.musique ? (
                  <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                    <div className="font-display text-xl font-black tracking-wider uppercase">Musique</div>
                    <div className="mt-3 text-sm text-tx-secondary font-bold">Débloque à {formatShortNumber(UNLOCKS.musique)} ₶ cumulés.</div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-display text-xl font-black tracking-wider uppercase">Roster</div>
                          <div className="mt-2 text-sm text-tx-secondary font-bold">
                            {data.artists.length} / {rosterMax} artistes
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {data.artists.map((a) => {
                          const works = data.musicProjects.filter((p) => p.status === 'released' && p.artistId === a.id).length;
                          return (
                            <div key={a.id} className="rounded-xl border-2 border-brand-border bg-brand-inner p-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="font-display font-black tracking-wider uppercase text-sm">{a.name}</div>
                                  <div className="mt-1 text-xs text-tx-secondary font-bold">
                                    Notoriété {a.notoriety}/5 • {a.style} • Salaire {formatShortNumber(a.salaryPerMonth)} ₶/mois
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-xs text-tx-secondary font-bold">
                                    Contrat {Math.max(0, Math.ceil((a.contractEndsAt - data.lastActionAt) / (5 * 60 * 1000)))} mois
                                  </div>
                                  {works > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => openNegotiation({ kind: 'music_catalog', artistId: a.id })}
                                      className="h-9 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                      aria-label={`Négocier un rachat de catalogue pour ${a.name}`}
                                    >
                                      Catalogue
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {data.artists.length === 0 ? <div className="text-sm text-tx-secondary font-bold">Aucun artiste signé.</div> : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                      <div className="font-display text-xl font-black tracking-wider uppercase">Artistes disponibles (10 min)</div>
                      <div className="mt-3 grid gap-2">
                        {data.artistMarket.map((a) => (
                          <div key={a.id} className="rounded-xl border-2 border-brand-border bg-brand-inner p-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="font-display font-black tracking-wider uppercase text-sm">{a.name}</div>
                                <div className="mt-1 text-xs text-tx-secondary font-bold">
                                  Notoriété {a.notoriety}/5 • {a.style} • Signature {formatShortNumber(a.signatureFee)} ₶ • Refus {a.refusals}/3
                                </div>
                                <div className="mt-1 text-xs text-tx-secondary font-bold">
                                  Expire dans {Math.max(0, Math.ceil((a.availableUntil - data.lastActionAt) / 1000))}s
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => openSignArtist(a.id)}
                                disabled={a.withdrawn || data.artists.length >= rosterMax}
                                className={cn(
                                  'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                  a.withdrawn || data.artists.length >= rosterMax
                                    ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                                    : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                )}
                                aria-label={`Signer ${a.name}`}
                              >
                                Signer
                              </button>
                            </div>
                          </div>
                        ))}
                        {data.artistMarket.length === 0 ? <div className="text-sm text-tx-secondary font-bold">Aucun artiste disponible.</div> : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                      <div className="font-display text-xl font-black tracking-wider uppercase">Projets en cours</div>
                      <div className="mt-3 space-y-3">
                        {data.musicProjects.filter((p) => p.status === 'producing').map((p) => (
                          <ProjectCard
                            key={p.id}
                            title={p.title}
                            subtitle={`${p.kind} • ${p.artistName}`}
                            status={getProjectStatusLabel(p.status)}
                            hype={p.hype}
                            progress={clamp((data.lastActionAt - p.startedAt) / Math.max(1, p.productionEndsAt - p.startedAt), 0, 1)}
                          />
                        ))}
                        {data.musicProjects.filter((p) => p.status === 'producing').length === 0 ? (
                          <div className="text-sm text-tx-secondary font-bold">Aucun projet en cours.</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                      <div className="font-display text-xl font-black tracking-wider uppercase">Projets terminés</div>
                      <div className="mt-3 space-y-3">
                        {data.musicProjects.filter((p) => p.status === 'released').map((p) => (
                          <div key={p.id} className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="font-display font-black tracking-wider uppercase">{p.title}</div>
                                <div className="mt-1 text-sm text-tx-secondary font-bold">
                                  Hype {Math.round(p.hype)} • Qualité {p.qualityScore ?? 0}
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-brand-bg border border-brand-border overflow-hidden">
                                  <div className={cn('h-full', hypeColor(p.hype))} style={{ width: `${clamp(p.hype, 0, 100)}%` }} />
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => openNegotiation({ kind: 'music_streaming', projectId: p.id })}
                                  className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                  aria-label="Vendre les droits de streaming"
                                >
                                  Droits streaming
                                </button>
                                {data.films.some((f) => f.status === 'released') || data.seriesProjects.some((s) => s.status === 'released') ? (
                                  <button
                                    type="button"
                                    onClick={() => startSyncPlacement(p.id)}
                                    disabled={Boolean(p.syncEndsAt && data.lastActionAt <= p.syncEndsAt)}
                                    className={cn(
                                      'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                      p.syncEndsAt && data.lastActionAt <= p.syncEndsAt
                                        ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                                        : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                    )}
                                    aria-label="Activer un placement sync (45 min)"
                                  >
                                    Sync
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                        {data.musicProjects.filter((p) => p.status === 'released').length === 0 ? (
                          <div className="text-sm text-tx-secondary font-bold">Aucune sortie.</div>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {data.sectorTab === 'series' ? (
              <div className="space-y-4">
                {!unlocked.series ? (
                  <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                    <div className="font-display text-xl font-black tracking-wider uppercase">Séries & Streaming</div>
                    <div className="mt-3 text-sm text-tx-secondary font-bold">Débloque à {formatShortNumber(UNLOCKS.series)} ₶ cumulés.</div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                      <div className="font-display text-xl font-black tracking-wider uppercase">Projets en cours</div>
                      <div className="mt-3 space-y-3">
                        {data.seriesProjects.filter((p) => p.status === 'producing').map((p) => (
                          <div key={p.id} className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <ProjectCard
                                  title={p.title}
                                  subtitle={`${p.genre} • ${p.seasonsPlanned} saisons • ${p.episodesPerSeason} ép/saison`}
                                  status={getProjectStatusLabel(p.status)}
                                  hype={p.hype}
                                  progress={clamp((data.lastActionAt - p.startedAt) / Math.max(1, p.productionEndsAt - p.startedAt), 0, 1)}
                                />
                              </div>
                              {p.releaseStrategy === 'territoires' ? !(p.territoryRights?.europe?.sold ?? false) : !p.distributionRights.sold ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openNegotiation(
                                      p.releaseStrategy === 'territoires'
                                        ? { kind: 'series_territory', projectId: p.id, zone: 'europe' }
                                        : { kind: 'series_distribution', projectId: p.id }
                                    )
                                  }
                                  className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                  aria-label="Vendre avant production"
                                >
                                  Vendre avant prod
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                        {data.seriesProjects.filter((p) => p.status === 'producing').length === 0 ? (
                          <div className="text-sm text-tx-secondary font-bold">Aucune série en cours.</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                      <div className="font-display text-xl font-black tracking-wider uppercase">Projets terminés</div>
                      <div className="mt-3 space-y-3">
                        {data.seriesProjects.filter((p) => p.status === 'released').map((p) => (
                          <div key={p.id} className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="font-display font-black tracking-wider uppercase">{p.title}</div>
                                <div className="mt-1 text-sm text-tx-secondary font-bold">
                                  Saison {p.season ?? 1}/{p.seasonsPlanned} • Hype {Math.round(p.hype)} • Qualité {p.qualityScore ?? 0} • Showrunner {p.showrunner.name} (N{p.showrunner.level})
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-brand-bg border border-brand-border overflow-hidden">
                                  <div className={cn('h-full', hypeColor(p.hype))} style={{ width: `${clamp(p.hype, 0, 100)}%` }} />
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {p.cancelled ? (
                                  <div className="h-10 px-3 inline-flex items-center rounded-lg border-2 border-brand-border bg-brand-card text-tx-secondary font-display font-black tracking-wider uppercase">
                                    Annulée
                                  </div>
                                ) : null}
                                {!p.cancelled && p.renewalOffer && data.lastActionAt < p.renewalOffer.expiresAt ? (
                                  <button
                                    type="button"
                                    onClick={() => openNegotiation({ kind: 'series_renewal', projectId: p.id })}
                                    className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                    aria-label="Négocier un renouvellement"
                                  >
                                    Renouvellement
                                  </button>
                                ) : null}
                                {!p.cancelled && (p.season ?? 1) < p.seasonsPlanned ? (
                                  <button
                                    type="button"
                                    onClick={() => startNextSeriesSeasonAutonomy(p.id)}
                                    className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                    aria-label="Produire la saison suivante en autonomie"
                                  >
                                    Autonomie
                                  </button>
                                ) : null}
                                {p.cancelled ? null : p.releaseStrategy === 'territoires' ? (
                                  !(p.territoryRights?.europe?.sold ?? false) ? (
                                    <button
                                      type="button"
                                      onClick={() => openNegotiation({ kind: 'series_territory', projectId: p.id, zone: 'europe' })}
                                      className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                      aria-label="Vendre les droits (Europe)"
                                    >
                                      Vendre (EU)
                                    </button>
                                  ) : null
                                ) : !p.distributionRights.sold ? (
                                  <button
                                    type="button"
                                    onClick={() => openNegotiation({ kind: 'series_distribution', projectId: p.id })}
                                    className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                    aria-label="Vendre à une plateforme"
                                  >
                                    Vendre
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                        {data.seriesProjects.filter((p) => p.status === 'released').length === 0 ? (
                          <div className="text-sm text-tx-secondary font-bold">Aucune série sortie.</div>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {data.sectorTab === 'jv' ? (
              <div className="space-y-4">
                {!unlocked.jv ? (
                  <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                    <div className="font-display text-xl font-black tracking-wider uppercase">Jeux Vidéo</div>
                    <div className="mt-3 text-sm text-tx-secondary font-bold">Débloque à {formatShortNumber(UNLOCKS.jv)} ₶ cumulés.</div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-display text-xl font-black tracking-wider uppercase">Studios</div>
                          <div className="mt-2 text-sm text-tx-secondary font-bold">{data.studios.length} possédé(s)</div>
                        </div>
                        <button
                          type="button"
                          onClick={createStudio}
                          disabled={data.cash < 3_000_000}
                          className={cn(
                            'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                            data.cash < 3_000_000
                              ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                              : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                          )}
                          aria-label="Créer un studio (3 000 000 ₶)"
                        >
                          Créer (3M)
                        </button>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {data.studios.map((s) => (
                          <div key={s.id} className="rounded-xl border-2 border-brand-border bg-brand-inner p-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="font-display font-black tracking-wider uppercase text-sm">{s.name}</div>
                                <div className="mt-1 text-xs text-tx-secondary font-bold">Tier {s.tier.toUpperCase()}</div>
                                {s.buyoutOffer && data.lastActionAt < s.buyoutOffer.expiresAt ? (
                                  <div className="mt-1 text-xs text-tx-secondary font-bold">
                                    Offre de rachat: {formatShortNumber(s.buyoutOffer.amount)} ₶ • Expire dans{' '}
                                    {Math.max(0, Math.ceil((s.buyoutOffer.expiresAt - data.lastActionAt) / 1000))}s
                                  </div>
                                ) : null}
                              </div>
                              {s.buyoutOffer && data.lastActionAt < s.buyoutOffer.expiresAt ? (
                                <button
                                  type="button"
                                  onClick={() => acceptStudioBuyout(s.id)}
                                  className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                  aria-label="Accepter le rachat"
                                >
                                  Accepter
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                        {data.studios.length === 0 ? <div className="text-sm text-tx-secondary font-bold">Aucun studio. Achète-en un.</div> : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                      <div className="font-display text-xl font-black tracking-wider uppercase">Studios disponibles (10 min)</div>
                      <div className="mt-3 grid gap-2">
                        {data.studioMarket.map((o) => (
                          <div key={o.id} className="rounded-xl border-2 border-brand-border bg-brand-inner p-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="font-display font-black tracking-wider uppercase text-sm">{o.name}</div>
                                <div className="mt-1 text-xs text-tx-secondary font-bold">
                                  Tier {o.tier.toUpperCase()} • Prix {formatShortNumber(o.price)} ₶
                                </div>
                                <div className="mt-1 text-xs text-tx-secondary font-bold">
                                  Expire dans {Math.max(0, Math.ceil((o.availableUntil - data.lastActionAt) / 1000))}s
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => buyStudioOffer(o.id)}
                                disabled={data.cash < o.price}
                                className={cn(
                                  'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                  data.cash < o.price
                                    ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                                    : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                )}
                                aria-label={`Acheter ${o.name}`}
                              >
                                Acheter
                              </button>
                            </div>
                          </div>
                        ))}
                        {data.studioMarket.length === 0 ? <div className="text-sm text-tx-secondary font-bold">Aucun studio disponible.</div> : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                      <div className="font-display text-xl font-black tracking-wider uppercase">Projets en cours</div>
                      <div className="mt-3 space-y-3">
                        {data.gameProjects.filter((p) => p.status === 'producing').map((p) => (
                          <ProjectCard
                            key={p.id}
                            title={p.title}
                            subtitle={`${p.genre} • ${p.model} • Dev ${formatShortNumber(p.devBudget)} ₶`}
                            status={getProjectStatusLabel(p.status)}
                            hype={p.hype}
                            progress={clamp((data.lastActionAt - p.startedAt) / Math.max(1, p.productionEndsAt - p.startedAt), 0, 1)}
                          />
                        ))}
                        {data.gameProjects.filter((p) => p.status === 'producing').length === 0 ? (
                          <div className="text-sm text-tx-secondary font-bold">Aucun jeu en cours.</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                      <div className="font-display text-xl font-black tracking-wider uppercase">Projets terminés</div>
                      <div className="mt-3 space-y-3">
                        {data.gameProjects.filter((p) => p.status === 'released').map((p) => (
                          <div key={p.id} className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="font-display font-black tracking-wider uppercase">{p.title}</div>
                                <div className="mt-1 text-sm text-tx-secondary font-bold">
                                  Hype {Math.round(p.hype)} • Qualité {p.qualityScore ?? 0} • Modèle {p.model}
                                  {p.bugUntil && data.lastActionAt < p.bugUntil ? ' • Bug majeur' : ''}
                                  {p.port?.done ? ` • Port ${p.port.platform}` : p.port && !p.port.done ? ' • Port en cours' : ''}
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-brand-bg border border-brand-border overflow-hidden">
                                  <div className={cn('h-full', hypeColor(p.hype))} style={{ width: `${clamp(p.hype, 0, 100)}%` }} />
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openNegotiation({ kind: 'game_distribution', projectId: p.id })}
                                  className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-card font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                                  aria-label="Accord de distribution"
                                >
                                  Distribution
                                </button>
                                {!p.port ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    {(['ArcBox', 'NovaStation', 'PocketPlay'] as const).map((pl) => {
                                      const cost = Math.max(10_000, Math.floor(p.devBudget * 0.22));
                                      const disabled = data.cash < cost;
                                      return (
                                        <button
                                          key={pl}
                                          type="button"
                                          onClick={() => startGamePort(p.id, pl)}
                                          disabled={disabled}
                                          className={cn(
                                            'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                            disabled
                                              ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                                              : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                          )}
                                          aria-label={`Lancer un port ${pl}`}
                                        >
                                          Port {pl === 'PocketPlay' ? 'Mobile' : pl === 'NovaStation' ? 'Nova' : 'Arc'}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                        {data.gameProjects.filter((p) => p.status === 'released').length === 0 ? (
                          <div className="text-sm text-tx-secondary font-bold">Aucun jeu sorti.</div>
                        ) : null}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {data.sectorTab === 'crypto' ? (
              <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                <div className="font-display text-xl font-black tracking-wider uppercase">Crypto</div>
                {!unlocked.crypto ? (
                  <div className="mt-3 text-sm text-tx-secondary font-bold">Débloque à {formatShortNumber(UNLOCKS.crypto)} ₶ cumulés.</div>
                ) : (
                  <div className="mt-4 grid gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(['BitApex', 'EtherGlobe', 'DogeStar', 'ApexStable'] as ApexCryptoId[]).map((id) => {
                        const coin = data.crypto.coins[id];
                        const suspended = Boolean(coin.suspendedUntil && data.lastActionAt < coin.suspendedUntil);
                        return (
                          <div key={id} className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-display font-black tracking-wider uppercase">{id}</div>
                                <div className="mt-1 text-sm text-tx-secondary font-bold">
                                  Prix {formatShortNumber(coin.price)} ₶ • Holdings {formatShortNumber(coin.holdings)}
                                </div>
                                <div className="mt-1 text-xs text-tx-secondary font-bold">
                                  Mining {formatShortNumber(coin.miningRatePerMin)} /min{ suspended ? ' • Suspendue' : '' }
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => tryBuyCrypto(id, 1000)}
                                  disabled={data.cash < 1000 || suspended}
                                  className={cn(
                                    'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                    data.cash < 1000 || suspended
                                      ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                                      : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                  )}
                                  aria-label={`Acheter ${id} pour 1000`}
                                >
                                  +1k
                                </button>
                                <button
                                  type="button"
                                  onClick={() => trySellCrypto(id, 0.5)}
                                  disabled={coin.holdings <= 0 || suspended}
                                  className={cn(
                                    'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                    coin.holdings <= 0 || suspended
                                      ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                                      : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                  )}
                                  aria-label={`Vendre 50% de ${id}`}
                                >
                                  -50%
                                </button>
                                <button
                                  type="button"
                                  onClick={() => buyMining(id)}
                                  disabled={data.cash < 5000 || suspended || id === 'ApexStable'}
                                  className={cn(
                                    'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                    data.cash < 5000 || suspended || id === 'ApexStable'
                                      ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                                      : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                  )}
                                  aria-label={`Installer du mining sur ${id} (5000 ₶)`}
                                >
                                  Mining
                                </button>
                              </div>
                            </div>
                            <Sparkline values={coin.history} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {data.sectorTab === 'bourse' ? (
              <div className="rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-4">
                <div className="font-display text-xl font-black tracking-wider uppercase">Bourse</div>
                {!unlocked.bourse ? (
                  <div className="mt-3 text-sm text-tx-secondary font-bold">Débloque à {formatShortNumber(UNLOCKS.bourse)} ₶ cumulés.</div>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {STOCKS.map((s) => {
                      const price = data.stocks.prices[s.id];
                      const held = data.stocks.shares[s.id] ?? 0;
                      return (
                        <div key={s.id} className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="font-display font-black tracking-wider uppercase">{s.name}</div>
                              <div className="mt-1 text-sm text-tx-secondary font-bold">
                                {formatShortNumber(price)} ₶ • Actions {formatShortNumber(held)}
                              </div>
                              {data.marketAnalysis && data.marketAnalysis.stockId === s.id && data.lastActionAt <= data.marketAnalysis.expiresAt ? (
                                <div className="mt-1 text-xs text-tx-secondary font-bold">{data.marketAnalysis.hint}</div>
                              ) : null}
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => tryBuyStock(s.id, 2000)}
                                disabled={data.cash < 2000}
                                className={cn(
                                  'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                  data.cash < 2000
                                    ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                                    : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                )}
                                aria-label={`Acheter ${s.name} pour 2000`}
                              >
                                +2k
                              </button>
                              <button
                                type="button"
                                onClick={() => trySellStock(s.id, 0.25)}
                                disabled={held <= 0}
                                className={cn(
                                  'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                  held <= 0
                                    ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                                    : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                )}
                                aria-label={`Vendre 25% de ${s.name}`}
                              >
                                -25%
                              </button>
                              <button
                                type="button"
                                onClick={() => runMarketAnalysis(s.id)}
                                disabled={data.cash < 2500}
                                className={cn(
                                  'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                  data.cash < 2500
                                    ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                                    : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                )}
                                aria-label={`Analyse de marché sur ${s.name}`}
                              >
                                Analyse
                              </button>
                            </div>
                          </div>
                          {data.totalEarned >= 50_000_000 ? (
                            <div className="mt-3 flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => buyoutStock(s.id)}
                                disabled={Boolean(data.buyouts?.[s.id])}
                                className={cn(
                                  'h-10 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                                  data.buyouts?.[s.id]
                                    ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                                    : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                                )}
                                aria-label={`Racheter ${s.name}`}
                              >
                                {data.buyouts?.[s.id] ? 'Rachetée' : 'Rachat'}
                              </button>
                            </div>
                          ) : null}
                          <Sparkline values={data.stocks.history[s.id] ?? []} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="hidden lg:block">{rightSidebar}</aside>
      </div>

      <MobileBar
        cash={data.cash}
        cashPerMin={cashPerMin}
        globalRep={globalRep}
        onCreate={() => setCreateOpen(true)}
        onTutorial={() => {
          setTutorialOpen(true);
          setTutorialStep(0);
        }}
        sheetOpen={mobileSheetOpen}
        onSheetOpenChange={setMobileSheetOpen}
        createButtonRef={(el) => {
          createSpotRef.current = el;
        }}
        fabButtonRef={(el) => {
          mobileFabSpotRef.current = el;
        }}
        leftContent={leftSidebar}
        rightContent={rightSidebar}
      />

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="+ Lancer un projet">
        {!names ? (
          <div className="text-sm text-tx-secondary font-bold">Chargement des données…</div>
        ) : data.sectorTab === 'cinema' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Genre</div>
                <select
                  className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                  value={cinemaForm.genre}
                  onChange={(e) => setCinemaForm((f) => ({ ...f, genre: e.target.value as ApexCinemaGenre }))}
                  aria-label="Genre du film"
                >
                  {CINEMA_GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Budget de production</div>
                <input
                  className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                  type="number"
                  min={500}
                  value={cinemaForm.productionBudget}
                  onChange={(e) => setCinemaForm((f) => ({ ...f, productionBudget: Math.max(500, Math.floor(Number(e.target.value || 0))) }))}
                  aria-label="Budget de production"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Réalisateur (niveau)</div>
                <select
                  className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                  value={cinemaForm.directorLevel}
                  onChange={(e) => setCinemaForm((f) => ({ ...f, directorLevel: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 }))}
                  aria-label="Niveau du réalisateur"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      Niveau {n}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-tx-secondary font-bold">
                  {cinemaForm.directorName} — Spécialité {cinemaForm.directorSpecialty}
                </div>
              </label>

              <label className="space-y-1">
                <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Budget publicitaire</div>
                <input
                  className="w-full"
                  type="range"
                  min={0}
                  max={100}
                  value={cinemaForm.marketingPercent}
                  onChange={(e) => setCinemaForm((f) => ({ ...f, marketingPercent: Math.floor(Number(e.target.value || 0)) }))}
                  aria-label="Budget publicitaire en pourcentage"
                />
                <div className="text-xs text-tx-secondary font-bold">{cinemaForm.marketingPercent}%</div>
              </label>
            </div>

            <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
              <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Casting (1 à 5 acteurs)</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {cinemaForm.cast.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => removeCastMember(c)}
                    className="h-9 px-3 rounded-lg border-2 border-brand-border bg-brand-card text-xs font-black tracking-wider uppercase hover:bg-accent-secondary hover:text-brand-bg transition-colors"
                    aria-label={`Retirer ${c}`}
                  >
                    {c}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={addCastMember}
                  disabled={cinemaForm.cast.length >= 5}
                  className={cn(
                    'h-9 px-3 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                    cinemaForm.cast.length >= 5
                      ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                      : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                  )}
                  aria-label="Ajouter un acteur"
                >
                  + Acteur
                </button>
              </div>
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={cinemaForm.premiere}
                onChange={(e) => setCinemaForm((f) => ({ ...f, premiere: e.target.checked }))}
                aria-label="Avant-première (200 ₶)"
              />
              <span className="text-sm text-tx-secondary font-bold">Avant-première (+15 hype, 200 ₶)</span>
            </label>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-tx-secondary font-bold">
                Coût estimé:{' '}
                <span className="text-tx-base">
                  {formatShortNumber(
                    cinemaForm.productionBudget +
                      Math.floor(cinemaForm.productionBudget * (cinemaForm.marketingPercent / 100)) +
                      (cinemaForm.premiere ? 200 : 0)
                  )}{' '}
                  ₶
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  startFilm({
                    genre: cinemaForm.genre,
                    productionBudget: cinemaForm.productionBudget,
                    marketingPercent: cinemaForm.marketingPercent,
                    premiere: cinemaForm.premiere,
                    directorLevel: cinemaForm.directorLevel,
                    directorName: cinemaForm.directorName,
                    directorSpecialty: cinemaForm.directorSpecialty,
                    cast: cinemaForm.cast.length ? cinemaForm.cast : [drawWithoutReplacement({ list: names.acteurs, prev: data.draw.acteurs }).value].slice(0, 1),
                  });
                  setCreateOpen(false);
                }}
                className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                aria-label="Lancer le film"
              >
                Lancer
              </button>
            </div>
          </div>
        ) : data.sectorTab === 'musique' ? (
          !unlocked.musique ? (
            <div className="text-sm text-tx-secondary font-bold">Débloque à {formatShortNumber(UNLOCKS.musique)} ₶ cumulés.</div>
          ) : data.artists.length === 0 ? (
            <div className="text-sm text-tx-secondary font-bold">Signe un artiste dans l’onglet Musique pour lancer des projets.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Artiste</div>
                  <select
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    value={musicForm.artistId}
                    onChange={(e) => setMusicForm((f) => ({ ...f, artistId: e.target.value }))}
                    aria-label="Choisir un artiste"
                  >
                    {data.artists.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (N{a.notoriety})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Type</div>
                  <select
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    value={musicForm.kind}
                    onChange={(e) => setMusicForm((f) => ({ ...f, kind: e.target.value as ApexMusicProject['kind'] }))}
                    aria-label="Type de projet musical"
                  >
                    <option value="single">Single (1 min)</option>
                    <option value="album">Album (8 min)</option>
                    <option value="tour_nationale">Tournée nationale (10 min)</option>
                    <option value="tour_mondiale" disabled={Math.floor(clamp(data.reputation.musique, 0, 100) / 20) + 1 < 3}>
                      Tournée mondiale (20 min)
                    </option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Budget</div>
                  <input
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    type="number"
                    min={0}
                    value={musicForm.budget}
                    onChange={(e) => setMusicForm((f) => ({ ...f, budget: Math.max(0, Math.floor(Number(e.target.value || 0))) }))}
                    aria-label="Budget du projet"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Marketing</div>
                  <input
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    type="number"
                    min={0}
                    value={musicForm.marketingBudget}
                    onChange={(e) => setMusicForm((f) => ({ ...f, marketingBudget: Math.max(0, Math.floor(Number(e.target.value || 0))) }))}
                    aria-label="Budget marketing"
                  />
                </label>
              </div>

              {musicForm.kind === 'tour_nationale' || musicForm.kind === 'tour_mondiale' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Salle</div>
                    <select
                      className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                      value={musicForm.tourVenue}
                      onChange={(e) => setMusicForm((f) => ({ ...f, tourVenue: e.target.value as typeof musicForm.tourVenue }))}
                      aria-label="Choisir la salle"
                    >
                      <option value="petite">Petite</option>
                      <option value="moyenne">Moyenne</option>
                      <option value="grande">Grande</option>
                      <option value="stade">Stade</option>
                    </select>
                  </label>
                  {musicForm.kind === 'tour_mondiale' ? (
                    <label className="space-y-1">
                      <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Villes (3–5)</div>
                      <input
                        className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                        type="number"
                        min={3}
                        max={5}
                        value={musicForm.tourCities}
                        onChange={(e) => setMusicForm((f) => ({ ...f, tourCities: clamp(Number(e.target.value || 3), 3, 5) }))}
                        aria-label="Nombre de villes"
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

              {musicForm.kind === 'single' && data.artists.length >= 2 ? (
                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Featuring (optionnel)</div>
                  <select
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    value={musicForm.featuringArtistId}
                    onChange={(e) => setMusicForm((f) => ({ ...f, featuringArtistId: e.target.value }))}
                    aria-label="Choisir un featuring"
                  >
                    <option value="">Aucun</option>
                    {data.artists
                      .filter((a) => a.id !== musicForm.artistId)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (N{a.notoriety})
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-tx-secondary font-bold">
                  Coût total: <span className="text-tx-base">{formatShortNumber(musicForm.budget + musicForm.marketingBudget)} ₶</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    startMusicProject({
                      kind: musicForm.kind,
                      artistId: musicForm.artistId,
                      featuringArtistId: musicForm.kind === 'single' ? musicForm.featuringArtistId || undefined : undefined,
                      budget: musicForm.budget,
                      marketingBudget: musicForm.marketingBudget,
                      tourVenue: musicForm.kind === 'tour_nationale' || musicForm.kind === 'tour_mondiale' ? musicForm.tourVenue : undefined,
                      tourCities: musicForm.kind === 'tour_mondiale' ? musicForm.tourCities : undefined,
                    });
                    setCreateOpen(false);
                  }}
                  className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                  aria-label="Lancer le projet musical"
                >
                  Lancer
                </button>
              </div>
            </div>
          )
        ) : data.sectorTab === 'series' ? (
          !unlocked.series ? (
            <div className="text-sm text-tx-secondary font-bold">Débloque à {formatShortNumber(UNLOCKS.series)} ₶ cumulés.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Genre</div>
                  <input
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    value={seriesForm.genre}
                    onChange={(e) => setSeriesForm((f) => ({ ...f, genre: e.target.value }))}
                    aria-label="Genre de la série"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Showrunner (niveau)</div>
                  <select
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    value={seriesForm.showrunnerLevel}
                    onChange={(e) => setSeriesForm((f) => ({ ...f, showrunnerLevel: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 }))}
                    aria-label="Niveau showrunner"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        Niveau {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1">
                <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Stratégie</div>
                <select
                  className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                  value={seriesForm.releaseStrategy}
                  onChange={(e) => setSeriesForm((f) => ({ ...f, releaseStrategy: e.target.value as 'mondiale' | 'territoires' }))}
                  aria-label="Stratégie de sortie"
                >
                  <option value="mondiale">Sortie mondiale</option>
                  <option value="territoires">Sortie par territoires</option>
                </select>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Saisons</div>
                  <input
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    type="number"
                    min={1}
                    max={5}
                    value={seriesForm.seasonsPlanned}
                    onChange={(e) => setSeriesForm((f) => ({ ...f, seasonsPlanned: clamp(Number(e.target.value || 1), 1, 5) }))}
                    aria-label="Nombre de saisons"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Épisodes/saison</div>
                  <select
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    value={seriesForm.episodesPerSeason}
                    onChange={(e) => setSeriesForm((f) => ({ ...f, episodesPerSeason: Number(e.target.value) as 6 | 12 | 24 }))}
                    aria-label="Épisodes par saison"
                  >
                    {[6, 12, 24].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Budget/épisode</div>
                  <input
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    type="number"
                    min={1}
                    value={seriesForm.budgetPerEpisode}
                    onChange={(e) => setSeriesForm((f) => ({ ...f, budgetPerEpisode: Math.max(1, Math.floor(Number(e.target.value || 0))) }))}
                    aria-label="Budget par épisode"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    startSeriesProject(seriesForm);
                    setCreateOpen(false);
                  }}
                  className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                  aria-label="Lancer la série"
                >
                  Lancer
                </button>
              </div>
            </div>
          )
        ) : data.sectorTab === 'live' ? (
          !unlocked.live ? (
            <div className="text-sm text-tx-secondary font-bold">Débloque à {formatShortNumber(UNLOCKS.live)} ₶ cumulés.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Type</div>
                  <select
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    value={liveForm.kind}
                    onChange={(e) => setLiveForm((f) => ({ ...f, kind: e.target.value as ApexLiveProject['kind'] }))}
                    aria-label="Type d’événement live"
                  >
                    <option value="concert">Concert unique</option>
                    <option value="festival">Festival</option>
                    <option value="ceremonie" disabled={Math.floor(globalRep / 20) + 1 < 3}>
                      Cérémonie (réputation globale niveau 3)
                    </option>
                    <option value="tour_multi">Tournée multi-villes</option>
                    <option value="corporatif">Événement corporatif</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Salle</div>
                  <select
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    value={liveForm.venue}
                    onChange={(e) => setLiveForm((f) => ({ ...f, venue: e.target.value as ApexLiveProject['venue'] }))}
                    aria-label="Taille de la salle"
                  >
                    <option value="petite">Petite</option>
                    <option value="moyenne">Moyenne</option>
                    <option value="grande">Grande</option>
                    <option value="stade">Stade</option>
                  </select>
                </label>
              </div>

              {liveForm.kind === 'tour_multi' ? (
                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Villes (3–5)</div>
                  <input
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    type="number"
                    min={3}
                    max={5}
                    value={liveForm.cities}
                    onChange={(e) => setLiveForm((f) => ({ ...f, cities: clamp(Math.floor(Number(e.target.value || 3)), 3, 5) }))}
                    aria-label="Nombre de villes"
                  />
                </label>
              ) : null}

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={liveForm.outdoor}
                  onChange={(e) => setLiveForm((f) => ({ ...f, outdoor: e.target.checked }))}
                  aria-label="Plein air (risque météo)"
                />
                <span className="text-sm text-tx-secondary font-bold">Plein air (risque météo)</span>
              </label>

              <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">
                  {liveForm.kind === 'festival' ? 'Line-up (1 à 3 artistes)' : 'Artiste'}
                </div>
                {data.artists.length === 0 ? (
                  <div className="mt-2 text-sm text-tx-secondary font-bold">Signe au moins un artiste pour organiser des événements.</div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data.artists.map((a) => {
                      const selected = liveForm.artistIds.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            setLiveForm((f) => {
                              if (f.kind !== 'festival') return { ...f, artistIds: [a.id] };
                              if (selected) return { ...f, artistIds: f.artistIds.filter((id) => id !== a.id) };
                              if (f.artistIds.length >= 3) return f;
                              return { ...f, artistIds: [...f.artistIds, a.id] };
                            });
                          }}
                          className={cn(
                            'h-9 px-3 rounded-lg border-2 text-xs font-black tracking-wider uppercase transition-colors',
                            selected ? 'bg-accent-primary text-brand-bg border-brand-border' : 'bg-brand-card text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                          )}
                          aria-label={selected ? `Retirer ${a.name}` : `Sélectionner ${a.name}`}
                        >
                          {a.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-tx-secondary font-bold">
                  Coût estimé:{' '}
                  <span className="text-tx-base">
                    {(() => {
                      const venueCost = liveForm.venue === 'petite' ? 600 : liveForm.venue === 'moyenne' ? 2400 : liveForm.venue === 'grande' ? 8000 : 30000;
                      const cities = liveForm.kind === 'tour_multi' ? clamp(liveForm.cities, 3, 5) : 1;
                      const selectedArtists = data.artists.filter((a) => liveForm.artistIds.includes(a.id));
                      const artistsFee = selectedArtists.reduce((acc, a) => acc + 500 * a.notoriety * a.notoriety, 0);
                      const kindCost = liveForm.kind === 'festival' ? 15000 : liveForm.kind === 'ceremonie' ? 50000 : liveForm.kind === 'corporatif' ? 5000 : 0;
                      return formatShortNumber(Math.floor(venueCost + artistsFee * cities + kindCost));
                    })()}{' '}
                    ₶
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    startLiveProject({ kind: liveForm.kind, venue: liveForm.venue, artistIds: liveForm.artistIds, cities: liveForm.cities, outdoor: liveForm.outdoor });
                    setCreateOpen(false);
                  }}
                  className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                  aria-label="Lancer l’événement live"
                >
                  Lancer
                </button>
              </div>
            </div>
          )
        ) : data.sectorTab === 'jv' ? (
          !unlocked.jv ? (
            <div className="text-sm text-tx-secondary font-bold">Débloque à {formatShortNumber(UNLOCKS.jv)} ₶ cumulés.</div>
          ) : data.studios.length === 0 ? (
            <div className="text-sm text-tx-secondary font-bold">Achète un studio dans l’onglet JV avant de produire un jeu.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Genre</div>
                  <select
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    value={gameForm.genre}
                    onChange={(e) => setGameForm((f) => ({ ...f, genre: e.target.value as ApexGameGenre }))}
                    aria-label="Genre du jeu"
                  >
                    {GAME_GENRES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Modèle</div>
                  <select
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    value={gameForm.model}
                    onChange={(e) => setGameForm((f) => ({ ...f, model: e.target.value as typeof gameForm.model }))}
                    aria-label="Modèle économique"
                  >
                    <option value="pay_once">Pay-once</option>
                    <option value="f2p">F2P</option>
                    <option value="abonnement">Abonnement</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Budget dev</div>
                  <input
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    type="number"
                    min={1}
                    value={gameForm.devBudget}
                    onChange={(e) => setGameForm((f) => ({ ...f, devBudget: Math.max(1, Math.floor(Number(e.target.value || 0))) }))}
                    aria-label="Budget de développement"
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Budget marketing</div>
                  <input
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    type="number"
                    min={0}
                    value={gameForm.marketingBudget}
                    onChange={(e) => setGameForm((f) => ({ ...f, marketingBudget: Math.max(0, Math.floor(Number(e.target.value || 0))) }))}
                    aria-label="Budget marketing"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    startGameProject(gameForm);
                    setCreateOpen(false);
                  }}
                  className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
                  aria-label="Lancer le jeu"
                >
                  Lancer
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="text-sm text-tx-secondary font-bold">Ce secteur est en cours d’intégration selon le prompt.</div>
        )}
      </Modal>

      <Modal open={signModalOpen} onClose={() => setSignModalOpen(false)} title="Signer un artiste">
        {(() => {
          const offer = signingOfferId ? data.artistMarket.find((a) => a.id === signingOfferId) : null;
          if (!offer) return <div className="text-sm text-tx-secondary font-bold">Offre indisponible.</div>;
          const estimate = Math.floor(offer.baseSalaryPerMonth * (1 - clamp(data.reputation.musique / 250, 0, 0.35)));
          const ratio = signingSalary / Math.max(1, estimate);
          const durationPenalty = clamp((signingMonths - 6) * 0.012, -0.04, 0.07);
          const baseProb = ratio <= 1 ? 0.85 + (1 - ratio) * 0.18 : 0.85 - (ratio - 1) * 0.6;
          const prob = clamp(baseProb - offer.refusals * 0.08 - durationPenalty, 0.05, 0.95);

          return (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
                <div className="font-display font-black tracking-wider uppercase">{offer.name}</div>
                <div className="mt-2 text-sm text-tx-secondary font-bold">
                  Notoriété {offer.notoriety}/5 • {offer.style}
                </div>
                <div className="mt-1 text-sm text-tx-secondary font-bold">
                  Signature: <span className="text-tx-base">{formatShortNumber(offer.signatureFee)} ₶</span>
                </div>
                <div className="mt-1 text-sm text-tx-secondary font-bold">
                  Salaire estimé: <span className="text-tx-base">{formatShortNumber(estimate)} ₶/mois</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Durée (mois)</div>
                  <select
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    value={signingMonths}
                    onChange={(e) => setSigningMonths(Math.max(1, Math.min(12, Math.floor(Number(e.target.value || 6)))))}
                    aria-label="Durée du contrat"
                  >
                    {[1, 3, 6, 9, 12].map((m) => (
                      <option key={m} value={m}>
                        {m} mois
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Salaire (₶/mois)</div>
                  <input
                    className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-inner px-3 font-bold"
                    type="number"
                    min={1}
                    value={signingSalary}
                    onChange={(e) => setSigningSalary(Math.max(1, Math.floor(Number(e.target.value || 0))))}
                    aria-label="Salaire mensuel"
                  />
                </label>
              </div>

              <div className="text-sm text-tx-secondary font-bold">
                Proba estimée: <span className="text-tx-base">{Math.round(prob * 100)}%</span> • Refus {offer.refusals}/3
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSignModalOpen(false)}
                  className="h-11 px-4 rounded-lg border-2 border-brand-border bg-transparent text-tx-secondary font-display font-black tracking-wider uppercase hover:bg-brand-card transition-colors"
                  aria-label="Annuler"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={attemptSignArtist}
                  disabled={data.cash < offer.signatureFee || data.artists.length >= rosterMax}
                  className={cn(
                    'h-11 px-4 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                    data.cash < offer.signatureFee || data.artists.length >= rosterMax
                      ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                      : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                  )}
                  aria-label="Signer"
                >
                  Signer
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal open={negotiateOpen} onClose={closeNegotiation} title={negotiationTarget?.title ?? 'Négociation'}>
        {!negotiationTarget ? (
          <div className="text-sm text-tx-secondary font-bold">Aucune négociation disponible.</div>
        ) : !negotiationTarget.ok.ok ? (
          <div className="text-sm text-tx-secondary font-bold">{negotiationTarget.ok.reason}</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
              <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Étape 1 — Estimation affichée</div>
              <div className="mt-2 text-sm text-tx-secondary font-bold">
                Estimation (meilleure proba):{' '}
                <span className="text-tx-base">
                  {formatShortNumber(
                    estimateDealPrice({
                      base: negotiationTarget.base,
                      hype: negotiationTarget.hype,
                      rep: negotiationTarget.rep,
                      ageMin: negotiationTarget.ageMin,
                      buyer: negotiationTarget.deal.negotiation.buyerId
                        ? negotiationTarget.deal.buyers.find((b) => b.id === negotiationTarget.deal.negotiation.buyerId) ?? negotiationTarget.deal.buyers[0]!
                        : negotiationTarget.deal.buyers[0]!,
                      macroMult: negotiationTarget.macroMult,
                    })
                  )}{' '}
                  ₶
                </span>
              </div>
              <div className="mt-2 text-xs text-tx-secondary font-bold">Hype {Math.round(negotiationTarget.hype)} • Réputation {Math.round(negotiationTarget.rep)}%</div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Étape 2 — Choisir un acheteur (3–5)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {negotiationTarget.deal.buyers.map((b) => {
                  const disabled = b.withdrawn;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() =>
                        negotiationTarget.update({
                          ...negotiationTarget.deal,
                          negotiation: {
                            buyerId: b.id,
                            askingPrice:
                              negotiationTarget.deal.negotiation.askingPrice ||
                              estimateDealPrice({
                                base: negotiationTarget.base,
                                hype: negotiationTarget.hype,
                                rep: negotiationTarget.rep,
                                ageMin: negotiationTarget.ageMin,
                                buyer: b,
                                macroMult: negotiationTarget.macroMult,
                              }),
                          },
                        })
                      }
                      disabled={disabled}
                      className={cn(
                        'rounded-xl border-2 p-3 text-left transition-colors',
                        negotiationTarget.deal.negotiation.buyerId === b.id ? 'bg-accent-primary text-brand-bg border-brand-border' : 'bg-brand-inner border-brand-border hover:bg-brand-card',
                        disabled ? 'opacity-60 cursor-not-allowed' : ''
                      )}
                      aria-label={`Acheteur ${b.name}`}
                    >
                      <div className="font-display font-black tracking-wider uppercase text-sm">{b.name}</div>
                      <div className={cn('mt-1 text-xs font-bold', negotiationTarget.deal.negotiation.buyerId === b.id ? 'text-brand-bg/80' : 'text-tx-secondary')}>
                        {b.personality === 'genereuse'
                          ? 'Offre généreuse — décide vite'
                          : b.personality === 'prudente'
                            ? 'Offre prudente — rarement pressé'
                            : b.personality === 'agressive'
                              ? 'Offre dure — négocie fort'
                              : 'Offre standard'}
                        {b.refusals > 0 ? ` • Refus ${b.refusals}/3` : ''}
                        {b.withdrawn ? ' • Retiré' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4 space-y-2">
              <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">
                Étape 3 — {activeNegotiation?.kind === 'music_streaming' ? 'Fixer tes royalties (par 5 min)' : 'Fixer ton prix'}
              </div>
              <input
                type="number"
                className="w-full h-11 rounded-lg border-2 border-brand-border bg-brand-bg px-3 font-bold"
                value={negotiationTarget.deal.negotiation.askingPrice || ''}
                onChange={(e) =>
                  negotiationTarget.update({
                    ...negotiationTarget.deal,
                    negotiation: { ...negotiationTarget.deal.negotiation, askingPrice: Math.max(1, Math.floor(Number(e.target.value || 0))) },
                  })
                }
                aria-label={activeNegotiation?.kind === 'music_streaming' ? 'Royalties par 5 min' : 'Prix demandé'}
              />
              {negotiationTarget.deal.negotiation.buyerId ? (
                <div className="text-xs text-tx-secondary font-bold">
                  Proba:{' '}
                  {(() => {
                    const buyer = negotiationTarget.deal.buyers.find((b) => b.id === negotiationTarget.deal.negotiation.buyerId);
                    if (!buyer) return '—';
                    const estimate = estimateDealPrice({ base: negotiationTarget.base, hype: negotiationTarget.hype, rep: negotiationTarget.rep, ageMin: negotiationTarget.ageMin, buyer, macroMult: negotiationTarget.macroMult });
                    const prob = acceptanceProbability({ asking: negotiationTarget.deal.negotiation.askingPrice || 1, estimate, buyer, negotiationBoost: negotiationTarget.negotiationBoost });
                    return `${Math.round(prob * 100)}%`;
                  })()}
                </div>
              ) : (
                <div className="text-xs text-tx-secondary font-bold">Choisis un acheteur pour voir la proba.</div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={attemptNegotiate}
                disabled={!negotiationTarget.deal.negotiation.buyerId || negotiationTarget.deal.negotiation.askingPrice <= 0}
                className={cn(
                  'h-11 px-4 rounded-lg border-2 font-display font-black tracking-wider uppercase transition-colors',
                  !negotiationTarget.deal.negotiation.buyerId || negotiationTarget.deal.negotiation.askingPrice <= 0
                    ? 'bg-brand-card text-tx-secondary border-brand-border opacity-60 cursor-not-allowed'
                    : 'bg-brand-inner text-tx-base border-brand-border hover:bg-tx-base hover:text-brand-bg hover:border-tx-base'
                )}
                aria-label="Lancer la négociation"
              >
                Négocier
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={agentModalOpen} onClose={() => setAgentModalOpen(false)} title="L’Agent">
        <div className="space-y-3">
          <div className="font-display text-xl font-black tracking-wider uppercase">{data.agent.title}</div>
          <div className="text-sm text-tx-secondary font-bold leading-relaxed">{data.agent.description}</div>
          <div className="text-xs text-tx-secondary font-bold">90 secondes pour décider.</div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={refuseAgent}
              className="h-11 px-4 rounded-lg border-2 border-brand-border bg-transparent text-tx-secondary font-display font-black tracking-wider uppercase hover:bg-brand-card transition-colors"
              aria-label="Refuser l'offre"
            >
              Refuser
            </button>
            <button
              type="button"
              onClick={acceptAgent}
              className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
              aria-label="Accepter l'offre"
            >
              Accepter
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={choiceEventModalOpen} onClose={() => setChoiceEventModalOpen(false)} title={data.event.title ?? 'Événement'}>
        <div className="space-y-3">
          <div className="text-sm text-tx-secondary font-bold leading-relaxed">{data.event.description}</div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => resolveChoiceEvent('b')}
              className="h-11 px-4 rounded-lg border-2 border-brand-border bg-transparent text-tx-secondary font-display font-black tracking-wider uppercase hover:bg-brand-card transition-colors"
              aria-label={data.event.choice?.bLabel ?? 'Option B'}
            >
              {data.event.choice?.bLabel ?? 'Option B'}
            </button>
            <button
              type="button"
              onClick={() => resolveChoiceEvent('a')}
              className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
              aria-label={data.event.choice?.aLabel ?? 'Option A'}
            >
              {data.event.choice?.aLabel ?? 'Option A'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={prestigeOpen} onClose={() => setPrestigeOpen(false)} title="Prestige — Nouveau Sommet">
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
            <div className="text-sm text-tx-secondary font-bold">
              Tu peux prendre ta retraite et recommencer à zéro en gardant tes Apex Stars et tes upgrades permanentes.
            </div>
          </div>

          <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-accent-primary" aria-hidden="true" />
              <div className="font-display font-black tracking-wider uppercase">Apex Stars</div>
            </div>
            <div className="mt-2 text-sm text-tx-secondary font-bold">
              Stars disponibles: <span className="text-tx-base">{data.prestige.stars} ★</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {getPrestigeUpgrades().map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => buyPrestigeUpgrade(u.id)}
                  disabled={Boolean(data.prestige.upgrades[u.id]) || data.prestige.stars < u.cost}
                  className={cn(
                    'rounded-xl border-2 p-3 text-left transition-colors',
                    data.prestige.upgrades[u.id] ? 'bg-brand-card border-brand-border opacity-70 cursor-not-allowed' : 'bg-brand-inner border-brand-border hover:bg-brand-card',
                    data.prestige.stars < u.cost && !data.prestige.upgrades[u.id] ? 'opacity-60 cursor-not-allowed' : ''
                  )}
                  aria-label={`Acheter upgrade ${u.name}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-display font-black tracking-wider uppercase text-sm">{u.name}</div>
                      <div className="mt-1 text-xs text-tx-secondary font-bold">{u.description}</div>
                    </div>
                    <div className="text-sm font-black text-accent-primary">{u.cost} ★</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={doPrestige}
              className="h-11 px-4 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
              aria-label="Faire un prestige"
            >
              Faire prestige
            </button>
          </div>
        </div>
      </Modal>

      <SpotlightTutorial
        open={tutorialOpen}
        stepIndex={tutorialStep}
        steps={tutorialSteps}
        targetEl={tutorialTargetEl}
        onStepChange={setTutorialStep}
        onClose={() => {
          setTutorialOpen(false);
          setTutorialStep(0);
        }}
        storageKey="apex_tutorial_done_v1"
      />
    </main>
  );
}

function collectContracts(data: ApexSave): Array<{ key: string; label: string; sub: string; open: NonNullable<Parameters<(x: any) => void>[0]> }> {
  const now = data.lastActionAt;
  const out: Array<{ key: string; label: string; sub: string; open: any }> = [];

  for (const f of data.films) {
    if (f.status !== 'released' || !f.releasedAt) continue;
    const embargo = f.productionEndsAt + 30 * 60 * 1000;
    if (now < embargo || f.hype < 10) continue;
    if (!f.broadcastRights.sold) out.push({ key: `${f.id}_broadcast`, label: `${f.title} — Diffusion`, sub: 'Cinéma', open: { kind: 'film_broadcast', filmId: f.id } });
    for (const zone of ['europe', 'americas', 'asia'] as const) {
      const d = f.intlRights[zone];
      if (d.sold) continue;
      out.push({
        key: `${f.id}_intl_${zone}`,
        label: `${f.title} — Intl ${zone === 'americas' ? 'Amériques' : zone === 'asia' ? 'Asie' : 'Europe'}`,
        sub: 'Cinéma',
        open: { kind: 'film_intl', filmId: f.id, zone },
      });
    }
  }

  for (const p of data.musicProjects) {
    if (p.status !== 'released' || !p.releasedAt) continue;
    const embargo = p.releasedAt + 30 * 60 * 1000;
    if (now < embargo || p.hype < 10) continue;
    if (!p.streamingRights.sold) out.push({ key: `${p.id}_stream`, label: `${p.title} — Streaming`, sub: 'Musique', open: { kind: 'music_streaming', projectId: p.id } });
    if (!(p.adsRights?.sold ?? false))
      out.push({ key: `${p.id}_ads`, label: `${p.title} — Publicité`, sub: 'Musique', open: { kind: 'music_ads', projectId: p.id } });
  }

  for (const p of data.seriesProjects) {
    if (p.status !== 'released' || !p.releasedAt) continue;
    const embargo = p.releasedAt + 30 * 60 * 1000;
    if (now < embargo || p.hype < 10) continue;
    if (p.releaseStrategy === 'territoires') {
      for (const zone of ['europe', 'americas', 'asia'] as const) {
        const sold = p.territoryRights?.[zone]?.sold ?? false;
        if (sold) continue;
        out.push({
          key: `${p.id}_series_${zone}`,
          label: `${p.title} — ${zone === 'americas' ? 'Amériques' : zone === 'asia' ? 'Asie' : 'Europe'}`,
          sub: 'Séries',
          open: { kind: 'series_territory', projectId: p.id, zone },
        });
      }
    } else {
      if (!p.distributionRights.sold) out.push({ key: `${p.id}_series`, label: `${p.title} — Plateforme`, sub: 'Séries', open: { kind: 'series_distribution', projectId: p.id } });
    }
    if (p.renewalOffer && now < p.renewalOffer.expiresAt) {
      out.push({ key: `${p.id}_renewal`, label: `${p.title} — Renouvellement`, sub: 'Séries', open: { kind: 'series_renewal', projectId: p.id } });
    }
  }

  for (const p of data.liveProjects) {
    if (p.hype < 10) continue;
    if (p.status === 'active') {
      if (!p.tvRights.sold) out.push({ key: `${p.id}_live_tv`, label: `${p.title} — Droits TV`, sub: 'Live', open: { kind: 'live_tv', projectId: p.id } });
      if (!p.sponsorship.sold) out.push({ key: `${p.id}_live_sponsor`, label: `${p.title} — Sponsoring`, sub: 'Live', open: { kind: 'live_sponsor', projectId: p.id } });
    }
    if (p.status === 'done') {
      if (!p.recordingRights.sold && now >= p.endsAt) out.push({ key: `${p.id}_live_rec`, label: `${p.title} — Captation`, sub: 'Live', open: { kind: 'live_recording', projectId: p.id } });
    }
  }

  for (const p of data.gameProjects) {
    if (p.status !== 'released' || !p.releasedAt) continue;
    const embargo = p.releasedAt + 30 * 60 * 1000;
    if (now < embargo || p.hype < 10) continue;
    if (p.distributionRights.sold) continue;
    out.push({ key: `${p.id}_game`, label: `${p.title} — Distribution`, sub: 'JV', open: { kind: 'game_distribution', projectId: p.id } });
  }

  return out;
}

function ProjectCard(props: { title: string; subtitle: string; status: string; hype: number; progress: number }) {
  return (
    <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display font-black tracking-wider uppercase">{props.title}</div>
          <div className="mt-1 text-sm text-tx-secondary font-bold">{props.subtitle}</div>
          <div className="mt-2 text-xs text-tx-secondary font-bold">{props.status}</div>
        </div>
        <div className="text-xs text-tx-secondary font-black">{Math.round(props.hype)} hype</div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-brand-bg border border-brand-border overflow-hidden" aria-label="Progression">
        <div className="h-full bg-accent-primary" style={{ width: `${clamp(props.progress, 0, 1) * 100}%` }} />
      </div>
      <div className="mt-2 h-2 rounded-full bg-brand-bg border border-brand-border overflow-hidden" aria-label="Hype">
        <div className={cn('h-full', hypeColor(props.hype))} style={{ width: `${clamp(props.hype, 0, 100)}%` }} />
      </div>
    </div>
  );
}

function Sparkline(props: { values: number[] }) {
  const values = props.values;
  const w = 220;
  const h = 56;
  const pad = 4;
  const slice = values.length > 300 ? values.slice(values.length - 300) : values;
  const min = slice.reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
  const max = slice.reduce((a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY);
  const span = Math.max(1e-9, max - min);

  const points = slice
    .map((v, i) => {
      const x = pad + (i / Math.max(1, slice.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / span) * (h - pad * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="mt-3" aria-label="Graphique 5 minutes">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} className="text-accent-primary" />
    </svg>
  );
}

function Modal(props: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label={props.title}>
      <button type="button" className="absolute inset-0 bg-brand-bg/80 backdrop-blur" onClick={props.onClose} aria-label="Fermer" />
      <div className="relative w-full max-w-2xl rounded-2xl border-2 border-brand-border bg-brand-card shadow-brutal p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="font-display text-xl font-black tracking-wider uppercase">{props.title}</div>
          <button
            type="button"
            onClick={props.onClose}
            className="h-10 px-3 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
            aria-label="Fermer la fenêtre"
          >
            Fermer
          </button>
        </div>
        <div className="mt-4">{props.children}</div>
      </div>
    </div>
  );
}

function MobileBar(props: {
  cash: number;
  cashPerMin: number;
  globalRep: number;
  onCreate: () => void;
  onTutorial: () => void;
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
  createButtonRef: (el: HTMLButtonElement | null) => void;
  fabButtonRef: (el: HTMLButtonElement | null) => void;
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
}) {
  return (
    <div className="lg:hidden">
      <div className="sticky top-0 z-30 border-b-2 border-brand-border bg-brand-bg/90 backdrop-blur">
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="text-sm font-black">{formatShortNumber(Math.floor(props.cash))} ₶</div>
          <div className="text-xs text-tx-secondary font-bold">{formatShortNumber(Math.floor(props.cashPerMin))} ₶/min</div>
          <div className="text-xs text-tx-secondary font-bold">{Math.round(props.globalRep)}%</div>
          <button
            type="button"
            onClick={props.onTutorial}
            className="h-9 w-9 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base flex items-center justify-center"
            aria-label="Ouvrir le tutoriel"
          >
            <HelpCircle className="h-4 w-4 text-tx-secondary" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => props.onSheetOpenChange(true)}
            className="h-9 w-9 rounded-lg border-2 border-brand-border bg-brand-inner text-tx-base flex items-center justify-center"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={props.onCreate}
        ref={props.createButtonRef}
        className="fixed bottom-4 left-4 right-4 z-30 h-12 rounded-xl border-2 border-brand-border bg-brand-inner text-tx-base font-display font-black tracking-wider uppercase shadow-brutal hover:bg-tx-base hover:text-brand-bg hover:border-tx-base transition-colors"
        aria-label="Lancer un projet"
      >
        + Lancer un projet
      </button>

      <button
        type="button"
        onClick={() => props.onSheetOpenChange(true)}
        ref={props.fabButtonRef}
        className="fixed bottom-20 right-4 z-30 h-12 w-12 rounded-full border-2 border-brand-border bg-accent-primary text-brand-bg shadow-brutal flex items-center justify-center"
        aria-label="Ouvrir la bottom sheet"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </button>

      <Modal open={props.sheetOpen} onClose={() => props.onSheetOpenChange(false)} title="Panneau">
        <div className="grid gap-4">
          {props.rightContent}
          {props.leftContent}
          <div className="rounded-2xl border-2 border-brand-border bg-brand-inner p-4">
            <div className="text-xs text-tx-secondary font-black tracking-widest uppercase">Réputation globale</div>
            <div className="mt-2 text-sm font-black">{Math.round(props.globalRep)}%</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
