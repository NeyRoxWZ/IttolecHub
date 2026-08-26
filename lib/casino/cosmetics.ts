/**
 * Cosmetics.
 *
 * 820 pieces, generated from a theme grid rather than written one by one —
 * that is the only way the collection can be this deep and still be
 * previewable, searchable and applicable without 820 bespoke components.
 *
 *   700 tied to a game   (35 per game, 20 games)
 *   100 general          (every game, and the screens around them)
 *    20 prestige         (one per prestige level)
 *
 * They are also split by where they come from, and a piece belongs to exactly
 * one source — a cosmetic that could drop from both a crate and the pass makes
 * neither worth chasing:
 *
 *   400 pass    (40 per season, ten seasons planned ahead)
 *   400 crates
 *    20 prestige
 *
 * Pass pieces stay hidden until their season is the live one; crate pieces are
 * visible from the start, greyed out until owned.
 */

export type CosmeticSlot =
  | 'table'      // scene background
  | 'skin'       // the game's own pieces (symbols, cards, ball, dino…)
  | 'win_fx'     // celebration
  | 'lose_fx'    // consolation
  | 'border'     // frame around the scene
  | 'particles'  // ambience while the action plays
  | 'sound'      // audio pack
  | 'emblem';    // badge shown next to the balance

export const COSMETIC_SLOTS: CosmeticSlot[] = [
  'table', 'skin', 'win_fx', 'lose_fx', 'border', 'particles', 'sound', 'emblem',
];

export const SLOT_LABEL: Record<CosmeticSlot, string> = {
  table: 'Tapis',
  skin: 'Skin',
  win_fx: 'Effet de victoire',
  lose_fx: 'Effet de défaite',
  border: 'Contour',
  particles: 'Particules',
  sound: 'Pack sonore',
  emblem: 'Emblème',
};

export type TablePattern = 'plain' | 'rays' | 'grid' | 'dots' | 'stripes';
export type WinStyle = 'confetti' | 'coins' | 'shock' | 'sparks' | 'fireworks';
export type LoseStyle = 'smoke' | 'crack' | 'ash' | 'static' | 'drip';
export type ParticleStyle = 'float' | 'rise' | 'fall' | 'orbit' | 'drift';
export type SoundPack = 'retro' | 'lounge' | 'arcade' | 'space' | 'western' | 'orchestral';

export interface CosmeticParams {
  from?: string;
  to?: string;
  pattern?: TablePattern;
  /** Skin: hue rotation + saturation applied to the game's own artwork. */
  hue?: number;
  saturate?: number;
  color?: string;
  colors?: string[];
  winStyle?: WinStyle;
  loseStyle?: LoseStyle;
  particleStyle?: ParticleStyle;
  glow?: boolean;
  animated?: boolean;
  pack?: SoundPack;
  /** Emblem: key into the shared casino artwork set. */
  art?: string;
}

export type Rarity = 'commun' | 'rare' | 'epique' | 'legendaire';

export const RARITY_LABEL: Record<Rarity, string> = {
  commun: 'Commun', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire',
};

export const RARITY_COLOR: Record<Rarity, string> = {
  commun: '#8A8AA0', rare: '#4FA3FF', epique: '#B061FF', legendaire: '#FFB300',
};

export type CosmeticSource = 'pass' | 'caisse' | 'prestige';

export const SOURCE_LABEL: Record<CosmeticSource, string> = {
  pass: 'Frenly Pass',
  caisse: 'Caisses',
  prestige: 'Prestige',
};

export const GLOBAL_SLUG = 'global';

export interface Cosmetic {
  id: string;
  gameSlug: string;
  slot: CosmeticSlot;
  name: string;
  themeKey: string;
  themeName: string;
  rarity: Rarity;
  source: CosmeticSource;
  /** Pass pieces only: which season hands this one out. */
  season?: number;
  /** Prestige pieces only. */
  prestige?: number;
  /** Applies to every game and to the screens around them. */
  global?: boolean;
  params: CosmeticParams;
}

