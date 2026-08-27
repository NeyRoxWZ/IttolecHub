'use client';

import { useState } from 'react';
import { Check, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';
import { useAuth } from '@/hooks/useAuth';
import { refreshCosmetics } from '@/hooks/useGameCosmetics';
import type { Cosmetic } from '@/lib/casino/cosmetics';

/**
 * Equip a piece the moment it drops.
 *
 * Winning a cosmetic used to mean closing the crate, opening the inventory,
 * finding the game, finding the slot. This is the same call, one tap in.
 */
export default function EquipButton({
  cosmetic, className, size = 'md',
}: {
  cosmetic: Cosmetic;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const { user } = useAuth();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');

  if (!user) return null;

  const equip = async () => {
    if (state !== 'idle') return;
    setState('busy');
    sfx.select();
    vibrate(HAPTIC.SOFT);
    try {
      const res = await fetch('/api/casino/cosmetics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          game_slug: cosmetic.gameSlug,
          slot: cosmetic.slot,
          cosmetic_id: cosmetic.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur'); setState('idle'); return; }

      setState('done');
      void refreshCosmetics(user.id);
    } catch {
      setState('idle');
    }
  };

  return (
    <button
      onClick={equip}
      disabled={state !== 'idle'}
      className={cn(
        'rounded-lg border-2 font-black tracking-widest flex items-center justify-center gap-1.5 focus:outline-none transition-colors',
        size === 'sm' ? 'h-7 px-2 text-[9px]' : 'h-9 px-3 text-[10px]',
        state === 'done'
          ? 'border-accent-success bg-accent-success/15 text-accent-success'
          : 'border-accent-primary bg-accent-primary text-brand-bg hover:brightness-110 disabled:opacity-60',
        className
      )}
    >
      {state === 'done'
        ? <><Check className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} /> ÉQUIPÉ</>
        : <><Wand2 className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} /> {state === 'busy' ? '···' : 'ÉQUIPER'}</>}
    </button>
  );
}
