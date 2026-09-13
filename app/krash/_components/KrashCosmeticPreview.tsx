'use client';

import { cn } from '@/lib/utils';
import CosmeticPreview from '@/app/casino/_components/CosmeticPreview';
import type { Cosmetic } from '@/lib/casino/cosmetics';
import type { KrashCosmetic } from '@/lib/krash/cosmetics';

const WIN_LABEL: Record<string, string> = {
  confetti: 'Confettis', coins: 'Pluie de pièces', shock: 'Onde de choc', sparks: 'Étincelles', fireworks: 'Feu d’artifice',
};
const PACK_LABEL: Record<string, string> = {
  retro: 'Rétro', lounge: 'Lounge', arcade: 'Arcade', space: 'Spatial', western: 'Western', orchestral: 'Orchestral',
};

/** One line on what the piece does on screen. */
export function krashCosmeticEffect(c: KrashCosmetic): string {
  const p = c.params;
  switch (c.slot) {
    case 'chart': return 'Recolore la courbe du marché.';
    case 'table': return 'Change le fond de toutes les pages Krash.';
    case 'border': return p.animated ? 'Contour animé autour des cartes.' : 'Contour coloré autour des cartes.';
    case 'title': return `Affiche « ${p.title} » sous ton pseudo.`;
    case 'win_fx': return `${WIN_LABEL[p.winStyle ?? ''] ?? 'Effet'} quand tu retires un gros gain.`;
    case 'sound': return `Pack sonore ${PACK_LABEL[p.pack ?? ''] ?? ''} sur tout Krash.`;
    case 'emblem': return 'Badge à côté de ton solde et de ton pseudo.';
  }
}

/**
 * Preview of a Krash cosmetic. The slots Krash shares with the casino are
 * drawn by the casino's own preview, so a background looks the same in both
 * games; the curve and the title get their own drawing.
 */
export default function KrashCosmeticPreview({
  cosmetic, size = 96, className,
}: { cosmetic: KrashCosmetic; size?: number; className?: string }) {
  const p = cosmetic.params;

  if (cosmetic.slot === 'chart') {
    return (
      <div
        className={cn('relative rounded-xl overflow-hidden border-2 border-brand-border shrink-0', className)}
        style={{ width: size, height: size, background: 'linear-gradient(160deg,#16161F,#0D0D14)' }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <polyline points="6,70 22,58 34,64 50,40 62,46 78,22 94,28" fill="none" stroke={p.up} strokeWidth="5" strokeLinejoin="round" />
          <polyline points="6,34 22,44 36,40 52,62 66,58 80,78 94,84" fill="none" stroke={p.down} strokeWidth="5" strokeLinejoin="round" opacity="0.85" />
        </svg>
      </div>
    );
  }

  if (cosmetic.slot === 'title') {
    return (
      <div
        className={cn('relative rounded-xl overflow-hidden border-2 border-brand-border shrink-0 flex items-center justify-center p-1.5 text-center', className)}
        style={{ width: size, height: size, background: `radial-gradient(circle at 50% 40%, ${p.color}22, #0D0D14 70%)` }}
      >
        <span className="font-display font-black uppercase leading-tight" style={{ color: p.color, fontSize: Math.max(8, size / 9) }}>
          {p.title}
        </span>
      </div>
    );
  }

  // The casino preview reads the same params for these slots. Krash keeps the
  // earlier dark look while the casino moves to its new style.
  return <CosmeticPreview cosmetic={{ ...cosmetic, gameSlug: 'global' } as unknown as Cosmetic} size={size} className={className} variant="legacy" />;
}
