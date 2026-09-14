'use client';

import { use } from 'react';

import FlagGuesser from '@/games/FlagGuesser';

export default function FlagGuesserPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ code: string }>,
  searchParams: Promise<{ [key: string]: string }>
}) {
  const { code } = use(params);
  return <FlagGuesser roomCode={code} />;
}
