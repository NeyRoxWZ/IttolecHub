'use client';

import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import EventBanner from './EventBanner';
import ActiveEffectsBar from './ActiveEffectsBar';
import PushToggle from './PushToggle';
import type { MenuEntry } from './CasinoMenu';

/**
 * Everything that is not a game, stacked down the side.
 *
 * These groups used to sit above the grid as full-width bands and ate roughly
 * a third of the page, which squeezed twenty games into what was left.
 *
 * The rail is two columns rather than a list for the same reason it exists at
 * all: as one column it outgrew the viewport and started scrolling, and a
 * scrolling sidebar hides exactly the things it is there to keep in sight.
 * Everything now fits at once, which is the whole point — so keep new entries
 * compact, or the scrollbar comes back.
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

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] font-black uppercase tracking-widest text-tx-muted mb-1 px-0.5">
        {title}
      </div>
      {children}
    </div>
  );
}

function ClaimTile({ claim }: { claim: Claim }) {
  const { icon: Icon } = claim;
  return (
    <button
      onClick={claim.onClick}
      disabled={claim.busy || !claim.ready}
      title={claim.ready ? claim.readyHint : claim.waitLabel}
      className={cn(
        'h-[52px] px-2 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all focus:outline-none',
        claim.ready
          ? 'border-accent-success bg-accent-success text-brand-bg shadow-brutal hover:-translate-y-0.5'
          : 'border-brand-border bg-brand-card cursor-default'
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', !claim.ready && 'text-tx-muted')} />
      <div className={cn(
        'font-display font-black text-[10px] leading-none truncate w-full text-center',
        claim.ready ? 'text-brand-bg' : 'text-tx-secondary'
      )}>
        {claim.label}
      </div>
      <div className={cn(
        'text-[8px] font-bold leading-none truncate w-full text-center flex items-center justify-center gap-0.5',
        claim.ready ? 'text-brand-bg/70' : 'text-tx-muted'
      )}>
        {claim.busy
          ? '···'
          : claim.ready
            ? claim.readyHint
            : (<><Clock className="h-2 w-2 shrink-0" />{claim.waitLabel}</>)}
      </div>
    </button>
  );
}

function NavTile({ entry }: { entry: MenuEntry }) {
  const { icon: Icon } = entry;
  return (
    <button
      onClick={entry.onSelect}
      title={entry.hint}
      className={cn(
        'relative h-[46px] px-2 rounded-xl border-2 bg-brand-card flex items-center gap-1.5 text-left transition-all focus:outline-none',
        'hover:border-accent-primary hover:-translate-y-0.5',
        entry.pending ? 'border-accent-secondary' : 'border-brand-border'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-accent-primary" />
      <span className="font-display font-black text-[10px] leading-tight text-tx-base line-clamp-2">
        {entry.label}
      </span>
      {entry.pending ? (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-accent-secondary text-white text-[9px] font-black flex items-center justify-center">
          {entry.pending}
        </span>
      ) : null}
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
    <aside className={cn('w-[236px] shrink-0 space-y-2.5', className)}>
      <Group title="À récupérer">
        <div className="grid grid-cols-2 gap-1.5">
          {claims.map((c) => <ClaimTile key={c.label} claim={c} />)}
        </div>
      </Group>

      <Group title="Aller à">
        <div className="grid grid-cols-2 gap-1.5">
          {destinations.map((d) => <NavTile key={d.label} entry={d} />)}
        </div>
      </Group>

      <Group title="En ce moment">
        <div className="space-y-1.5">
          <EventBanner className="flex-col flex-nowrap items-stretch" />
          <ActiveEffectsBar />
          <PushToggle className="w-full justify-center" />
        </div>
      </Group>
    </aside>
  );
}
