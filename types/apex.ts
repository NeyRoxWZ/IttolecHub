export type ApexSectorId = 'cinema' | 'musique' | 'series' | 'live' | 'jv' | 'crypto' | 'bourse';

export type ApexCinemaGenre =
  | 'Action'
  | 'Drame'
  | 'Comédie'
  | 'Horreur'
  | 'SF'
  | 'Animation'
  | 'Documentaire'
  | 'Romance';

export type ApexGameGenre = 'RPG' | 'FPS' | 'Mobile' | 'Simulation' | 'Indé' | 'MMO';

export type ApexProjectStatus = 'producing' | 'released';

export interface ApexBuyer {
  id: string;
  name: string;
  personality: 'prudente' | 'standard' | 'genereuse' | 'agressive';
  refusals: number;
  withdrawn: boolean;
}

export interface ApexNegotiation {
  buyerId: string | null;
  askingPrice: number;
}

export interface ApexRightsDeal {
  sold: boolean;
  soldAt?: number;
  buyerName?: string;
  amount?: number;
  negotiation: ApexNegotiation;
  buyers: ApexBuyer[];
  embargoUntil?: number;
}

export interface ApexDirector {
  name: string;
  level: 1 | 2 | 3 | 4 | 5;
  specialty: ApexCinemaGenre;
}

export interface ApexFilmProject {
  id: string;
  title: string;
  genre: ApexCinemaGenre;
  productionBudget: number;
  marketingPercent: number;
  marketingBudget: number;
  premiere: boolean;
  revenueShare: number;
  qualityBonus: number;
  franchiseRootId?: string;
  sequelOfFilmId?: string;
  sequelIndex?: number;
  frozenUntil?: number | null;
  director: ApexDirector;
  cast: string[];
  status: ApexProjectStatus;
  startedAt: number;
  productionEndsAt: number;
  releasedAt?: number;
  qualityScore?: number;
  hype: number;
  lastHypeAt: number;
  boxOfficeEndsAt?: number;
  boxOfficePerMin?: number;
  totalBoxOffice?: number;
  broadcastRights: ApexRightsDeal;
  intlRights: {
    europe: ApexRightsDeal;
    americas: ApexRightsDeal;
    asia: ApexRightsDeal;
  };
  festival?: {
    submittedAt: number;
    resolvesAt: number;
    resolved: boolean;
    won: boolean;
  };
  merchUnlocked: boolean;
  merchEndsAt?: number;
  merchPerMin?: number;
}

export interface ApexMusicArtist {
  id: string;
  name: string;
  notoriety: 1 | 2 | 3 | 4 | 5;
  notorietyBoost: number;
  style: string;
  signedAt: number;
  contractEndsAt: number;
  salaryPerMonth: number;
  underpaidSince?: number | null;
  catalogBuyoutDeal?: ApexRightsDeal;
}

export interface ApexAvailableArtist {
  id: string;
  name: string;
  notoriety: 1 | 2 | 3 | 4 | 5;
  style: string;
  signatureFee: number;
  baseSalaryPerMonth: number;
  availableUntil: number;
  refusals: number;
  withdrawn: boolean;
}

export type ApexMusicProjectKind = 'single' | 'album' | 'tour_nationale' | 'tour_mondiale';

export interface ApexMusicProject {
  id: string;
  kind: ApexMusicProjectKind;
  title: string;
  artistId: string;
  artistName: string;
  featuringArtistId?: string;
  featuringArtistName?: string;
  tourVenue?: 'petite' | 'moyenne' | 'grande' | 'stade';
  tourCities?: number;
  startedAt: number;
  productionEndsAt: number;
  status: ApexProjectStatus;
  qualityScore?: number;
  hype: number;
  lastHypeAt: number;
  releasedAt?: number;
  payoutEndsAt?: number;
  payoutPerMin?: number;
  viralBoostEndsAt?: number;
  prereqSinglesMet?: boolean;
  nextStreamingPayoutAt?: number;
  syncEndsAt?: number;
  syncPayoutPerMin?: number;
  streamingRights: ApexRightsDeal;
  adsRights?: ApexRightsDeal;
}

export interface ApexSeriesProject {
  id: string;
  title: string;
  genre: string;
  seasonsPlanned: number;
  episodesPerSeason: 6 | 12 | 24;
  budgetPerEpisode: number;
  showrunner: { name: string; level: 1 | 2 | 3 | 4 | 5 };
  season?: number;
  cancelled?: boolean;
  releaseStrategy?: 'mondiale' | 'territoires';
  territoryRights?: {
    europe: ApexRightsDeal;
    americas: ApexRightsDeal;
    asia: ApexRightsDeal;
  };
  renewalOffer?: { offeredAt: number; expiresAt: number; deal: ApexRightsDeal } | null;
  startedAt: number;
  productionEndsAt: number;
  status: ApexProjectStatus;
  qualityScore?: number;
  hype: number;
  lastHypeAt: number;
  releasedAt?: number;
  distributionRights: ApexRightsDeal;
  renewalOffered?: boolean;
}

