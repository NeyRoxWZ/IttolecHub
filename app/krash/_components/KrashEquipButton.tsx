'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KrashCosmetic } from '@/lib/krash/cosmetics';
import { useKrashLoadout } from '../_lib/useKrashLoadout';

/** Equip or take off a Krash cosmetic; greyed out while it is not owned. */
export default function KrashEquipButton({
  cosmetic, size = 'md', className,
}: { cosmetic: KrashCosmetic; size?: 'sm' | 'md'; className?: string }) {
  const { owned, equipped, equip } = useKrashLoadout();
  const isOwned = owned.includes(cosmetic.id);
  const isEquipped = equipped[cosmetic.slot] === cosmetic.id;

  return (
    <button
      disabled={!isOwned}
      onClick={() => equip(cosmetic.slot, isEquipped ? null : cosmetic.id)}
      className={cn(
        'rounded-lg border-2 font-display font-black tracking-wider flex items-center justify-center gap-1 transition-colors disabled:opacity-40',
        size === 'sm' ? 'h-7 px-2 text-[9px]' : 'h-9 px-3 text-[11px]',
        isEquipped ? 'border-accent-success bg-accent-success/15 text-accent-success' : 'border-brand-border bg-brand-inner text-tx-secondary hover:text-tx-base hover:border-tx-base',
        className,
      )}
    >
      {isEquipped && <Check className="h-3 w-3" />}
      {!isOwned ? 'VERROUILLÉ' : isEquipped ? 'ÉQUIPÉ' : 'ÉQUIPER'}
    </button>
  );
}
