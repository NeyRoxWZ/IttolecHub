'use client';

import Undercover from '@/games/Undercover';

export default function UndercoverPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { [key: string]: string };
}) {
  return <Undercover roomCode={params.code} />;
}

