/**
 * Cosmetics — eight per game, twenty games, 160 pieces.
 *
 * They're described as data (palettes, patterns, effect styles) rather than
 * as one-off components: that's the only way 160 pieces stay previewable in
 * the pass and applicable in-game without 160 bespoke implementations.
 * Each piece belongs to the game that drops it, so a Slots skin only ever
 * shows up in Slots.
 */

export type CosmeticSlot =
  | 'table'      // scene background
  | 'skin'       // the game's own pieces (symbols, cards, ball, dino…)
  | 'win_fx'     // celebration
  | 'lose_fx'    // consolation
  | 'border'     // frame around the scene
  | 'particles'  // ambience while the action plays
  | 'sound'      // audio pack
  | 'emblem';    // badge shown next to the balance in that game

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

/** Cosmetics that work in every game are one notch rarer than their slot. */
const BUMP: Record<Rarity, Rarity> = {
  commun: 'rare', rare: 'epique', epique: 'legendaire', legendaire: 'legendaire',
};

export const GLOBAL_SLUG = 'global';

export interface Cosmetic {
  id: string;
  gameSlug: string;
  slot: CosmeticSlot;
  name: string;
  rarity: Rarity;
  /** Applies to every game rather than a single one. */
  global?: boolean;
  params: CosmeticParams;
}

interface GameTheme {
  slug: string;
  /** Short game name, used in the pass listing. */
  game: string;
  /** The theme's own identity — what makes these eight feel like a set. */
  theme: string;
  palette: [string, string, string];
  pattern: TablePattern;
  skin: string;
  hue: number;
  saturate: number;
  winStyle: WinStyle;
  loseStyle: LoseStyle;
  particleStyle: ParticleStyle;
  pack: SoundPack;
  art: string;
  /** Per-slot names, so no two pieces read the same. */
  names: [string, string, string, string, string, string, string, string];
}