/* ------------------------------------------------------------------ */
/* Themes                                                              */
/* ------------------------------------------------------------------ */

interface Theme {
  key: string;
  name: string;
  dark: string;
  mid: string;
  accent: string;
  pattern: TablePattern;
  hue: number;
  saturate: number;
  winStyle: WinStyle;
  loseStyle: LoseStyle;
  particleStyle: ParticleStyle;
  pack: SoundPack;
  art: string;
}

export const THEMES: Theme[] = [
  { key: 'brasier', name: 'Brasier', dark: '#1A0703', mid: '#5C1B06', accent: '#FF5A1F', pattern: 'rays', hue: 15, saturate: 1.5, winStyle: 'fireworks', loseStyle: 'ash', particleStyle: 'rise', pack: 'arcade', art: 'fire' },
  { key: 'givre', name: 'Givre', dark: '#061018', mid: '#123245', accent: '#9EE7FF', pattern: 'dots', hue: 190, saturate: 1.2, winStyle: 'sparks', loseStyle: 'crack', particleStyle: 'fall', pack: 'space', art: 'diamond' },
  { key: 'orage', name: 'Orage', dark: '#0A0A16', mid: '#1E2044', accent: '#7C5CFF', pattern: 'stripes', hue: 255, saturate: 1.4, winStyle: 'shock', loseStyle: 'static', particleStyle: 'orbit', pack: 'arcade', art: 'star' },
  { key: 'toxique', name: 'Toxique', dark: '#0C1604', mid: '#254D0C', accent: '#A3E635', pattern: 'grid', hue: 90, saturate: 1.5, winStyle: 'confetti', loseStyle: 'drip', particleStyle: 'float', pack: 'retro', art: 'bomb' },
  { key: 'or', name: 'Or massif', dark: '#1A1405', mid: '#4A3A0C', accent: '#FFD000', pattern: 'rays', hue: 45, saturate: 1.4, winStyle: 'coins', loseStyle: 'smoke', particleStyle: 'rise', pack: 'orchestral', art: 'crown' },
  { key: 'neon', name: 'Néon', dark: '#04070F', mid: '#0B2038', accent: '#00E5FF', pattern: 'grid', hue: 185, saturate: 1.7, winStyle: 'shock', loseStyle: 'static', particleStyle: 'orbit', pack: 'arcade', art: 'star' },
  { key: 'sang', name: 'Sang-froid', dark: '#14060A', mid: '#3D0D18', accent: '#FF2E4D', pattern: 'stripes', hue: 350, saturate: 1.5, winStyle: 'fireworks', loseStyle: 'drip', particleStyle: 'fall', pack: 'western', art: 'skull' },
  { key: 'abyssal', name: 'Abyssal', dark: '#03070E', mid: '#0B2038', accent: '#38BDF8', pattern: 'plain', hue: 205, saturate: 1.1, winStyle: 'sparks', loseStyle: 'smoke', particleStyle: 'drift', pack: 'space', art: 'gem' },
  { key: 'jungle', name: 'Jungle', dark: '#07140A', mid: '#16401F', accent: '#4ADE80', pattern: 'dots', hue: 130, saturate: 1.3, winStyle: 'confetti', loseStyle: 'ash', particleStyle: 'float', pack: 'western', art: 'clover' },
  { key: 'onyx', name: 'Onyx', dark: '#08080B', mid: '#1B1B22', accent: '#C9CCD6', pattern: 'plain', hue: 0, saturate: 0.35, winStyle: 'sparks', loseStyle: 'ash', particleStyle: 'drift', pack: 'lounge', art: 'diamond' },
  { key: 'bonbon', name: 'Bonbon', dark: '#2A0B2E', mid: '#B5179E', accent: '#FFCA3A', pattern: 'dots', hue: 320, saturate: 1.6, winStyle: 'confetti', loseStyle: 'drip', particleStyle: 'fall', pack: 'arcade', art: 'cherry' },
  { key: 'sable', name: 'Sable', dark: '#1A1408', mid: '#4E3B18', accent: '#E8C284', pattern: 'stripes', hue: 38, saturate: 1.1, winStyle: 'coins', loseStyle: 'smoke', particleStyle: 'drift', pack: 'western', art: 'moneyBag' },
  { key: 'spectre', name: 'Spectre', dark: '#0A0A12', mid: '#232338', accent: '#C4B5FD', pattern: 'plain', hue: 270, saturate: 0.8, winStyle: 'sparks', loseStyle: 'static', particleStyle: 'float', pack: 'lounge', art: 'skull' },
  { key: 'magma', name: 'Magma', dark: '#170402', mid: '#4E1204', accent: '#FF7043', pattern: 'rays', hue: 12, saturate: 1.6, winStyle: 'shock', loseStyle: 'ash', particleStyle: 'rise', pack: 'arcade', art: 'volcano' },
  { key: 'emeraude', name: 'Émeraude', dark: '#06160E', mid: '#0F4029', accent: '#25D07A', pattern: 'grid', hue: 155, saturate: 1.3, winStyle: 'coins', loseStyle: 'crack', particleStyle: 'orbit', pack: 'orchestral', art: 'gem' },
  { key: 'saphir', name: 'Saphir', dark: '#060C1E', mid: '#132C63', accent: '#3E8CFF', pattern: 'rays', hue: 220, saturate: 1.3, winStyle: 'sparks', loseStyle: 'smoke', particleStyle: 'orbit', pack: 'orchestral', art: 'diamond' },
  { key: 'rubis', name: 'Rubis', dark: '#170608', mid: '#4C1018', accent: '#FF3355', pattern: 'plain', hue: 355, saturate: 1.4, winStyle: 'fireworks', loseStyle: 'crack', particleStyle: 'rise', pack: 'orchestral', art: 'gem' },
  { key: 'amethyste', name: 'Améthyste', dark: '#120722', mid: '#361065', accent: '#A855F7', pattern: 'dots', hue: 280, saturate: 1.4, winStyle: 'confetti', loseStyle: 'static', particleStyle: 'drift', pack: 'lounge', art: 'star' },
  { key: 'ambre', name: 'Ambre', dark: '#1B1104', mid: '#5B3608', accent: '#FF9F1C', pattern: 'stripes', hue: 32, saturate: 1.3, winStyle: 'coins', loseStyle: 'smoke', particleStyle: 'fall', pack: 'retro', art: 'lemon' },
  { key: 'chrome', name: 'Chrome', dark: '#0D0F12', mid: '#2A3038', accent: '#E2E8F0', pattern: 'grid', hue: 210, saturate: 0.5, winStyle: 'shock', loseStyle: 'crack', particleStyle: 'orbit', pack: 'space', art: 'coinFace' },
  { key: 'retro', name: 'Rétro', dark: '#12071A', mid: '#3B0F52', accent: '#FF2E88', pattern: 'stripes', hue: 315, saturate: 1.5, winStyle: 'fireworks', loseStyle: 'static', particleStyle: 'rise', pack: 'retro', art: 'seven' },
  { key: 'vapeur', name: 'Vapeur', dark: '#0B0E14', mid: '#243044', accent: '#94A3B8', pattern: 'plain', hue: 200, saturate: 0.7, winStyle: 'sparks', loseStyle: 'smoke', particleStyle: 'drift', pack: 'lounge', art: 'ball' },
  { key: 'cosmos', name: 'Cosmos', dark: '#05050F', mid: '#141440', accent: '#818CF8', pattern: 'dots', hue: 240, saturate: 1.2, winStyle: 'fireworks', loseStyle: 'ash', particleStyle: 'orbit', pack: 'space', art: 'rocket' },
  { key: 'rouille', name: 'Rouille', dark: '#150A05', mid: '#452012', accent: '#C2632B', pattern: 'grid', hue: 22, saturate: 1.2, winStyle: 'sparks', loseStyle: 'crack', particleStyle: 'fall', pack: 'western', art: 'rock' },
  { key: 'marbre', name: 'Marbre', dark: '#101014', mid: '#31313C', accent: '#F1F5F9', pattern: 'plain', hue: 0, saturate: 0.4, winStyle: 'coins', loseStyle: 'crack', particleStyle: 'drift', pack: 'orchestral', art: 'crown' },
  { key: 'prisme', name: 'Prisme', dark: '#0A0714', mid: '#241748', accent: '#F472B6', pattern: 'rays', hue: 300, saturate: 1.6, winStyle: 'confetti', loseStyle: 'drip', particleStyle: 'orbit', pack: 'arcade', art: 'diamond' },
  { key: 'arctique', name: 'Arctique', dark: '#081218', mid: '#153A4A', accent: '#67E8F9', pattern: 'stripes', hue: 180, saturate: 1.1, winStyle: 'sparks', loseStyle: 'crack', particleStyle: 'fall', pack: 'space', art: 'diamond' },
  { key: 'ombre', name: 'Ombre', dark: '#06060A', mid: '#161620', accent: '#6E6E80', pattern: 'plain', hue: 0, saturate: 0.3, winStyle: 'shock', loseStyle: 'smoke', particleStyle: 'float', pack: 'lounge', art: 'door' },
  { key: 'solaire', name: 'Solaire', dark: '#1C1503', mid: '#6B4E06', accent: '#FDE047', pattern: 'rays', hue: 50, saturate: 1.5, winStyle: 'fireworks', loseStyle: 'ash', particleStyle: 'rise', pack: 'orchestral', art: 'star' },
  { key: 'velours', name: 'Velours', dark: '#100612', mid: '#3A0F3E', accent: '#D8B4FE', pattern: 'plain', hue: 290, saturate: 1.1, winStyle: 'coins', loseStyle: 'drip', particleStyle: 'drift', pack: 'lounge', art: 'crown' },
];

