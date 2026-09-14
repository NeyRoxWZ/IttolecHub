'use client';

import { use } from 'react';

import Undercover from '@/games/Undercover';

export default function UndercoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string }>;
}) {
  const { code } = use(params);
  return <Undercover roomCode={code} />;
}

