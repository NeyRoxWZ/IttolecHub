export * from './core';
import { secureRandomInt } from './core';

export const PRESTIGE_THRESHOLD = 1_000_000;
export const JACKPOT_CONTRIBUTION_RATE = 0.01; // 1% of every net loss feeds the shared pot
export const JACKPOT_HIT_CHANCE = 1 / 3000; // independent roll on every settled bet
export const JACKPOT_SEED = 5000;

export interface WalletStats {
  balance: number;
  totalWagered: number;
  totalWon: number;
  currentStreak: number;
  bestStreak: number;
  prestigeCount: number;
  biggestMultiplier: number;
  /** Everything below feeds the achievement list. */
  level: number;
  dailyStreak: number;
  allTimeBestBalance: number;
  betsPlaced: number;
  winsCount: number;
  /** Bitmask of games played at least once. */
  gamesMask: number;
  distinctGames: number;
  cratesOpened: number;
  missionsDone: number;
  jackpotsWon: number;
  passTiersTotal: number;
  biggestWin: number;
  worstStreak: number;
  cosmeticsOwned: number;
  legendaryOwned: number;
}

export type AchievementCategory =
  'decouverte' | 'mises' | 'parties' | 'victoires' | 'series' | 'multiplicateurs' | 'gains' | 'fortune' | 'niveaux' | 'assiduite' | 'missions' | 'passe' | 'collection' | 'jeux' | 'prestige' | 'extremes';

export const ACHIEVEMENT_CATEGORIES: { id: AchievementCategory; label: string }[] = [
  { id: 'decouverte', label: 'Découverte' },
  { id: 'mises', label: 'Mises' },
  { id: 'parties', label: 'Parties' },
  { id: 'victoires', label: 'Victoires' },
  { id: 'series', label: 'Séries' },
  { id: 'multiplicateurs', label: 'Multiplicateurs' },
  { id: 'gains', label: 'Gains uniques' },
  { id: 'fortune', label: 'Fortune' },
  { id: 'niveaux', label: 'Niveaux' },
  { id: 'assiduite', label: 'Assiduité' },
  { id: 'missions', label: 'Missions' },
  { id: 'passe', label: 'Frenly Pass' },
  { id: 'collection', label: 'Caisses & collection' },
  { id: 'jeux', label: 'Jeux' },
  { id: 'prestige', label: 'Prestige' },
  { id: 'extremes', label: 'Défis extrêmes' },
];

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  /** Difficulty weight; also drives the coin reward. */
  points: number;
  check: (s: WalletStats) => boolean;
}

/** Coins handed out when an achievement unlocks. */
export function achievementReward(points: number): number {
  return points * 20;
}

