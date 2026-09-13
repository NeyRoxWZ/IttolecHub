'use client';

import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAWL, BRAWL_SWATCHES } from '@/lib/ui/brawl';
import EventBanner from './EventBanner';
import ActiveEffectsBar from './ActiveEffectsBar';
import PushToggle from './PushToggle';
import type { MenuEntry } from './CasinoMenu';

/**
 * Everything that is not a game, stacked down the side in panels.
 *
 * These groups used to sit above the grid as full-width bands and ate roughly
 * a third of the page, which squeezed twenty games into what was left. Keep
 * new entries compact, or the rail starts scrolling and hides exactly what it
 * is there to keep in sight.
 */

export interface Claim {
  label: string;
  icon: any;
  ready: boolean;
  readyHint: string;
  waitLabel: string;
  busy?: boolean;
  onClick: () => void;
}

export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={cn(BRAWL.panel, 'p-3')}>
      <div className="font-display text-lg leading-none mb-2.5">{title}</div>
      {children}
    </div>
  );
}

/** Green and raised when there is something to take; sunk and grey while it recharges. */
export function ClaimTile({ claim }: { claim: Claim }) {
  const { icon: Icon } = claim;
  return (
    <button
      onClick={claim.onClick}
      disabled={claim.busy || !claim.ready}
      title={claim.ready ? claim.readyHint : claim.waitLabel}
      className={cn(
        'h-[60px] px-1.5 rounded-xl border-[3px] border-brand-border flex flex-col items-center justify-center gap-0.5 transition-transform focus:outline-none',
        claim.ready
          ? 'bg-accent-success text-brand-bg shadow-[inset_0_-5px_0_#1E9A55,0_4px_0_#05061A] active:translate-y-[3px]'
          : 'bg-brand-inner text-tx-muted shadow-[inset_0_3px_0_#0B0E2A] cursor-default'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="font-display text-[13px] leading-none truncate w-full text-center">{claim.label}</div>
      <div className="text-[9px] font-black leading-none truncate w-full text-center flex items-center justify-center gap-0.5 opacity-80">
        {claim.busy
          ? '···'
          : claim.ready
            ? claim.readyHint
            : (<><Clock className="h-2.5 w-2.5 shrink-0" />{claim.waitLabel}</>)}
      </div>
    </button>
  );
}

/** A coloured icon with its label under it, and a red count when something waits. */
export function NavTile({ entry, index = 0 }: { entry: MenuEntry; index?: number }) {
  const { icon: Icon } = entry;
  const swatch = BRAWL_SWATCHES[index % BRAWL_SWATCHES.length];
  return (
    <button
      onClick={entry.onSelect}
      title={entry.hint}
      className="group flex flex-col items-center gap-1 text-center focus:outline-none"
    >
      <span
        className={cn(BRAWL.iconTile, 'h-11 w-11 text-white transition-transform group-hover:-translate-y-0.5 group-active:translate-y-[2px]')}
        style={{ background: swatch.fill, boxShadow: `inset 0 -4px 0 ${swatch.shade}, 0 3px 0 #05061A` }}
      >
        <Icon className="h-5 w-5" strokeWidth={2.5} />
        {entry.pending ? (
          <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full bg-accent-secondary border-2 border-brand-border text-white font-display text-[11px] flex items-center justify-center">
            {entry.pending}
          </span>
        ) : null}
      </span>
      <span className="text-[10px] font-black leading-tight text-tx-secondary group-hover:text-white line-clamp-2">
        {entry.label}
      </span>
    </button>
  );
}

export default function CasinoRail({
  claims, destinations, className,
}: {
  claims: Claim[];
  destinations: MenuEntry[];
  className?: string;
}) {
  return (
    <aside className={cn('w-[264px] shrink-0 space-y-3', className)}>
      <Group title="À récupérer">
        <div className="grid grid-cols-2 gap-2">
          {claims.map((c) => <ClaimTile key={c.label} claim={c} />)}
        </div>
      </Group>

      <Group title="Aller à">
        <div className="grid grid-cols-4 gap-x-1 gap-y-2.5">
          {destinations.map((d, i) => <NavTile key={d.label} entry={d} index={i} />)}
        </div>
      </Group>

      <Group title="En ce moment">
        <div className="space-y-2">
          <EventBanner className="flex-col flex-nowrap items-stretch" />
          <ActiveEffectsBar />
          <PushToggle className="w-full justify-center" />
        </div>
      </Group>
    </aside>
  );
}
