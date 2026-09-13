/**
 * Frenly Pêche — static content: rarities, fishing spots, species, gear, the
 * prestige tree, titles, weather, shop items, missions and cosmetics.
 * Formulas live in ./engine.
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
  sky: string;
  top: string;
  bottom: string;
  /** Names by rarity: 6 commun, 4 rare, 3 épique, 1 légendaire, 1 mythique. */
  fish: [string[], string[], string[], string[], string[]];
  /** Only catchable once the player has done enough Marées. */
  tide: string;
}

type Raw = [name: string, sky: string, top: string, bottom: string, fish: Zone['fish'], tide: string];

const REGIONS: [string, Raw[]][] = [
  ['Eaux douces', [
    ['Étang', '#8FD3FF', '#4FB38A', '#1E6B55', [['Gardon', 'Ablette', 'Perche soleil', 'Tanche', 'Rotengle', 'Goujon'], ['Carpe commune', 'Brème', 'Perche', 'Carassin doré'], ['Carpe koï', 'Brochet', 'Black-bass'], ['Carpe miroir géante'], ['Esprit de l’étang']], 'Koï des marées'],
    ['Rivière', '#9ADBFF', '#3AA0C8', '#1A5E86', [['Chevesne', 'Vandoise', 'Barbeau', 'Hotu', 'Spirlin', 'Loche'], ['Truite fario', 'Ombre', 'Aspe', 'Sandre'], ['Truite arc-en-ciel', 'Silure', 'Saumon de rivière'], ['Esturgeon'], ['Dragon de rivière']], 'Saumon d’argent'],
    ['Lac', '#B7E3FF', '#2F86C9', '#15407A', [['Lavaret', 'Féra', 'Épinoche', 'Vairon', 'Grémille', 'Bouvière'], ['Omble chevalier', 'Truite lacustre', 'Anguille', 'Lotte'], ['Brochet géant', 'Maskinongé', 'Esturgeon blanc'], ['Silure titan'], ['Nessie']], 'Lavaret lunaire'],
    ['Marais', '#C9D9A8', '#6E8F3E', '#2F4A1E', [['Gambusie', 'Pseudorasbora', 'Crapet', 'Poisson-chat', 'Loche d’étang', 'Tilapia'], ['Anguille des marais', 'Gar à nez court', 'Bowfin', 'Poisson-serpent'], ['Arapaïma', 'Gar alligator', 'Poisson-poumon'], ['Anguille électrique'], ['Bête du marais']], 'Gar des brumes'],
    ['Cascade', '#A8F0FF', '#5FD0E8', '#1F7FA6', [['Truite de torrent', 'Chabot', 'Loche franche', 'Vairon doré', 'Blageon', 'Toxostome'], ['Omble de fontaine', 'Huchon', 'Ombre arctique', 'Truite marbrée'], ['Saumon royal', 'Taimen', 'Truite dorée'], ['Saumon géant'], ['Carpe-dragon']], 'Truite d’écume'],
  ]],
  ['Côtes', [
    ['Plage', '#FFE3A8', '#3CC3D6', '#137A9E', [['Mulet', 'Sardine', 'Anchois', 'Maquereau', 'Lançon', 'Sole'], ['Bar', 'Dorade royale', 'Rouget', 'Plie'], ['Turbot', 'Raie pastenague', 'Barracuda'], ['Requin-marteau'], ['Poisson-lune doré']], 'Bar des grandes marées'],
    ['Port', '#C7CFE0', '#3A7FA8', '#1B3F63', [['Chinchard', 'Tacaud', 'Orphie', 'Blennie', 'Gobie', 'Vieille'], ['Congre', 'Lieu jaune', 'Grondin', 'Saint-pierre'], ['Mérou', 'Baliste', 'Lotte de mer'], ['Thon rouge'], ['Kraken des quais']], 'Saint-pierre des marées'],
    ['Falaises', '#D9C3FF', '#2E6FB8', '#142E6B', [['Labre', 'Serran', 'Girelle', 'Castagnole', 'Sar', 'Oblade'], ['Denti', 'Pagre', 'Chapon', 'Murène'], ['Liche', 'Sériole', 'Voilier'], ['Espadon'], ['Léviathan des falaises']], 'Murène d’écume'],
    ['Estuaire', '#FFD2B8', '#4E9A9A', '#1F4F5E', [['Flet', 'Éperlan', 'Alose', 'Gobie tacheté', 'Mulet doré', 'Bar juvénile'], ['Lamproie', 'Anguille argentée', 'Maigre', 'Bar moucheté'], ['Esturgeon européen', 'Tarpon', 'Snook'], ['Requin bouledogue'], ['Serpent de l’estuaire']], 'Maigre des marées'],
    ['Récif', '#A8FFF0', '#25D0C8', '#0B6E8C', [['Poisson-clown', 'Demoiselle', 'Chirurgien bleu', 'Poisson-papillon', 'Gramma royal', 'Anthias'], ['Poisson-ange', 'Poisson-perroquet', 'Mérou tacheté', 'Poisson-lion'], ['Napoléon', 'Barracuda géant', 'Raie manta'], ['Requin-baleine'], ['Gardien du récif']], 'Poisson-ange des marées'],
  ]],
  ['Tropiques', [
    ['Mangrove', '#C8F5B0', '#3E9E7A', '#1A4F3C', [['Poisson-archer', 'Périophtalme', 'Tilapia rouge', 'Mulet de mangrove', 'Gobie des vases', 'Aiguillette'], ['Vivaneau', 'Carangue', 'Poisson-soldat', 'Bar tropical'], ['Tarpon argenté', 'Snook géant', 'Mérou goliath'], ['Requin nourrice'], ['Crocodile-poisson']], 'Vivaneau des marées'],
    ['Lagon', '#B8FFF6', '#33E0D0', '#0E8FA0', [['Poisson-chirurgien', 'Sergent-major', 'Labre nettoyeur', 'Poisson-trompette', 'Rascasse', 'Poisson-coffre'], ['Carangue bleue', 'Loche marbrée', 'Poisson-lune', 'Bec-de-cane'], ['Barracuda à chevrons', 'Raie léopard', 'Thazard'], ['Requin à pointes noires'], ['Serpent du lagon']], 'Carangue des marées'],
    ['Atoll', '#FFF0B8', '#2FC8E8', '#0A6AA8', [['Poisson-écureuil', 'Demoiselle bleue', 'Idole des Maures', 'Poisson-hachette', 'Blennie à dents de sabre', 'Poisson-flûte'], ['Bonite', 'Thon jaune', 'Mahi-mahi', 'Wahoo'], ['Marlin rayé', 'Carangue géante', 'Requin gris'], ['Marlin bleu'], ['Seigneur de l’atoll']], 'Mahi-mahi des marées'],
    ['Amazone', '#D8F0A8', '#7A9A3A', '#3A4A1A', [['Piranha', 'Néon', 'Corydoras', 'Tétra cardinal', 'Pacu', 'Poisson-hachette amazonien'], ['Paon bass', 'Arowana', 'Aimara', 'Poisson-feuille'], ['Arapaïma géant', 'Pirarucu', 'Raie d’eau douce'], ['Poisson-chat géant'], ['Boto rose fantôme']], 'Arowana des marées'],
    ['Cénote', '#9EDFD0', '#1FA8B8', '#0A3F58', [['Poisson aveugle', 'Molly', 'Platy', 'Guppy sauvage', 'Characin des grottes', 'Gobie des cénotes'], ['Cichlidé bleu', 'Anguille de grotte', 'Poisson-miroir', 'Barbeau des cavernes'], ['Poisson cristal', 'Anguille pâle', 'Silure des profondeurs'], ['Gardien du cénote'], ['Serpent à plumes']], 'Poisson-miroir des marées'],
  ]],
  ['Grand Nord', [
    ['Fjord', '#D8E8F8', '#3F6F9A', '#1A3350', [['Hareng', 'Cabillaud', 'Églefin', 'Merlan', 'Lieu noir', 'Sprat'], ['Flétan', 'Loup de mer', 'Lingue', 'Brosme'], ['Saumon atlantique', 'Flétan géant', 'Requin-lézard'], ['Requin du Groenland'], ['Kraken du fjord']], 'Flétan des marées'],
    ['Lac gelé', '#EAF6FF', '#8FC8E8', '#3A6E9A', [['Omble arctique', 'Corégone blanc', 'Perche des glaces', 'Lotte d’eau douce', 'Cisco', 'Épinoche des neiges'], ['Touladi', 'Brochet nordique', 'Doré jaune', 'Esturgeon jaune'], ['Taimen sibérien', 'Brochet des glaces', 'Nelma'], ['Esturgeon géant du lac'], ['Esprit du lac gelé']], 'Omble des marées'],
    ['Banquise', '#F4FBFF', '#6FA8C8', '#23506E', [['Morue arctique', 'Capelan', 'Chabot polaire', 'Lompe', 'Poisson des glaces', 'Lançon arctique'], ['Flétan noir', 'Sébaste', 'Loup tacheté', 'Plie grise'], ['Requin dormeur', 'Grenadier', 'Poisson-crocodile'], ['Narval-poisson'], ['Léviathan de glace']], 'Sébaste des marées'],
    ['Mer de Barents', '#C8D4E0', '#4A6A8A', '#1C2E44', [['Hareng argenté', 'Maquereau du nord', 'Merlan bleu', 'Sprat nordique', 'Tacaud norvégien', 'Limande'], ['Cabillaud géant', 'Turbot du nord', 'Raie étoilée', 'Baudroie'], ['Thon de l’Atlantique', 'Espadon du nord', 'Requin-taupe'], ['Requin pèlerin'], ['Serpent de mer boréal']], 'Baudroie des marées'],
    ['Glacier', '#E0F8FF', '#9EE7FF', '#3F8FB8', [['Poisson de givre', 'Chabot bleu', 'Omble cristallin', 'Loche glaciaire', 'Vairon des neiges', 'Truite pâle'], ['Truite de glacier', 'Ombre polaire', 'Esturgeon nordique', 'Lotte de glacier'], ['Saumon des glaces', 'Taimen blanc', 'Brochet de cristal'], ['Dragon de glace'], ['Cœur du glacier']], 'Truite des marées gelées'],
  ]],
  ['Haute mer', [
    ['Le Large', '#A8C8FF', '#1F6FD0', '#0A2E70', [['Chinchard du large', 'Poisson-volant', 'Coryphène juvénile', 'Bonite rayée', 'Poisson-pilote', 'Balaou'], ['Thon germon', 'Coryphène', 'Sériole du large', 'Môle'], ['Marlin blanc', 'Thon obèse', 'Requin peau bleue'], ['Espadon géant'], ['Roi du large']], 'Coryphène des marées'],
    ['Courant chaud', '#FFD8A8', '#2F9FE0', '#0E4A90', [['Poisson-lanterne', 'Sardinelle', 'Perroquet du large', 'Chirurgien jaune', 'Thazard bâtard', 'Mulet volant'], ['Thon albacore', 'Wahoo géant', 'Carangue arc-en-ciel', 'Barracuda du courant'], ['Voilier indo-pacifique', 'Requin soyeux', 'Manta géante'], ['Requin océanique'], ['Poisson ancestral']], 'Albacore des marées'],
    ['Sargasses', '#D8F0B8', '#4F9A6A', '#1A4A3A', [['Poisson-grenouille', 'Hippocampe', 'Poisson-lime', 'Syngnathe', 'Baliste des algues', 'Aiguille de mer'], ['Anguille d’Europe', 'Coffre des sargasses', 'Chirurgien des algues', 'Mérou des sargasses'], ['Marlin des sargasses', 'Thon rouge du large', 'Tarpon des algues'], ['Anguille géante'], ['Dame des sargasses']], 'Hippocampe des marées'],
    ['Mer des tempêtes', '#8A94B0', '#2E4A6E', '#101C30', [['Poisson-tonnerre', 'Maquereau d’orage', 'Sardine d’écume', 'Chinchard noir', 'Mulet des vagues', 'Hareng des bourrasques'], ['Thon de tempête', 'Bar noir', 'Raie éclair', 'Sériole grise'], ['Espadon d’orage', 'Requin tigre', 'Marlin noir'], ['Requin-marteau géant'], ['Léviathan des tempêtes']], 'Raie éclair des marées'],
    ['Triangle perdu', '#B8A8D8', '#3A3A7A', '#12123A', [['Poisson fantôme', 'Sardine perdue', 'Gobie des brumes', 'Hareng spectral', 'Poisson-boussole', 'Anchois disparu'], ['Thon égaré', 'Mérou oublié', 'Raie du triangle', 'Barracuda spectral'], ['Épave vivante', 'Requin fantôme', 'Marlin des brumes'], ['Mégalodon'], ['Gardien du triangle']], 'Poisson-boussole des marées'],
  ]],
  ['Abysses', [
    ['Talus', '#5A6A90', '#1E3A6A', '#08142E', [['Grenadier', 'Sabre noir', 'Chimère', 'Lanterne des talus', 'Hoplostète', 'Béryx'], ['Lingue bleue', 'Flétan des profondeurs', 'Sébaste abyssal', 'Grondin des abysses'], ['Requin-lutin', 'Coelacanthe', 'Chimère géante'], ['Requin à collerette'], ['Ombre du talus']], 'Béryx des marées'],
    ['Plaine abyssale', '#404A70', '#16284E', '#050C20', [['Poisson-trépied', 'Macrouridé', 'Crapaud abyssal', 'Zoarcidé', 'Poisson-limace', 'Ophidion'], ['Baudroie abyssale', 'Poisson-ogre', 'Anguille abyssale', 'Grenadier géant'], ['Poisson-vipère', 'Mâchoire noire', 'Dragon noir'], ['Colosse abyssal'], ['Titan des abysses']], 'Poisson-trépied des marées'],
    ['Fosse', '#303858', '#101C3A', '#03081A', [['Liparis', 'Poisson-escargot', 'Macroure des fosses', 'Brotule', 'Ophidien pâle', 'Gobie des fosses'], ['Fantôme des fosses', 'Anguille-pélican', 'Hachette géante', 'Grimpeur noir'], ['Lanterne royale', 'Dragon des fosses', 'Mâchoire de verre'], ['Monstre de la fosse'], ['Œil des profondeurs']], 'Liparis des marées'],
    ['Sources chaudes', '#6A4A58', '#3A2A4A', '#10081A', [['Poisson des cheminées', 'Zoarcidé thermal', 'Poisson-soufre', 'Blennie thermale', 'Gobie des sources', 'Loche ardente'], ['Anguille thermale', 'Poisson-braise', 'Rascasse des sources', 'Grenadier chaud'], ['Poisson-fumeur', 'Dragon thermal', 'Requin des cheminées'], ['Géant des sources'], ['Esprit de la cheminée']], 'Poisson-braise des marées'],
    ['Gouffre noir', '#282838', '#0E0E22', '#020208', [['Poisson-néant', 'Ombre-lanterne', 'Aveugle noir', 'Anguille d’encre', 'Gobie d’obscurité', 'Sardine d’ombre'], ['Baudroie d’ombre', 'Poisson-vide', 'Mâchoire d’encre', 'Raie noire'], ['Dragon du gouffre', 'Serpent d’ombre', 'Titan d’encre'], ['Béhémoth du gouffre'], ['Ce qui dort au fond']], 'Ombre-lanterne des marées'],
  ]],
  ['Volcanique', [
    ['Lac de cratère', '#E0B8A0', '#6A8A7A', '#2A3A36', [['Tilapia de cratère', 'Poisson-cendre', 'Gobie volcanique', 'Barbeau sulfureux', 'Vairon de basalte', 'Loche de ponce'], ['Carpe de cratère', 'Brochet cendré', 'Truite de lave froide', 'Silure de basalte'], ['Esturgeon de cratère', 'Poisson-obsidienne', 'Anguille de cendre'], ['Carpe ardente'], ['Gardien du cratère']], 'Poisson-cendre des marées'],
    ['Rivière de lave', '#FFB080', '#E0602A', '#6A1A0A', [['Tison', 'Salamandre-poisson', 'Ablette de feu', 'Gardon incandescent', 'Chevesne de lave', 'Goujon brûlant'], ['Truite de magma', 'Barbeau ardent', 'Perche de feu', 'Sandre fondu'], ['Saumon de lave', 'Silure de magma', 'Brochet flamboyant'], ['Phénix des eaux'], ['Dragon de lave']], 'Tison des marées'],
    ['Geysers', '#F0E0C8', '#7AB8B0', '#2A5A5A', [['Poisson-vapeur', 'Bulle-gobie', 'Vairon bouillant', 'Loche des geysers', 'Épinoche fumante', 'Ablette de soufre'], ['Truite des geysers', 'Omble bouillant', 'Carpe de vapeur', 'Anguille sifflante'], ['Poisson-geyser', 'Esturgeon brûlant', 'Taimen de vapeur'], ['Jaillisseur géant'], ['Esprit des geysers']], 'Omble bouillant des marées'],
    ['Mer de soufre', '#F0E890', '#C8B82A', '#5A4A0A', [['Sardine de soufre', 'Hareng jaune', 'Mulet acide', 'Gobie sulfureux', 'Maquereau toxique', 'Anchois d’ambre'], ['Mérou de soufre', 'Raie acide', 'Congre jaune', 'Barracuda d’ambre'], ['Requin de soufre', 'Marlin d’ambre', 'Thon toxique'], ['Kraken de soufre'], ['Reine de soufre']], 'Mérou de soufre des marées'],
    ['Cœur du volcan', '#FF9060', '#C82A1A', '#3A0404', [['Poisson-magma', 'Braise vivante', 'Cendrillon', 'Poisson-scorie', 'Étincelle', 'Poisson-lave'], ['Salamandre géante', 'Anguille de feu', 'Rascasse ardente', 'Obsidienne royale'], ['Dragon de magma', 'Titan de feu', 'Serpent volcanique'], ['Cœur ardent'], ['Dieu du volcan']], 'Étincelle des marées'],
  ]],
  ['Mystique', [
    ['Lac hanté', '#9A90B8', '#4A5A7A', '#1A1E36', [['Poisson-spectre', 'Gardon fantôme', 'Ablette voilée', 'Perche des âmes', 'Tanche maudite', 'Brème pâle'], ['Carpe hantée', 'Brochet spectral', 'Anguille des murmures', 'Silure d’outre-tombe'], ['Poisson-banshee', 'Esturgeon fantôme', 'Koï des âmes'], ['Dame du lac'], ['Roi des revenants']], 'Carpe hantée des marées'],
    ['Mer de cristal', '#F0E8FF', '#B8A8FF', '#5A4AB8', [['Poisson de verre', 'Sardine prismatique', 'Gobie de quartz', 'Hareng de cristal', 'Mulet diamant', 'Anchois irisé'], ['Mérou de cristal', 'Raie prismatique', 'Thon de quartz', 'Baliste de verre'], ['Marlin de diamant', 'Requin de cristal', 'Poisson-kaléidoscope'], ['Léviathan de cristal'], ['Cœur de cristal']], 'Poisson de verre des marées'],
    ['Forêt engloutie', '#B8D8A0', '#3A7A5A', '#10301E', [['Poisson-mousse', 'Gardon des racines', 'Perche de lierre', 'Carassin des feuilles', 'Loche d’écorce', 'Vairon des lianes'], ['Brochet des souches', 'Carpe moussue', 'Anguille des racines', 'Silure des ruines'], ['Esprit sylvestre', 'Arapaïma des ruines', 'Poisson-druide'], ['Gardien de la forêt'], ['Poisson-arbre ancestral']], 'Carpe moussue des marées'],
    ['Océan céleste', '#3A2A7A', '#5A3AC8', '#1A0A5A', [['Étoile filante', 'Sardine lunaire', 'Poisson-comète', 'Gobie nébuleux', 'Hareng astral', 'Mulet solaire'], ['Raie galactique', 'Thon céleste', 'Mérou nébuleux', 'Baliste stellaire'], ['Baleine astrale', 'Requin cosmique', 'Marlin des étoiles'], ['Dragon céleste'], ['Gardien des constellations']], 'Poisson-comète des marées'],
    ['Abîme des rêves', '#E8B8E8', '#8A5AB8', '#2A0A4A', [['Poisson-songe', 'Rêveur pâle', 'Gobie onirique', 'Sardine de sommeil', 'Poisson-nuage', 'Ablette des songes'], ['Raie de brume', 'Anguille des cauchemars', 'Mérou endormi', 'Poisson-horloge'], ['Chimère des rêves', 'Titan onirique', 'Serpent de l’oubli'], ['Dévoreur de rêves'], ['Le Grand Rêveur']], 'Poisson-songe des marées'],
  ]],
];

