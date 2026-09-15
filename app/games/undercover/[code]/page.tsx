'use client';

import { use } from 'react';

import Undercover from '@/games/Undercover';
import HostAwayPlayers from '@/components/HostAwayPlayers';

export default function UndercoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string }>;
}) {
  const { code } = use(params);
  return (
    <>
      <Undercover roomCode={code} />
      <HostAwayPlayers roomCode={code} />
    </>
  );
}