export const THEME_BY_KEY = new Map(THEMES.map((t) => [t.key, t]));

/* ------------------------------------------------------------------ */
/* Rarity                                                              */
/* ------------------------------------------------------------------ */

/**
 * Rarity follows how much of the screen a piece changes: a background tint is
 * common, a full reskin of the game's own artwork is legendary.
 */
const SLOT_RARITY: Record<CosmeticSlot, Rarity> = {
  table: 'commun',
  particles: 'commun',
  lose_fx: 'rare',
  border: 'rare',
  win_fx: 'epique',
  sound: 'epique',
  skin: 'legendaire',
  emblem: 'legendaire',
};

/** Cosmetics that work everywhere are one notch rarer than their slot. */
const BUMP: Record<Rarity, Rarity> = {
  commun: 'rare', rare: 'epique', epique: 'legendaire', legendaire: 'legendaire',
};

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

export const GAME_SLUGS = [
  'slots', 'blackjack', 'wheel', 'rocket', 'mines', 'plinko', 'hilo', 'grattage',
  'poulet', 'tower', 'keno', 'caisses', 'coinflip', 'dino', 'chevaux', 'bonneteau',
  'stade', 'baccarat', 'rps', 'craps',
];

export const GAME_LABELS: Record<string, string> = {
  slots: 'Slots', blackjack: '21', wheel: 'Wheel', rocket: 'Rocket', mines: 'Mines',
  plinko: 'Plinko', hilo: 'HiLo', grattage: 'Grattage', poulet: 'Poulet', tower: 'Tower',
  keno: 'Keno', caisses: 'Caisses', coinflip: 'Coinflip', dino: 'Dino', chevaux: 'Chevaux',
  bonneteau: 'Bonneteau', stade: 'Stade', baccarat: 'Baccarat', rps: 'PFC', craps: 'Craps',
};

