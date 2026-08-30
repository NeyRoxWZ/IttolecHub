'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

/**
 * The game screens, loadable one at a time.
 *
 * During a group run the players never leave the cagnotte page, so the game
 * they pick is mounted inside it rather than navigated to. These are the very
 * same components the individual routes render — pulled in lazily, because
 * bundling all twenty into the arena would make it enormous to open.
 */

export const ARENA_GAMES: Record<string, ComponentType> = {
  slots: dynamic(() => import('@/app/casino/slots/page'), { ssr: false }),
  blackjack: dynamic(() => import('@/app/casino/blackjack/page'), { ssr: false }),
  wheel: dynamic(() => import('@/app/casino/wheel/page'), { ssr: false }),
  rocket: dynamic(() => import('@/app/casino/rocket/page'), { ssr: false }),
  mines: dynamic(() => import('@/app/casino/mines/page'), { ssr: false }),
  plinko: dynamic(() => import('@/app/casino/plinko/page'), { ssr: false }),
  hilo: dynamic(() => import('@/app/casino/hilo/page'), { ssr: false }),
  grattage: dynamic(() => import('@/app/casino/grattage/page'), { ssr: false }),
  poulet: dynamic(() => import('@/app/casino/poulet/page'), { ssr: false }),
  tower: dynamic(() => import('@/app/casino/tower/page'), { ssr: false }),
  keno: dynamic(() => import('@/app/casino/keno/page'), { ssr: false }),
  caisses: dynamic(() => import('@/app/casino/caisses/page'), { ssr: false }),
  coinflip: dynamic(() => import('@/app/casino/coinflip/page'), { ssr: false }),
  dino: dynamic(() => import('@/app/casino/dino/page'), { ssr: false }),
  chevaux: dynamic(() => import('@/app/casino/chevaux/page'), { ssr: false }),
  bonneteau: dynamic(() => import('@/app/casino/bonneteau/page'), { ssr: false }),
  stade: dynamic(() => import('@/app/casino/stade/page'), { ssr: false }),
  baccarat: dynamic(() => import('@/app/casino/baccarat/page'), { ssr: false }),
  rps: dynamic(() => import('@/app/casino/rps/page'), { ssr: false }),
  craps: dynamic(() => import('@/app/casino/craps/page'), { ssr: false }),
};