/**
 * Ordered by category, and inside a category from the first thing a player
 * does to the thing almost nobody will ever do, so the list reads top to
 * bottom as a difficulty ramp.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_bet', name: 'Premier pas', description: 'Place ta première mise.', category: 'decouverte', points: 10, check: (s) => s.betsPlaced >= 1 },
  { id: 'first_win', name: 'Premier sang', description: 'Remporte ton premier gain.', category: 'decouverte', points: 10, check: (s) => s.winsCount >= 1 },
  { id: 'first_crate', name: 'Curieux', description: 'Ouvre ta première caisse.', category: 'decouverte', points: 10, check: (s) => s.cratesOpened >= 1 },
  { id: 'first_mission', name: 'Consciencieux', description: 'Termine ta première mission du jour.', category: 'decouverte', points: 10, check: (s) => s.missionsDone >= 1 },
  { id: 'first_level', name: 'Ça monte', description: 'Atteins le niveau 2.', category: 'decouverte', points: 10, check: (s) => s.level >= 2 },
  { id: 'first_cosmetic', name: 'Coquet', description: 'Possède ton premier cosmétique.', category: 'decouverte', points: 10, check: (s) => s.cosmeticsOwned >= 1 },
  { id: 'wagered_1000', name: 'Petit joueur', description: '1 000 ₶ misés au total.', category: 'mises', points: 10, check: (s) => s.totalWagered >= 1000 },
  { id: 'wagered_10000', name: 'Régulier', description: '10 000 ₶ misés au total.', category: 'mises', points: 10, check: (s) => s.totalWagered >= 10000 },
  { id: 'wagered_50000', name: 'Assidu', description: '50 000 ₶ misés au total.', category: 'mises', points: 25, check: (s) => s.totalWagered >= 50000 },
  { id: 'wagered_100000', name: 'Habitué', description: '100 000 ₶ misés au total.', category: 'mises', points: 25, check: (s) => s.totalWagered >= 100000 },
  { id: 'wagered_500000', name: 'Gros bras', description: '500 000 ₶ misés au total.', category: 'mises', points: 50, check: (s) => s.totalWagered >= 500000 },
  { id: 'wagered_1000000', name: 'Pilier du casino', description: '1 000 000 ₶ misés au total.', category: 'mises', points: 50, check: (s) => s.totalWagered >= 1000000 },
  { id: 'wagered_10000000', name: 'Baleine', description: '10 000 000 ₶ misés au total.', category: 'mises', points: 100, check: (s) => s.totalWagered >= 10000000 },
  { id: 'wagered_100000000', name: 'Institution', description: '100 000 000 ₶ misés au total.', category: 'mises', points: 250, check: (s) => s.totalWagered >= 100000000 },
  { id: 'plays_10', name: 'Échauffement', description: 'Joue 10 parties.', category: 'parties', points: 10, check: (s) => s.betsPlaced >= 10 },
  { id: 'plays_50', name: 'Dans le bain', description: 'Joue 50 parties.', category: 'parties', points: 10, check: (s) => s.betsPlaced >= 50 },
  { id: 'plays_100', name: 'Centenaire', description: 'Joue 100 parties.', category: 'parties', points: 25, check: (s) => s.betsPlaced >= 100 },
  { id: 'plays_500', name: 'Marathonien', description: 'Joue 500 parties.', category: 'parties', points: 25, check: (s) => s.betsPlaced >= 500 },
  { id: 'plays_1000', name: 'Le millier', description: 'Joue 1 000 parties.', category: 'parties', points: 50, check: (s) => s.betsPlaced >= 1000 },
  { id: 'plays_5000', name: 'Increvable', description: 'Joue 5 000 parties.', category: 'parties', points: 100, check: (s) => s.betsPlaced >= 5000 },
  { id: 'plays_25000', name: 'Machine à sous humaine', description: 'Joue 25 000 parties.', category: 'parties', points: 250, check: (s) => s.betsPlaced >= 25000 },
  { id: 'wins_5', name: 'Ça paie', description: 'Remporte 5 parties.', category: 'victoires', points: 10, check: (s) => s.winsCount >= 5 },
  { id: 'wins_25', name: 'Gagnant régulier', description: 'Remporte 25 parties.', category: 'victoires', points: 10, check: (s) => s.winsCount >= 25 },
  { id: 'wins_100', name: 'Centurion', description: 'Remporte 100 parties.', category: 'victoires', points: 25, check: (s) => s.winsCount >= 100 },
  { id: 'wins_500', name: 'Vainqueur né', description: 'Remporte 500 parties.', category: 'victoires', points: 50, check: (s) => s.winsCount >= 500 },
  { id: 'wins_2000', name: 'Collectionneur de gains', description: 'Remporte 2 000 parties.', category: 'victoires', points: 100, check: (s) => s.winsCount >= 2000 },
  { id: 'wins_10000', name: 'Statistique vivante', description: 'Remporte 10 000 parties.', category: 'victoires', points: 250, check: (s) => s.winsCount >= 10000 },
  { id: 'streak_3', name: 'Sur une lancée', description: 'Enchaîne 3 victoires d’affilée.', category: 'series', points: 10, check: (s) => s.bestStreak >= 3 },
  { id: 'streak_5', name: 'Chaud bouillant', description: 'Enchaîne 5 victoires d’affilée.', category: 'series', points: 10, check: (s) => s.bestStreak >= 5 },
  { id: 'streak_7', name: 'En feu', description: 'Enchaîne 7 victoires d’affilée.', category: 'series', points: 25, check: (s) => s.bestStreak >= 7 },
  { id: 'streak_10', name: 'Intouchable', description: 'Enchaîne 10 victoires d’affilée.', category: 'series', points: 25, check: (s) => s.bestStreak >= 10 },
  { id: 'streak_15', name: 'Surnaturel', description: 'Enchaîne 15 victoires d’affilée.', category: 'series', points: 50, check: (s) => s.bestStreak >= 15 },
  { id: 'streak_20', name: 'Le casino transpire', description: 'Enchaîne 20 victoires d’affilée.', category: 'series', points: 100, check: (s) => s.bestStreak >= 20 },
  { id: 'streak_25', name: 'Bug dans la matrice', description: 'Enchaîne 25 victoires d’affilée.', category: 'series', points: 250, check: (s) => s.bestStreak >= 25 },
  { id: 'streak_30', name: 'Interdit de séjour', description: 'Enchaîne 30 victoires d’affilée.', category: 'series', points: 250, check: (s) => s.bestStreak >= 30 },
  { id: 'mult_5', name: 'Joli coup', description: 'Décroche un gain à ×5 ou plus en une mise.', category: 'multiplicateurs', points: 10, check: (s) => s.biggestMultiplier >= 5 },
  { id: 'mult_10', name: 'Belle prise', description: 'Décroche un gain à ×10 ou plus en une mise.', category: 'multiplicateurs', points: 10, check: (s) => s.biggestMultiplier >= 10 },
  { id: 'mult_25', name: 'Coup d’éclat', description: 'Décroche un gain à ×25 ou plus en une mise.', category: 'multiplicateurs', points: 25, check: (s) => s.biggestMultiplier >= 25 },
  { id: 'mult_50', name: 'Jackpot personnel', description: 'Décroche un gain à ×50 ou plus en une mise.', category: 'multiplicateurs', points: 25, check: (s) => s.biggestMultiplier >= 50 },
  { id: 'mult_100', name: 'Centuple', description: 'Décroche un gain à ×100 ou plus en une mise.', category: 'multiplicateurs', points: 50, check: (s) => s.biggestMultiplier >= 100 },
  { id: 'mult_250', name: 'Démesure', description: 'Décroche un gain à ×250 ou plus en une mise.', category: 'multiplicateurs', points: 100, check: (s) => s.biggestMultiplier >= 250 },
  { id: 'mult_500', name: 'Coup de folie', description: 'Décroche un gain à ×500 ou plus en une mise.', category: 'multiplicateurs', points: 100, check: (s) => s.biggestMultiplier >= 500 },
  { id: 'mult_1000', name: 'Une fois dans une vie', description: 'Décroche un gain à ×1 000 ou plus en une mise.', category: 'multiplicateurs', points: 250, check: (s) => s.biggestMultiplier >= 1000 },
  { id: 'win_1000', name: 'Première liasse', description: 'Encaisse 1 000 ₶ sur une seule partie.', category: 'gains', points: 10, check: (s) => s.biggestWin >= 1000 },
  { id: 'win_10000', name: 'Belle soirée', description: 'Encaisse 10 000 ₶ sur une seule partie.', category: 'gains', points: 25, check: (s) => s.biggestWin >= 10000 },
  { id: 'win_50000', name: 'Le coup du siècle', description: 'Encaisse 50 000 ₶ sur une seule partie.', category: 'gains', points: 25, check: (s) => s.biggestWin >= 50000 },
  { id: 'win_250000', name: 'Braquage', description: 'Encaisse 250 000 ₶ sur une seule partie.', category: 'gains', points: 50, check: (s) => s.biggestWin >= 250000 },
  { id: 'win_1000000', name: 'Le casse', description: 'Encaisse 1 000 000 ₶ sur une seule partie.', category: 'gains', points: 100, check: (s) => s.biggestWin >= 1000000 },
  { id: 'win_5000000', name: 'On ferme la caisse', description: 'Encaisse 5 000 000 ₶ sur une seule partie.', category: 'gains', points: 250, check: (s) => s.biggestWin >= 5000000 },
  { id: 'balance_5000', name: 'En route', description: 'Atteins 5 000 ₶ de solde.', category: 'fortune', points: 10, check: (s) => s.balance >= 5000 },
  { id: 'balance_25000', name: 'À l’aise', description: 'Atteins 25 000 ₶ de solde.', category: 'fortune', points: 10, check: (s) => s.balance >= 25000 },
  { id: 'balance_100000', name: 'Riche', description: 'Atteins 100 000 ₶ de solde.', category: 'fortune', points: 25, check: (s) => s.balance >= 100000 },
  { id: 'balance_500000', name: 'Très riche', description: 'Atteins 500 000 ₶ de solde.', category: 'fortune', points: 50, check: (s) => s.balance >= 500000 },
  { id: 'balance_1000000', name: 'Millionnaire', description: 'Atteins 1 000 000 ₶ de solde.', category: 'fortune', points: 50, check: (s) => s.balance >= 1000000 },
  { id: 'balance_5000000', name: 'Indécent', description: 'Atteins 5 000 000 ₶ de solde.', category: 'fortune', points: 100, check: (s) => s.balance >= 5000000 },
  { id: 'balance_25000000', name: 'Hors catégorie', description: 'Atteins 25 000 000 ₶ de solde.', category: 'fortune', points: 250, check: (s) => s.balance >= 25000000 },
  { id: 'best_balance_10m', name: 'Sommet historique', description: 'Aie détenu 10 000 000 ₶ au moins une fois.', category: 'fortune', points: 100, check: (s) => s.allTimeBestBalance >= 10000000 },
  { id: 'level_5', name: 'Apprenti', description: 'Atteins le niveau 5.', category: 'niveaux', points: 10, check: (s) => s.level >= 5 },
  { id: 'level_10', name: 'Confirmé', description: 'Atteins le niveau 10.', category: 'niveaux', points: 10, check: (s) => s.level >= 10 },
  { id: 'level_20', name: 'Vétéran', description: 'Atteins le niveau 20.', category: 'niveaux', points: 25, check: (s) => s.level >= 20 },
  { id: 'level_30', name: 'Expert', description: 'Atteins le niveau 30.', category: 'niveaux', points: 25, check: (s) => s.level >= 30 },
  { id: 'level_50', name: 'Maître', description: 'Atteins le niveau 50.', category: 'niveaux', points: 50, check: (s) => s.level >= 50 },
  { id: 'level_75', name: 'Grand maître', description: 'Atteins le niveau 75.', category: 'niveaux', points: 100, check: (s) => s.level >= 75 },
  { id: 'level_100', name: 'Centurion du casino', description: 'Atteins le niveau 100.', category: 'niveaux', points: 250, check: (s) => s.level >= 100 },
  { id: 'level_150', name: 'Au-delà du raisonnable', description: 'Atteins le niveau 150.', category: 'niveaux', points: 250, check: (s) => s.level >= 150 },
  { id: 'daily_3', name: 'Habitude', description: 'Réclame le bonus quotidien 3 jours de suite.', category: 'assiduite', points: 10, check: (s) => s.dailyStreak >= 3 },
  { id: 'daily_7', name: 'Une semaine pile', description: 'Réclame le bonus quotidien 7 jours de suite.', category: 'assiduite', points: 25, check: (s) => s.dailyStreak >= 7 },
  { id: 'daily_14', name: 'Deux semaines', description: 'Réclame le bonus quotidien 14 jours de suite.', category: 'assiduite', points: 25, check: (s) => s.dailyStreak >= 14 },
  { id: 'daily_30', name: 'Un mois sans faute', description: 'Réclame le bonus quotidien 30 jours de suite.', category: 'assiduite', points: 50, check: (s) => s.dailyStreak >= 30 },
  { id: 'daily_60', name: 'Deux mois sans faute', description: 'Réclame le bonus quotidien 60 jours de suite.', category: 'assiduite', points: 100, check: (s) => s.dailyStreak >= 60 },
  { id: 'daily_100', name: 'Cent jours', description: 'Réclame le bonus quotidien 100 jours de suite.', category: 'assiduite', points: 250, check: (s) => s.dailyStreak >= 100 },
  { id: 'missions_5', name: 'Bon élève', description: 'Termine 5 missions quotidiennes.', category: 'missions', points: 10, check: (s) => s.missionsDone >= 5 },
  { id: 'missions_25', name: 'Appliqué', description: 'Termine 25 missions quotidiennes.', category: 'missions', points: 10, check: (s) => s.missionsDone >= 25 },
  { id: 'missions_100', name: 'Méthodique', description: 'Termine 100 missions quotidiennes.', category: 'missions', points: 25, check: (s) => s.missionsDone >= 100 },
  { id: 'missions_300', name: 'Infatigable', description: 'Termine 300 missions quotidiennes.', category: 'missions', points: 50, check: (s) => s.missionsDone >= 300 },
  { id: 'missions_750', name: 'Obsessionnel', description: 'Termine 750 missions quotidiennes.', category: 'missions', points: 100, check: (s) => s.missionsDone >= 750 },
  { id: 'missions_1500', name: 'Mission accomplie', description: 'Termine 1 500 missions quotidiennes.', category: 'missions', points: 250, check: (s) => s.missionsDone >= 1500 },
  { id: 'pass_25', name: 'Premier quart', description: 'Franchis 25 paliers de Frenly Pass au total.', category: 'passe', points: 10, check: (s) => s.passTiersTotal >= 25 },
  { id: 'pass_100', name: 'Passe bouclé', description: 'Franchis 100 paliers de Frenly Pass au total.', category: 'passe', points: 25, check: (s) => s.passTiersTotal >= 100 },
  { id: 'pass_300', name: 'Trois passes', description: 'Franchis 300 paliers de Frenly Pass au total.', category: 'passe', points: 25, check: (s) => s.passTiersTotal >= 300 },
  { id: 'pass_600', name: 'Six passes', description: 'Franchis 600 paliers de Frenly Pass au total.', category: 'passe', points: 50, check: (s) => s.passTiersTotal >= 600 },
  { id: 'pass_1000', name: 'Dix passes', description: 'Franchis 1 000 paliers de Frenly Pass au total.', category: 'passe', points: 100, check: (s) => s.passTiersTotal >= 1000 },
  { id: 'pass_2000', name: 'Vingt passes', description: 'Franchis 2 000 paliers de Frenly Pass au total.', category: 'passe', points: 250, check: (s) => s.passTiersTotal >= 2000 },
  { id: 'crates_10', name: 'Ouvreur', description: 'Ouvre 10 caisses.', category: 'collection', points: 10, check: (s) => s.cratesOpened >= 10 },
  { id: 'crates_50', name: 'Amateur de caisses', description: 'Ouvre 50 caisses.', category: 'collection', points: 25, check: (s) => s.cratesOpened >= 50 },
  { id: 'crates_200', name: 'Déballeur compulsif', description: 'Ouvre 200 caisses.', category: 'collection', points: 50, check: (s) => s.cratesOpened >= 200 },
  { id: 'crates_1000', name: 'Usine à caisses', description: 'Ouvre 1 000 caisses.', category: 'collection', points: 250, check: (s) => s.cratesOpened >= 1000 },
  { id: 'cosmetics_10', name: 'Garde-robe', description: 'Possède 10 cosmétiques.', category: 'collection', points: 10, check: (s) => s.cosmeticsOwned >= 10 },
  { id: 'cosmetics_40', name: 'Vestiaire fourni', description: 'Possède 40 cosmétiques.', category: 'collection', points: 25, check: (s) => s.cosmeticsOwned >= 40 },
  { id: 'cosmetics_100', name: 'Collectionneur', description: 'Possède 100 cosmétiques.', category: 'collection', points: 100, check: (s) => s.cosmeticsOwned >= 100 },
  { id: 'legendary_1', name: 'Première légende', description: 'Possède un cosmétique légendaire.', category: 'collection', points: 25, check: (s) => s.legendaryOwned >= 1 },
  { id: 'legendary_20', name: 'Panthéon', description: 'Possède 20 cosmétiques légendaires.', category: 'collection', points: 100, check: (s) => s.legendaryOwned >= 20 },
  { id: 'cosmetics_all', name: 'Rien ne manque', description: 'Possède la totalité des cosmétiques du casino.', category: 'collection', points: 250, check: (s) => s.cosmeticsOwned >= 192 },
  { id: 'games_3', name: 'Touche-à-tout', description: 'Joue à 3 jeux différents.', category: 'jeux', points: 10, check: (s) => s.distinctGames >= 3 },
  { id: 'games_5', name: 'Explorateur', description: 'Joue à 5 jeux différents.', category: 'jeux', points: 10, check: (s) => s.distinctGames >= 5 },
  { id: 'games_10', name: 'La moitié du casino', description: 'Joue à 10 jeux différents.', category: 'jeux', points: 25, check: (s) => s.distinctGames >= 10 },
  { id: 'games_15', name: 'Presque partout', description: 'Joue à 15 jeux différents.', category: 'jeux', points: 50, check: (s) => s.distinctGames >= 15 },
  { id: 'games_20', name: 'Tour complet', description: 'Joue à 20 jeux différents.', category: 'jeux', points: 100, check: (s) => s.distinctGames >= 20 },
  { id: 'prestige_1', name: 'Renaissance', description: 'Prestige 1 fois.', category: 'prestige', points: 25, check: (s) => s.prestigeCount >= 1 },
  { id: 'prestige_2', name: 'On remet ça', description: 'Prestige 2 fois.', category: 'prestige', points: 25, check: (s) => s.prestigeCount >= 2 },
  { id: 'prestige_5', name: 'Légende du casino', description: 'Prestige 5 fois.', category: 'prestige', points: 50, check: (s) => s.prestigeCount >= 5 },
  { id: 'prestige_10', name: 'Éternel recommencement', description: 'Prestige 10 fois.', category: 'prestige', points: 100, check: (s) => s.prestigeCount >= 10 },
  { id: 'prestige_25', name: 'Cycle sans fin', description: 'Prestige 25 fois.', category: 'prestige', points: 250, check: (s) => s.prestigeCount >= 25 },
  { id: 'prestige_50', name: 'Le mythe', description: 'Prestige 50 fois.', category: 'prestige', points: 250, check: (s) => s.prestigeCount >= 50 },
  { id: 'worst_10', name: 'Guigne', description: 'Encaisse 10 défaites d’affilée.', category: 'extremes', points: 25, check: (s) => s.worstStreak >= 10 },
  { id: 'worst_20', name: 'Malédiction', description: 'Encaisse 20 défaites d’affilée.', category: 'extremes', points: 100, check: (s) => s.worstStreak >= 20 },
  { id: 'jackpot_1', name: 'L’élu', description: 'Rafle le jackpot commun.', category: 'extremes', points: 100, check: (s) => s.jackpotsWon >= 1 },
  { id: 'jackpot_3', name: 'Triplé impossible', description: 'Rafle le jackpot commun 3 fois.', category: 'extremes', points: 250, check: (s) => s.jackpotsWon >= 3 },
  { id: 'devil_hand', name: 'Main du diable', description: '15 victoires de suite ET un gain à ×100.', category: 'extremes', points: 100, check: (s) => s.bestStreak >= 15 && s.biggestMultiplier >= 100 },
  { id: 'monument', name: 'Monument', description: 'Niveau 100 et 10 prestiges.', category: 'extremes', points: 250, check: (s) => s.level >= 100 && s.prestigeCount >= 10 },
  { id: 'lifer', name: 'Abonné à vie', description: '5 000 paliers de passe au total.', category: 'extremes', points: 250, check: (s) => s.passTiersTotal >= 5000 },
  { id: 'impossible', name: 'Statistiquement impossible', description: '25 victoires de suite et 5 000 parties gagnées.', category: 'extremes', points: 250, check: (s) => s.bestStreak >= 25 && s.winsCount >= 5000 },
  { id: 'midas', name: 'Toucher de Midas', description: '10 000 000 ₶ sur une seule partie.', category: 'extremes', points: 250, check: (s) => s.biggestWin >= 10000000 },
  { id: 'omniscient', name: 'Touche-à-tout absolu', description: 'Les 20 jeux, niveau 50 et 300 missions.', category: 'extremes', points: 100, check: (s) => s.distinctGames >= 20 && s.level >= 50 && s.missionsDone >= 300 },
  { id: 'unshakable', name: 'Inébranlable', description: '1 000 000 ₶ misés et un record à 100 000 ₶.', category: 'extremes', points: 100, check: (s) => s.totalWagered >= 1000000 && s.allTimeBestBalance >= 100000 },
];

export function getPrestigeTitle(prestigeCount: number): string | null {
  if (prestigeCount <= 0) return null;
  if (prestigeCount < 3) return `Prestige ${prestigeCount}`;
  if (prestigeCount < 5) return `Vétéran ★${prestigeCount}`;
  if (prestigeCount < 10) return `Légende ★${prestigeCount}`;
  return `Mythique ★${prestigeCount}`;
}

// Free daily gift, not a bet — weighted tiers like the other games, but no
// house edge concept applies since nothing is wagered.
export function rollDailyBonus(): number {
  const roll = secureRandomInt(1_000_000) / 1_000_000;
  if (roll < 0.55) return 250;
  if (roll < 0.85) return 500;
  if (roll < 0.97) return 2000;
  return 10_000;
}

// Free daily wheel spin — different (higher-variance) segment table than the
// login bonus, for a distinct "special event" feel.
export const WHEEL_OF_FORTUNE_SEGMENTS = [100, 250, 500, 1000, 2500, 10_000];
const WHEEL_OF_FORTUNE_WEIGHTS = [0.30, 0.28, 0.22, 0.12, 0.06, 0.02];

export function rollWheelOfFortune(): number {
  const roll = secureRandomInt(1_000_000) / 1_000_000;
  let cumulative = 0;
  for (let i = 0; i < WHEEL_OF_FORTUNE_SEGMENTS.length; i++) {
    cumulative += WHEEL_OF_FORTUNE_WEIGHTS[i];
    if (roll < cumulative) return WHEEL_OF_FORTUNE_SEGMENTS[i];
  }
  return WHEEL_OF_FORTUNE_SEGMENTS[0];
}

export function seasonKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
