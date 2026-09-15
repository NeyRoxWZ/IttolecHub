'use client';

import { useEffect, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';

/** A sheet that slides up from the bottom: the "Plus" of the solo games' tab bar. */
export default function AppSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  // A sheet that stays open while the page scrolls underneath feels broken.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-[260] bg-[#05061A]/75 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 max-h-[86dvh] flex flex-col rounded-t-[28px] border-t-4 border-x-4 border-brand-border bg-brand-card animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-brand-border/80" />
        <div className="flex items-center justify-between px-4 pt-2 pb-3">
          <h2 className="font-display text-2xl leading-none">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="h-10 w-10 rounded-xl border-[3px] border-brand-border bg-[#2B3170] text-white shadow-[inset_0_-4px_0_#1A1F52,0_3px_0_#05061A] active:translate-y-[2px] flex items-center justify-center focus:outline-none">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

/** One destination in a sheet: a coloured icon tile over its name, like an app's home screen. */
export function SheetTile({ label, hint, icon: Icon, fill, shade, badge, active, onSelect }: {
  label: string; hint?: string; icon: LucideIcon; fill: string; shade: string; badge?: number; active?: boolean; onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => { vibrate(HAPTIC.SOFT); onSelect(); }}
      className={cn(
        'group flex flex-col items-center gap-1.5 rounded-2xl border-[3px] px-1 pt-3 pb-2 text-center touch-manipulation focus:outline-none',
        active ? 'border-accent-primary bg-brand-inner' : 'border-brand-border bg-brand-inner'
      )}
    >
      <span
        className="relative h-12 w-12 rounded-2xl border-[3px] border-brand-border flex items-center justify-center text-white transition-transform group-active:translate-y-[2px]"
        style={{ background: fill, boxShadow: `inset 0 -4px 0 ${shade}, 0 3px 0 #05061A` }}
      >
        <Icon className="h-6 w-6" strokeWidth={2.5} />
        {!!badge && badge > 0 && (
          <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-accent-secondary border-2 border-brand-border text-white font-display text-[11px] leading-none flex items-center justify-center">{badge}</span>
        )}
      </span>
      <span className="font-display text-[13px] leading-tight">{label}</span>
      {hint && <span className="text-[10px] font-bold leading-tight text-tx-muted line-clamp-2">{hint}</span>}
    </button>
  );
}
