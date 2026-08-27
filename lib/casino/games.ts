import type { LucideIcon } from 'lucide-react';
import {
  Dices, Spade, CircleDot, Rocket, Bomb, Circle, ArrowUpDown, Ticket,
  Egg, Building2, Grid3x3, Gift, Zap, Flag, GlassWater, LayoutGrid, Layers, Hand, Dice5, Coins,
} from 'lucide-react';

/**
 * The twenty games, in the order the hub shows them.
 *
 * Lived inside the hub page until the syndicate needed the same grid: during
 * a group run the players stay on the cagnotte page and pick their game from
 * there, so both screens have to read one list.
 */
export interface CasinoGameEntry { slug: string; name: string; short: string; icon: LucideIcon; rtp: string }

export const CASINO_GAMES: CasinoGameEntry[] = [
  { slug: 'slots', name: 'Frenly Slots', short: 'Aligne 3 symboles', icon: Dices, rtp: '94%' },
  { slug: 'blackjack', name: 'Frenly 21', short: 'Bats le croupier', icon: Spade, rtp: '98%' },
  { slug: 'wheel', name: 'Frenly Wheel', short: 'Rouge, noir ou plein', icon: CircleDot, rtp: '97%' },
  { slug: 'rocket', name: 'Frenly Rocket', short: 'Encaisse avant le crash', icon: Rocket, rtp: '95%' },
  { slug: 'mines', name: 'Frenly Mines', short: 'Évite les mines', icon: Bomb, rtp: '96%' },
  { slug: 'plinko', name: 'Frenly Plinko', short: 'La bille tombe', icon: Circle, rtp: '97%' },
  { slug: 'hilo', name: 'Frenly HiLo', short: 'Plus haut ou plus bas', icon: ArrowUpDown, rtp: '96%' },
  { slug: 'grattage', name: 'Frenly Grattage', short: 'Gratte ton ticket', icon: Ticket, rtp: '90%' },
  { slug: 'poulet', name: 'Frenly Poulet', short: 'Traverse la route', icon: Egg, rtp: '96%' },
  { slug: 'tower', name: 'Frenly Tower', short: 'Monte les étages', icon: Building2, rtp: '96%' },
  { slug: 'keno', name: 'Frenly Keno', short: 'Coche 10 numéros', icon: Grid3x3, rtp: '95%' },
  { slug: 'caisses', name: 'Frenly Caisses', short: '5 caisses, 1 jackpot', icon: Gift, rtp: '93%' },
  { slug: 'coinflip', name: 'Frenly Coinflip', short: 'Pile ou face', icon: Coins, rtp: '97%' },
  { slug: 'dino', name: 'Frenly Dino', short: 'Cours et esquive', icon: Zap, rtp: '95%' },
  { slug: 'chevaux', name: 'Frenly Chevaux', short: 'Mise sur un cheval', icon: Flag, rtp: '94%' },
  { slug: 'bonneteau', name: 'Frenly Bonneteau', short: 'Suis la bille', icon: GlassWater, rtp: '93%' },
  { slug: 'stade', name: 'Frenly Stade', short: 'Domicile ou extérieur', icon: LayoutGrid, rtp: '96%' },
  { slug: 'baccarat', name: 'Frenly Baccarat', short: 'Joueur ou banque', icon: Layers, rtp: '98%' },
  { slug: 'rps', name: 'Pierre-Feuille-Ciseaux', short: 'Un coup, un gagnant', icon: Hand, rtp: '96%' },
  { slug: 'craps', name: 'Frenly Craps', short: 'Ça passe ou ça casse', icon: Dice5, rtp: '98%' },
];
