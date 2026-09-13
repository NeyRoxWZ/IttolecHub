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

  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <button
      onClick={equip}
      disabled={state !== 'idle'}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl border-[3px] border-brand-border font-display leading-none',
        'transition-transform focus:outline-none active:translate-y-[3px] disabled:active:translate-y-0',
        size === 'sm' ? 'h-9 px-2.5 text-base' : 'h-11 px-4 text-lg',
        state === 'done'
          ? 'bg-accent-success text-brand-bg shadow-[inset_0_-4px_0_#1E9A55]'
          : 'bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00,0_3px_0_#05061A] hover:brightness-105 disabled:opacity-70',
        className
      )}
    >
      {state === 'done'
        ? <><Check className={icon} strokeWidth={3} /> Équipé</>
        : <><Wand2 className={icon} /> {state === 'busy' ? '···' : 'Équiper'}</>}
    </button>
  );
}
