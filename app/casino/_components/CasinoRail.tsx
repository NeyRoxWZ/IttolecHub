'use client';

import { Clock, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import EventBanner from './EventBanner';
import ActiveEffectsBar from './ActiveEffectsBar';
import PushToggle from './PushToggle';
import type { MenuEntry } from './CasinoMenu';

/**
 * Everything that is not a game, stacked down the side.
 *
 * These four groups used to sit above the grid as four full-width bands and
 * ate roughly a third of the page, which squeezed twenty games into what was
 * left. Vertical space is the scarce one here and horizontal space was going
 * spare, so they moved sideways: the grid gets the whole height back and the
 * rail scrolls on its own if the list outgrows the viewport.
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
      <div className="text-[9px] font-black uppercase tracking-widest text-tx-muted mb-1.5 px-0.5">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ClaimRow({ claim }: { claim: Claim }) {
  const { icon: Icon } = claim;
  return (
    <button
      onClick={claim.onClick}
      disabled={claim.busy || !claim.ready}
      className={cn(
        'w-full h-11 px-2.5 rounded-xl border-2 flex items-center gap-2 text-left transition-all focus:outline-none',
        claim.ready
          ? 'border-accent-success bg-accent-success text-brand-bg shadow-brutal hover:-translate-y-0.5'
          : 'border-brand-border bg-brand-card cursor-default'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', !claim.ready && 'text-tx-muted')} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className={cn(
          'font-display font-black text-[11px] truncate',
          claim.ready ? 'text-brand-bg' : 'text-tx-secondary'
        )}>
          {claim.label}
        </div>
        <div className={cn(
          'text-[9px] font-bold truncate flex items-center gap-1',
          claim.ready ? 'text-brand-bg/70' : 'text-tx-muted'
        )}>
          {claim.busy
            ? '···'
            : claim.ready
              ? claim.readyHint
              : (<><Clock className="h-2.5 w-2.5 shrink-0" />{claim.waitLabel}</>)}
        </div>
      </div>
    </button>
  );
}

function NavRow({ entry }: { entry: MenuEntry }) {
  const { icon: Icon } = entry;
  return (
    <button
      onClick={entry.onSelect}
      className={cn(
        'group relative w-full h-11 px-2.5 rounded-xl border-2 bg-brand-card flex items-center gap-2 text-left transition-all focus:outline-none',
        'hover:border-accent-primary hover:-translate-y-0.5',
        entry.pending ? 'border-accent-secondary' : 'border-brand-border'
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-accent-primary" />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="font-display font-black text-[11px] text-tx-base truncate">{entry.label}</div>
        <div className={cn(
          'text-[9px] font-bold truncate',
          entry.pending ? 'text-accent-secondary' : 'text-tx-muted'
        )}>
          {entry.pending ? `${entry.pending} à réclamer` : entry.hint}
        </div>
      </div>
      <ArrowUpRight className="h-3 w-3 shrink-0 text-tx-muted group-hover:text-accent-primary transition-colors" />
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
    <aside className={cn('w-[212px] shrink-0 overflow-y-auto pr-1 space-y-3.5', className)}>
      <Group title="À récupérer">
        {claims.map((c) => <ClaimRow key={c.label} claim={c} />)}
      </Group>

      <Group title="Aller à">
        {destinations.map((d) => <NavRow key={d.label} entry={d} />)}
      </Group>

      <Group title="En ce moment">
        <EventBanner className="flex-col flex-nowrap items-stretch" />
        <ActiveEffectsBar />
        <PushToggle className="w-full justify-center" />
      </Group>
    </aside>
  );
}
