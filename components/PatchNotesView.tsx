'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  groupByArea, GROUP_META, TYPE_META, CHANGE_TYPES, type PatchEntry, type ScopeGroup,
} from '@/lib/patch-notes';

const UNFOLDED_KEY = 'itollec_patch_unfolded';

/**
 * One version's changes: area, then game, then change.
 *
 * Deliberately plain. The first version put every entry in its own bordered
 * box with two coloured badges, and sixty-seven of those read as noise. Now a
 * game is a row, a change is a line, and colour is only used where it tells
 * you something: a type dot appears only when a version mixes several kinds.
 *
 * Areas start folded: the version reads as a short list of areas with their
 * counts, and a player opens the one they play. When a filter leaves a single
 * area there is nothing to choose between, so it shows open.
 */
export default function PatchNotesView({ entries }: { entries: PatchEntry[] }) {
  const areas = groupByArea(entries);
  const types = CHANGE_TYPES.filter((t) => entries.some((e) => e.type === t));
  const mixed = types.length > 1;
  const [unfolded, setUnfolded] = useState<Set<ScopeGroup>>(new Set());

  // Remembered in this browser, per area: open Casino once and it stays open
  // on every version and every visit. Read after mount so the server render
  // and the first client render agree.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(UNFOLDED_KEY) || '[]');
      if (Array.isArray(saved)) setUnfolded(new Set(saved as ScopeGroup[]));
    } catch {}
  }, []);

  const toggle = (group: ScopeGroup) =>
    setUnfolded((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      try { localStorage.setItem(UNFOLDED_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });

  return (
    <div className="space-y-2">
      {mixed && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-tx-muted">
          {types.map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', TYPE_META[t].dot)} />
              {TYPE_META[t].label}
            </span>
          ))}
        </div>
      )}

      {areas.map(({ group, count, scopes }) => {
        const open = areas.length === 1 || unfolded.has(group);
        return (
          <section key={group}>
            <button
              type="button"
              onClick={() => toggle(group)}
              aria-expanded={open}
              className="w-full flex items-center gap-2 py-1.5 mb-1 text-left group"
            >
              <span className={cn('h-3.5 w-1.5 rounded-full', GROUP_META[group].bar)} />
              <span className="font-display text-lg">{GROUP_META[group].label}</span>
              <span className="text-[11px] font-bold text-tx-muted">{count}</span>
              <ChevronDown
                className={cn(
                  'ml-auto h-4 w-4 text-tx-muted group-hover:text-tx-base transition-transform',
                  !open && '-rotate-90'
                )}
              />
            </button>

            {open && (
              <div className="rounded-2xl border-[3px] border-brand-border bg-brand-inner divide-y divide-brand-border/70">
                {scopes.map(({ scope, entries: list }) => {
                  // A game described by a single entry titled after itself reads
                  // best as one line, not a heading over a line that repeats it.
                  const single = list.length === 1 && list[0].title === scope.label;

                  return (
                    <div key={scope.id} className="px-4 py-3">
                      {!single && <div className="font-bold text-[13px] text-tx-base mb-1.5">{scope.label}</div>}
                      <ul className="space-y-2">
                        {list.map((entry) => (
                          <li key={entry.id} className="flex gap-2.5">
                            {mixed && (
                              <span
                                title={TYPE_META[entry.type]?.label}
                                className={cn('mt-[7px] h-2 w-2 shrink-0 rounded-full', TYPE_META[entry.type]?.dot ?? 'bg-tx-muted')}
                              />
                            )}
                            <div className="min-w-0">
                              <div className={cn('text-[13px] leading-snug', single ? 'font-bold text-tx-base' : 'font-semibold text-tx-secondary')}>
                                {entry.title}
                              </div>
                              {entry.details && (
                                <p className="text-[12px] text-tx-muted leading-relaxed mt-0.5">{entry.details}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