export const PER_GAME_COUNT = 35;
export const GENERAL_COUNT = 100;
export const PASS_SEASONS = 10;
export const PASS_COSMETICS_PER_SEASON = 40;

/** Deterministic PRNG: the whole catalogue must be identical for everyone. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
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

function paramsFor(theme: Theme, slot: CosmeticSlot): CosmeticParams {
  switch (slot) {
    case 'table': return { from: theme.dark, to: theme.mid, pattern: theme.pattern, color: theme.accent };
    case 'skin': return { hue: theme.hue, saturate: theme.saturate, color: theme.accent };
    case 'win_fx': return { winStyle: theme.winStyle, colors: [theme.accent, theme.mid, '#FFFFFF'] };
    case 'lose_fx': return { loseStyle: theme.loseStyle, color: theme.mid };
    case 'border': return { color: theme.accent, glow: true, animated: theme.pattern === 'rays' };
    case 'particles': return { particleStyle: theme.particleStyle, color: theme.accent };
    case 'sound': return { pack: theme.pack, color: theme.accent };
    case 'emblem': return { art: theme.art, color: theme.accent };
  }
}

/** Every (theme, slot) pair, in a stable order. */
const ALL_PAIRS: { theme: Theme; slot: CosmeticSlot }[] = THEMES.flatMap(
  (theme) => COSMETIC_SLOTS.map((slot) => ({ theme, slot }))
);

