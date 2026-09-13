'use client';

import { useEffect, useState } from 'react';
import { setGlobalCosmetics } from '@/lib/casino/activeCosmetics';
import { legacyTableBackground as tableBackground } from '@/app/casino/_components/CosmeticPreview';
import Confetti from '@/app/casino/_components/Confetti';
import type { CosmeticParams } from '@/lib/casino/cosmetics';
import { useKrashLoadout } from '../_lib/useKrashLoadout';

/** The site's stripes, kept on top of a background skin, as the casino does. */
const QUADRILLAGE =
  'repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 24px, transparent 24px 48px)';

/** Fired by the positions hook when a withdrawal is a big win. */
export const KRASH_BIG_WIN_EVENT = 'krash:bigwin';

/**
 * Applies the equipped Krash cosmetics to every Krash page: background,
 * card frames, the sound pack every sfx call reads, and the celebration on a
 * big win. Mounted once by the Krash layout.
 */
export default function KrashSkin() {
  const { cosmetics } = useKrashLoadout();
  const [burst, setBurst] = useState(0);

  // Sound pack and win effect go through the casino's shared active-cosmetics
  // store, which the sound engine and the confetti already read.
  useEffect(() => {
    const loadout: Record<string, unknown> = {};
    if (cosmetics.sound) loadout.sound = { slot: 'sound', params: cosmetics.sound.params };
    if (cosmetics.win_fx) loadout.win_fx = { slot: 'win_fx', params: cosmetics.win_fx.params };
    setGlobalCosmetics(loadout as never);
    return () => setGlobalCosmetics({});
  }, [cosmetics.sound, cosmetics.win_fx]);

  useEffect(() => {
    const root = document.documentElement;
    const table = cosmetics.table?.params;
    if (table) {
      document.body.style.background = `${QUADRILLAGE}, ${tableBackground(table as CosmeticParams)}`;
      document.body.style.backgroundAttachment = 'fixed';
    }
    const accent = cosmetics.border?.params.color;
    if (accent) root.style.setProperty('--krash-accent', accent);
    return () => {
      document.body.style.background = '';
      document.body.style.backgroundAttachment = '';
      root.style.removeProperty('--krash-accent');
    };
  }, [cosmetics.table, cosmetics.border]);

  useEffect(() => {
    const onWin = () => setBurst((b) => b + 1);
    window.addEventListener(KRASH_BIG_WIN_EVENT, onWin);
    return () => window.removeEventListener(KRASH_BIG_WIN_EVENT, onWin);
  }, []);

  return (
    <>
      {cosmetics.table && (
        <style>{'main[data-krash] { background: transparent !important; }'}</style>
      )}
      {cosmetics.border && (
        <style>{`main[data-krash] .shadow-brutal.border-brand-border { border-color: var(--krash-accent) !important; ${cosmetics.border.params.glow ? 'box-shadow: 0 0 14px var(--krash-accent), 0 5px 0 #14142B !important;' : ''} }`}</style>
      )}
      {burst > 0 && <Confetti trigger={burst} intensity="huge" />}
    </>
  );
}
