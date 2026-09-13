'use client';

import { useEffect, useState } from 'react';
import { Volume2, VolumeX, Zap, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx, isMuted, setMuted } from '@/lib/casino/sfx';
import { useTurbo } from '@/lib/casino/turbo';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { screensSkinned, setScreensSkinned } from '@/lib/casino/activeCosmetics';

/**
 * Sound and turbo, on every casino page rather than only inside a game — both
 * settings are global, and having to open a game to mute the site was absurd.
 */
export default function CasinoControls({ className }: { className?: string }) {
  const [turbo, setTurboMode] = useTurbo();
  const [muted, setMutedState] = useState(false);
  const [skinned, setSkinned] = useState(true);

  // Read on mount only: localStorage is not available during the server render.
  useEffect(() => {
    setMutedState(isMuted());
    setSkinned(screensSkinned());
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
    if (!next) sfx.click();
    vibrate(HAPTIC.SOFT);
  };

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <button
        onClick={toggleMute}
        title={muted ? 'Réactiver le son' : 'Couper le son'}
        aria-label={muted ? 'Réactiver le son' : 'Couper le son'}
        className={cn(
          'h-12 w-12 rounded-xl border-[3px] border-brand-border flex items-center justify-center transition-transform active:translate-y-[3px] focus:outline-none',
          muted
            ? 'bg-accent-secondary text-white shadow-[inset_0_-4px_0_#C92D63,0_3px_0_#05061A]'
            : 'bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A]'
        )}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      <button
        onClick={() => { sfx.click(); vibrate(HAPTIC.SOFT); setTurboMode(!turbo); }}
        title="Mode turbo : animations accélérées partout"
        aria-label="Mode turbo"
        className={cn(
          'h-12 w-12 rounded-xl border-[3px] border-brand-border flex items-center justify-center transition-transform active:translate-y-[3px] focus:outline-none',
          turbo
            ? 'bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00,0_3px_0_#05061A]'
            : 'bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A]'
        )}
      >
        <Zap className="h-4 w-4" />
      </button>

      <button
        onClick={() => {
          sfx.click(); vibrate(HAPTIC.SOFT);
          const next = !skinned;
          setSkinned(next);
          setScreensSkinned(next);
        }}
        // The two states were named but never explained, so nobody could tell
        // what the button changed. It only concerns the general set: pieces
        // tied to a game always show inside that game either way.
        title={skinned
          ? 'Cosmétiques sur toutes les pages (activé) — le Tapis et le Contour de ton set général habillent aussi l’accueil du casino, la boutique, le pass… Les autres pièces ne changent pas. Clique pour les limiter aux jeux.'
          : 'Cosmétiques dans les jeux uniquement (désactivé) — les pages du casino gardent leur fond normal. Clique pour que le Tapis et le Contour de ton set général habillent aussi l’accueil, la boutique, le pass…'}
        aria-label={skinned ? 'Cosmétiques sur toutes les pages : activé' : 'Cosmétiques sur toutes les pages : désactivé'}
        className={cn(
          'h-12 w-12 rounded-xl border-[3px] border-brand-border flex items-center justify-center transition-transform active:translate-y-[3px] focus:outline-none',
          skinned
            ? 'bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00,0_3px_0_#05061A]'
            : 'bg-[#2B3170] text-tx-muted shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A]'
        )}
      >
        <Palette className="h-4 w-4" />
      </button>
    </div>
  );
}
