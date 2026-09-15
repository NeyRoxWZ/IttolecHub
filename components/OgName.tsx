'use client';

import {
  BADGE_INFO, DONOR_BADGE_LABEL, DONOR_BADGE_TITLE, FOUNDER_BADGE_LABEL, FOUNDER_BADGE_TITLE, OG_BADGE_LABEL, OG_BADGE_TITLE,
  shownBadges, type BadgeId,
} from '@/lib/og';
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

/** La pastille Donateur seule : cœur rose. */
export function DonorBadge({ className }: { className?: string }) {
  return (
    <span className={cn('donor-badge', className)} title={DONOR_BADGE_TITLE} aria-label={DONOR_BADGE_TITLE}>
      {DONOR_BADGE_LABEL}
    </span>
  );
}

export function BadgePlaque({ badge, className }: { badge: BadgeId; className?: string }) {
  if (badge === 'founder') return <FounderBadge className={className} />;
  if (badge === 'og') return <OgBadge className={className} />;
  return <DonorBadge className={className} />;
}

const NAME_CLASS: Record<BadgeId, string> = { founder: 'founder-name', og: 'og-name', donor: 'donor-name' };

/**
 * Un pseudo à afficher n'importe où sur le site, avec les badges que le joueur
 * a choisi d'afficher. Le premier badge donne sa couleur au pseudo (diamant
 * pour le Fondateur, or pour un OG, rose pour un Donateur) ; chaque badge
 * ajoute sa pastille. Sans badge affiché : le pseudo, tel quel.
 */
export default function OgName({
  name,
  className,
  nameClassName,
  badge = true,
  truncate = true,
}: {
  name?: string | null;
  /** Appliquée au conteneur (pseudo + pastilles). */
  className?: string;
  /** Appliquée au pseudo seul. */
  nameClassName?: string;
  /** À couper quand la place manque vraiment (tickers, listes serrées). */
  badge?: boolean;
  truncate?: boolean;
}) {
  const profile = useOgProfile(name);

  if (!name) return null;
  const shown = profile ? shownBadges(profile) : [];
  if (!shown.length) return <>{name}</>;

  const top = shown[0];
  return (
    <span className={cn(top === 'founder' ? 'founder-wrap' : 'og-wrap', className)} title={shown.map((b) => BADGE_INFO[b].title).join(' · ')}>
      <span className={cn(NAME_CLASS[top], truncate && 'truncate', nameClassName)}>{name}</span>
      {badge && shown.map((b) => <BadgePlaque key={b} badge={b} />)}
    </span>
  );
}