export const ZONES: Zone[] = REGIONS.flatMap(([region, zones], ri) =>
  zones.map(([name, sky, top, bottom, fish, tide], zi) => ({ id: ri * 5 + zi, name, region, sky, top, bottom, fish, tide })),
);

/** Past the last hand-made spot: the Profondeurs, one level after another, forever. */
export const DEPTH_START = ZONES.length;

const DEPTH_PREFIX = ['Géant', 'Spectral', 'Cristal', 'Magma', 'Doré', 'Néon', 'Titan', 'Ancestral', 'Stellaire', 'Maudit', 'Primordial', 'Éternel'];
const DEPTH_PALETTES: [string, string, string][] = [
  ['#1A2040', '#0E1A4A', '#02051A'], ['#2A1040', '#2A0E5A', '#0A0220'], ['#10302A', '#0A4A40', '#021A14'], ['#401010', '#5A0E0E', '#1A0202'],
];

export function zoneInfo(z: number): Zone {
  if (z < DEPTH_START) return ZONES[z];
  const depth = z - DEPTH_START + 1;
  const src = ZONES[25 + ((depth - 1) % 5)]; // the abyss spots, mutated
  const prefix = DEPTH_PREFIX[(depth - 1) % DEPTH_PREFIX.length];
  const [sky, top, bottom] = DEPTH_PALETTES[(depth - 1) % DEPTH_PALETTES.length];
  const mutate = (list: string[]) => list.map((n) => `${n} ${prefix.toLowerCase()}`);
  return {
    id: z, name: `Profondeur ${depth}`, region: 'Profondeurs', sky, top, bottom,
    fish: [mutate(src.fish[0]), mutate(src.fish[1]), mutate(src.fish[2]), mutate(src.fish[3]), mutate(src.fish[4])],
    tide: `${src.tide} ${prefix.toLowerCase()}`,
  };
}

