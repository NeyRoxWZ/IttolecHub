/**
 * How each species looks: body shape, tail, fins, pattern and a few extras.
 * The name decides first (a shark looks like a shark, an eel like an eel, a
 * crystal fish shines); whatever the name leaves open is picked from a hash of
 * the species id, so two fish of the same spot never share a look. The depths
 * reuse abyss names with a prefix ("spectral", "magma"…), and those prefixes
 * add their own traits.
 */

export type Body = 'oval' | 'slim' | 'tall' | 'round' | 'box' | 'eel' | 'flat' | 'shark' | 'ray' | 'seahorse';
export type Tail = 'fork' | 'round' | 'lunate' | 'fan' | 'none';
export type Dorsal = 'none' | 'small' | 'spiky' | 'sail' | 'flame';
export type Pattern = 'none' | 'stripes' | 'spots' | 'belly' | 'stars' | 'shine';
export type Extra = 'whiskers' | 'teeth' | 'lure' | 'horn' | 'hammer' | 'horns' | 'spines' | 'wings' | 'bill';
export type Eye = 'normal' | 'big' | 'angry' | 'none';

export interface FishLook {
  body: Body;
  tail: Tail;
  dorsal: Dorsal;
  pattern: Pattern;
  extras: Extra[];
  eye: Eye;
  /** Second colour, for stripes and spots. */
  accent: string;
  /** Spirits and ghosts: see-through. */
  ghost: boolean;
}

const PALETTE = ['#FF8A1F', '#FFC61A', '#33D17A', '#5B8CFF', '#FF4F8B', '#B06BFF', '#25D0C8', '#FFFFFF', '#C2632B', '#9EE7FF', '#05061A'];

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const cache = new Map<string, FishLook>();

