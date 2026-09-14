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

export type ScopeGroup = 'site' | 'casino' | 'peche' | 'solo' | 'multi';

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
export const TYPE_META: Record<ChangeType, { label: string; dot: string }> = {
  nouveau: { label: 'Nouveau', dot: 'bg-accent-success' },
  amelioration: { label: 'Amélioration', dot: 'bg-sky-400' },
  equilibrage: { label: 'Équilibrage', dot: 'bg-accent-primary' },
  correctif: { label: 'Correctif', dot: 'bg-accent-secondary' },
  retrait: { label: 'Retiré', dot: 'bg-tx-muted' },
};

export const GROUP_ORDER: ScopeGroup[] = ['site', 'casino', 'peche', 'solo', 'multi'];

export const GROUP_META: Record<ScopeGroup, { label: string; bar: string; active: string }> = {
  site: { label: 'Site', bar: 'bg-tx-muted', active: 'border-tx-base text-tx-base' },
  casino: { label: 'Casino', bar: 'bg-accent-primary', active: 'border-accent-primary text-accent-primary' },
  peche: { label: 'Pêche', bar: 'bg-cyan-400', active: 'border-cyan-400 text-cyan-300' },
  solo: { label: 'Solo', bar: 'bg-accent-success', active: 'border-accent-success text-accent-success' },
  multi: { label: 'Multijoueur', bar: 'bg-sky-400', active: 'border-sky-400 text-sky-300' },
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

/**
 * Entries in three levels — area, then game, then change — the shape both the
 * page and the modal read. Areas with nothing in them are left out.
 */
export function groupByArea(entries: PatchEntry[]): {
  group: ScopeGroup;
  count: number;
  scopes: { scope: ScopeDef; entries: PatchEntry[] }[];
}[] {
  const byScope = groupByScope(entries);
  return GROUP_ORDER
    .map((group) => {
      const scopes = byScope.filter((s) => s.scope.group === group);
      return { group, scopes, count: scopes.reduce((n, s) => n + s.entries.length, 0) };
    })
    .filter((area) => area.count > 0);
}
