/**
 * Frenly Pêche — static content: rarities, fishing spots, species, gear, the
 * prestige tree and titles. Formulas live in ./engine.
 */

export const RARITIES = [
  { id: 'commun', label: 'Commun', weight: 60, mult: 1, color: '#C2C9F0' },
  { id: 'rare', label: 'Rare', weight: 26, mult: 3, color: '#5B8CFF' },
  { id: 'epique', label: 'Épique', weight: 10, mult: 10, color: '#B06BFF' },
  { id: 'legendaire', label: 'Légendaire', weight: 3.4, mult: 40, color: '#FFC61A' },
  { id: 'mythique', label: 'Mythique', weight: 0.6, mult: 200, color: '#FF4F8B' },
] as const;

export type RarityIndex = 0 | 1 | 2 | 3 | 4;

export const VARIANTS = {
  '': { label: '', mult: 1 },
  chroma: { label: 'Chromatique', mult: 5 },
  or: { label: 'Doré', mult: 25 },
} as const;
export type Variant = keyof typeof VARIANTS;

export interface Zone {
  id: number;
  name: string;
  region: string;
  /** Water gradient, top then bottom, and the sky above it. */
  sky: string;
  top: string;
  bottom: string;
  /** Names by rarity: 6 commun, 4 rare, 3 épique, 1 légendaire, 1 mythique. */
  fish: [string[], string[], string[], string[], string[]];
  /** Only catchable once the player has done `id + 1` Marées. */
  tide: string;
}

