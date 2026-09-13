import type { MarketId } from './assets';

/**
 * What the page needs to draw a headline. Kept apart from the news book so
 * the browser does not download every headline the market could ever print.
 */

export type NewsCategory = 'geo' | 'eco' | 'energie' | 'tech' | 'entreprise' | 'crypto' | 'rumeur';
export type Certainty = 'evidente' | 'ambigue' | 'pile';

export const CATEGORIES: Record<NewsCategory, { label: string; dot: string; border: string; text: string }> = {
  geo: { label: 'Géopolitique', dot: 'bg-red-500', border: 'border-l-red-500', text: 'text-red-400' },
  eco: { label: 'Économie', dot: 'bg-emerald-400', border: 'border-l-emerald-400', text: 'text-emerald-300' },
  energie: { label: 'Énergie', dot: 'bg-yellow-400', border: 'border-l-yellow-400', text: 'text-yellow-300' },
  tech: { label: 'Tech', dot: 'bg-sky-400', border: 'border-l-sky-400', text: 'text-sky-300' },
  entreprise: { label: 'Entreprise', dot: 'bg-violet-400', border: 'border-l-violet-400', text: 'text-violet-300' },
  crypto: { label: 'Crypto', dot: 'bg-orange-400', border: 'border-l-orange-400', text: 'text-orange-300' },
  rumeur: { label: 'Rumeur', dot: 'bg-zinc-400', border: 'border-l-zinc-500', text: 'text-zinc-300' },
};

export const CERTAINTY: Record<Certainty, { label: string; hint: string }> = {
  evidente: { label: 'Claire', hint: 'Le sens ne fait presque aucun doute.' },
  ambigue: { label: 'Floue', hint: 'Une tendance probable, sans garantie.' },
  pile: { label: '50/50', hint: 'Personne ne sait. Mouvement plus violent.' },
};

/** The announced-results loop, as the market page's banner shows it. */
export type ResultCycle =
  | { phase: 'waiting'; announceAt: number }
  | { phase: 'announced'; news: KrashNews }
  | { phase: 'revealed'; news: KrashNews; move: number };

export interface KrashNews {
  id: string;
  at: number;
  category: NewsCategory;
  certainty: Certainty;
  text: string;
  hints: { label: string; up: number; markets: MarketId[]; ref: string }[];
  markets: MarketId[];
  arc?: string;
  chapter?: number;
  /** A market-wide KRACH or BULL RUN, or the rumour announcing one. */
  event?: 'krach' | 'bullrun';
  rumour?: boolean;
  /** A result announced in advance, and the announcement itself. */
  scheduled?: { resolveAt: number; asset: string; announce: boolean };
}
