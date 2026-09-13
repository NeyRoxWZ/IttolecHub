import { THEMES, RARITY_COLOR, RARITY_LABEL, type Rarity } from '@/lib/casino/cosmetics';

/**
 * Krash cosmetics.
 *
 * Built exactly like the casino's: the same thirty themes crossed with a set
 * of slots, split by a fixed seed between the pass (by season) and crates.
 * The slots are Krash's own — there is no card back or table felt on a
 * trading screen, but there is a price curve, a background, card frames, a
 * title, a celebration, a sound pack and an emblem.
 */

export { RARITY_COLOR, RARITY_LABEL };
export type { Rarity };

export type KrashSlot = 'chart' | 'table' | 'border' | 'title' | 'win_fx' | 'sound' | 'emblem';

export const KRASH_SLOTS: KrashSlot[] = ['chart', 'table', 'border', 'title', 'win_fx', 'sound', 'emblem'];

export const KRASH_SLOT_LABEL: Record<KrashSlot, string> = {
  chart: 'Courbe',
  table: 'Fond',
  border: 'Contour',
  title: 'Titre',
  win_fx: 'Effet de gain',
  sound: 'Pack sonore',
  emblem: 'Emblème',
};

/** Where each slot shows, in the words the inventory uses. */
export const KRASH_SLOT_HINT: Record<KrashSlot, string> = {
  chart: 'Les couleurs du graphique du marché.',
  table: 'Le fond de toutes les pages Krash.',
  border: 'Le contour des cartes et du graphique.',
  title: 'Sous ton pseudo, au classement et sur ta fiche.',
  win_fx: 'La célébration quand tu retires un gros gain.',
  sound: 'Tous les sons de Krash.',
  emblem: 'À côté de ton solde et de ton pseudo.',
};

export type WinStyle = 'confetti' | 'coins' | 'shock' | 'sparks' | 'fireworks';
export type SoundPack = 'retro' | 'lounge' | 'arcade' | 'space' | 'western' | 'orchestral';

export interface KrashCosmeticParams {
  /** chart */
  up?: string;
  down?: string;
  /** table */
  from?: string;
  to?: string;
  pattern?: string;
  /** border, title, emblem, win_fx, sound */
  color?: string;
  glow?: boolean;
  animated?: boolean;
  colors?: string[];
  winStyle?: WinStyle;
  pack?: SoundPack;
  art?: string;
  title?: string;
}

export type KrashSource = 'pass' | 'caisse';

export const KRASH_SOURCE_LABEL: Record<KrashSource, string> = { pass: 'Pass Krash', caisse: 'Caisses' };

export interface KrashCosmetic {
  id: string;
  slot: KrashSlot;
  name: string;
  themeKey: string;
  themeName: string;
  rarity: Rarity;
  source: KrashSource;
  season?: number;
  params: KrashCosmeticParams;
}

/** A trader title per theme, in the theme's mood. */
const TITLES: Record<string, string> = {
  brasier: 'Main de feu', givre: 'Sang-froid glacial', orage: 'Faiseur d’orages', toxique: 'Actif toxique',
  or: 'Lingot vivant', neon: 'Trader de minuit', sang: 'Vendeur à découvert', abyssal: 'Plongeur des krachs',
  jungle: 'Loup de la jungle', onyx: 'Main invisible', bonbon: 'Chasseur de memecoins', sable: 'Baron du pétrole',
  spectre: 'Fantôme de la corbeille', magma: 'Bull run ambulant', emeraude: 'Pluie de dividendes', saphir: 'Initié',
  rubis: 'Roi du levier', amethyste: 'Oracle des news', ambre: 'Spéculateur', chrome: 'Algorithme humain',
  retro: 'Vieux briscard', vapeur: 'Bulle spéculative', cosmos: 'To the moon', rouille: 'Survivant du krach',
  marbre: 'Institutionnel', prisme: 'Diversifié', arctique: 'Nerfs d’acier', ombre: 'Délit d’initié',
  solaire: 'Rayon vert', velours: 'Gants de velours',
};