function buildGameCosmetics(): Cosmetic[] {
  const out: Cosmetic[] = [];
  for (const game of GAME_SLUGS) {
    const pairs = shuffled(ALL_PAIRS, `game:${game}`).slice(0, PER_GAME_COUNT);
    for (const { theme, slot } of pairs) {
      out.push({
        id: `${game}:${theme.key}:${slot}`,
        gameSlug: game,
        slot,
        name: `${SLOT_LABEL[slot]} ${theme.name}`,
        themeKey: theme.key,
        themeName: theme.name,
        rarity: SLOT_RARITY[slot],
        source: 'caisse', // reassigned below
        params: paramsFor(theme, slot),
      });
    }
  }
  return out;
}

function buildGeneralCosmetics(): Cosmetic[] {
  const pairs = shuffled(ALL_PAIRS, 'general-set').slice(0, GENERAL_COUNT);
  return pairs.map(({ theme, slot }) => ({
    id: `${GLOBAL_SLUG}:${theme.key}:${slot}`,
    gameSlug: GLOBAL_SLUG,
    slot,
    name: `${SLOT_LABEL[slot]} ${theme.name}`,
    themeKey: theme.key,
    themeName: theme.name,
    rarity: BUMP[SLOT_RARITY[slot]],
    source: 'caisse' as CosmeticSource,
    global: true,
    params: paramsFor(theme, slot),
  }));
}

/* ------------------------------------------------------------------ */
/* Prestige                                                            */
/* ------------------------------------------------------------------ */

const PRESTIGE_THEME_ORDER = [
  'rouille', 'chrome', 'marbre', 'or', 'emeraude', 'saphir', 'rubis', 'amethyste',
  'onyx', 'ambre', 'neon', 'magma', 'givre', 'toxique', 'sang', 'spectre',
  'solaire', 'abyssal', 'prisme', 'cosmos',
];

