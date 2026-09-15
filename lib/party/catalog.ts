/**
 * The party games in the room's game list: name, pitch, minimum players and
 * settings. Category ids match the ones in public/data/<game>.json.
 */

export interface PartySetting {
  id: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'multiselect';
  default: string | number | any[];
  options?: { value: string; label: string; disabled?: boolean }[];
}

export interface PartyGameEntry {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  settings: PartySetting[];
}

type Option = { value: string; label: string };
const all = (options: Option[]) => options.map((o) => o.value);

export const HORS_SUJET_CATEGORIES: Option[] = [
  { value: 'quotidien', label: 'Vie quotidienne' },
  { value: 'chiffres', label: 'Chiffres' },
  { value: 'bouffe', label: 'Bouffe' },
  { value: 'gouts', label: 'Tes goûts' },
  { value: 'popculture', label: 'Films, séries, musique' },
  { value: 'lieux', label: 'Lieux et voyages' },
  { value: 'delire', label: 'Délire' },
];

export const TRAIT_CATEGORIES: Option[] = [
  { value: 'objets', label: 'Objets' },
  { value: 'animaux', label: 'Animaux' },
  { value: 'nourriture', label: 'Nourriture' },
  { value: 'lieux', label: 'Lieux et bâtiments' },
  { value: 'metiers', label: 'Métiers' },
  { value: 'sports', label: 'Sports et loisirs' },
  { value: 'transports', label: 'Transports' },
  { value: 'nature', label: 'Nature et météo' },
  { value: 'corps', label: 'Corps et vêtements' },
  { value: 'fiction', label: 'Personnages et créatures' },
];

export const BLINDTEST_CATEGORIES: Option[] = [
  { value: 'rapfr', label: 'Rap FR' },
  { value: 'popfr', label: 'Pop FR' },
  { value: 'variete', label: 'Variété française' },
  { value: 'hits', label: 'Hits internationaux' },
  { value: 'annees80', label: 'Années 80' },
  { value: 'annees90', label: 'Années 90' },
  { value: 'annees2000', label: 'Années 2000' },
  { value: 'rock', label: 'Rock' },
  { value: 'rnb', label: 'RnB et soul' },
  { value: 'electro', label: 'Électro' },
];

export const PUNCHLINE_CATEGORIES: Option[] = [
  { value: 'classique', label: 'Classiques' },
  { value: 'soiree', label: 'Soirée' },
  { value: 'boulot', label: 'École et boulot' },
  { value: 'famille', label: 'Famille et couple' },
  { value: 'popculture', label: 'Pop culture' },
  { value: 'absurde', label: 'Absurde' },
];

export const PETIT_BAC_CATEGORIES: Option[] = [
  { value: 'prenom', label: 'Prénom' },
  { value: 'pays', label: 'Pays' },
  { value: 'ville', label: 'Ville' },
  { value: 'animal', label: 'Animal' },
  { value: 'metier', label: 'Métier' },
  { value: 'fruitlegume', label: 'Fruit ou légume' },
  { value: 'objet', label: 'Objet' },
  { value: 'marque', label: 'Marque' },
  { value: 'celebrite', label: 'Célébrité' },
  { value: 'filmserie', label: 'Film ou série' },
  { value: 'sport', label: 'Sport' },
  { value: 'plat', label: 'Plat' },
  { value: 'vetement', label: 'Vêtement' },
  { value: 'personnage', label: 'Personnage de fiction' },
  { value: 'chanteur', label: 'Chanteur ou groupe' },
  { value: 'instrument', label: 'Instrument' },
  { value: 'transport', label: 'Moyen de transport' },
  { value: 'corps', label: 'Partie du corps' },
  { value: 'couleur', label: 'Couleur' },
  { value: 'jeuvideo', label: 'Jeu vidéo' },
  { value: 'boisson', label: 'Boisson' },
  { value: 'insulte', label: 'Insulte gentille' },
  { value: 'excuse', label: 'Excuse bidon' },
  { value: 'superpouvoir', label: 'Super-pouvoir' },
];
const PETIT_BAC_DEFAULT = ['prenom', 'pays', 'animal', 'metier', 'fruitlegume', 'objet', 'marque', 'celebrite'];

export const QUI_A_DIT_CA_CATEGORIES: Option[] = [
  { value: 'souvenirs', label: 'Souvenirs' },
  { value: 'gouts', label: 'Goûts' },
  { value: 'etsi', label: 'Et si…' },
  { value: 'hontes', label: 'Petites hontes' },
  { value: 'opinions', label: 'Avis tranchés' },
  { value: 'reves', label: 'Rêves et projets' },
];

export const SURENCHERE_CATEGORIES: Option[] = [
  { value: 'geo', label: 'Géographie' },
  { value: 'cinema', label: 'Cinéma et séries' },
  { value: 'musique', label: 'Musique' },
  { value: 'sport', label: 'Sport' },
  { value: 'bouffe', label: 'Bouffe' },
  { value: 'culture', label: 'Culture générale' },
  { value: 'quotidien', label: 'Vie quotidienne' },
  { value: 'delire', label: 'Délire' },
];