export const ZONES: Zone[] = [
  {
    id: 0, name: 'Étang', region: 'Eaux douces', sky: '#8FD3FF', top: '#4FB38A', bottom: '#1E6B55',
    fish: [
      ['Gardon', 'Ablette', 'Perche soleil', 'Tanche', 'Rotengle', 'Goujon'],
      ['Carpe commune', 'Brème', 'Perche', 'Carassin doré'],
      ['Carpe koï', 'Brochet', 'Black-bass'],
      ['Carpe miroir géante'],
      ['Esprit de l’étang'],
    ],
    tide: 'Koï des marées',
  },
  {
    id: 1, name: 'Rivière', region: 'Eaux douces', sky: '#9ADBFF', top: '#3AA0C8', bottom: '#1A5E86',
    fish: [
      ['Chevesne', 'Vandoise', 'Barbeau', 'Hotu', 'Spirlin', 'Loche'],
      ['Truite fario', 'Ombre', 'Aspe', 'Sandre'],
      ['Truite arc-en-ciel', 'Silure', 'Saumon de rivière'],
      ['Esturgeon'],
      ['Dragon de rivière'],
    ],
    tide: 'Saumon d’argent',
  },
  {
    id: 2, name: 'Lac', region: 'Eaux douces', sky: '#B7E3FF', top: '#2F86C9', bottom: '#15407A',
    fish: [
      ['Lavaret', 'Féra', 'Épinoche', 'Vairon', 'Grémille', 'Bouvière'],
      ['Omble chevalier', 'Truite lacustre', 'Anguille', 'Lotte'],
      ['Brochet géant', 'Maskinongé', 'Esturgeon blanc'],
      ['Silure titan'],
      ['Nessie'],
    ],
    tide: 'Lavaret lunaire',
  },
  {
    id: 3, name: 'Marais', region: 'Eaux douces', sky: '#C9D9A8', top: '#6E8F3E', bottom: '#2F4A1E',
    fish: [
      ['Gambusie', 'Pseudorasbora', 'Crapet', 'Poisson-chat', 'Loche d’étang', 'Tilapia'],
      ['Anguille des marais', 'Gar à nez court', 'Bowfin', 'Poisson-serpent'],
      ['Arapaïma', 'Gar alligator', 'Poisson-poumon'],
      ['Anguille électrique'],
      ['Bête du marais'],
    ],
    tide: 'Gar des brumes',
  },
  {
    id: 4, name: 'Cascade', region: 'Eaux douces', sky: '#A8F0FF', top: '#5FD0E8', bottom: '#1F7FA6',
    fish: [
      ['Truite de torrent', 'Chabot', 'Loche franche', 'Vairon doré', 'Blageon', 'Toxostome'],
      ['Omble de fontaine', 'Huchon', 'Ombre arctique', 'Truite marbrée'],
      ['Saumon royal', 'Taimen', 'Truite dorée'],
      ['Saumon géant'],
      ['Carpe-dragon'],
    ],
    tide: 'Truite d’écume',
  },
  {
    id: 5, name: 'Plage', region: 'Côtes', sky: '#FFE3A8', top: '#3CC3D6', bottom: '#137A9E',
    fish: [
      ['Mulet', 'Sardine', 'Anchois', 'Maquereau', 'Lançon', 'Sole'],
      ['Bar', 'Dorade royale', 'Rouget', 'Plie'],
      ['Turbot', 'Raie pastenague', 'Barracuda'],
      ['Requin-marteau'],
      ['Poisson-lune doré'],
    ],
    tide: 'Bar des grandes marées',
  },
  {
    id: 6, name: 'Port', region: 'Côtes', sky: '#C7CFE0', top: '#3A7FA8', bottom: '#1B3F63',
    fish: [
      ['Chinchard', 'Tacaud', 'Orphie', 'Blennie', 'Gobie', 'Vieille'],
      ['Congre', 'Lieu jaune', 'Grondin', 'Saint-pierre'],
      ['Mérou', 'Baliste', 'Lotte de mer'],
      ['Thon rouge'],
      ['Kraken des quais'],
    ],
    tide: 'Saint-pierre des marées',
  },
  {
    id: 7, name: 'Falaises', region: 'Côtes', sky: '#D9C3FF', top: '#2E6FB8', bottom: '#142E6B',
    fish: [
      ['Labre', 'Serran', 'Girelle', 'Castagnole', 'Sar', 'Oblade'],
      ['Denti', 'Pagre', 'Chapon', 'Murène'],
      ['Liche', 'Sériole', 'Voilier'],
      ['Espadon'],
      ['Léviathan des falaises'],
    ],
    tide: 'Murène d’écume',
  },
  {
    id: 8, name: 'Estuaire', region: 'Côtes', sky: '#FFD2B8', top: '#4E9A9A', bottom: '#1F4F5E',
    fish: [
      ['Flet', 'Éperlan', 'Alose', 'Gobie tacheté', 'Mulet doré', 'Bar juvénile'],
      ['Lamproie', 'Anguille argentée', 'Maigre', 'Bar moucheté'],
      ['Esturgeon européen', 'Tarpon', 'Snook'],
      ['Requin bouledogue'],
      ['Serpent de l’estuaire'],
    ],
    tide: 'Maigre des marées',
  },
  {
    id: 9, name: 'Récif', region: 'Côtes', sky: '#A8FFF0', top: '#25D0C8', bottom: '#0B6E8C',
    fish: [
      ['Poisson-clown', 'Demoiselle', 'Chirurgien bleu', 'Poisson-papillon', 'Gramma royal', 'Anthias'],
      ['Poisson-ange', 'Poisson-perroquet', 'Mérou tacheté', 'Poisson-lion'],
      ['Napoléon', 'Barracuda géant', 'Raie manta'],
      ['Requin-baleine'],
      ['Gardien du récif'],
    ],
    tide: 'Poisson-ange des marées',
  },
];

export interface Species {
  id: string;
  name: string;
  zone: number;
  rarity: RarityIndex;
  /** Tide species: only after enough Marées. */
  tide: boolean;
  color: string;
  minKg: number;
  maxKg: number;
}

const FISH_COLORS = ['#FF8A1F', '#FFC61A', '#33D17A', '#5B8CFF', '#FF4F8B', '#B06BFF', '#25D0C8', '#E8E8E8', '#C2632B', '#9EE7FF'];

