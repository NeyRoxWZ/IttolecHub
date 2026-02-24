'use client';

import PopulationGuesser from '@/games/PopulationGuesser';

export default function PopulationGuesserPage({ 
  params, 
  searchParams 
}: { 
  params: { code: string },
  searchParams: { [key: string]: string }
}) {
  return <PopulationGuesser roomCode={params.code} settings={searchParams} />;
}
