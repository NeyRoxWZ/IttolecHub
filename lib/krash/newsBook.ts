import type { MarketId, Sector } from './assets';

/**
 * Everything the news feed can say.
 *
 * Two kinds of news. Standalone items are one-off headlines with blanks — a
 * company, a country, a figure — filled differently each time they come up.
 * Storylines are small trees: a first headline, then follow-ups a few
 * minutes apart whose branch is drawn when they happen, so "the talks open"
 * is followed by "an agreement is signed" or "the talks collapse", never by
 * the same headline again.
 *
 * Real countries, but leaders are named by their role only.
 *
 * A target's `up` is the chance the price goes up (0.1 = very likely down).
 * `strength` is the size of the move as a fraction of the price, before the
 * country's weight and a little per-asset jitter.
 */

import type { Certainty, NewsCategory } from './newsMeta';

export type { Certainty, NewsCategory };

export interface Target {
  /** An asset id, or '{E}' for the company the headline names. */
  asset?: string;
  sector?: Sector;
  market?: MarketId;
  up: number;
  strength: number;
}

/** Which countries may fill a {L}/{P}/{dP} blank. */
export type CountryPool = string[];

export interface Headline {
  category: NewsCategory;
  certainty: Certainty;
  text: string;
  targets: Target[];
}

export interface NewsTemplate extends Headline {
  id: string;
  /** Sectors the {E} company is drawn from; any FRX 40 company when empty. */
  companyFrom?: Sector[];
  countries?: CountryPool;
  /** Inclusive range for {n}. */
  number?: [number, number];
}

export interface ArcNode extends Headline {
  next?: { weight: number; node: ArcNode }[];
}

export interface Arc {
  id: string;
  companyFrom?: Sector[];
  root: ArcNode;
}

export interface Country {
  id: string;
  /** "les États-Unis" */
  name: string;
  /** "des États-Unis" */
  of: string;
  /** "le président américain" */
  leader: string;
  /** How far their word moves markets. */
  weight: number;
}

export const COUNTRIES: Country[] = [
  { id: 'us', name: 'les États-Unis', of: 'des États-Unis', leader: 'le président américain', weight: 1 },
  { id: 'cn', name: 'la Chine', of: 'de la Chine', leader: 'le président chinois', weight: 0.95 },
  { id: 'eu', name: "l'Union européenne", of: "de l'Union européenne", leader: 'la Commission européenne', weight: 0.8 },
  { id: 'ru', name: 'la Russie', of: 'de la Russie', leader: 'le Kremlin', weight: 0.75 },
  { id: 'fr', name: 'la France', of: 'de la France', leader: "l'Élysée", weight: 0.7 },
  { id: 'sa', name: "l'Arabie saoudite", of: "de l'Arabie saoudite", leader: 'Riyad', weight: 0.7 },
  { id: 'de', name: "l'Allemagne", of: "de l'Allemagne", leader: 'le chancelier allemand', weight: 0.65 },
  { id: 'jp', name: 'le Japon', of: 'du Japon', leader: 'le Premier ministre japonais', weight: 0.55 },
  { id: 'uk', name: 'le Royaume-Uni', of: 'du Royaume-Uni', leader: 'Downing Street', weight: 0.55 },
  { id: 'in', name: "l'Inde", of: "de l'Inde", leader: 'le Premier ministre indien', weight: 0.5 },
  { id: 'br', name: 'le Brésil', of: 'du Brésil', leader: 'le président brésilien', weight: 0.4 },
  { id: 'ch', name: 'la Suisse', of: 'de la Suisse', leader: 'le Conseil fédéral suisse', weight: 0.3 },
];

/* ------------------------------------------------------------------ */
/* Standalone headlines                                                 */
/* ------------------------------------------------------------------ */

