import scopesFile from '@/patch-notes/scopes.json';
import releasesFile from '@/patch-notes/releases.json';

/**
 * Patch notes as the site reads them.
 *
 * Only published versions are imported here. Pending entries live in
 * patch-notes/unreleased.json and are never bundled: the owner decides when a
 * version ships by running the release script (see scripts/patch-notes.mjs).
 */

export const CHANGE_TYPES = ['nouveau', 'amelioration', 'equilibrage', 'correctif', 'retrait'] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export type ScopeGroup = 'site' | 'casino' | 'solo' | 'multi';

export interface ScopeDef {
  id: string;
  label: string;
  group: ScopeGroup;
}

export interface PatchEntry {
  id: string;
  date: string;
  scope: string;
  type: ChangeType;
  title: string;
  details?: string;
}

export interface PatchRelease {
  version: string;
  date: string;
  title: string;
  entries: PatchEntry[];
}

export const SCOPES = scopesFile.scopes as ScopeDef[];
const SCOPE_BY_ID = new Map(SCOPES.map((s) => [s.id, s]));

/** An unknown scope still renders, filed under the site. */
export function scopeOf(id: string): ScopeDef {
  return SCOPE_BY_ID.get(id) ?? { id, label: id, group: 'site' };
}

/** Newest first. */
export const RELEASES = releasesFile.releases as PatchRelease[];
export const LATEST_RELEASE: PatchRelease | null = RELEASES[0] ?? null;

// Full class names spelled out: Tailwind only generates what it can read.
export const TYPE_META: Record<ChangeType, { label: string; chip: string }> = {
  nouveau: { label: 'Nouveau', chip: 'border-accent-success/60 bg-accent-success/15 text-accent-success' },
  amelioration: { label: 'Amélioration', chip: 'border-sky-400/60 bg-sky-400/15 text-sky-300' },
  equilibrage: { label: 'Équilibrage', chip: 'border-accent-primary/60 bg-accent-primary/15 text-accent-primary' },
  correctif: { label: 'Correctif', chip: 'border-accent-secondary/60 bg-accent-secondary/15 text-accent-secondary' },
  retrait: { label: 'Retiré', chip: 'border-brand-border bg-brand-inner text-tx-muted' },
};

export const GROUP_META: Record<ScopeGroup, { label: string; badge: string; bar: string }> = {
  site: { label: 'Site', badge: 'border-tx-muted/50 bg-brand-inner text-tx-secondary', bar: 'bg-tx-muted' },
  casino: { label: 'Casino', badge: 'border-accent-primary/60 bg-accent-primary/10 text-accent-primary', bar: 'bg-accent-primary' },
  solo: { label: 'Solo', badge: 'border-accent-success/60 bg-accent-success/10 text-accent-success', bar: 'bg-accent-success' },
  multi: { label: 'Multijoueur', badge: 'border-sky-400/60 bg-sky-400/10 text-sky-300', bar: 'bg-sky-400' },
};

/**
 * Entries grouped by scope, in the order scopes are declared (site, casino,
 * solo, multiplayer), and inside a scope new things first, fixes after.
 */
export function groupByScope(entries: PatchEntry[]): { scope: ScopeDef; entries: PatchEntry[] }[] {
  const scopeOrder = new Map(SCOPES.map((s, i) => [s.id, i]));
  const typeOrder = new Map(CHANGE_TYPES.map((t, i) => [t, i]));
  const buckets = new Map<string, PatchEntry[]>();
  for (const entry of entries) {
    const list = buckets.get(entry.scope) ?? [];
    list.push(entry);
    buckets.set(entry.scope, list);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => (scopeOrder.get(a[0]) ?? 999) - (scopeOrder.get(b[0]) ?? 999))
    .map(([id, list]) => ({
      scope: scopeOf(id),
      entries: [...list].sort((x, y) => (typeOrder.get(x.type) ?? 9) - (typeOrder.get(y.type) ?? 9)),
    }));
}

export function formatReleaseDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}
