'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import { LATEST_RELEASE, formatReleaseDate } from '@/lib/patch-notes';
import PatchNotesView from './PatchNotesView';

const SEEN_KEY = 'itollec_patch_seen';

/**
 * Shown once per published version, the first time a player lands on a solo
 * screen after it ships. Remembered per browser, so it never comes back for a
 * version already read — and it stays silent until a version is released.
 */
export default function PatchNotesModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!LATEST_RELEASE) return;
    try {
      if (localStorage.getItem(SEEN_KEY) !== LATEST_RELEASE.version) setOpen(true);
    } catch {
      // Storage blocked: better to skip it than to show it on every visit.
    }
  }, []);

  if (!open || !LATEST_RELEASE) return null;

  // Captured after the guard: TypeScript does not carry the narrowing of a
  // module constant into the closure below.
  const release = LATEST_RELEASE;
  const close = () => {
    try { localStorage.setItem(SEEN_KEY, release.version); } catch {}
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={close}
    >
      <div
        className="w-full max-w-lg max-h-[88dvh] flex flex-col bg-brand-card border-4 border-brand-border rounded-[28px] shadow-brutal animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="patch-notes-title"
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b-2 border-brand-border">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-accent-primary flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Nouvelle version · {LATEST_RELEASE.version}
            </div>
            <h2 id="patch-notes-title" className="font-display text-xl font-black mt-1 leading-tight">
              {LATEST_RELEASE.title}
            </h2>
            <div className="text-[11px] text-tx-muted mt-1">{formatReleaseDate(LATEST_RELEASE.date)}</div>
          </div>
          <button
            onClick={close}
            aria-label="Fermer"
            className="h-9 w-9 shrink-0 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center hover:border-tx-base focus:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <PatchNotesView entries={LATEST_RELEASE.entries} />
        </div>

        <div className="flex gap-2 p-6 pt-4 border-t-2 border-brand-border">
          <Link
            href="/patch-notes"
            onClick={close}
            className="h-12 px-4 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-xs tracking-wider text-tx-secondary flex items-center hover:text-tx-base focus:outline-none"
          >
            HISTORIQUE
          </Link>
          <button
            onClick={close}
            className="flex-1 h-12 rounded-xl bg-accent-primary text-brand-bg font-display font-black tracking-wider border-2 border-brand-border focus:outline-none"
          >
            C&apos;EST NOTÉ
          </button>
        </div>
      </div>
    </div>
  );
}
