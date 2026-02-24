'use client';

import ComplèteGuessr from '@/games/ComplèteGuessr';

export default function ComplèteGuessrPage({ 
  params, 
  searchParams 
}: { 
  params: { code: string },
  searchParams: { [key: string]: string }
}) {
  return <ComplèteGuessr roomCode={params.code} settings={searchParams} />;
}