export const TEMPLATES: NewsTemplate[] = [
  // Géopolitique
  { id: 'g-taxe-auto', category: 'geo', certainty: 'evidente', countries: ['us', 'cn'],
    text: '{L} menace de taxer lourdement les voitures européennes.',
    targets: [{ sector: 'auto', up: 0.15, strength: 0.03 }] },
  { id: 'g-taxe-luxe', category: 'geo', certainty: 'evidente', countries: ['us', 'cn'],
    text: '{L} annonce des droits de douane sur le luxe français.',
    targets: [{ sector: 'luxe', up: 0.12, strength: 0.03 }] },
  { id: 'g-mer-chine', category: 'geo', certainty: 'ambigue',
    text: 'Tensions en mer de Chine : des navires militaires se font face.',
    targets: [{ sector: 'tech', up: 0.3, strength: 0.02 }, { sector: 'aero', up: 0.75, strength: 0.02 }] },
  { id: 'g-cessez-feu', category: 'geo', certainty: 'ambigue', countries: ['us', 'eu', 'fr', 'cn'],
    text: '{L} appelle à un cessez-le-feu immédiat au Moyen-Orient.',
    targets: [{ sector: 'energie', up: 0.3, strength: 0.02 }, { sector: 'aero', up: 0.35, strength: 0.015 }] },
  { id: 'g-drones-petrole', category: 'geo', certainty: 'evidente',
    text: "Frappes de drones sur des installations pétrolières en Arabie saoudite.",
    targets: [{ sector: 'energie', up: 0.9, strength: 0.035 }, { sector: 'auto', up: 0.3, strength: 0.012 }] },
  { id: 'g-elections', category: 'geo', certainty: 'ambigue',
    text: 'Élections législatives anticipées annoncées en France.',
    targets: [{ sector: 'banque', up: 0.3, strength: 0.022 }, { sector: 'btp', up: 0.4, strength: 0.015 }] },
  { id: 'g-accord-inde', category: 'geo', certainty: 'ambigue', countries: ['eu', 'fr', 'uk', 'us'],
    text: "{L} signe un accord commercial historique avec l'Inde.",
    targets: [{ sector: 'industrie', up: 0.75, strength: 0.018 }, { sector: 'conso', up: 0.7, strength: 0.012 }] },
  { id: 'g-otan', category: 'geo', certainty: 'evidente',
    text: "L'OTAN annonce une hausse massive des budgets de défense.",
    targets: [{ sector: 'aero', up: 0.92, strength: 0.03 }] },
  { id: 'g-greve', category: 'geo', certainty: 'ambigue',
    text: 'Grève générale reconduite dans les transports français.',
    targets: [{ sector: 'conso', up: 0.28, strength: 0.012 }, { sector: 'auto', up: 0.35, strength: 0.01 }] },
  { id: 'g-g20', category: 'geo', certainty: 'ambigue',
    text: 'Sommet du G20 : les dirigeants discutent d’une taxe mondiale sur les multinationales.',
    targets: [{ sector: 'tech', up: 0.35, strength: 0.02 }, { sector: 'luxe', up: 0.4, strength: 0.015 }] },
  { id: 'g-sanctions', category: 'geo', certainty: 'ambigue', countries: ['us', 'eu', 'uk'],
    text: '{L} annonce un nouveau paquet de sanctions contre la Russie.',
    targets: [{ sector: 'energie', up: 0.72, strength: 0.022 }, { sector: 'banque', up: 0.4, strength: 0.012 }] },

  // Économie
  { id: 'e-pression-taux', category: 'eco', certainty: 'ambigue', countries: ['us'],
    text: '{L} exige que la banque centrale baisse ses taux.',
    targets: [{ market: 'crypto', up: 0.68, strength: 0.035 }, { sector: 'banque', up: 0.38, strength: 0.012 }] },
  { id: 'e-bce-hausse', category: 'eco', certainty: 'evidente',
    text: 'La BCE relève ses taux directeurs d’un quart de point.',
    targets: [{ sector: 'immo', up: 0.12, strength: 0.03 }, { sector: 'btp', up: 0.3, strength: 0.015 }, { sector: 'banque', up: 0.75, strength: 0.015 }] },
  { id: 'e-bce-baisse', category: 'eco', certainty: 'evidente',
    text: 'La BCE baisse ses taux par surprise.',
    targets: [{ sector: 'immo', up: 0.88, strength: 0.035 }, { market: 'crypto', up: 0.72, strength: 0.03 }] },
  { id: 'e-inflation', category: 'eco', certainty: 'ambigue',
    text: "L'inflation française grimpe à {n} % sur un an.", number: [3, 7],
    targets: [{ sector: 'conso', up: 0.3, strength: 0.015 }, { sector: 'banque', up: 0.6, strength: 0.012 }] },
  { id: 'e-chomage', category: 'eco', certainty: 'ambigue',
    text: 'Le chômage recule en France pour le troisième mois d’affilée.',
    targets: [{ market: 'frx', up: 0.7, strength: 0.01 }] },
  { id: 'e-emploi-us', category: 'eco', certainty: 'pile',
    text: 'Chiffres de l’emploi américain attendus dans quelques minutes.',
    targets: [{ market: 'frx', up: 0.5, strength: 0.02 }, { market: 'crypto', up: 0.5, strength: 0.045 }] },
  { id: 'e-recession-de', category: 'eco', certainty: 'evidente',
    text: "L'Allemagne entre officiellement en récession.",
    targets: [{ sector: 'industrie', up: 0.15, strength: 0.025 }, { sector: 'auto', up: 0.18, strength: 0.025 }] },
  { id: 'e-relance-chine', category: 'eco', certainty: 'evidente',
    text: 'La Chine injecte des centaines de milliards pour relancer sa consommation.',
    targets: [{ sector: 'luxe', up: 0.88, strength: 0.032 }, { sector: 'industrie', up: 0.72, strength: 0.015 }] },
  { id: 'e-notation', category: 'eco', certainty: 'evidente',
    text: 'Une agence de notation dégrade la note de la France.',
    targets: [{ sector: 'banque', up: 0.1, strength: 0.03 }, { market: 'frx', up: 0.25, strength: 0.012 }] },
  { id: 'e-immo', category: 'eco', certainty: 'evidente',
    text: 'Les prix de l’immobilier reculent de {n} % sur un an.', number: [4, 12],
    targets: [{ sector: 'immo', up: 0.15, strength: 0.025 }, { sector: 'btp', up: 0.35, strength: 0.015 }] },
  { id: 'e-plan-relance', category: 'eco', certainty: 'ambigue', countries: ['us', 'cn', 'eu', 'de', 'jp'],
    text: '{L} présente un plan de relance de {n} milliards.', number: [100, 900],
    targets: [{ market: 'frx', up: 0.7, strength: 0.015 }, { sector: 'btp', up: 0.78, strength: 0.02 }] },

  // Énergie
  { id: 'n-opep-baisse', category: 'energie', certainty: 'evidente',
    text: "L'OPEP annonce une baisse de production surprise.",
    targets: [{ sector: 'energie', up: 0.92, strength: 0.03 }, { sector: 'auto', up: 0.3, strength: 0.012 }] },
  { id: 'n-opep-reunion', category: 'energie', certainty: 'pile',
    text: "L'OPEP se réunit ce soir, aucune fuite sur la décision.",
    targets: [{ sector: 'energie', up: 0.5, strength: 0.04 }] },
  { id: 'n-gisement', category: 'energie', certainty: 'ambigue',
    text: 'Découverte d’un gisement de gaz géant en Méditerranée.',
    targets: [{ sector: 'energie', up: 0.35, strength: 0.02 }] },
  { id: 'n-canicule', category: 'energie', certainty: 'ambigue',
    text: 'Canicule : la consommation d’électricité bat des records en Europe.',
    targets: [{ sector: 'energie', up: 0.75, strength: 0.02 }] },
  { id: 'n-panne', category: 'energie', certainty: 'ambigue',
    text: 'Panne géante sur le réseau électrique espagnol.',
    targets: [{ sector: 'energie', up: 0.35, strength: 0.015 }, { sector: 'industrie', up: 0.4, strength: 0.01 }] },
  { id: 'n-baril-chute', category: 'energie', certainty: 'evidente',
    text: 'Le baril de pétrole chute sous les 60 dollars.',
    targets: [{ sector: 'energie', up: 0.1, strength: 0.03 }, { sector: 'auto', up: 0.7, strength: 0.012 }, { sector: 'aero', up: 0.68, strength: 0.012 }] },
  { id: 'n-nucleaire', category: 'energie', certainty: 'ambigue', countries: ['fr', 'jp', 'uk', 'in'],
    text: '{L} annonce la construction de {n} nouveaux réacteurs nucléaires.', number: [4, 14],
    targets: [{ sector: 'energie', up: 0.72, strength: 0.018 }, { sector: 'btp', up: 0.75, strength: 0.015 }] },

  // Tech
  { id: 't-ia', category: 'tech', certainty: 'evidente',
    text: 'Percée majeure en intelligence artificielle annoncée par un laboratoire européen.',
    targets: [{ sector: 'tech', up: 0.85, strength: 0.03 }] },
  { id: 't-puces', category: 'tech', certainty: 'ambigue',
    text: 'Pénurie mondiale de puces électroniques.',
    targets: [{ asset: 'STMC', up: 0.75, strength: 0.035 }, { sector: 'auto', up: 0.18, strength: 0.03 }] },
  { id: 't-cyber', category: 'tech', certainty: 'evidente',
    text: 'Cyberattaque massive contre plusieurs banques européennes.',
    targets: [{ sector: 'banque', up: 0.12, strength: 0.025 }, { sector: 'tech', up: 0.62, strength: 0.015 }] },
  { id: 't-produit', category: 'tech', certainty: 'pile', companyFrom: ['tech', 'auto', 'luxe'],
    text: '{E} dévoile ce soir le produit phare de l’année.',
    targets: [{ asset: '{E}', up: 0.5, strength: 0.05 }] },
  { id: 't-antitrust', category: 'tech', certainty: 'evidente', companyFrom: ['tech', 'media', 'telecom'],
    text: 'Bruxelles ouvre une enquête antitrust visant {E}.',
    targets: [{ asset: '{E}', up: 0.18, strength: 0.035 }] },

  // Entreprises
  { id: 'c-resultats-bons', category: 'entreprise', certainty: 'evidente',
    text: '{E} publie des résultats bien au-dessus des attentes.',
    targets: [{ asset: '{E}', up: 0.88, strength: 0.04 }] },
  { id: 'c-resultats-mauvais', category: 'entreprise', certainty: 'evidente',
    text: '{E} rate ses objectifs et abaisse ses prévisions.',
    targets: [{ asset: '{E}', up: 0.1, strength: 0.05 }] },
  { id: 'c-pdg', category: 'entreprise', certainty: 'ambigue',
    text: '{E} annonce le départ surprise de son PDG.',
    targets: [{ asset: '{E}', up: 0.3, strength: 0.035 }] },
  { id: 'c-rachat-us', category: 'entreprise', certainty: 'ambigue',
    text: '{E} annonce le rachat d’un concurrent américain.',
    targets: [{ asset: '{E}', up: 0.4, strength: 0.04 }] },
  { id: 'c-plan-social', category: 'entreprise', certainty: 'ambigue',
    text: '{E} lance un plan de {n} suppressions de postes.', number: [800, 6000],
    targets: [{ asset: '{E}', up: 0.62, strength: 0.025 }] },
  { id: 'c-buyback', category: 'entreprise', certainty: 'evidente',
    text: '{E} rachète ses propres actions pour {n} milliards.', number: [1, 5],
    targets: [{ asset: '{E}', up: 0.85, strength: 0.025 }] },
  { id: 'c-rappel', category: 'entreprise', certainty: 'evidente', companyFrom: ['auto', 'conso', 'sante'],
    text: 'Rappel massif de produits chez {E}.',
    targets: [{ asset: '{E}', up: 0.12, strength: 0.04 }] },
  { id: 'c-contrat', category: 'entreprise', certainty: 'evidente', companyFrom: ['aero', 'industrie', 'btp'],
    countries: ['us', 'cn', 'sa', 'in', 'jp', 'br', 'uk', 'de'],
    text: '{E} décroche un contrat géant auprès {dP}.',
    targets: [{ asset: '{E}', up: 0.9, strength: 0.035 }] },
  { id: 'c-essai', category: 'entreprise', certainty: 'evidente', companyFrom: ['sante'],
    text: 'Essai clinique décevant pour le médicament vedette de {E}.',
    targets: [{ asset: '{E}', up: 0.1, strength: 0.06 }] },
  { id: 'c-fusion', category: 'entreprise', certainty: 'pile',
    text: '{E} entre en négociations exclusives pour une fusion.',
    targets: [{ asset: '{E}', up: 0.5, strength: 0.06 }] },

  // Crypto
  { id: 'k-etf-sol', category: 'crypto', certainty: 'evidente',
    text: 'Un grand fonds américain dépose une demande d’ETF sur Solana.',
    targets: [{ asset: 'SOL', up: 0.85, strength: 0.08 }, { sector: 'crypto_alt', up: 0.7, strength: 0.025 }] },
  { id: 'k-minage', category: 'crypto', certainty: 'evidente', countries: ['us', 'cn', 'eu', 'ru', 'in'],
    text: '{L} envisage d’interdire le minage de cryptomonnaies.',
    targets: [{ market: 'crypto', up: 0.15, strength: 0.06 }] },
  { id: 'k-retraits', category: 'crypto', certainty: 'evidente',
    text: 'Une plateforme d’échange majeure suspend tous les retraits.',
    targets: [{ market: 'crypto', up: 0.1, strength: 0.07 }] },
  { id: 'k-hack-pont', category: 'crypto', certainty: 'evidente',
    text: 'Piratage d’un pont entre blockchains : {n} millions dérobés.', number: [80, 600],
    targets: [{ sector: 'crypto_alt', up: 0.15, strength: 0.05 }, { asset: 'ETH', up: 0.3, strength: 0.03 }] },
  { id: 'k-baleines', category: 'crypto', certainty: 'ambigue',
    text: 'Des baleines déplacent {n} 000 bitcoins vers les plateformes.', number: [15, 60],
    targets: [{ asset: 'BTC', up: 0.3, strength: 0.05 }] },
  { id: 'k-maj-eth', category: 'crypto', certainty: 'pile',
    text: 'Mise à jour majeure du réseau Ethereum prévue ce soir.',
    targets: [{ asset: 'ETH', up: 0.5, strength: 0.07 }] },
  { id: 'k-reserve', category: 'crypto', certainty: 'evidente', countries: ['us', 'br', 'ch', 'jp', 'uk'],
    text: '{L} annonce constituer une réserve stratégique de bitcoins.',
    targets: [{ asset: 'BTC', up: 0.92, strength: 0.07 }, { market: 'crypto', up: 0.8, strength: 0.03 }] },
  { id: 'k-meme-viral', category: 'crypto', certainty: 'ambigue',
    text: 'Un memecoin devient viral : les petits jetons s’envolent.',
    targets: [{ sector: 'crypto_meme', up: 0.7, strength: 0.06 }] },
  { id: 'k-staking', category: 'crypto', certainty: 'ambigue', countries: ['eu', 'uk', 'jp'],
    text: '{L} encadre le staking de cryptomonnaies.',
    targets: [{ asset: 'ETH', up: 0.4, strength: 0.04 }, { asset: 'ADA', up: 0.4, strength: 0.05 }] },

  // Rumeurs
  { id: 'r-cible', category: 'rumeur', certainty: 'ambigue',
    text: 'Rumeur : {E} serait la cible d’un rachat.',
    targets: [{ asset: '{E}', up: 0.66, strength: 0.04 }] },
  { id: 'r-banque', category: 'rumeur', certainty: 'ambigue',
    text: 'Un compte anonyme affirme qu’une grande banque française est en difficulté.',
    targets: [{ sector: 'banque', up: 0.35, strength: 0.03 }] },
  { id: 'r-krach-tech', category: 'rumeur', certainty: 'ambigue',
    text: 'Des analystes parient sur un krach imminent de la tech.',
    targets: [{ sector: 'tech', up: 0.4, strength: 0.025 }] },
  { id: 'r-chien', category: 'rumeur', certainty: 'ambigue',
    text: 'Un milliardaire publie une photo de son chien avec un bonnet orange.',
    targets: [{ asset: 'DOGE', up: 0.78, strength: 0.12 }, { asset: 'SHIB', up: 0.7, strength: 0.08 }] },
  { id: 'r-interdit-meme', category: 'rumeur', certainty: 'ambigue',
    text: 'Rumeur d’une interdiction des memecoins en Asie.',
    targets: [{ sector: 'crypto_meme', up: 0.3, strength: 0.072 }] },
  { id: 'r-btc-legal', category: 'rumeur', certainty: 'ambigue',
    text: 'Un pays du G20 pourrait faire du bitcoin une monnaie légale.',
    targets: [{ asset: 'BTC', up: 0.62, strength: 0.06 }] },
  { id: 'r-pepe', category: 'rumeur', certainty: 'ambigue',
    text: 'Soupçons de manipulation autour du cours de Pepe.',
    targets: [{ asset: 'PEPE', up: 0.25, strength: 0.15 }] },

  // Global 50
  { id: 'gl-xvidia-puce', category: 'tech', certainty: 'evidente',
    text: 'Xvidia dévoile une puce d’IA deux fois plus rapide que la précédente.',
    targets: [{ asset: 'XVDA', up: 0.88, strength: 0.06 }, { sector: 'tech', up: 0.68, strength: 0.012 }] },
  { id: 'gl-pomme-chine', category: 'entreprise', certainty: 'ambigue',
    text: 'Les ventes du nouveau téléphone de Pomme déçoivent en Chine.',
    targets: [{ asset: 'POMM', up: 0.25, strength: 0.04 }] },
  { id: 'gl-teslo-livraisons', category: 'entreprise', certainty: 'pile',
    text: 'Teslo publie ses livraisons du trimestre dans quelques minutes.',
    targets: [{ asset: 'TSLO', up: 0.5, strength: 0.08 }] },
  { id: 'gl-demantelement', category: 'tech', certainty: 'evidente', countries: ['us', 'eu'],
    text: '{L} veut démanteler Alphabeta.',
    targets: [{ asset: 'ALPB', up: 0.15, strength: 0.05 }] },
  { id: 'gl-taiwan', category: 'geo', certainty: 'evidente',
    text: 'Manœuvres militaires chinoises géantes autour de Taïwan.',
    targets: [{ asset: 'TSMX', up: 0.1, strength: 0.07 }, { sector: 'tech', up: 0.25, strength: 0.02 }, { asset: 'GOLD', up: 0.8, strength: 0.015 }] },
  { id: 'gl-boeinge', category: 'entreprise', certainty: 'evidente',
    text: 'Nouvel incident en vol sur un avion Boeinge.',
    targets: [{ asset: 'BOEG', up: 0.12, strength: 0.05 }, { asset: 'AIRZ', up: 0.7, strength: 0.015 }] },
  { id: 'gl-obesite', category: 'entreprise', certainty: 'evidente',
    text: 'Un nouveau traitement contre l’obésité de Novo Nordik et Eli Lolly est validé.',
    targets: [{ asset: 'NOVO', up: 0.85, strength: 0.05 }, { asset: 'LOLY', up: 0.85, strength: 0.05 }] },
  { id: 'gl-banques-us', category: 'eco', certainty: 'ambigue',
    text: 'Les grandes banques américaines passent les tests de résistance.',
    targets: [{ asset: 'JPMG', up: 0.75, strength: 0.025 }, { asset: 'GSAX', up: 0.72, strength: 0.03 }] },

  // Matières premières
  { id: 'm-or-banques', category: 'eco', certainty: 'ambigue',
    text: 'Les banques centrales achètent de l’or en quantités record.',
    targets: [{ asset: 'GOLD', up: 0.82, strength: 0.02 }, { asset: 'SILVER', up: 0.7, strength: 0.025 }] },
  { id: 'm-secheresse', category: 'eco', certainty: 'evidente',
    text: 'Sécheresse historique dans les grandes plaines céréalières.',
    targets: [{ asset: 'WHEAT', up: 0.9, strength: 0.06 }, { sector: 'conso', up: 0.35, strength: 0.008 }] },
  { id: 'm-cacao', category: 'eco', certainty: 'evidente',
    text: 'Récoltes de cacao catastrophiques en Côte d’Ivoire et au Ghana.',
    targets: [{ asset: 'COCOA', up: 0.9, strength: 0.08 }, { asset: 'NSTL', up: 0.3, strength: 0.012 }] },
  { id: 'm-cafe', category: 'eco', certainty: 'ambigue',
    text: 'Gel inattendu sur les plantations de café au Brésil.',
    targets: [{ asset: 'COFFEE', up: 0.8, strength: 0.06 }, { asset: 'SBUK', up: 0.35, strength: 0.015 }] },
  { id: 'm-cuivre', category: 'eco', certainty: 'ambigue', countries: ['cn', 'in', 'us'],
    text: '{L} lance des grands travaux : la demande de cuivre s’envole.',
    targets: [{ asset: 'COPPER', up: 0.8, strength: 0.04 }, { asset: 'CATR', up: 0.7, strength: 0.02 }] },
  { id: 'm-lithium', category: 'tech', certainty: 'ambigue',
    text: 'Découverte d’un gisement géant de lithium en Europe.',
    targets: [{ asset: 'LITH', up: 0.2, strength: 0.06 }, { asset: 'TSLO', up: 0.62, strength: 0.015 }] },
  { id: 'm-uranium', category: 'energie', certainty: 'evidente',
    text: 'Pénurie d’uranium : plusieurs réacteurs tournent au ralenti.',
    targets: [{ asset: 'URAN', up: 0.9, strength: 0.06 }] },
  { id: 'm-stocks-petrole', category: 'energie', certainty: 'ambigue',
    text: 'Les stocks américains de pétrole grimpent bien plus que prévu.',
    targets: [{ asset: 'BRENT', up: 0.25, strength: 0.03 }, { asset: 'XOMB', up: 0.35, strength: 0.012 }] },
  { id: 'm-argent-solaire', category: 'tech', certainty: 'ambigue',
    text: 'Les fabricants de panneaux solaires s’arrachent l’argent métal.',
    targets: [{ asset: 'SILVER', up: 0.75, strength: 0.04 }] },

  // Meme
  { id: 'me-baguette', category: 'rumeur', certainty: 'ambigue',
    text: 'Une boulangerie parisienne accepterait le Baguette Coin.',
    targets: [{ asset: 'BAGUET', up: 0.78, strength: 0.135 }] },
  { id: 'me-croissant', category: 'crypto', certainty: 'evidente',
    text: 'Les créateurs de Croissant Inu bloquent leurs jetons pendant un an.',
    targets: [{ asset: 'CROISS', up: 0.85, strength: 0.113 }] },
  { id: 'me-escargot', category: 'crypto', certainty: 'evidente',
    text: 'Escargot victime d’un piratage : la moitié des jetons dérobés.',
    targets: [{ asset: 'ESCARG', up: 0.1, strength: 0.158 }] },
  { id: 'me-frenly', category: 'rumeur', certainty: 'ambigue',
    text: 'FrenlyToken bientôt listé sur une grande plateforme ?',
    targets: [{ asset: 'FRENLY', up: 0.7, strength: 0.135 }] },
  { id: 'me-pastis', category: 'rumeur', certainty: 'pile',
    text: 'Pastis Token promet « une surprise pour l’apéro ».',
    targets: [{ asset: 'PASTIS', up: 0.5, strength: 0.158 }] },
  { id: 'me-moon', category: 'crypto', certainty: 'ambigue',
    text: 'MoonMoon : un portefeuille géant se réveille après deux ans.',
    targets: [{ asset: 'MOON', up: 0.35, strength: 0.18 }] },
  { id: 'me-bonk', category: 'crypto', certainty: 'ambigue',
    text: 'Bonk annonce un brûlage massif de jetons.',
    targets: [{ asset: 'BONK', up: 0.78, strength: 0.113 }] },
  { id: 'me-lenny', category: 'rumeur', certainty: 'pile',
    text: 'LennyCoin en tendance sur les réseaux, personne ne sait pourquoi.',
    targets: [{ asset: 'LENNY', up: 0.5, strength: 0.158 }] },
  { id: 'me-wif', category: 'rumeur', certainty: 'ambigue',
    text: 'Le chien au bonnet de dogwifhat fait la une d’un grand magazine.',
    targets: [{ asset: 'WIF', up: 0.72, strength: 0.099 }, { asset: 'FLOKI', up: 0.62, strength: 0.054 }] },
];