export interface Species {
  id: string;
  name: string;
  zone: number;
  rarity: RarityIndex;
  tide: boolean;
  color: string;
  minKg: number;
  maxKg: number;
}

const FISH_COLORS = ['#FF8A1F', '#FFC61A', '#33D17A', '#5B8CFF', '#FF4F8B', '#B06BFF', '#25D0C8', '#E8E8E8', '#C2632B', '#9EE7FF'];

function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** The species of one spot. Hand-made spots get readable ids, depths numbered ones. */
export function speciesOfZone(z: number): Species[] {
  const info = zoneInfo(z);
  const depth = z >= DEPTH_START;
  const scale = depth ? 8 + (z - DEPTH_START) * 1.5 : 0.12 + z * 0.2;
  const out: Species[] = [];
  let i = 0;
  info.fish.forEach((names, r) => {
    names.forEach((name) => {
      const min = scale * (1 + r * 1.2);
      out.push({
        id: depth ? `p${z}-${i}` : `z${z}-${slug(name)}`, name, zone: z, rarity: r as RarityIndex, tide: false,
        color: FISH_COLORS[(z * 3 + i) % FISH_COLORS.length], minKg: min, maxKg: min * 4,
      });
      i++;
    });
  });
  const min = scale * 7;
  out.push({ id: depth ? `p${z}-t` : `z${z}-${slug(info.tide)}`, name: info.tide, zone: z, rarity: 4, tide: true, color: '#9EE7FF', minKg: min, maxKg: min * 3 });
  return out;
}

