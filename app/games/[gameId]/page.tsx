'use client';

import { useSearchParams } from 'next/navigation';
import PokeGuessr from '@/games/PokeGuessr';

export default function GamePage({ params }: { params: { gameId: string } }) {
  const searchParams = useSearchParams();
  const roomCode = searchParams.get('room');

  return (
    <PokeGuessr roomCode={roomCode} />
  );
}