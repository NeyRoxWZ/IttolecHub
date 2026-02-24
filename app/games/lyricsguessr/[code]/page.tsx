'use client';

import LyricsGuesser from '@/games/LyricsGuesser';

export default function LyricsGuesserPage({ 
  params, 
  searchParams 
}: { 
  params: { code: string },
  searchParams: { [key: string]: string }
}) {
  return <LyricsGuesser roomCode={params.code} settings={searchParams} />;
}