/** Every hand-made species, for the Poissodex. */
export const SPECIES: Species[] = ZONES.flatMap((z) => speciesOfZone(z.id));
const SPECIES_INDEX = new Map(SPECIES.map((s) => [s.id, s]));

export function getSpecies(id: string): Species | undefined {
  const hit = SPECIES_INDEX.get(id);
  if (hit) return hit;
  const m = /^p(\d+)-(\d+|t)$/.exec(id);
  if (!m) return undefined;
  return speciesOfZone(Number(m[1])).find((s) => s.id === id);
}

/* ------------------------------------------------------------------ */
/* Gear                                                                */
/* ------------------------------------------------------------------ */

export type GearId = 'canne' | 'moulinet' | 'hamecon' | 'bateau' | 'auto';
export type MaterialId = 'fil' | 'bois' | 'metal' | 'ecaille';

export const MATERIALS: Record<MaterialId, { label: string; color: string }> = {
  fil: { label: 'Fil', color: '#E8E8E8' },
  bois: { label: 'Bois', color: '#E08A4A' },
  metal: { label: 'Métal', color: '#9AA6C8' },
  ecaille: { label: 'Écaille rare', color: '#25D0C8' },
};

export const GEAR: Record<GearId, { label: string; hint: string }> = {
  canne: { label: 'Canne', hint: 'Prises plus lourdes et mieux payées.' },
  moulinet: { label: 'Moulinet', hint: 'Zone verte plus large, remontée plus facile.' },
  hamecon: { label: 'Hameçon', hint: 'Plus de chances d’attraper des raretés.' },
  bateau: { label: 'Bateau', hint: 'Chaque niveau ouvre le coin de pêche suivant, jusqu’aux Profondeurs.' },
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
  depart: { label: 'Bon départ', hint: (l) => `Chaque Marée repart avec le bateau niveau ${l}` },
};

