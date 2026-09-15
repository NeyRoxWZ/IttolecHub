import type { Metadata } from 'next';
import { CASINO_GAMES } from '@/lib/casino/games';

const game = CASINO_GAMES.find((g) => g.slug === "coinflip");

export const metadata: Metadata = {
  title: game?.name ?? 'Casino',
  description: game ? `${game.name} : ${game.short.toLowerCase()}. Mini-jeu du casino IttolecHub en monnaie fictive.` : undefined,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
