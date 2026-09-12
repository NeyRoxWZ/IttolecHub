'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  RELEASES, GROUP_META, TYPE_META, CHANGE_TYPES, scopeOf, formatReleaseDate,
  type ScopeGroup,
} from '@/lib/patch-notes';
import PatchNotesView from '@/components/PatchNotesView';

type GroupFilter = 'tous' | ScopeGroup;

/**
 * Every published version, newest first, filterable by area and by game.
 */
export default function PatchNotesPage() {
  const [group, setGroup] = useState<GroupFilter>('tous');
  const [scope, setScope] = useState<string | null>(null);

  // Only offer filters for areas and games that actually have notes.
  const presentScopes = useMemo(() => {
    const ids = new Set(RELEASES.flatMap((r) => r.entries.map((e) => e.scope)));
    return Array.from(ids).map(scopeOf);
  }, []);
  const presentGroups = useMemo(
    () => (Object.keys(GROUP_META) as ScopeGroup[]).filter((g) => presentScopes.some((s) => s.group === g)),
    [presentScopes]
  );

  const visible = RELEASES
    .map((release) => ({
      ...release,
      entries: release.entries.filter((e) => {
        if (scope) return e.scope === scope;
        if (group !== 'tous') return scopeOf(e.scope).group === group;
        return true;
      }),
    }))
    .filter((release) => release.entries.length > 0);

  const scopesInGroup = presentScopes.filter((s) => group === 'tous' || s.group === group);

  return (
    <main className="min-h-screen bg-transparent text-tx-base px-4 sm:px-6 pt-4 md:pt-6 pb-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
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
            <div className="bg-brand-card border-4 border-brand-border rounded-[28px] p-4 shadow-brutal mb-6 space-y-3">
              <div className="flex flex-wrap gap-2">
                {(['tous', ...presentGroups] as GroupFilter[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => { setGroup(g); setScope(null); }}
                    className={cn(
                      'h-9 px-3 rounded-lg border-2 font-display font-black text-[11px] tracking-wider uppercase transition-colors',
                      group === g && !scope
                        ? g === 'tous' ? 'border-tx-base bg-brand-inner text-tx-base' : GROUP_META[g].badge
                        : 'border-brand-border bg-transparent text-tx-muted hover:text-tx-base'
                    )}
                  >
                    {g === 'tous' ? 'Tout' : GROUP_META[g].label}
                  </button>
                ))}
              </div>

              {scopesInGroup.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {scopesInGroup.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setScope(scope === s.id ? null : s.id)}
                      className={cn(
                        'h-7 px-2 rounded-md border text-[11px] font-bold transition-colors',
                        scope === s.id ? GROUP_META[s.group].badge : 'border-brand-border text-tx-secondary hover:text-tx-base'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1">
                {CHANGE_TYPES.map((t) => (
                  <span key={t} className={cn('px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-widest', TYPE_META[t].chip)}>
                    {TYPE_META[t].label}
                  </span>
                ))}
              </div>
            </div>

            {visible.length === 0 ? (
              <p className="text-sm text-tx-secondary text-center">Aucun changement pour ce filtre.</p>
            ) : (
              <div className="space-y-6">
                {visible.map((release, i) => (
                  <section
                    key={release.version}
                    id={`v${release.version}`}
                    className="bg-brand-card border-4 border-brand-border rounded-[32px] p-5 sm:p-6 shadow-brutal"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={cn(
                        'px-2 py-0.5 rounded-lg border-2 font-display font-black text-sm',
                        i === 0 && release.version === RELEASES[0].version
                          ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                          : 'border-brand-border bg-brand-inner text-tx-secondary'
                      )}>
                        v{release.version}
                      </span>
                      {release.version === RELEASES[0].version && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-accent-primary">Dernière</span>
                      )}
                      <span className="text-[11px] text-tx-muted ml-auto">{formatReleaseDate(release.date)}</span>
                    </div>
                    <h2 className="font-display text-xl font-black mb-4">{release.title}</h2>
                    <PatchNotesView entries={release.entries} />
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
