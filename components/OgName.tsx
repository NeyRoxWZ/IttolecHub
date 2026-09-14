'use client';

import { OG_BADGE_LABEL, OG_BADGE_TITLE } from '@/lib/og';
import { useOgProfile } from '@/hooks/useOg';
import { cn } from '@/lib/utils';

/** La pastille OG seule, quand le pseudo est déjà affiché à côté. */
export function OgBadge({ className }: { className?: string }) {
  return (
    <span className={cn('og-badge', className)} title={OG_BADGE_TITLE} aria-label={OG_BADGE_TITLE}>
      {OG_BADGE_LABEL}
    </span>
  );
}

/**
 * Un pseudo à afficher n'importe où sur le site. Pour un OG qui affiche sa
 * distinction : pseudo en or à motif, suivi de la pastille. Pour tous les
 * autres : le pseudo, tel quel, sans rien changer à la mise en page.
 */
export default function OgName({
  name,
  className,
  nameClassName,
  badge = true,
  truncate = true,
}: {
  name?: string | null;
  /** Appliquée au conteneur (pseudo + pastille). */
  className?: string;
  /** Appliquée au pseudo seul. */
  nameClassName?: string;
  /** À couper quand la place manque vraiment (tickers, listes serrées). */
  badge?: boolean;
  truncate?: boolean;
}) {
  const profile = useOgProfile(name);

  if (!name) return null;
  if (!profile || !profile.visible) return <>{name}</>;

  return (
    <span className={cn('og-wrap', className)} title={OG_BADGE_TITLE}>
      <span className={cn('og-name', truncate && 'truncate', nameClassName)}>{name}</span>
      {badge && <OgBadge />}
    </span>
  );
}