const THEMES: GameTheme[] = [
  {
    slug: 'slots', game: 'Slots', theme: 'Néon Vegas',
    palette: ['#2B0B3F', '#7A1FA2', '#FF2E88'], pattern: 'rays',
    skin: 'Gemmes', hue: 300, saturate: 1.5,
    winStyle: 'fireworks', loseStyle: 'static', particleStyle: 'rise', pack: 'retro', art: 'cherry',
    names: ['Tapis Néon Vegas', 'Symboles Gemmes', 'Feu d’artifice rose', 'Écran neigeux', 'Liseré néon', 'Étincelles montantes', 'Bornes d’arcade', 'Cerise dorée'],
  },
  {
    slug: 'blackjack', game: '21', theme: 'Salon feutré',
    palette: ['#0B2E1F', '#0F5132', '#D4AF37'], pattern: 'plain',
    skin: 'Cartes ivoire', hue: 40, saturate: 0.8,
    winStyle: 'coins', loseStyle: 'smoke', particleStyle: 'drift', pack: 'lounge', art: 'crown',
    names: ['Tapis Salon feutré', 'Cartes ivoire', 'Pluie de jetons', 'Volute de fumée', 'Cadre laiton', 'Poussière de salon', 'Piano-bar', 'Couronne du croupier'],
  },
  {
    slug: 'wheel', game: 'Wheel', theme: 'Or et velours',
    palette: ['#1A0E2E', '#4A1B6D', '#FFD000'], pattern: 'rays',
    skin: 'Cases dorées', hue: 45, saturate: 1.3,
    winStyle: 'confetti', loseStyle: 'ash', particleStyle: 'orbit', pack: 'orchestral', art: 'gem',
    names: ['Tapis Or et velours', 'Cases dorées', 'Confettis d’or', 'Pluie de cendres', 'Contour serti', 'Halo tournant', 'Fanfare', 'Gemme du croupier'],
  },
  {
    slug: 'rocket', game: 'Rocket', theme: 'Orbite basse',
    palette: ['#050A1F', '#12245C', '#4FC3F7'], pattern: 'dots',
    skin: 'Soucoupe', hue: 190, saturate: 1.4,
    winStyle: 'shock', loseStyle: 'smoke', particleStyle: 'rise', pack: 'space', art: 'rocket',
    names: ['Tapis Orbite basse', 'Coque Soucoupe', 'Onde de choc', 'Épave fumante', 'Contour ionisé', 'Traînée d’étoiles', 'Radio spatiale', 'Insigne de pilote'],
  },
  {
    slug: 'mines', game: 'Mines', theme: 'Galerie profonde',
    palette: ['#12100E', '#3B2A20', '#FF6B2C'], pattern: 'grid',
    skin: 'Roche brute', hue: 20, saturate: 1.1,
    winStyle: 'sparks', loseStyle: 'crack', particleStyle: 'fall', pack: 'western', art: 'bomb',
    names: ['Tapis Galerie profonde', 'Dalles Roche brute', 'Gerbe d’étincelles', 'Dalle fissurée', 'Contour de fonte', 'Poussière de charbon', 'Harmonica', 'Détonateur'],
  },
  {
    slug: 'plinko', game: 'Plinko', theme: 'Bonbon',
    palette: ['#2A0B2E', '#B5179E', '#FFCA3A'], pattern: 'dots',
    skin: 'Bille sucre', hue: 320, saturate: 1.6,
    winStyle: 'confetti', loseStyle: 'drip', particleStyle: 'fall', pack: 'arcade', art: 'ball',
    names: ['Tapis Bonbon', 'Bille sucre', 'Confettis acidulés', 'Coulée de sirop', 'Contour guimauve', 'Grêle de dragées', 'Machine à bonbons', 'Bille championne'],
  },
  {
    slug: 'hilo', game: 'HiLo', theme: 'Minuit',
    palette: ['#0A0A14', '#1E2749', '#8AB4F8'], pattern: 'stripes',
    skin: 'Dos bleu nuit', hue: 220, saturate: 0.9,
    winStyle: 'sparks', loseStyle: 'static', particleStyle: 'drift', pack: 'lounge', art: 'star',
    names: ['Tapis Minuit', 'Dos bleu nuit', 'Éclat argenté', 'Grésillement', 'Contour lunaire', 'Poussière d’étoiles', 'Contrebasse', 'Étoile de minuit'],
  },
  {
    slug: 'grattage', game: 'Grattage', theme: 'Kiosque',
    palette: ['#1B1006', '#6B3F16', '#FFB300'], pattern: 'stripes',
    skin: 'Encre argent', hue: 35, saturate: 1.2,
    winStyle: 'coins', loseStyle: 'ash', particleStyle: 'fall', pack: 'retro', art: 'clover',
    names: ['Tapis Kiosque', 'Encre argent', 'Averse de pièces', 'Confettis gris', 'Contour carton', 'Copeaux de grattage', 'Vieille radio', 'Trèfle porte-bonheur'],
  },
  {
    slug: 'poulet', game: 'Poulet', theme: 'Départementale',
    palette: ['#0E1A0E', '#2E4E2E', '#FFE066'], pattern: 'stripes',
    skin: 'Plumage roux', hue: 25, saturate: 1.4,
    winStyle: 'confetti', loseStyle: 'crack', particleStyle: 'drift', pack: 'western', art: 'chicken',
    names: ['Tapis Départementale', 'Plumage roux', 'Envol de plumes', 'Pare-brise fêlé', 'Contour glissière', 'Poussière de bitume', 'Klaxons', 'Poulet doré'],
  },
  {
    slug: 'tower', game: 'Tower', theme: 'Gratte-ciel',
    palette: ['#0A0E1A', '#22304A', '#6FE3C4'], pattern: 'grid',
    skin: 'Verre teinté', hue: 165, saturate: 1.2,
    winStyle: 'shock', loseStyle: 'crack', particleStyle: 'rise', pack: 'orchestral', art: 'crate',
    names: ['Tapis Gratte-ciel', 'Verre teinté', 'Onde ascendante', 'Vitre brisée', 'Contour acier', 'Vent d’altitude', 'Cordes tendues', 'Clé de la tour'],
  },
  {
    slug: 'keno', game: 'Keno', theme: 'Boulier',
    palette: ['#10131F', '#26355C', '#FF5C7A'], pattern: 'dots',
    skin: 'Boules laquées', hue: 340, saturate: 1.3,
    winStyle: 'fireworks', loseStyle: 'smoke', particleStyle: 'orbit', pack: 'arcade', art: 'seven',
    names: ['Tapis Boulier', 'Boules laquées', 'Bouquet final', 'Fumée de tirage', 'Contour de laiton', 'Boules en suspension', 'Sonnerie de tirage', 'Numéro fétiche'],
  },
  {
    slug: 'caisses', game: 'Caisses', theme: 'Entrepôt',
    palette: ['#141008', '#4A3418', '#FFC94A'], pattern: 'grid',
    skin: 'Caisses peintes', hue: 40, saturate: 1.3,
    winStyle: 'coins', loseStyle: 'ash', particleStyle: 'fall', pack: 'retro', art: 'moneyBag',
    names: ['Tapis Entrepôt', 'Caisses peintes', 'Déluge de pièces', 'Sciure retombante', 'Contour palette', 'Poussière d’entrepôt', 'Monte-charge', 'Sac scellé'],
  },
  {
    slug: 'coinflip', game: 'Coinflip', theme: 'Frappe royale',
    palette: ['#161208', '#4C3B12', '#FFE9A3'], pattern: 'rays',
    skin: 'Pièce ancienne', hue: 45, saturate: 1.1,
    winStyle: 'sparks', loseStyle: 'static', particleStyle: 'orbit', pack: 'orchestral', art: 'coinFace',
    names: ['Tapis Frappe royale', 'Pièce ancienne', 'Éclat de frappe', 'Voile terni', 'Contour ciselé', 'Halo de métal', 'Cuivres', 'Sceau royal'],
  },
  {
    slug: 'dino', game: 'Dino', theme: 'Ère volcanique',
    palette: ['#1A0B06', '#5A2110', '#FF7043'], pattern: 'stripes',
    skin: 'Écailles braise', hue: 15, saturate: 1.5,
    winStyle: 'shock', loseStyle: 'ash', particleStyle: 'rise', pack: 'arcade', art: 'volcano',
    names: ['Tapis Ère volcanique', 'Écailles braise', 'Rugissement', 'Pluie de cendres', 'Contour de lave', 'Braises flottantes', 'Bips préhistoriques', 'Crâne fossile'],
  },
  {
    slug: 'chevaux', game: 'Chevaux', theme: 'Hippodrome',
    palette: ['#0D1A10', '#255034', '#F4E4BC'], pattern: 'stripes',
    skin: 'Casaque rayée', hue: 100, saturate: 1.2,
    winStyle: 'confetti', loseStyle: 'smoke', particleStyle: 'drift', pack: 'orchestral', art: 'horse',
    names: ['Tapis Hippodrome', 'Casaque rayée', 'Confettis de tribune', 'Poussière de piste', 'Contour de lice', 'Mottes de terre', 'Trompes de départ', 'Fer à cheval'],
  },
  {
    slug: 'bonneteau', game: 'Bonneteau', theme: 'Ruelle',
    palette: ['#12100F', '#33261C', '#E5B769'], pattern: 'plain',
    skin: 'Gobelets cuivre', hue: 30, saturate: 1.1,
    winStyle: 'sparks', loseStyle: 'smoke', particleStyle: 'drift', pack: 'lounge', art: 'door',
    names: ['Tapis Ruelle', 'Gobelets cuivre', 'Tour de passe-passe', 'Fumée de ruelle', 'Contour de caisse', 'Poussière de pavé', 'Accordéon', 'Gobelet marqué'],
  },
  {
    slug: 'stade', game: 'Stade', theme: 'Nocturne',
    palette: ['#08140C', '#12401F', '#B9F18D'], pattern: 'stripes',
    skin: 'Maillot fluo', hue: 95, saturate: 1.6,
    winStyle: 'fireworks', loseStyle: 'static', particleStyle: 'rise', pack: 'arcade', art: 'finishFlag',
    names: ['Tapis Nocturne', 'Maillot fluo', 'Feux de tribune', 'Écran de fin', 'Contour de projecteur', 'Confettis de supporters', 'Tambours de virage', 'Fanion du club'],
  },
  {
    slug: 'baccarat', game: 'Baccarat', theme: 'Riviera',
    palette: ['#0A1420', '#123A5C', '#E8D9B0'], pattern: 'plain',
    skin: 'Cartes crème', hue: 200, saturate: 0.9,
    winStyle: 'coins', loseStyle: 'drip', particleStyle: 'drift', pack: 'lounge', art: 'diamond',
    names: ['Tapis Riviera', 'Cartes crème', 'Cascade de jetons', 'Goutte de champagne', 'Contour marqueterie', 'Embruns', 'Quatuor à cordes', 'Diamant de la maison'],
  },
  {
    slug: 'rps', game: 'PFC', theme: 'Dojo',
    palette: ['#160C0C', '#4A1F1F', '#FF8A65'], pattern: 'rays',
    skin: 'Mains d’encre', hue: 10, saturate: 1.2,
    winStyle: 'shock', loseStyle: 'crack', particleStyle: 'rise', pack: 'western', art: 'rps',
    names: ['Tapis Dojo', 'Mains d’encre', 'Impact net', 'Papier déchiré', 'Contour de bambou', 'Pétales emportés', 'Percussions', 'Sceau du dojo'],
  },
  {
    slug: 'craps', game: 'Craps', theme: 'Arrière-salle',
    palette: ['#0F1410', '#1F3A2A', '#FF4D4D'], pattern: 'plain',
    skin: 'Dés ivoire', hue: 355, saturate: 1.3,
    winStyle: 'sparks', loseStyle: 'smoke', particleStyle: 'drift', pack: 'western', art: 'skull',
    names: ['Tapis Arrière-salle', 'Dés ivoire', 'Gerbe rouge', 'Fumée de cigare', 'Contour de feutre', 'Poussière de craie', 'Blues rugueux', 'Tête de mort porte-veine'],
  },
];

