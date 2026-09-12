'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  RELEASES, GROUP_META, GROUP_ORDER, scopeOf, formatReleaseDate,
  type ScopeGroup,
} from '@/lib/patch-notes';
import PatchNotesView from '@/components/PatchNotesView';

type Filter = 'tous' | ScopeGroup;

/**
 * Every published version, newest first, with one filter: the area. A wall
 * of thirty game chips on top of it made the page harder to read, not easier
 * to search — the area sections already group the games.
 */
export default function PatchNotesPage() {
  const [filter, setFilter] = useState<Filter>('tous');

  // A game's popup links here already filtered on its area. Read from the URL
  // after mount: useSearchParams would force a Suspense boundary on a page
  // that is otherwise static.
  // The newest version starts unfolded, older ones folded — plus whichever
  // version the link points at.
  const [openVersions, setOpenVersions] = useState<Set<string>>(
    () => new Set(RELEASES[0] ? [RELEASES[0].version] : [])
  );

  useEffect(() => {
    const zone = new URLSearchParams(window.location.search).get('zone');
    if (zone && (GROUP_ORDER as string[]).includes(zone)) setFilter(zone as ScopeGroup);
    const target = window.location.hash.match(/^#v(\d+\.\d+\.\d+)$/)?.[1];
    if (target) {
      setOpenVersions((prev) => new Set(prev).add(target));
      requestAnimationFrame(() => document.getElementById(`v${target}`)?.scrollIntoView());
    }
  }, []);

  const toggleVersion = (version: string) =>
    setOpenVersions((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });

  const presentGroups = useMemo(
    () => GROUP_ORDER.filter((g) => RELEASES.some((r) => r.entries.some((e) => scopeOf(e.scope).group === g))),
    []
  );

  const visible = RELEASES
    .map((release) => ({
      ...release,
      entries: filter === 'tous' ? release.entries : release.entries.filter((e) => scopeOf(e.scope).group === filter),
    }))
    .filter((release) => release.entries.length > 0);

  return (
    <main className="min-h-screen bg-transparent text-tx-base px-4 sm:px-6 pt-4 md:pt-6 pb-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/"
            aria-label="Accueil"
            className="h-11 w-11 shrink-0 rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-display text-3xl font-black tracking-wider uppercase leading-none">Patch notes</h1>
            <p className="text-[11px] text-tx-muted mt-1">Tout ce qui a changé, version après version.</p>
          </div>
        </div>

        {RELEASES.length === 0 ? (
          <div className="bg-brand-card border-4 border-brand-border rounded-[32px] p-8 shadow-brutal text-center">
            <p className="text-tx-secondary">Aucune version publiée pour l&apos;instant.</p>
          </div>
        ) : (
          <>
            {presentGroups.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {(['tous', ...presentGroups] as Filter[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setFilter(g)}
                    className={cn(
                      'h-9 px-3 rounded-lg border-2 font-display font-black text-[11px] tracking-wider uppercase transition-colors',
                      filter === g
                        ? g === 'tous' ? 'border-tx-base text-tx-base bg-brand-inner' : cn('bg-brand-inner', GROUP_META[g].active)
                        : 'border-brand-border text-tx-muted hover:text-tx-base'
                    )}
                  >
                    {g === 'tous' ? 'Tout' : GROUP_META[g].label}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-6">
              {visible.map((release) => {
                const latest = release.version === RELEASES[0].version;
                const open = openVersions.has(release.version);
                return (
                  <section
                    key={release.version}
                    id={`v${release.version}`}
                    className="bg-brand-card border-4 border-brand-border rounded-[28px] p-5 sm:p-6 shadow-brutal scroll-mt-4"
                  >
                    <button
                      type="button"
                      onClick={() => toggleVersion(release.version)}
                      aria-expanded={open}
                      className="w-full text-left group"
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span className={cn('font-display font-black text-sm', latest ? 'text-accent-primary' : 'text-tx-muted')}>
                          v{release.version}{latest && ' · dernière'}
                        </span>
                        <span className="text-[11px] text-tx-muted">{formatReleaseDate(release.date)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <h2 className="font-display text-2xl font-black leading-tight">{release.title}</h2>
                        <span className="ml-auto shrink-0 flex items-center gap-1 text-[11px] font-bold text-tx-muted group-hover:text-tx-base">
                          {open ? 'Replier' : `${release.entries.length} changements`}
                          <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
                        </span>
                      </div>
                    </button>
                    {open && (
                      <div className="mt-5">
                        <PatchNotesView entries={release.entries} />
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
