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
          'h-11 w-11 rounded-xl border-2 flex items-center justify-center transition-colors focus:outline-none',
          muted
            ? 'border-accent-secondary bg-accent-secondary/10 text-accent-secondary'
            : 'border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base'
        )}
      >
        {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      <button
        onClick={() => { sfx.click(); vibrate(HAPTIC.SOFT); setTurboMode(!turbo); }}
        title="Mode turbo : animations accélérées partout"
        aria-label="Mode turbo"
        className={cn(
          'h-11 w-11 rounded-xl border-2 flex items-center justify-center transition-colors focus:outline-none',
          turbo
            ? 'border-accent-primary bg-accent-primary/15 text-accent-primary'
            : 'border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base'
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
        title={skinned ? 'Cosmétiques appliqués aux écrans' : 'Cosmétiques dans les jeux uniquement'}
        aria-label="Cosmétiques sur les écrans"
        className={cn(
          'h-11 w-11 rounded-xl border-2 flex items-center justify-center transition-colors focus:outline-none',
          skinned
            ? 'border-accent-primary bg-accent-primary/15 text-accent-primary'
            : 'border-brand-border bg-brand-inner text-tx-muted'
        )}
      >
        <Palette className="h-4 w-4" />
      </button>
    </div>
  );
}
