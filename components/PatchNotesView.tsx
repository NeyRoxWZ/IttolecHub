import { cn } from '@/lib/utils';
import {
  groupByScope, GROUP_META, TYPE_META, type PatchEntry,
} from '@/lib/patch-notes';

/** One version's changes, grouped by game, coloured by kind. Shared by the modal and the history page. */
export default function PatchNotesView({ entries }: { entries: PatchEntry[] }) {
  const groups = groupByScope(entries);

  return (
    <div className="space-y-4">
      {groups.map(({ scope, entries: list }) => {
        const group = GROUP_META[scope.group];
        return (
          <div key={scope.id}>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('h-4 w-1.5 rounded-full', group.bar)} />
              <span className={cn('px-2 py-0.5 rounded-lg border-2 font-display font-black text-[11px] tracking-wide', group.badge)}>
                {scope.label}
              </span>
              {scope.label !== group.label && (
                <span className="text-[10px] font-bold uppercase tracking-widest text-tx-muted">{group.label}</span>
              )}
            </div>

            <ul className="space-y-2">
              {list.map((entry) => {
                const kind = TYPE_META[entry.type] ?? TYPE_META.amelioration;
                return (
                  <li key={entry.id} className="rounded-xl border-2 border-brand-border bg-brand-inner p-3">
                    <div className="flex items-start gap-2">
                      <span className={cn(
                        'shrink-0 px-1.5 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-widest',
                        kind.chip
                      )}>
                        {kind.label}
                      </span>
                      <span className="font-bold text-sm leading-snug">{entry.title}</span>
                    </div>
                    {entry.details && (
                      <p className="mt-1.5 text-[12px] text-tx-secondary leading-relaxed">{entry.details}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
