'use client';

import PokeGuessr from '@/games/PokeGuessr';

export default function PokeGuessrPage({ 
  params, 
  searchParams 
}: { 
  params: { code: string },
  searchParams: { [key: string]: string }
}) {
  return <PokeGuessr roomCode={params.code} settings={searchParams} />;
}