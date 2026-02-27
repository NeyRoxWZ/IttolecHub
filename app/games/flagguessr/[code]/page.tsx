'use client';

import FlagGuesser from '@/games/FlagGuesser';

export default function FlagGuesserPage({ 
  params, 
  searchParams 
}: { 
  params: { code: string },
  searchParams: { [key: string]: string }
}) {
  return <FlagGuesser roomCode={params.code} />;
}