export function fishLook(id: string, name: string, color: string): FishLook {
  const key = `${id}|${color}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const h = hashOf(id || name);
  const pick = <T>(list: T[], salt: number): T => list[(h >>> salt) % list.length];
  const n = ` ${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()} `;
  const has = (...words: string[]) => words.some((w) => n.includes(w));
  const others = PALETTE.filter((c) => c.toLowerCase() !== color.toLowerCase());

  const look: FishLook = {
    body: pick<Body>(['oval', 'slim', 'tall', 'oval', 'round'], 0),
    tail: pick<Tail>(['fork', 'round', 'lunate', 'fan'], 3),
    dorsal: pick<Dorsal>(['small', 'spiky', 'none', 'small', 'sail'], 6),
    pattern: pick<Pattern>(['none', 'stripes', 'spots', 'belly', 'none', 'stripes'], 9),
    extras: [],
    eye: 'normal',
    accent: others[(h >>> 12) % others.length],
    ghost: false,
  };
  const add = (...e: Extra[]) => { for (const x of e) if (!look.extras.includes(x)) look.extras.push(x); };
  const set = (p: Partial<FishLook>) => Object.assign(look, p);

  /* ---- the shape, from what the fish is ---- */
  if (has('hippocampe')) set({ body: 'seahorse', tail: 'none', dorsal: 'none', pattern: 'belly' });
  else if (has('raie', 'manta')) set({ body: 'ray', tail: 'none', dorsal: 'none', pattern: pick<Pattern>(['spots', 'none', 'stars'], 9) });
  else if (has('requin', 'megalodon', 'narval')) {
    set({ body: 'shark', tail: 'lunate', dorsal: 'none', pattern: 'belly', eye: 'angry' });
    if (has('marteau')) add('hammer');
    if (has('narval')) add('horn');
    if (has('megalodon', 'tigre', 'bouledogue')) add('teeth');
  } else if (has('anguille', 'murene', 'congre', 'lamproie', 'serpent', 'syngnathe', 'aiguille de mer', 'kraken', 'leviathan', 'behemoth')) {
    set({ body: 'eel', tail: 'none', dorsal: 'none' });
    if (has('kraken', 'leviathan', 'behemoth', 'serpent de mer', 'serpent a plumes', 'serpent volcanique')) add('horns');
    if (has('murene', 'kraken', 'leviathan')) add('teeth');
  } else if (has('sole ', 'plie', 'turbot', 'flet ', 'limande', 'fletan')) set({ body: 'flat', tail: 'round', dorsal: 'none', pattern: 'spots' });
  else if (has('poisson-lune', 'mole ', 'poisson-globe', 'bulle')) set({ body: 'round', tail: 'fan', dorsal: 'small' });
  else if (has('coffre')) set({ body: 'box', tail: 'fan', dorsal: 'none', pattern: 'spots' });
  else if (has('espadon', 'marlin', 'voilier')) { set({ body: 'slim', tail: 'lunate', dorsal: has('voilier') ? 'sail' : 'small' }); add('bill'); }
  else if (has('brochet', 'barracuda', 'orphie', 'balaou', 'aiguillette', ' gar ', 'maskinonge', 'trompette', 'flute', 'bec-de-cane', 'sandre', 'aiguille')) {
    set({ body: 'slim', tail: 'fork' });
    add(has('trompette', 'flute', 'orphie', 'balaou', 'aiguille', 'bec-de-cane') ? 'bill' : 'teeth');
  } else if (has('baudroie', 'lanterne', 'lotte de mer', 'ogre', 'vipere', 'machoire', 'grimpeur', 'poisson-grenouille')) {
    set({ body: 'round', tail: 'fan', dorsal: 'none', eye: 'big' });
    add('lure', 'teeth');
  } else if (has('thon', 'bonite', 'maquereau', 'albacore', 'germon', 'wahoo', 'thazard', 'sardine', 'hareng', 'anchois', 'sprat', 'capelan', 'chinchard', 'mulet', 'coryphene', 'mahi', 'lancon', 'eperlan')) {
    set({ body: 'slim', tail: 'fork', pattern: has('maquereau', 'bonite', 'thazard') ? 'stripes' : 'belly' });
  } else if (has('chirurgien', 'poisson-ange', 'papillon', 'idole', 'demoiselle', 'baliste', 'saint-pierre', 'castagnole', 'perche soleil', 'crapet', 'hachette', 'cichlide', 'breme', 'pacu', 'piranha', 'discus')) {
    set({ body: 'tall', tail: 'fan', dorsal: 'spiky' });
  }

  /* ---- traits that stack on any shape ---- */
  const finned = ['oval', 'slim', 'tall', 'round', 'box', 'shark'].includes(look.body);
  if (has('poisson-clown', 'sergent', 'zebre', ' raye', 'chevrons', 'tigre', 'perche')) look.pattern = 'stripes';
  if (has('tachet', 'mouchet', 'leopard', 'marbre', 'etoilee', 'truite')) look.pattern = 'spots';
  if (has('poisson-lion', 'rascasse', 'chapon', 'epinoche')) { add('spines'); look.dorsal = 'none'; }
  if (has('piranha', ' loup', 'aimara', 'dents')) add('teeth');
  if (has('silure', 'poisson-chat', 'barbeau', 'carpe', ' koi', 'corydoras', 'esturgeon', 'loche', 'lotte', 'goujon')) add('whiskers');
  if (has('volant')) add('wings');
  if (has('dragon', 'titan', 'colosse', 'dieu ', 'roi ', 'seigneur', 'reine', 'gardien', 'phenix', 'devoreur', 'geant des', 'coeur', 'cœur', 'primordial', 'ancestral')) {
    add('horns');
    if (look.eye === 'normal') look.eye = 'angry';
  }
  if (finned && has('feu', 'lave', 'magma', 'braise', 'ardent', 'tison', 'incandescent', 'volcan', 'flamboyant', 'etincelle', 'brulant', 'bouillant')) look.dorsal = 'flame';
  if (has('etoile', 'comete', 'astral', 'cosmique', 'celeste', 'stellaire', 'galactique', 'lunaire', 'solaire', 'nebuleu', 'neon')) look.pattern = 'stars';
  if (has('cristal', 'verre', 'diamant', 'quartz', 'prismatique', 'irise', 'miroir', 'kaleidoscope', 'glace', 'givre', 'cristallin')) look.pattern = 'shine';
  if (has('esprit', 'fantome', 'spectre', 'spectral', 'banshee', 'revenant', 'reveur', 'songe', ' ames', 'hante', 'maudit', 'perdu', 'disparu', 'neant', 'vide', 'voilee', 'dame ')) look.ghost = true;
  if (has('aveugle', 'caverne', 'grotte', 'pale')) look.eye = 'none';
  else if (look.eye === 'normal' && has('abyss', 'fosse', 'gouffre', 'profondeurs', 'ombre-lanterne', 'encre')) look.eye = 'big';
  if (!finned && look.dorsal !== 'none') look.dorsal = 'none';

  cache.set(key, look);
  return look;
}
