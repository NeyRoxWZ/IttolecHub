'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import { RELEASES, formatReleaseDate, scopeOf, type PatchEntry } from '@/lib/patch-notes';

/**
 * The games that greet players with their own notes. Plain names rather than
 * filter functions so a server layout can mount the modal.
 */
export type PatchArea = 'casino' | 'clicker' | 'krash';

const AREAS: Record<PatchArea, { label: string; zone: string; matches: (e: PatchEntry) => boolean }> = {
  casino: { label: 'du casino', zone: 'casino', matches: (e) => scopeOf(e.scope).group === 'casino' },
  clicker: { label: "d'ItollecClicker", zone: 'solo', matches: (e) => e.scope === 'clicker' },
  krash: { label: 'de Krash', zone: 'solo', matches: (e) => e.scope === 'krash' },
};

/** How many change titles are listed before "et N autres". */
const PREVIEW = 8;

/**
 * What changed in this game since the player last opened it.
 *
 * One per game, remembered per game: a version that only touches the casino
 * never interrupts someone opening the clicker, and reading the casino's notes
 * does not mark the clicker's as read. It looks for the newest version that
 * concerns this game, not simply the newest version.
 */
export default function PatchNotesModal({ area }: { area: PatchArea }) {
  const def = AREAS[area];
  const seenKey = `itollec_patch_seen_${area}`;

  const release = useMemo(() => {
    for (const r of RELEASES) {
      const entries = r.entries.filter(def.matches);
      if (entries.length) return { ...r, entries };
    }
    return null;
  }, [def]);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!release) return;
    try {
      if (localStorage.getItem(seenKey) !== release.version) setOpen(true);
    } catch {
      // Storage blocked: better to skip it than to show it on every visit.
    }
  }, [release, seenKey]);

  if (!open || !release) return null;

  const version = release.version;
  const close = () => {
    try { localStorage.setItem(seenKey, version); } catch {}
    setOpen(false);
  };

  const shown = release.entries.slice(0, PREVIEW);
  const rest = release.entries.length - shown.length;

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={close}
    >
      <div
        className="w-full max-w-md max-h-[88dvh] flex flex-col bg-brand-card border-4 border-brand-border rounded-[28px] shadow-brutal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="patch-notes-title"
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-accent-primary flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Version {version}
            </div>
            <h2 id="patch-notes-title" className="font-display text-xl font-black mt-1 leading-tight">
              Nouveautés {def.label}
            </h2>
            <div className="text-[11px] text-tx-muted mt-1">
              {formatReleaseDate(release.date)} · {release.entries.length} changement{release.entries.length > 1 ? 's' : ''}
            </div>
          </div>
          <button
            onClick={close}
            aria-label="Fermer"
            className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto px-6 space-y-2">
          {shown.map((entry) => (
            <li key={entry.id} className="flex gap-2.5 text-[13px] leading-snug">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent-primary" />
              <span className="text-tx-secondary">{entry.title}</span>
            </li>
          ))}
          {rest > 0 && (
            <li className="pl-4 text-[12px] text-tx-muted">et {rest} autre{rest > 1 ? 's' : ''}…</li>
          )}
        </ul>

        <div className="flex gap-2 p-6 pt-5">
          <Link
            href={`/patch-notes?zone=${def.zone}#v${version}`}
            onClick={close}
            className="flex-1 h-12 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-xs tracking-wider text-tx-base flex items-center justify-center hover:border-tx-base focus:outline-none"
          >
            TOUT LE DÉTAIL
          </Link>
          <button
            onClick={close}
            className="flex-1 h-12 rounded-xl bg-accent-primary text-brand-bg font-display font-black text-xs tracking-wider border-2 border-brand-border focus:outline-none"
          >
            C&apos;EST NOTÉ
          </button>
        </div>
      </div>
    </div>
  );
}
