'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, X, Target, Crown, Backpack, ShoppingBag, Award, Trophy, Radio, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { vibrate, HAPTIC } from '@/lib/haptic';

export interface MenuEntry {
  label: string;
  hint: string;
  icon: any;
  pending?: number;
  onSelect: () => void;
}

const ICONS = { Target, Crown, Backpack, ShoppingBag, Award, Trophy, Radio, Sparkles };

/**
 * On a phone the row of destination tiles wrapped into four ragged lines and
 * pushed the games off screen. They collapse into this sheet instead; the
 * three claimable rewards stay in the open, because those are the ones with
 * something waiting.
 */
export default function CasinoMenu({ entries, pending }: { entries: MenuEntry[]; pending: number }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // A sheet that stays open while the page scrolls underneath feels broken.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => { sfx.click(); vibrate(HAPTIC.SOFT); setOpen(true); }}
        aria-label="Menu"
        className="relative sm:hidden h-11 w-11 shrink-0 rounded-xl border-2 border-brand-border bg-brand-inner flex items-center justify-center text-tx-secondary focus:outline-none"
      >
        <Menu className="h-5 w-5" />
        {pending > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-secondary text-white text-[10px] font-black flex items-center justify-center">
            {pending}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[260] bg-black/70 backdrop-blur-sm sm:hidden animate-in fade-in duration-150"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-[28px] border-t-4 border-x-4 border-brand-border bg-brand-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-black text-lg">Casino</h2>
              <button
                onClick={() => setOpen(false)}
                className="h-9 w-9 rounded-lg border-2 border-brand-border bg-brand-inner flex items-center justify-center focus:outline-none"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {entries.map((entry) => (
                <button
                  key={entry.label}
                  onClick={() => { setOpen(false); entry.onSelect(); }}
                  className={cn(
                    'relative h-16 px-3 rounded-xl border-2 flex items-center gap-2 text-left focus:outline-none',
                    entry.pending ? 'border-accent-secondary bg-brand-inner' : 'border-brand-border bg-brand-inner'
                  )}
                >
                  <entry.icon className="h-4 w-4 shrink-0 text-accent-primary" />
                  <div className="min-w-0 leading-tight">
                    <div className="font-display font-black text-[12px]">{entry.label}</div>
                    <div className={cn('text-[9px] font-bold truncate', entry.pending ? 'text-accent-secondary' : 'text-tx-muted')}>
                      {entry.pending ? `${entry.pending} à réclamer` : entry.hint}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => { setOpen(false); router.push('/?mode=solo'); }}
              className="mt-3 w-full h-12 rounded-xl border-2 border-brand-border bg-brand-inner font-display font-black text-xs tracking-wider text-tx-secondary focus:outline-none"
            >
              QUITTER LE CASINO
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export { ICONS };