const TITLES: [number, string][] = [
  [0, 'Mousse'], [1, 'Moussaillon'], [2, 'Matelot'], [3, 'Pêcheur'], [5, 'Loup de mer'],
  [10, 'Capitaine'], [20, 'Amiral'], [35, 'Seigneur des Marées'], [50, 'Légende des abysses'],
  [75, 'Maître des océans'], [100, 'Dieu des marées'], [150, 'Au-delà des marées'], [250, 'Éternel'],
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
  return { label: 'Bronze', fill: '#E08A4A', shade: '#8E4418', text: '#FFFFFF' };
}

/* ------------------------------------------------------------------ */
/* Weather — shared by everyone, changes every 15 minutes              */
/* ------------------------------------------------------------------ */

export type WeatherId = 'soleil' | 'pluie' | 'brume' | 'orage' | 'lune';

export const WEATHER: Record<WeatherId, { label: string; hint: string; weight: number; luck: number; variants: number; tide: number; value: number }> = {
  soleil: { label: 'Soleil', hint: 'Temps calme.', weight: 40, luck: 1, variants: 1, tide: 1, value: 1 },
  pluie: { label: 'Pluie', hint: 'Les poissons rares mordent plus (+25 %).', weight: 25, luck: 1.25, variants: 1, tide: 1, value: 1 },
  brume: { label: 'Brume', hint: 'Variantes ×2 et espèces de marée plus fréquentes.', weight: 15, luck: 1, variants: 2, tide: 2, value: 1 },
  orage: { label: 'Orage', hint: 'Grosses raretés (+60 %) et prises payées +30 %.', weight: 12, luck: 1.6, variants: 1, tide: 1, value: 1.3 },
  lune: { label: 'Nuit de lune', hint: 'Variantes ×3.', weight: 8, luck: 1.1, variants: 3, tide: 1.5, value: 1 },
};