function buildCosmetics(): Cosmetic[] {
  const out: Cosmetic[] = [];
  for (const t of THEMES) {
    const [dark, mid, accent] = t.palette;
    const params: Record<CosmeticSlot, CosmeticParams> = {
      table: { from: dark, to: mid, pattern: t.pattern, color: accent },
      skin: { hue: t.hue, saturate: t.saturate, color: accent },
      win_fx: { winStyle: t.winStyle, colors: [accent, mid, '#FFFFFF'] },
      lose_fx: { loseStyle: t.loseStyle, color: mid },
      border: { color: accent, glow: true, animated: t.pattern === 'rays' },
      particles: { particleStyle: t.particleStyle, color: accent },
      sound: { pack: t.pack, color: accent },
      emblem: { art: t.art, color: accent },
    };

    COSMETIC_SLOTS.forEach((slot, i) => {
      out.push({
        id: `${t.slug}:${slot}`,
        gameSlug: t.slug,
        slot,
        name: t.names[i],
        rarity: SLOT_RARITY[slot],
        params: params[slot],
      });
    });
  }
  return out;
}

/**
 * Global sets — the same eight slots, but they apply to every game. Four
 * sets, so a player who never touches Craps still has something to chase.
 */
const GLOBAL_SETS: { key: string; theme: string; palette: [string, string, string]; pattern: TablePattern;
  hue: number; saturate: number; winStyle: WinStyle; loseStyle: LoseStyle;
  particleStyle: ParticleStyle; pack: SoundPack; art: string;
  names: [string, string, string, string, string, string, string, string] }[] = [
  {
    key: 'onyx', theme: 'Onyx', palette: ['#0B0B10', '#1C1C26', '#C9CCD6'], pattern: 'plain',
    hue: 0, saturate: 0.35, winStyle: 'sparks', loseStyle: 'ash', particleStyle: 'drift',
    pack: 'lounge', art: 'diamond',
    names: ['Tapis Onyx', 'Nuances Onyx', 'Éclat d’onyx', 'Poussière noire', 'Contour d’onyx', 'Cendres flottantes', 'Silence feutré', 'Sceau d’onyx'],
  },
  {
    key: 'or', theme: 'Or massif', palette: ['#1A1405', '#4A3A0C', '#FFD000'], pattern: 'rays',
    hue: 45, saturate: 1.4, winStyle: 'coins', loseStyle: 'smoke', particleStyle: 'rise',
    pack: 'orchestral', art: 'crown',
    names: ['Tapis Or massif', 'Dorure intégrale', 'Averse dorée', 'Fumée d’encens', 'Contour d’or', 'Paillettes d’or', 'Grand orchestre', 'Couronne d’or'],
  },
  {
    key: 'neon', theme: 'Néon', palette: ['#06060F', '#101038', '#00E5FF'], pattern: 'grid',
    hue: 185, saturate: 1.7, winStyle: 'shock', loseStyle: 'static', particleStyle: 'orbit',
    pack: 'arcade', art: 'star',
    names: ['Tapis Néon', 'Filtre Néon', 'Impulsion cyan', 'Coupure de signal', 'Contour néon', 'Circuits flottants', 'Bornes néon', 'Étoile néon'],
  },
  {
    key: 'sang', theme: 'Sang-froid', palette: ['#14060A', '#3D0D18', '#FF2E4D'], pattern: 'stripes',
    hue: 350, saturate: 1.5, winStyle: 'fireworks', loseStyle: 'drip', particleStyle: 'fall',
    pack: 'western', art: 'skull',
    names: ['Tapis Sang-froid', 'Teinte Sang-froid', 'Gerbe écarlate', 'Coulée pourpre', 'Contour écarlate', 'Braises rouges', 'Blues de minuit', 'Crâne écarlate'],
  },
];

