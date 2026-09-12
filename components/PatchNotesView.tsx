import { cn } from '@/lib/utils';
import {
  groupByArea, GROUP_META, TYPE_META, CHANGE_TYPES, type PatchEntry,
} from '@/lib/patch-notes';

/**
 * One version's changes: area, then game, then change.
 *
 * Deliberately plain. The first version put every entry in its own bordered
 * box with two coloured badges, and sixty-seven of those read as noise. Now a
 * game is a row, a change is a line, and colour is only used where it tells
 * you something: a type dot appears only when a version mixes several kinds.
 */
export default function PatchNotesView({ entries }: { entries: PatchEntry[] }) {
  const areas = groupByArea(entries);
  const types = CHANGE_TYPES.filter((t) => entries.some((e) => e.type === t));
  const mixed = types.length > 1;

  return (
    <div className="space-y-6">
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

      {areas.map(({ group, count, scopes }) => (
        <section key={group}>
          <h3 className="flex items-center gap-2 mb-2">
            <span className={cn('h-3.5 w-1.5 rounded-full', GROUP_META[group].bar)} />
            <span className="font-display font-black text-sm uppercase tracking-widest">{GROUP_META[group].label}</span>
            <span className="text-[11px] font-bold text-tx-muted">{count}</span>
          </h3>

          <div className="rounded-2xl border-2 border-brand-border bg-brand-inner divide-y divide-brand-border/70">
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
        </section>
      ))}
    </div>
  );
}