/* ------------------------------------------------------------------ */
/* Shop                                                                */
/* ------------------------------------------------------------------ */

export type EffectId = 'appat' | 'criee' | 'moulinet' | 'turbo' | 'boussole';

export interface ShopItem {
  id: string;
  label: string;
  hint: string;
  /** Price in "zone base" units, so it follows the player's progress. */
  price: number;
  effect?: EffectId;
  minutes?: number;
  /** Instant materials instead of an effect. */
  materials?: boolean;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'appat', label: 'Appât doré', hint: 'Raretés +50 % pendant 10 min.', price: 60, effect: 'appat', minutes: 10 },
  { id: 'criee', label: 'Criée VIP', hint: 'Ventes ×2 pendant 10 min.', price: 90, effect: 'criee', minutes: 10 },
  { id: 'moulinet', label: 'Moulinet huilé', hint: 'Jauge bien plus facile pendant 15 min.', price: 40, effect: 'moulinet', minutes: 15 },
  { id: 'turbo', label: 'Canne turbo', hint: 'Canne auto deux fois plus rapide pendant 15 min.', price: 70, effect: 'turbo', minutes: 15 },
  { id: 'boussole', label: 'Boussole des marées', hint: 'Variantes et espèces de marée ×3 pendant 15 min.', price: 80, effect: 'boussole', minutes: 15 },
  { id: 'caisse', label: 'Caisse de matériaux', hint: 'Une bonne réserve de chaque matériau, tout de suite.', price: 50, materials: true },
];

/* ------------------------------------------------------------------ */
/* Missions                                                            */
/* ------------------------------------------------------------------ */

export type MissionType = 'catch' | 'rare' | 'perfect' | 'sell' | 'market' | 'orders' | 'epic';