export interface ApexLiveProject {
  id: string;
  kind: 'concert' | 'festival' | 'ceremonie' | 'tour_multi' | 'corporatif';
  title: string;
  venue: 'petite' | 'moyenne' | 'grande' | 'stade';
  artistIds: string[];
  artistNames: string[];
  cities: number;
  outdoor: boolean;
  annual: boolean;
  nextAnnualAt?: number;
  cost: number;
  startedAt: number;
  endsAt: number;
  status: 'active' | 'done';
  hype: number;
  lastHypeAt: number;
  revenue?: number;
  tvRights: ApexRightsDeal;
  sponsorship: ApexRightsDeal;
  recordingRights: ApexRightsDeal;
}

export interface ApexGameProject {
  id: string;
  title: string;
  genre: ApexGameGenre;
  model: 'pay_once' | 'f2p' | 'abonnement';
  devBudget: number;
  marketingBudget: number;
  bugUntil?: number | null;
  port?: { platform: 'ArcBox' | 'NovaStation' | 'PocketPlay'; startedAt: number; endsAt: number; done: boolean };
  startedAt: number;
  productionEndsAt: number;
  status: ApexProjectStatus;
  qualityScore?: number;
  hype: number;
  lastHypeAt: number;
  releasedAt?: number;
  payoutEndsAt?: number;
  payoutPerMin?: number;
  distributionRights: ApexRightsDeal;
}

export type ApexCryptoId = 'BitApex' | 'EtherGlobe' | 'DogeStar' | 'ApexStable';

export interface ApexCryptoCoinState {
  id: ApexCryptoId;
  price: number;
  history: number[];
  holdings: number;
  costBasis: number;
  realizedProfit: number;
  miningRatePerMin: number;
  suspendedUntil?: number;
}

export interface ApexCryptoState {
  coins: Record<ApexCryptoId, ApexCryptoCoinState>;
  selected: ApexCryptoId;
}

export type ApexStockId =
  | 'CINEGLOBE'
  | 'SOUNDWAVE'
  | 'PRIMEVISION'
  | 'LIVENATION'
  | 'PIXELFORGE'
  | 'APEXMEDIA'
  | 'TECHSTREAM'
  | 'GLOBALADS';

export interface ApexStockState {
  prices: Record<ApexStockId, number>;
  history: Partial<Record<ApexStockId, number[]>>;
  shares: Partial<Record<ApexStockId, number>>;
  costBasis: Partial<Record<ApexStockId, number>>;
  realizedProfit: number;
  nextDividendAt: number;
  nextQuarterAt: number;
}

export type ApexGameStudioTier = 'inconnu' | 'inde' | 'aa' | 'aaa';

export interface ApexGameStudio {
  id: string;
  name: string;
  tier: ApexGameStudioTier;
  purchasedAt: number;
  buyoutOffer?: { amount: number; expiresAt: number };
}

export interface ApexStudioOffer {
  id: string;
  name: string;
  tier: ApexGameStudioTier;
  price: number;
  availableUntil: number;
}

export interface ApexPlatformState {
  unlocked: boolean;
  launchedAt?: number;
  subscribers: number;
  hostingCostPerMin: number;
  nextPayoutAt: number;
  offlineUntil?: number | null;
}

export interface ApexReputationState {
  cinema: number;
  musique: number;
  series: number;
  live: number;
  jv: number;
}

export interface ApexAgentState {
  active: boolean;
  offerId?: string;
  title?: string;
  description?: string;
  createdAt?: number;
  expiresAt?: number;
  refuseStreak: number;
  acceptCount: number;
  nextAt: number;
}

export interface ApexEventState {
  active: boolean;
  eventId?: string;
  title?: string;
  description?: string;
  startedAt?: number;
  endsAt?: number;
  kind?: 'positive' | 'negative' | 'choice';
  choice?: {
    aLabel: string;
    bLabel: string;
  };
  nextAt: number;
}

export interface ApexDrawStateMap {
  films?: { order: number[]; idx: number };
  artistes?: { order: number[]; idx: number };
  realisateurs?: { order: number[]; idx: number };
  acteurs?: { order: number[]; idx: number };
  showrunners?: { order: number[]; idx: number };
  studios_jv?: { order: number[]; idx: number };
  noms_series?: { order: number[]; idx: number };
  noms_jeux?: { order: number[]; idx: number };
}

export interface ApexSave {
  version: 1;
  cash: number;
  totalEarned: number;
  createdAt: number;
  lastActionAt: number;
  sectorTab: ApexSectorId;
  reputation: ApexReputationState;
  prestige: {
    stars: number;
    lifetimeStars: number;
    count: number;
    upgrades: Record<string, boolean | undefined>;
  };
  buffs: {
    nextFilmHypeBonus: number;
    nextFilmQualityBonus: number;
    nextFilmCoprod: boolean;
    dogeStarCrashHintUntil: number | null;
    partnershipUntil: number | null;
  };
  achievements: string[];
  draw: ApexDrawStateMap;
  films: ApexFilmProject[];
  artists: ApexMusicArtist[];
  artistMarket: ApexAvailableArtist[];
  musicProjects: ApexMusicProject[];
  seriesProjects: ApexSeriesProject[];
  liveProjects: ApexLiveProject[];
  studios: ApexGameStudio[];
  studioMarket: ApexStudioOffer[];
  gameProjects: ApexGameProject[];
  crypto: ApexCryptoState;
  stocks: ApexStockState;
  buyouts: Partial<Record<ApexStockId, boolean>>;
  marketAnalysis: { stockId: ApexStockId; hint: string; expiresAt: number } | null;
  platform: ApexPlatformState;
  agent: ApexAgentState;
  event: ApexEventState;
}
