'use client';

import { use } from 'react';

import FlagGuesser from '@/games/FlagGuesser';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default function FlagGuesserPage({
  params,
  searchParams
}: {
  params: Promise<{ code: string }>,
  searchParams: Promise<{ [key: string]: string }>
}) {
  const { code } = use(params);
  return (
    <>
      <FlagGuesser roomCode={code} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
