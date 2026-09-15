/**
 * The public description of each multiplayer game, for its page under
 * /jeux-multijoueur. Rules and settings follow the room's game catalog
 * (app/room/[code]/page.tsx): keep them in step when a game changes.
 */
export interface MultiplayerGameInfo {
  slug: string;
  name: string;
  /** What people type into a search engine, as a title. */
  headline: string;
  tagline: string;
  intro: string;
  steps: string[];
  settings: string[];
  genre: string;
  faq: { q: string; a: string }[];
}

const COMMON_FAQ = [
  { q: 'Faut-il télécharger quelque chose ?', a: 'Non. Le jeu se lance directement dans le navigateur, sur ordinateur, tablette ou téléphone.' },
  { q: 'Est-ce gratuit ?', a: 'Oui, entièrement. Il suffit de créer une salle, de choisir un pseudo et d’envoyer le code aux autres joueurs.' },
  { q: 'Faut-il un compte ?', a: 'Non : un pseudo suffit pour créer ou rejoindre une salle. Un compte gratuit sert à garder ton pseudo et tes badges.' },
];

export const MULTIPLAYER_GAMES: MultiplayerGameInfo[] = [
  {
    slug: 'undercover',
    name: 'Undercover',
    headline: 'Undercover en ligne entre amis',
    tagline: 'Bluffez pour survivre.',
    intro: 'Chaque joueur reçoit un mot secret. Les imposteurs en ont un très proche, et Mr. White n’en a aucun. À tour de rôle, chacun donne un indice sans trop en dire, puis tout le monde vote pour éliminer celui qu’il soupçonne.',
    steps: ['Découvre ton mot en secret.', 'Donne un indice à chaque tour de table, sans te trahir.', 'Votez pour démasquer les imposteurs avant qu’il ne soit trop tard.'],
    settings: ['Nombre de manches', 'Nombre d’imposteurs', 'Mr. White activé ou non', 'Rôles affichés ou secrets', 'Nombre de tours de table'],
    genre: 'Jeu d’ambiance et de déduction',
    faq: [{ q: 'Qui est Mr. White ?', a: 'Un joueur qui ne reçoit aucun mot : il doit bluffer à partir des indices des autres. On peut l’activer ou le désactiver dans les réglages de la salle.' }, ...COMMON_FAQ],
  },
  {
    slug: 'infiltre',
    name: 'L’Infiltré',
    headline: 'L’Infiltré : jeu de l’intrus en ligne',
    tagline: 'Démasquez l’intrus parmi vous.',
    intro: 'Un intrus s’est glissé dans le groupe. Les joueurs s’interrogent et débattent autour d’un thème, puis votent pour désigner celui qui cache son jeu. Lieux, objets, animaux, métiers ou notions abstraites : l’univers se choisit dans la salle.',
    steps: ['Découvre ton rôle.', 'Pose des questions et débats pendant le temps imparti.', 'Votez pour démasquer l’infiltré.'],
    settings: ['Nombre de manches', 'Durée du débat (minutes)', 'Durée du vote (secondes)', 'Univers : tout mélangé, lieux, objets, animaux, métiers, abstrait'],
    genre: 'Jeu d’ambiance et de déduction',
    faq: COMMON_FAQ,
  },
  {
    slug: 'drawguessr',
    name: 'DrawGuessr',
    headline: 'Jeu de dessin en ligne : dessine et fais deviner',
    tagline: 'Dessinez, c’est gagné !',
    intro: 'Un joueur dessine un mot pendant que les autres essaient de le deviner le plus vite possible. Chacun passe au dessin à son tour. Le niveau des mots s’adapte : débutant, intermédiaire, expert ou équilibré.',
    steps: ['Reçois un mot à dessiner, ou devine celui des autres.', 'Dessine avant la fin du chrono.', 'Marque des points en devinant vite et en faisant deviner.'],
    settings: ['Nombre de manches', 'Temps par manche (90 s par défaut)', 'Niveau des mots : équilibré, débutant, intermédiaire, expert'],
    genre: 'Jeu de dessin',
    faq: COMMON_FAQ,
  },
  {
    slug: 'budgetguessr',
    name: 'BudgetGuessr',
    headline: 'Devine le budget des films : le juste prix du cinéma',
    tagline: 'Estimez le juste prix.',
    intro: 'Une affiche de film s’affiche : à toi d’estimer son budget. Plus ton estimation est proche, plus tu marques de points. Idéal pour les fans de cinéma qui aiment les quiz entre amis.',
    steps: ['Regarde l’affiche du film.', 'Estime son budget avant la fin du temps.', 'Le plus proche du vrai chiffre gagne le plus de points.'],
    settings: ['Nombre de manches', 'Temps par manche (30 s par défaut)', 'Catégorie : films'],
    genre: 'Quiz d’estimation',
    faq: COMMON_FAQ,
  },
  {
    slug: 'rentguessr',
    name: 'RentGuessr',
    headline: 'Devine le loyer : quiz immobilier en ligne',
    tagline: 'Devinez le loyer mensuel.',
    intro: 'Des photos d’un logement défilent : estime son loyer mensuel. Qui a le meilleur flair pour l’immobilier ? Plus tu es proche du vrai loyer, plus tu marques.',
    steps: ['Parcours les photos du logement.', 'Donne ton estimation du loyer.', 'Compare-toi aux autres à chaque manche.'],
    settings: ['Nombre de manches', 'Temps par manche (30 s par défaut)'],
    genre: 'Quiz d’estimation',
    faq: COMMON_FAQ,
  },
  {
    slug: 'logoguessr',
    name: 'LogoGuessr',
    headline: 'Quiz logos : reconnais la marque',
    tagline: 'Reconnaissez la marque.',
    intro: 'Un logo apparaît, parfois bien caché : trouve la marque avant les autres. Trois niveaux de difficulté pour les débutants comme pour les experts des marques.',
    steps: ['Observe le logo.', 'Écris le nom de la marque le plus vite possible.', 'Enchaîne les manches et grimpe au classement de la partie.'],
    settings: ['Nombre de manches', 'Temps par manche (15 s par défaut)', 'Difficulté : facile, moyen, difficile'],
    genre: 'Quiz',
    faq: COMMON_FAQ,
  },
  {
    slug: 'jaugeguessr',
    name: 'JaugeGuessr',
    headline: 'JaugeGuessr : place la jauge entre deux extrêmes',
    tagline: 'Ciblez la bonne intensité.',
    intro: 'Deux extrêmes s’affichent, du « pire » au « meilleur ». Il faut placer le curseur au bon endroit sur la jauge. Un jeu d’ambiance qui fait débattre tout le groupe.',
    steps: ['Découvre les deux extrêmes de la jauge.', 'Place le curseur là où tu penses que se trouve la cible.', 'Plus tu es proche, plus tu marques.'],
    settings: ['Nombre de manches', 'Temps par manche (45 s par défaut)', 'Difficulté : zones larges, normal, zones fines'],
    genre: 'Jeu d’ambiance',
    faq: COMMON_FAQ,
  },
  {
    slug: 'wikiracing',
    name: 'WikiRacing',
    headline: 'WikiRacing : la course Wikipédia multijoueur',
    tagline: 'Reliez deux pages Wikipédia le plus vite possible.',
    intro: 'Pars d’une page Wikipédia et rejoins la page d’arrivée uniquement en cliquant sur les liens. Gagne en étant le plus rapide, ou en utilisant le moins de clics selon le mode choisi.',
    steps: ['Découvre la page de départ et la page d’arrivée.', 'Clique de lien en lien pour rejoindre l’arrivée.', 'Le plus rapide, ou le plus économe en clics, l’emporte.'],
    settings: ['Nombre de manches', 'Difficulté du trajet : concepts liés ou éloignés', 'Victoire : vitesse ou moins de clics'],
    genre: 'Jeu de culture générale',
    faq: COMMON_FAQ,
  },
  {
    slug: 'flagguessr',
    name: 'FlagGuessr',
    headline: 'Quiz drapeaux du monde en ligne',
    tagline: 'Voyagez à travers les drapeaux.',
    intro: 'Un drapeau s’affiche : trouve le pays. Joue sur le monde entier ou sur un seul continent, de l’Europe à l’Océanie, et deviens le champion de géographie du groupe.',
    steps: ['Regarde le drapeau.', 'Trouve le pays avant la fin du temps.', 'Marque des points à chaque bonne réponse.'],
    settings: ['Nombre de manches (10 par défaut)', 'Temps par manche (15 s par défaut)', 'Continent : monde entier, Europe, Amériques, Afrique, Asie, Océanie'],
    genre: 'Quiz de géographie',
    faq: COMMON_FAQ,
  },
  {
    slug: 'pokeguessr',
    name: 'PokeGuessr',
    headline: 'Quiz Pokémon : quel est ce Pokémon ?',
    tagline: 'Quel est ce Pokémon ?',
    intro: 'Retrouve le Pokémon caché derrière une image floue, une ombre ou des couleurs inversées. Choisis les générations, de Kanto à Paldea, et affronte tes amis.',
    steps: ['Observe l’image du Pokémon.', 'Écris son nom le plus vite possible.', 'Enchaîne les manches et marque des points.'],
    settings: ['Nombre de manches', 'Temps par manche (30 s par défaut)', 'Mode : image floue, ombre ou inversé', 'Générations 1 à 9'],
    genre: 'Quiz',
    faq: COMMON_FAQ,
  },
];

export const multiplayerGame = (slug: string) => MULTIPLAYER_GAMES.find((g) => g.slug === slug);