export const MISSION_TEXT: Record<MissionType, (n: number) => string> = {
  catch: (n) => `Attrape ${n} poissons`,
  rare: (n) => `Attrape ${n} poissons rares ou mieux`,
  epic: (n) => `Attrape ${n} poissons épiques ou mieux`,
  perfect: (n) => `Réussis ${n} prises parfaites`,
  sell: () => 'Vends pour un gros montant',
  market: (n) => `Attrape ${n} poissons de la criée du jour`,
  orders: (n) => `Livre ${n} commandes de la criée`,
};

/* ------------------------------------------------------------------ */
/* Cosmetics                                                           */
/* ------------------------------------------------------------------ */

export type CosmeticSlot = 'flotteur' | 'canne' | 'decor' | 'effet';

export const COSMETIC_SLOTS: Record<CosmeticSlot, string> = {
  flotteur: 'Flotteur',
  canne: 'Canne',
  decor: 'Décor',
  effet: 'Effet de prise',
};

export interface Cosmetic {
  id: string;
  slot: CosmeticSlot;
  name: string;
  rarity: 0 | 1 | 2 | 3;
  /** flotteur: [top, bottom]; canne: [rod]; decor: [sky tint, sun]; effet: [colors…] */
  colors: string[];
}

export const COSMETICS: Cosmetic[] = [
  { id: 'fl-classique', slot: 'flotteur', name: 'Flotteur classique', rarity: 0, colors: ['#FF4F8B', '#FFFFFF'] },
  { id: 'fl-citron', slot: 'flotteur', name: 'Citron', rarity: 0, colors: ['#FFC61A', '#FFFFFF'] },
  { id: 'fl-menthe', slot: 'flotteur', name: 'Menthe', rarity: 0, colors: ['#33D17A', '#FFFFFF'] },
  { id: 'fl-nuit', slot: 'flotteur', name: 'Nuit', rarity: 1, colors: ['#5B8CFF', '#0E1030'] },
  { id: 'fl-corail', slot: 'flotteur', name: 'Corail', rarity: 1, colors: ['#FF8A1F', '#FFE3A8'] },
  { id: 'fl-glace', slot: 'flotteur', name: 'Glace', rarity: 2, colors: ['#9EE7FF', '#FFFFFF'] },
  { id: 'fl-lave', slot: 'flotteur', name: 'Lave', rarity: 2, colors: ['#FF4F1A', '#FFC61A'] },
  { id: 'fl-or', slot: 'flotteur', name: 'Flotteur en or', rarity: 3, colors: ['#FFC61A', '#D98E00'] },
  { id: 'fl-galaxie', slot: 'flotteur', name: 'Galaxie', rarity: 3, colors: ['#B06BFF', '#25D0C8'] },

  { id: 'ca-bois', slot: 'canne', name: 'Canne en bois', rarity: 0, colors: ['#8E4418'] },
  { id: 'ca-bambou', slot: 'canne', name: 'Bambou', rarity: 0, colors: ['#9AAF3A'] },
  { id: 'ca-carbone', slot: 'canne', name: 'Carbone', rarity: 1, colors: ['#2B3170'] },
  { id: 'ca-rose', slot: 'canne', name: 'Bonbon', rarity: 1, colors: ['#FF4F8B'] },
  { id: 'ca-corsaire', slot: 'canne', name: 'Corsaire', rarity: 2, colors: ['#C2632B'] },
  { id: 'ca-cristal', slot: 'canne', name: 'Cristal', rarity: 2, colors: ['#9EE7FF'] },
  { id: 'ca-doree', slot: 'canne', name: 'Canne dorée', rarity: 3, colors: ['#FFC61A'] },
  { id: 'ca-neon', slot: 'canne', name: 'Néon', rarity: 3, colors: ['#25FFD0'] },

  { id: 'de-aube', slot: 'decor', name: 'Aube', rarity: 0, colors: ['#FFD2B8', '#FFE27A'] },
  { id: 'de-midi', slot: 'decor', name: 'Plein midi', rarity: 0, colors: ['#9ADBFF', '#FFF27A'] },
  { id: 'de-couchant', slot: 'decor', name: 'Coucher de soleil', rarity: 1, colors: ['#FF9A6A', '#FF4F1A'] },
  { id: 'de-rose', slot: 'decor', name: 'Ciel rose', rarity: 1, colors: ['#FFB8E0', '#FFFFFF'] },
  { id: 'de-aurore', slot: 'decor', name: 'Aurore boréale', rarity: 2, colors: ['#1A3A5A', '#33D17A'] },
  { id: 'de-nuit', slot: 'decor', name: 'Nuit étoilée', rarity: 2, colors: ['#10133A', '#F4F4FF'] },
  { id: 'de-eclipse', slot: 'decor', name: 'Éclipse', rarity: 3, colors: ['#1A0A2A', '#FF4F8B'] },
  { id: 'de-arcenciel', slot: 'decor', name: 'Arc-en-ciel', rarity: 3, colors: ['#7AD8FF', '#FFC61A'] },

  { id: 'ef-bulles', slot: 'effet', name: 'Bulles', rarity: 0, colors: ['#9EE7FF', '#FFFFFF'] },
  { id: 'ef-confettis', slot: 'effet', name: 'Confettis', rarity: 1, colors: ['#FFC61A', '#FF4F8B', '#33D17A', '#5B8CFF'] },
  { id: 'ef-etoiles', slot: 'effet', name: 'Étoiles', rarity: 2, colors: ['#FFC61A', '#FFFFFF'] },
  { id: 'ef-flammes', slot: 'effet', name: 'Flammes', rarity: 2, colors: ['#FF4F1A', '#FFC61A'] },
  { id: 'ef-arcenciel', slot: 'effet', name: 'Pluie arc-en-ciel', rarity: 3, colors: ['#FF4F8B', '#FFC61A', '#33D17A', '#5B8CFF', '#B06BFF'] },
];

