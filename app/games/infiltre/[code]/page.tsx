'use client';

import Infiltre from '@/games/Infiltre';

export default function InfiltrePage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { [key: string]: string };
}) {
  return <Infiltre roomCode={params.code} />;
}