function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const SPECIES: Species[] = ZONES.flatMap((z) => {
  const out: Species[] = [];
  let i = 0;
  z.fish.forEach((names, r) => {
    names.forEach((name) => {
      const min = (0.12 + z.id * 0.2) * (1 + r * 1.2);
      out.push({
        id: `z${z.id}-${slug(name)}`, name, zone: z.id, rarity: r as RarityIndex, tide: false,
        color: FISH_COLORS[(z.id * 3 + i++) % FISH_COLORS.length], minKg: min, maxKg: min * 4,
      });
    });
  });
  const min = (0.12 + z.id * 0.2) * 7;
  out.push({ id: `z${z.id}-${slug(z.tide)}`, name: z.tide, zone: z.id, rarity: 4, tide: true, color: '#9EE7FF', minKg: min, maxKg: min * 3 });
  return out;
});

export const SPECIES_BY_ID = new Map(SPECIES.map((s) => [s.id, s]));

/* ------------------------------------------------------------------ */
/* Gear                                                                */
/* ------------------------------------------------------------------ */

export type GearId = 'canne' | 'moulinet' | 'hamecon' | 'bateau' | 'auto';
export type MaterialId = 'fil' | 'bois' | 'metal' | 'ecaille';

export const MATERIALS: Record<MaterialId, { label: string; color: string }> = {
  fil: { label: 'Fil', color: '#E8E8E8' },
  bois: { label: 'Bois', color: '#C2632B' },
  metal: { label: 'Métal', color: '#9AA6C8' },
  ecaille: { label: 'Écaille rare', color: '#25D0C8' },
};

export const GEAR: Record<GearId, { label: string; hint: string }> = {
  canne: { label: 'Canne', hint: 'Prises plus lourdes et mieux payées.' },
  moulinet: { label: 'Moulinet', hint: 'Zone verte plus large, remontée plus facile.' },
  hamecon: { label: 'Hameçon', hint: 'Plus de chances d’attraper des raretés.' },
  bateau: { label: 'Bateau', hint: 'Chaque niveau ouvre le coin de pêche suivant.' },
  auto: { label: 'Canne auto', hint: 'Pêche toute seule tant que la page est ouverte.' },
};

/* ------------------------------------------------------------------ */
/* Prestige: Marées                                                    */
/* ------------------------------------------------------------------ */

export type TreeId = 'vente' | 'chance' | 'auto' | 'materiaux' | 'depart';

export const TREE: Record<TreeId, { label: string; hint: (lvl: number) => string; max?: number }> = {
  vente: { label: 'Criée généreuse', hint: (l) => `Ventes +${l * 25} %` },
  chance: { label: 'Œil du pêcheur', hint: (l) => `Chance de rareté +${l * 6} %` },
  auto: { label: 'Canne infatigable', hint: (l) => `Canne auto +${l * 10} % plus rapide et rentable` },
  materiaux: { label: 'Récupérateur', hint: (l) => `Matériaux +${l * 20} %` },
  depart: { label: 'Bon départ', hint: (l) => `Chaque Marée repart avec le bateau niveau ${l}`, max: ZONES.length - 1 },
};

const TITLES: [number, string][] = [
  [0, 'Mousse'], [1, 'Moussaillon'], [2, 'Matelot'], [3, 'Pêcheur'], [5, 'Loup de mer'],
  [10, 'Capitaine'], [20, 'Amiral'], [35, 'Seigneur des Marées'], [50, 'Légende des abysses'],
  [75, 'Maître des océans'], [100, 'Dieu des marées'],
];

export function mareeTitle(maree: number): string {
  let title = TITLES[0][1];
  for (const [n, t] of TITLES) if (maree >= n) title = t;
  return title;
}

export function mareeBadge(maree: number): { label: string; fill: string; shade: string; text: string } {
  if (maree >= 50) return { label: 'Cosmique', fill: '#B06BFF', shade: '#7A3FCC', text: '#FFFFFF' };
  if (maree >= 20) return { label: 'Diamant', fill: '#9EE7FF', shade: '#5BB8D6', text: '#0E1030' };
  if (maree >= 10) return { label: 'Or', fill: '#FFC61A', shade: '#D98E00', text: '#0E1030' };
  if (maree >= 5) return { label: 'Argent', fill: '#C7CBD6', shade: '#9197A8', text: '#0E1030' };
  return { label: 'Bronze', fill: '#C2632B', shade: '#8E4418', text: '#FFFFFF' };
}