const SLOT_RARITY: Record<KrashSlot, Rarity> = {
  table: 'commun',
  border: 'rare',
  title: 'rare',
  chart: 'epique',
  win_fx: 'epique',
  sound: 'epique',
  emblem: 'legendaire',
};

/** Blend two #rrggbb colours; t = 0 gives a, t = 1 gives b. */
function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

type Theme = (typeof THEMES)[number];

function paramsFor(theme: Theme, slot: KrashSlot): KrashCosmeticParams {
  switch (slot) {
    // The falling colour keeps a clear red cast so a skin never hides a loss.
    case 'chart': return { up: theme.accent, down: mix(theme.accent, '#FF2E4D', 0.65), color: theme.accent };
    case 'table': return { from: theme.dark, to: theme.mid, pattern: theme.pattern, color: theme.accent };
    case 'border': return { color: theme.accent, glow: true, animated: theme.pattern === 'rays' };
    case 'title': return { color: theme.accent, title: TITLES[theme.key] ?? theme.name };
    case 'win_fx': return { winStyle: theme.winStyle, colors: [theme.accent, theme.mid, '#FFFFFF'], color: theme.accent };
    case 'sound': return { pack: theme.pack, color: theme.accent };
    case 'emblem': return { art: theme.art, color: theme.accent };
  }
}

function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
}

function shuffled<T>(list: T[], seed: string): T[] {
  const rand = seeded(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const KRASH_PASS_SEASONS = 10;
export const KRASH_COSMETICS_PER_SEASON = 12;

function build(): KrashCosmetic[] {
  const all: KrashCosmetic[] = THEMES.flatMap((theme) => KRASH_SLOTS.map((slot) => ({
    id: `krash:${theme.key}:${slot}`,
    slot,
    name: slot === 'title' ? `Titre « ${TITLES[theme.key] ?? theme.name} »` : `${KRASH_SLOT_LABEL[slot]} ${theme.name}`,
    themeKey: theme.key,
    themeName: theme.name,
    rarity: SLOT_RARITY[slot],
    source: 'caisse' as KrashSource,
    params: paramsFor(theme, slot),
  })));

  // A fixed split: the first slice goes to the pass, season by season.
  const order = shuffled(all.map((c) => c.id), 'krash-source-split-v1');
  const seasonOf = new Map<string, number>();
  order.slice(0, KRASH_PASS_SEASONS * KRASH_COSMETICS_PER_SEASON)
    .forEach((id, i) => seasonOf.set(id, Math.floor(i / KRASH_COSMETICS_PER_SEASON) + 1));

  for (const c of all) {
    const season = seasonOf.get(c.id);
    if (season) { c.source = 'pass'; c.season = season; }
  }
  return all;
}

export const KRASH_COSMETICS: KrashCosmetic[] = build();
const BY_ID = new Map(KRASH_COSMETICS.map((c) => [c.id, c]));

export function krashCosmeticById(id: string): KrashCosmetic | undefined {
  return BY_ID.get(id);
}

export function isKrashCosmetic(id: string): boolean {
  return BY_ID.has(id);
}

export const KRASH_CRATE_COSMETICS = KRASH_COSMETICS.filter((c) => c.source === 'caisse');

export function krashPassCosmetics(season: number): KrashCosmetic[] {
  return KRASH_COSMETICS.filter((c) => c.source === 'pass' && c.season === season);
}

/** The pass starts counting seasons from Krash's launch month. */
export const KRASH_SEASON_ANCHOR = '2026-09-01';

export function krashSeason(date = new Date()): number {
  const anchor = new Date(`${KRASH_SEASON_ANCHOR}T00:00:00.000Z`);
  const months = (date.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (date.getUTCMonth() - anchor.getUTCMonth());
  return Math.min(KRASH_PASS_SEASONS, Math.max(1, months + 1));
}

/** Pass pieces from seasons still to come stay hidden, like the casino's. */
export function visibleKrashCosmetics(season = krashSeason()): KrashCosmetic[] {
  return KRASH_COSMETICS.filter((c) => c.source === 'caisse' || (c.season ?? 1) <= season);
}
