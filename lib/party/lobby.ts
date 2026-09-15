/**
 * How each multiplayer game shows up in the room: a short line that always fits
 * on its card, a family to filter by, and the minimum number of players.
 */

export type GameFamily = 'ambiance' | 'quiz' | 'dessin' | 'estimation';

export const GAME_FAMILIES: { id: 'all' | GameFamily; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'ambiance', label: 'Ambiance' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'dessin', label: 'Dessin' },
  { id: 'estimation', label: 'Estimation' },
];

export const GAME_META: Record<string, { short: string; family: GameFamily; minPlayers: number }> = {
  pokeguessr: { short: 'Retrouve le Pokémon caché.', family: 'quiz', minPlayers: 1 },
  flagguessr: { short: 'Trouve le pays du drapeau.', family: 'quiz', minPlayers: 1 },
  logoguessr: { short: 'Reconnais la marque.', family: 'quiz', minPlayers: 1 },
  blindtest: { short: 'Trouve le titre et l’artiste.', family: 'quiz', minPlayers: 1 },
  petitbac: { short: 'Une lettre, des catégories.', family: 'quiz', minPlayers: 2 },
  wikiracing: { short: 'Relie deux pages Wikipédia.', family: 'quiz', minPlayers: 1 },
  undercover: { short: 'Un mot proche, des imposteurs.', family: 'ambiance', minPlayers: 3 },
  infiltre: { short: 'Démasquez l’intrus parmi vous.', family: 'ambiance', minPlayers: 4 },
  horssujet: { short: 'Qui a eu l’autre question ?', family: 'ambiance', minPlayers: 3 },
  punchline: { short: 'La réponse la plus drôle gagne.', family: 'ambiance', minPlayers: 3 },
  quiaditca: { short: 'Devine qui a écrit quoi.', family: 'ambiance', minPlayers: 3 },
  surenchere: { short: 'Annonce, puis prouve-le.', family: 'ambiance', minPlayers: 2 },
  ledico: { short: 'Trouve la vraie définition.', family: 'ambiance', minPlayers: 3 },
  drawguessr: { short: 'Dessine, les autres devinent.', family: 'dessin', minPlayers: 2 },
  untraitdetrop: { short: 'Un trait chacun, un imposteur.', family: 'dessin', minPlayers: 3 },
  budgetguessr: { short: 'Devine le budget du film.', family: 'estimation', minPlayers: 1 },
  rentguessr: { short: 'Devine le loyer du logement.', family: 'estimation', minPlayers: 1 },
  jaugeguessr: { short: 'Place l’aiguille au bon endroit.', family: 'estimation', minPlayers: 2 },
};