/* ------------------------------------------------------------------ */
/* Storylines                                                           */
/* ------------------------------------------------------------------ */

export const ARCS: Arc[] = [
  {
    id: 'guerre-commerciale',
    root: {
      category: 'geo', certainty: 'ambigue',
      text: 'Les États-Unis menacent l’Europe de droits de douane de 25 %.',
      targets: [{ sector: 'luxe', up: 0.3, strength: 0.02 }, { sector: 'auto', up: 0.3, strength: 0.02 }],
      next: [
        { weight: 0.5, node: {
          category: 'geo', certainty: 'evidente',
          text: 'Washington confirme : les nouvelles taxes entrent en vigueur lundi.',
          targets: [{ sector: 'luxe', up: 0.15, strength: 0.035 }, { sector: 'auto', up: 0.15, strength: 0.03 }],
          next: [
            { weight: 0.5, node: {
              category: 'eco', certainty: 'ambigue',
              text: 'Bruxelles riposte avec des taxes sur les géants américains du numérique.',
              targets: [{ market: 'frx', up: 0.4, strength: 0.015 }],
              next: [{ weight: 1, node: {
                category: 'geo', certainty: 'evidente',
                text: 'Accord trouvé in extremis entre Washington et Bruxelles.',
                targets: [{ market: 'frx', up: 0.9, strength: 0.025 }, { sector: 'luxe', up: 0.9, strength: 0.03 }],
              } }],
            } },
            { weight: 0.5, node: {
              category: 'eco', certainty: 'ambigue',
              text: 'Les exportateurs français chiffrent déjà leurs pertes.',
              targets: [{ sector: 'luxe', up: 0.25, strength: 0.02 }],
              next: [{ weight: 1, node: {
                category: 'geo', certainty: 'evidente',
                text: 'Washington accorde finalement une exemption au luxe européen.',
                targets: [{ sector: 'luxe', up: 0.9, strength: 0.04 }],
              } }],
            } },
          ],
        } },
        { weight: 0.5, node: {
          category: 'geo', certainty: 'ambigue',
          text: 'Des négociations s’ouvrent entre Washington et Bruxelles.',
          targets: [{ market: 'frx', up: 0.65, strength: 0.012 }],
          next: [
            { weight: 0.6, node: {
              category: 'geo', certainty: 'evidente',
              text: 'Accord signé : les droits de douane sont abandonnés.',
              targets: [{ market: 'frx', up: 0.88, strength: 0.02 }, { sector: 'luxe', up: 0.85, strength: 0.025 }],
            } },
            { weight: 0.4, node: {
              category: 'geo', certainty: 'evidente',
              text: 'Les négociations échouent, les taxes tombent dès demain.',
              targets: [{ sector: 'luxe', up: 0.12, strength: 0.035 }, { sector: 'auto', up: 0.15, strength: 0.03 }],
            } },
          ],
        } },
      ],
    },
  },
  {
    id: 'moyen-orient',
    root: {
      category: 'geo', certainty: 'ambigue',
      text: "Escalade militaire entre Israël et l'Iran.",
      targets: [{ sector: 'energie', up: 0.8, strength: 0.03 }, { sector: 'aero', up: 0.75, strength: 0.02 }],
      next: [
        { weight: 0.55, node: {
          category: 'geo', certainty: 'evidente',
          text: "L'Iran menace de fermer le détroit d'Ormuz.",
          targets: [{ sector: 'energie', up: 0.92, strength: 0.045 }, { sector: 'auto', up: 0.25, strength: 0.015 }],
          next: [
            { weight: 0.5, node: {
              category: 'geo', certainty: 'evidente',
              text: "La marine américaine sécurise le détroit d'Ormuz.",
              targets: [{ sector: 'energie', up: 0.12, strength: 0.04 }, { market: 'frx', up: 0.75, strength: 0.015 }],
            } },
            { weight: 0.5, node: {
              category: 'energie', certainty: 'evidente',
              text: 'Des pétroliers bloqués dans le Golfe : le baril s’envole.',
              targets: [{ sector: 'energie', up: 0.9, strength: 0.04 }, { sector: 'conso', up: 0.3, strength: 0.015 }],
            } },
          ],
        } },
        { weight: 0.45, node: {
          category: 'geo', certainty: 'ambigue',
          text: 'Médiation du Qatar : les deux camps acceptent de se parler.',
          targets: [{ sector: 'energie', up: 0.3, strength: 0.025 }],
          next: [{ weight: 1, node: {
            category: 'geo', certainty: 'evidente',
            text: "Cessez-le-feu signé sous l'égide de l'ONU.",
            targets: [{ sector: 'energie', up: 0.15, strength: 0.035 }, { market: 'frx', up: 0.85, strength: 0.02 }],
          } }],
        } },
      ],
    },
  },
  {
    id: 'loi-crypto',
    root: {
      category: 'crypto', certainty: 'ambigue',
      text: 'Le Congrès américain débat d’une grande loi sur les cryptomonnaies.',
      targets: [{ market: 'crypto', up: 0.6, strength: 0.03 }],
      next: [
        { weight: 0.5, node: {
          category: 'crypto', certainty: 'evidente',
          text: 'La loi crypto passe au Sénat avec un large soutien.',
          targets: [{ asset: 'BTC', up: 0.85, strength: 0.05 }, { market: 'crypto', up: 0.8, strength: 0.035 }],
          next: [
            { weight: 0.6, node: {
              category: 'crypto', certainty: 'evidente',
              text: 'Le président américain signe la loi : les cryptos entrent dans le cadre légal.',
              targets: [{ market: 'crypto', up: 0.9, strength: 0.06 }],
            } },
            { weight: 0.4, node: {
              category: 'crypto', certainty: 'evidente',
              text: 'Dernière minute : un amendement taxe les gains crypto à 30 %.',
              targets: [{ market: 'crypto', up: 0.15, strength: 0.06 }],
            } },
          ],
        } },
        { weight: 0.5, node: {
          category: 'crypto', certainty: 'evidente',
          text: 'La loi crypto est bloquée en commission.',
          targets: [{ market: 'crypto', up: 0.2, strength: 0.04 }],
          next: [
            { weight: 0.6, node: {
              category: 'crypto', certainty: 'evidente',
              text: 'Le régulateur américain poursuit plusieurs plateformes d’échange.',
              targets: [{ market: 'crypto', up: 0.15, strength: 0.05 }],
            } },
            { weight: 0.4, node: {
              category: 'crypto', certainty: 'ambigue',
              text: 'Les élus promettent un nouveau texte avant l’été.',
              targets: [{ market: 'crypto', up: 0.65, strength: 0.025 }],
            } },
          ],
        } },
      ],
    },
  },
  {
    id: 'scandale',
    root: {
      category: 'entreprise', certainty: 'ambigue',
      text: 'Un journal d’investigation enquête sur les comptes de {E}.',
      targets: [{ asset: '{E}', up: 0.3, strength: 0.04 }],
      next: [
        { weight: 0.5, node: {
          category: 'entreprise', certainty: 'evidente',
          text: 'Perquisition au siège de {E}.',
          targets: [{ asset: '{E}', up: 0.1, strength: 0.06 }],
          next: [
            { weight: 0.5, node: {
              category: 'entreprise', certainty: 'evidente',
              text: '{E} reconnaît des irrégularités comptables.',
              targets: [{ asset: '{E}', up: 0.08, strength: 0.09 }],
            } },
            { weight: 0.5, node: {
              category: 'entreprise', certainty: 'evidente',
              text: "L'enquête ne trouve rien : {E} est blanchie.",
              targets: [{ asset: '{E}', up: 0.9, strength: 0.06 }],
            } },
          ],
        } },
        { weight: 0.5, node: {
          category: 'entreprise', certainty: 'ambigue',
          text: '{E} dément fermement et porte plainte.',
          targets: [{ asset: '{E}', up: 0.6, strength: 0.03 }],
          next: [
            { weight: 0.5, node: {
              category: 'rumeur', certainty: 'evidente',
              text: 'Le journal publie de nouvelles preuves contre {E}.',
              targets: [{ asset: '{E}', up: 0.15, strength: 0.05 }],
            } },
            { weight: 0.5, node: {
              category: 'entreprise', certainty: 'evidente',
              text: 'Le journal retire son article et présente ses excuses à {E}.',
              targets: [{ asset: '{E}', up: 0.9, strength: 0.04 }],
            } },
          ],
        } },
      ],
    },
  },
  {
    id: 'crise-gaz',
    root: {
      category: 'energie', certainty: 'ambigue',
      text: 'La Russie réduit ses livraisons de gaz vers l’Europe.',
      targets: [{ sector: 'energie', up: 0.75, strength: 0.03 }, { sector: 'industrie', up: 0.3, strength: 0.02 }],
      next: [
        { weight: 0.5, node: {
          category: 'energie', certainty: 'evidente',
          text: 'Le prix du gaz triple en une semaine.',
          targets: [{ sector: 'energie', up: 0.88, strength: 0.04 }, { sector: 'industrie', up: 0.15, strength: 0.03 }],
          next: [{ weight: 1, node: {
            category: 'eco', certainty: 'evidente',
            text: "L'Union européenne plafonne les prix de l'énergie.",
            targets: [{ sector: 'energie', up: 0.15, strength: 0.04 }, { sector: 'industrie', up: 0.85, strength: 0.025 }],
          } }],
        } },
        { weight: 0.5, node: {
          category: 'energie', certainty: 'ambigue',
          text: 'La Norvège et le Qatar promettent d’augmenter leurs livraisons.',
          targets: [{ sector: 'energie', up: 0.25, strength: 0.025 }],
          next: [{ weight: 1, node: {
            category: 'energie', certainty: 'evidente',
            text: 'Hiver doux : les stocks de gaz européens restent pleins.',
            targets: [{ sector: 'energie', up: 0.15, strength: 0.03 }, { sector: 'industrie', up: 0.7, strength: 0.015 }],
          } }],
        } },
      ],
    },
  },
  {
    id: 'folie-meme',
    root: {
      category: 'crypto', certainty: 'pile',
      text: 'Un nouveau memecoin fait x50 en une nuit.',
      targets: [{ sector: 'crypto_meme', up: 0.5, strength: 0.072 }],
      next: [
        { weight: 0.55, node: {
          category: 'rumeur', certainty: 'evidente',
          text: 'Les influenceurs s’emparent de la folie des memecoins.',
          targets: [{ sector: 'crypto_meme', up: 0.85, strength: 0.084 }],
          next: [
            { weight: 0.5, node: {
              category: 'crypto', certainty: 'evidente',
              text: 'Arnaque : les créateurs du memecoin disparaissent avec la caisse.',
              targets: [{ sector: 'crypto_meme', up: 0.08, strength: 0.12 }],
            } },
            { weight: 0.5, node: {
              category: 'crypto', certainty: 'evidente',
              text: 'Une grande plateforme référence les memecoins les plus populaires.',
              targets: [{ sector: 'crypto_meme', up: 0.88, strength: 0.084 }],
            } },
          ],
        } },
        { weight: 0.45, node: {
          category: 'crypto', certainty: 'evidente',
          text: 'Les régulateurs mettent en garde contre les memecoins.',
          targets: [{ sector: 'crypto_meme', up: 0.18, strength: 0.06 }],
        } },
      ],
    },
  },
  {
    id: 'course-ia',
    companyFrom: ['tech'],
    root: {
      category: 'tech', certainty: 'ambigue',
      text: 'L’Europe préparerait un plan géant pour l’intelligence artificielle.',
      targets: [{ sector: 'tech', up: 0.65, strength: 0.025 }],
      next: [
        { weight: 0.55, node: {
          category: 'tech', certainty: 'evidente',
          text: "L'Union européenne annonce 200 milliards pour une IA souveraine.",
          targets: [{ sector: 'tech', up: 0.9, strength: 0.04 }, { sector: 'industrie', up: 0.7, strength: 0.015 }],
          next: [
            { weight: 0.5, node: {
              category: 'entreprise', certainty: 'evidente',
              text: '{E} décroche le premier contrat du plan européen pour l’IA.',
              targets: [{ asset: '{E}', up: 0.92, strength: 0.06 }],
            } },
            { weight: 0.5, node: {
              category: 'tech', certainty: 'evidente',
              text: 'Le plan IA européen est retardé par des désaccords entre États.',
              targets: [{ sector: 'tech', up: 0.2, strength: 0.03 }],
            } },
          ],
        } },
        { weight: 0.45, node: {
          category: 'rumeur', certainty: 'evidente',
          text: 'Bulle de l’IA : un investisseur célèbre vend toutes ses actions tech.',
          targets: [{ sector: 'tech', up: 0.15, strength: 0.03 }],
        } },
      ],
    },
  },
  {
    id: 'fed',
    root: {
      category: 'eco', certainty: 'ambigue',
      text: 'La Réserve fédérale américaine laisse entendre un virage.',
      targets: [{ market: 'crypto', up: 0.55, strength: 0.03 }, { sector: 'banque', up: 0.55, strength: 0.015 }],
      next: [
        { weight: 0.5, node: {
          category: 'eco', certainty: 'evidente',
          text: 'La Fed baisse ses taux d’un demi-point.',
          targets: [{ market: 'crypto', up: 0.88, strength: 0.05 }, { sector: 'immo', up: 0.85, strength: 0.025 }],
          next: [{ weight: 1, node: {
            category: 'eco', certainty: 'ambigue',
            text: 'L’inflation américaine repart à la hausse après la baisse des taux.',
            targets: [{ market: 'crypto', up: 0.3, strength: 0.035 }, { market: 'frx', up: 0.35, strength: 0.012 }],
          } }],
        } },
        { weight: 0.5, node: {
          category: 'eco', certainty: 'evidente',
          text: 'La Fed maintient ses taux et durcit le ton.',
          targets: [{ market: 'crypto', up: 0.12, strength: 0.05 }, { market: 'frx', up: 0.25, strength: 0.015 }],
        } },
      ],
    },
  },
  {
    id: 'guerre-ble',
    root: {
      category: 'geo', certainty: 'ambigue',
      text: 'La Russie menace de bloquer les exportations de blé en mer Noire.',
      targets: [{ asset: 'WHEAT', up: 0.8, strength: 0.04 }],
      next: [
        { weight: 0.5, node: {
          category: 'geo', certainty: 'evidente',
          text: 'Blocus confirmé : les cargos de blé restent à quai.',
          targets: [{ asset: 'WHEAT', up: 0.92, strength: 0.07 }, { sector: 'conso', up: 0.35, strength: 0.008 }],
          next: [{ weight: 1, node: {
            category: 'geo', certainty: 'evidente',
            text: 'Un couloir maritime pour le blé est négocié sous l’égide de la Turquie.',
            targets: [{ asset: 'WHEAT', up: 0.15, strength: 0.05 }],
          } }],
        } },
        { weight: 0.5, node: {
          category: 'eco', certainty: 'ambigue',
          text: 'L’Ukraine trouve des routes alternatives par le Danube.',
          targets: [{ asset: 'WHEAT', up: 0.3, strength: 0.03 }],
        } },
      ],
    },
  },
  {
    id: 'resultats-xvidia',
    root: {
      category: 'entreprise', certainty: 'pile',
      text: 'Xvidia publie ses résultats ce soir, les attentes sont folles.',
      targets: [{ asset: 'XVDA', up: 0.5, strength: 0.04 }],
      next: [
        { weight: 0.55, node: {
          category: 'entreprise', certainty: 'evidente',
          text: 'Xvidia pulvérise les attentes : chiffre d’affaires record.',
          targets: [{ asset: 'XVDA', up: 0.92, strength: 0.08 }, { sector: 'tech', up: 0.78, strength: 0.018 }],
          next: [
            { weight: 0.5, node: {
              category: 'entreprise', certainty: 'evidente',
              text: 'Macrosoft et Alphabeta commandent pour 50 milliards de puces à Xvidia.',
              targets: [{ asset: 'XVDA', up: 0.9, strength: 0.05 }, { asset: 'BRCM', up: 0.7, strength: 0.03 }],
            } },
            { weight: 0.5, node: {
              category: 'rumeur', certainty: 'ambigue',
              text: 'Des analystes jugent l’action Xvidia beaucoup trop chère.',
              targets: [{ asset: 'XVDA', up: 0.22, strength: 0.05 }],
            } },
          ],
        } },
        { weight: 0.45, node: {
          category: 'entreprise', certainty: 'evidente',
          text: 'Xvidia déçoit sur ses prévisions pour l’an prochain.',
          targets: [{ asset: 'XVDA', up: 0.1, strength: 0.09 }, { sector: 'tech', up: 0.25, strength: 0.02 }],
        } },
      ],
    },
  },
  {
    id: 'lennycoin',
    root: {
      category: 'rumeur', certainty: 'pile',
      text: 'Une célébrité publie « LENNY » sans aucune explication.',
      targets: [{ asset: 'LENNY', up: 0.5, strength: 0.135 }],
      next: [
        { weight: 0.5, node: {
          category: 'crypto', certainty: 'evidente',
          text: 'La célébrité confirme : elle a acheté des LennyCoins.',
          targets: [{ asset: 'LENNY', up: 0.92, strength: 0.18 }, { market: 'meme', up: 0.7, strength: 0.06 }],
          next: [
            { weight: 0.5, node: {
              category: 'rumeur', certainty: 'evidente',
              text: 'La célébrité revend tous ses LennyCoins au sommet.',
              targets: [{ asset: 'LENNY', up: 0.08, strength: 0.203 }],
            } },
            { weight: 0.5, node: {
              category: 'crypto', certainty: 'evidente',
              text: 'LennyCoin débarque sur une grande plateforme d’échange.',
              targets: [{ asset: 'LENNY', up: 0.9, strength: 0.158 }],
            } },
          ],
        } },
        { weight: 0.5, node: {
          category: 'rumeur', certainty: 'evidente',
          text: 'Fausse alerte : Lenny, c’était le nom de son chat.',
          targets: [{ asset: 'LENNY', up: 0.15, strength: 0.135 }],
        } },
      ],
    },
  },
];
