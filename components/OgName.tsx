'use client';

import { FOUNDER_BADGE_LABEL, FOUNDER_BADGE_TITLE, OG_BADGE_LABEL, OG_BADGE_TITLE } from '@/lib/og';
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

/** La pastille Fondateur seule : cristal, reflet qui balaie, halo qui pulse. */
export function FounderBadge({ className }: { className?: string }) {
  return (
    <span className={cn('founder-badge', className)} title={FOUNDER_BADGE_TITLE} aria-label={FOUNDER_BADGE_TITLE}>
      {FOUNDER_BADGE_LABEL}
    </span>
  );
}

/**
 * Un pseudo à afficher n'importe où sur le site. Pour le fondateur : pseudo en
 * diamant qui scintille, suivi de la pastille FD. Pour un OG : pseudo en or,
 * suivi de la pastille OG. Pour tous les autres : le pseudo, tel quel, sans rien
 * changer à la mise en page. Chacun peut masquer sa distinction depuis son profil.
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

  if (profile.founder) {
    return (
      <span className={cn('founder-wrap', className)} title={FOUNDER_BADGE_TITLE}>
        <span className={cn('founder-name', truncate && 'truncate', nameClassName)}>{name}</span>
        {badge && <FounderBadge />}
      </span>
    );
  }

  return (
    <span className={cn('og-wrap', className)} title={OG_BADGE_TITLE}>
      <span className={cn('og-name', truncate && 'truncate', nameClassName)}>{name}</span>
      {badge && <OgBadge />}
    </span>
  );
}