export const COSMETIC_BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

/** Chest odds by cosmetic rarity. */
export const PACK_ODDS = [60, 28, 10, 2];

/* ------------------------------------------------------------------ */
/* V3: points, achievements, pass, weekly boss                         */
/* ------------------------------------------------------------------ */

/**
 * Leaderboard points per catch. They depend on rarity and variant only — not
 * on the spot or on Marées — so a new player and a veteran race on equal terms.
 */
export const RARITY_POINTS = [1, 3, 10, 40, 200];
export const VARIANT_POINTS: Record<string, number> = { '': 1, chroma: 3, or: 10 };

export type AchievementMetric =
  | 'caught' | 'species' | 'maree' | 'bestZone' | 'perfect' | 'legendary' | 'mythic'
  | 'chroma' | 'or' | 'chests' | 'orders' | 'missions' | 'earned';

export interface Achievement {
  id: string;
  label: string;
  metric: AchievementMetric;
  target: number;
  perles: number;
  packs: number;
}

const ach = (metric: AchievementMetric, targets: number[], label: (n: number) => string, perles: number[], packs: number[]): Achievement[] =>
  targets.map((t, i) => ({ id: `${metric}-${t}`, label: label(t), metric, target: t, perles: perles[i] ?? 0, packs: packs[i] ?? 0 }));

export const ACHIEVEMENTS: Achievement[] = [
  ...ach('caught', [10, 100, 1_000, 10_000, 100_000], (n) => `Attraper ${n.toLocaleString('fr-FR')} poissons`, [1, 2, 4, 8, 16], [0, 1, 1, 2, 3]),
  ...ach('species', [10, 50, 150, 400, 640], (n) => `Découvrir ${n} espèces`, [1, 3, 6, 12, 30], [1, 1, 2, 3, 5]),
  ...ach('maree', [1, 5, 10, 25, 50, 100], (n) => `Atteindre la Marée ${n}`, [2, 5, 10, 20, 40, 80], [1, 2, 3, 4, 5, 8]),
  ...ach('bestZone', [5, 10, 20, 30, 40, 60], (n) => (n >= 40 ? `Descendre à la Profondeur ${n - 39}` : `Pêcher dans le coin n°${n + 1}`), [1, 2, 4, 6, 10, 20], [0, 1, 1, 2, 3, 4]),
  ...ach('perfect', [10, 100, 1_000], (n) => `Réussir ${n.toLocaleString('fr-FR')} prises parfaites`, [1, 3, 8], [0, 1, 2]),
  ...ach('legendary', [1, 25, 250], (n) => `Attraper ${n} légendaire${n > 1 ? 's' : ''}`, [1, 4, 10], [1, 1, 2]),
  ...ach('mythic', [1, 10, 100], (n) => `Attraper ${n} mythique${n > 1 ? 's' : ''}`, [2, 6, 20], [1, 2, 4]),
  ...ach('chroma', [1, 25], (n) => `Attraper ${n} poisson${n > 1 ? 's' : ''} chromatique${n > 1 ? 's' : ''}`, [1, 6], [1, 2]),
  ...ach('or', [1, 10], (n) => `Attraper ${n} poisson${n > 1 ? 's' : ''} doré${n > 1 ? 's' : ''}`, [3, 15], [1, 3]),
  ...ach('chests', [5, 50, 250], (n) => `Ouvrir ${n} coffres au trésor`, [1, 3, 8], [1, 2, 3]),
  ...ach('orders', [10, 100, 1_000], (n) => `Livrer ${n.toLocaleString('fr-FR')} commandes`, [1, 4, 12], [0, 1, 2]),
  ...ach('missions', [10, 100, 500], (n) => `Réclamer ${n} missions`, [1, 4, 10], [0, 1, 2]),
  ...ach('earned', [1e6, 1e9, 1e12, 1e18, 1e30], (n) => `Gagner ${n.toExponential(0).replace('e+', ' × 10^')} ₶ au total`, [1, 3, 6, 12, 25], [0, 1, 1, 2, 3]),
];

export const PASS_TIERS = 50;

export const BOSSES = ['Léviathan', 'Kraken', 'Mégalodon', 'Serpent de mer', 'Hydre des abysses'];