export const DICO_CATEGORIES: Option[] = [
  { value: 'rares', label: 'Mots rares' },
  { value: 'anciens', label: 'Vieux mots' },
  { value: 'argot', label: 'Argot' },
  { value: 'regions', label: 'Régionalismes' },
  { value: 'sciences', label: 'Sciences et nature' },
];

const rounds = (n: number): PartySetting => ({ id: 'rounds', label: 'Manches', type: 'number', default: n });
const seconds = (id: string, label: string, n: number): PartySetting => ({ id, label, type: 'number', default: n });
const categories = (options: Option[], label = 'Catégories', defaults = all(options)): PartySetting => ({ id: 'categories', label, type: 'multiselect', default: defaults, options });

export const PARTY_GAMES: PartyGameEntry[] = [
  {
    id: 'horssujet',
    name: 'Hors Sujet',
    description: 'Un joueur n’a pas eu la même question. Trouvez-le.',
    minPlayers: 3,
    settings: [rounds(5), seconds('answerTime', 'Temps pour répondre (s)', 45), seconds('voteTime', 'Débat et vote (s)', 60), categories(HORS_SUJET_CATEGORIES)],
  },
  {
    id: 'untraitdetrop',
    name: 'Un Trait de Trop',
    description: 'Un trait chacun, un imposteur qui n’a pas le mot.',
    minPlayers: 3,
    settings: [
      rounds(4),
      { id: 'laps', label: 'Tours de dessin', type: 'number', default: 2 },
      seconds('turnTime', 'Temps par trait (s)', 20),
      seconds('voteTime', 'Temps de vote (s)', 45),
      categories(TRAIT_CATEGORIES),
    ],
  },
  {
    id: 'blindtest',
    name: 'BlindTest',
    description: 'Un extrait, trouve le titre et l’artiste.',
    minPlayers: 1,
    settings: [
      rounds(10),
      { id: 'listenTime', label: 'Durée d’écoute', type: 'select', default: '30', options: [{ value: '15', label: '15 secondes' }, { value: '20', label: '20 secondes' }, { value: '30', label: '30 secondes' }] },
      { id: 'answerMode', label: 'À trouver', type: 'select', default: 'both', options: [{ value: 'both', label: 'Titre et artiste' }, { value: 'title', label: 'Titre seulement' }, { value: 'artist', label: 'Artiste seulement' }] },
      categories(BLINDTEST_CATEGORIES, 'Playlists', ['rapfr', 'popfr', 'hits', 'annees2000']),
    ],
  },
  {
    id: 'punchline',
    name: 'Punchline',
    description: 'La réponse la plus drôle gagne, au vote anonyme.',
    minPlayers: 3,
    settings: [rounds(5), seconds('answerTime', 'Temps pour écrire (s)', 60), seconds('voteTime', 'Temps de vote (s)', 30), categories(PUNCHLINE_CATEGORIES)],
  },
  {
    id: 'petitbac',
    name: 'Petit Bac',
    description: 'Une lettre, des catégories, le chrono tourne.',
    minPlayers: 2,
    settings: [
      rounds(5),
      seconds('time', 'Temps par manche (s)', 90),
      { id: 'letters', label: 'Lettres', type: 'select', default: 'easy', options: [{ value: 'easy', label: 'Sans K, Q, W, X, Y, Z' }, { value: 'all', label: 'Tout l’alphabet' }] },
      categories(PETIT_BAC_CATEGORIES, 'Catégories', PETIT_BAC_DEFAULT),
    ],
  },
  {
    id: 'quiaditca',
    name: 'Qui a dit ça ?',
    description: 'Répondez en secret, puis devinez qui a écrit quoi.',
    minPlayers: 3,
    settings: [
      { id: 'questions', label: 'Questions par joueur', type: 'number', default: 3 },
      seconds('writeTime', 'Temps pour répondre (s)', 120),
      { id: 'rounds', label: 'Réponses à deviner', type: 'number', default: 8 },
      seconds('guessTime', 'Temps pour deviner (s)', 20),
      categories(QUI_A_DIT_CA_CATEGORIES, 'Thèmes'),
    ],
  },
  {
    id: 'surenchere',
    name: 'Surenchère',
    description: 'Annonce combien tu peux en citer, puis prouve-le.',
    minPlayers: 2,
    settings: [rounds(6), seconds('bidTime', 'Temps pour annoncer (s)', 20), seconds('proveTime', 'Temps pour citer (s)', 45), categories(SURENCHERE_CATEGORIES, 'Thèmes')],
  },
  {
    id: 'ledico',
    name: 'Le Dico',
    description: 'Invente une fausse définition, trouve la vraie.',
    minPlayers: 3,
    settings: [rounds(6), seconds('writeTime', 'Temps pour inventer (s)', 60), seconds('voteTime', 'Temps de vote (s)', 40), categories(DICO_CATEGORIES)],
  },
];

export const partyMinPlayers = Object.fromEntries(PARTY_GAMES.map((g) => [g.id, g.minPlayers]));