function buildGlobalCosmetics(): Cosmetic[] {
  const out: Cosmetic[] = [];
  for (const g of GLOBAL_SETS) {
    const [dark, mid, accent] = g.palette;
    const params: Record<CosmeticSlot, CosmeticParams> = {
      table: { from: dark, to: mid, pattern: g.pattern, color: accent },
      skin: { hue: g.hue, saturate: g.saturate, color: accent },
      win_fx: { winStyle: g.winStyle, colors: [accent, mid, '#FFFFFF'] },
      lose_fx: { loseStyle: g.loseStyle, color: mid },
      border: { color: accent, glow: true, animated: true },
      particles: { particleStyle: g.particleStyle, color: accent },
      sound: { pack: g.pack, color: accent },
      emblem: { art: g.art, color: accent },
    };
    COSMETIC_SLOTS.forEach((slot, i) => {
      out.push({
        id: `${GLOBAL_SLUG}:${g.key}:${slot}`,
        gameSlug: GLOBAL_SLUG,
        slot,
        name: g.names[i],
        rarity: BUMP[SLOT_RARITY[slot]],
        global: true,
        params: params[slot],
      });
    });
  }
  return out;
}

export const GLOBAL_COSMETICS: Cosmetic[] = buildGlobalCosmetics();

export const COSMETICS: Cosmetic[] = [...buildCosmetics(), ...GLOBAL_COSMETICS];

export const GLOBAL_SET_LABELS: { key: string; theme: string }[] = GLOBAL_SETS.map((g) => ({ key: g.key, theme: g.theme }));

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export function cosmeticById(id: string): Cosmetic | undefined {
  return BY_ID.get(id);
}

export function cosmeticsForGame(gameSlug: string): Cosmetic[] {
  return COSMETICS.filter((c) => c.gameSlug === gameSlug);
}

export function gameTheme(gameSlug: string): string {
  if (gameSlug === GLOBAL_SLUG) return 'Tous les jeux';
  return THEMES.find((t) => t.slug === gameSlug)?.theme ?? gameSlug;
}

export function gameLabel(gameSlug: string): string {
  if (gameSlug === GLOBAL_SLUG) return 'Général';
  return THEMES.find((t) => t.slug === gameSlug)?.game ?? gameSlug;
}

/** "Général" first: it's the set that shows up everywhere. */
export const COSMETIC_GAME_ORDER = [GLOBAL_SLUG, ...THEMES.map((t) => t.slug)];

export function cosmeticsByRarity(rarity: Rarity): Cosmetic[] {
  return COSMETICS.filter((c) => c.rarity === rarity);
}
