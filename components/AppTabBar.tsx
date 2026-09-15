'use client';

import { useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { vibrate, HAPTIC } from '@/lib/haptic';

export interface TabBarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  badge?: number;
  onSelect: () => void;
}

/**
 * The bottom tab bar of the solo games on phones and tablets, like a game app.
 * From lg the desktop layout keeps its own navigation and the bar is gone.
 *
 * While mounted it sets `has-tabbar` on <html>, which gives `--app-tabbar` its
 * height below lg (globals.css): toasts and floating tickers read it to stay
 * above the bar, and the spacer below keeps the end of the page reachable.
 */
export default function AppTabBar({ items, label }: { items: TabBarItem[]; label: string }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('has-tabbar');
    return () => root.classList.remove('has-tabbar');
  }, []);

  return (
    <>
      <div aria-hidden className="h-[var(--app-tabbar)]" />
      <nav
        aria-label={label}
        className="lg:hidden fixed inset-x-0 bottom-0 z-[150] select-none rounded-t-[22px] border-t-4 border-x-4 border-brand-border bg-brand-card shadow-[0_-4px_0_rgba(5,6,26,0.35)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto max-w-xl grid h-[72px]" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { vibrate(HAPTIC.SOFT); item.onSelect(); }}
              aria-current={item.active ? 'page' : undefined}
              className="group relative flex flex-col items-center justify-center gap-1 touch-manipulation focus:outline-none"
            >
              <span
                className={cn(
                  'relative h-9 w-12 rounded-xl border-[3px] flex items-center justify-center transition-all duration-150',
                  item.active
                    ? 'border-brand-border bg-accent-primary text-brand-bg shadow-[inset_0_-4px_0_#D98E00,0_3px_0_#05061A] -translate-y-0.5'
                    : 'border-transparent text-tx-secondary group-active:translate-y-[2px]'
                )}
              >
                <item.icon className="h-5 w-5" strokeWidth={2.5} />
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-accent-secondary border-2 border-brand-border text-white font-display text-[11px] leading-none flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <span className={cn('font-display text-[11px] leading-none truncate max-w-full px-0.5', item.active ? 'text-accent-primary' : 'text-tx-secondary')}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