function buildPrestigeCosmetics(): Cosmetic[] {
  return PRESTIGE_THEME_ORDER.map((key, i) => {
    const theme = THEME_BY_KEY.get(key)!;
    const slot = COSMETIC_SLOTS[i % COSMETIC_SLOTS.length];
    return {
      id: `prestige:${i + 1}`,
      gameSlug: GLOBAL_SLUG,
      slot,
      name: `${SLOT_LABEL[slot]} ${theme.name} · Prestige ${i + 1}`,
      themeKey: theme.key,
      themeName: theme.name,
      rarity: 'legendaire' as Rarity,
      source: 'prestige' as CosmeticSource,
      prestige: i + 1,
      global: true,
      params: paramsFor(theme, slot),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Source split                                                        */
/* ------------------------------------------------------------------ */

const DROPPABLE = [...buildGameCosmetics(), ...buildGeneralCosmetics()];

/**
 * Half the catalogue goes to the pass, split into ten seasons of forty; the
 * rest lives in crates. The split is seeded, so it never moves.
 */
const SPLIT = shuffled(DROPPABLE.map((c) => c.id), 'source-split-v2');
const PASS_IDS = SPLIT.slice(0, PASS_SEASONS * PASS_COSMETICS_PER_SEASON);
const PASS_SEASON_OF = new Map<string, number>();
PASS_IDS.forEach((id, i) => PASS_SEASON_OF.set(id, Math.floor(i / PASS_COSMETICS_PER_SEASON) + 1));

for (const cosmetic of DROPPABLE) {
  const season = PASS_SEASON_OF.get(cosmetic.id);
  if (season) {
    cosmetic.source = 'pass';
    cosmetic.season = season;
  }
}

export const COSMETICS: Cosmetic[] = [...DROPPABLE, ...buildPrestigeCosmetics()];

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export function cosmeticById(id: string): Cosmetic | undefined {
  return BY_ID.get(id);
}

/** Only ever found in crates. */
export const CRATE_COSMETICS: Cosmetic[] = COSMETICS.filter((c) => c.source === 'caisse');

/** The pass pieces of one season. */
export function passCosmeticsForSeason(season: number): Cosmetic[] {
  return COSMETICS.filter((c) => c.source === 'pass' && c.season === season);
}

export function prestigeCosmetic(level: number): Cosmetic | undefined {
  return COSMETICS.find((c) => c.prestige === level);
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export function cosmeticsForGame(gameSlug: string): Cosmetic[] {
  return COSMETICS.filter((c) => c.gameSlug === gameSlug);
}

export function gameLabel(gameSlug: string): string {
  if (gameSlug === GLOBAL_SLUG) return 'Général';
  return GAME_LABELS[gameSlug] ?? gameSlug;
}

export function gameTheme(gameSlug: string): string {
  return gameSlug === GLOBAL_SLUG ? 'Tous les jeux et tous les écrans' : `${PER_GAME_COUNT} pièces`;
}

/** "Général" first: it is the set that shows up everywhere. */
export const COSMETIC_GAME_ORDER = [GLOBAL_SLUG, ...GAME_SLUGS];

export function cosmeticsByRarity(rarity: Rarity): Cosmetic[] {
  return COSMETICS.filter((c) => c.rarity === rarity);
}

/**
 * What the collection should list. A pass piece from a season that hasn't
 * started yet is not shown at all — it appears, greyed out, the week its
 * season goes live.
 */
export function visibleCosmetics(currentSeason: number, gameSlug?: string): Cosmetic[] {
  return COSMETICS.filter((c) => {
    if (gameSlug && c.gameSlug !== gameSlug) return false;
    if (c.source === 'pass') return (c.season ?? 1) <= currentSeason;
    return true;
  });
}

/** Stock report, so it's obvious when new seasons need writing. */
export function cosmeticStock() {
  const pass = COSMETICS.filter((c) => c.source === 'pass');
  const bySeason = Array.from({ length: PASS_SEASONS }, (_, i) => ({
    season: i + 1,
    count: pass.filter((c) => c.season === i + 1).length,
  }));
  return {
    total: COSMETICS.length,
    perGame: PER_GAME_COUNT,
    general: GENERAL_COUNT,
    pass: pass.length,
    crate: CRATE_COSMETICS.length,
    prestige: COSMETICS.filter((c) => c.source === 'prestige').length,
    seasons: PASS_SEASONS,
    bySeason,
  };
}
