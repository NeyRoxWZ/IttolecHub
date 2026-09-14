'use client';

import { use } from 'react';

import Infiltre from '@/games/Infiltre';

export default function InfiltrePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string }>;
}) {
  const { code } = use(params);
  return <Infiltre roomCode={code} />;
}

