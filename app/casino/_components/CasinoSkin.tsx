'use client';

import { useEffect } from 'react';
import { useGameCosmetics } from '@/hooks/useGameCosmetics';
import { GLOBAL_SLUG } from '@/lib/casino/cosmetics';
import {
  setGlobalCosmetics, screensSkinned, subscribeCosmetics,
} from '@/lib/casino/activeCosmetics';
import { tableBackground } from './CosmeticPreview';

/**
 * The general set, applied to the whole casino.
 *
 * Mounted once by the layout, so a sound pack works on the shop page and the
 * table skin paints every screen — not only the inside of a game. A game
 * mounts its own layer on top and wins slot by slot.
 */
export default function CasinoSkin() {
  const cosmetics = useGameCosmetics(GLOBAL_SLUG);

  useEffect(() => { setGlobalCosmetics(cosmetics); }, [cosmetics]);

  // Painting the pages is optional: some players want the skin in the games
  // only, and the background is the part that gets in the way.
  useEffect(() => {
    const apply = () => {
      const table = cosmetics.table?.params;
      const border = cosmetics.border?.params;
      const root = document.documentElement;

      if (table && screensSkinned()) {
        root.style.setProperty('--casino-skin-bg', tableBackground(table));
        document.body.style.background = tableBackground(table);
        document.body.style.backgroundAttachment = 'fixed';
      } else {
        root.style.removeProperty('--casino-skin-bg');
        document.body.style.background = '';
        document.body.style.backgroundAttachment = '';
      }

      if (border && screensSkinned()) {
        root.style.setProperty('--casino-skin-accent', border.color || '#FFD000');
      } else {
        root.style.removeProperty('--casino-skin-accent');
      }
    };

    apply();
    const unsubscribe = subscribeCosmetics(apply);
    return () => {
      unsubscribe();
      document.body.style.background = '';
      document.body.style.backgroundAttachment = '';
    };
  }, [cosmetics]);

  return null;
}
