'use client';

import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAWL } from '@/lib/ui/brawl';
import { fmtBig } from '@/lib/peche/format';

/** Monday's recap of last week, shown once. */
export default function WeekRecap({ recap, onClose }: { recap: { week: string; points: number; caught: number }; onClose: () => void }) {
  const from = new Date(`${recap.week}T00:00:00Z`);
  const label = from.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  return (
    <div className="fixed inset-0 z-[270] bg-[#05061A]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-brand-card border-4 border-brand-border rounded-[22px] p-6 text-center shadow-[0_8px_0_#05061A] animate-in zoom-in-95 duration-200">
        <span className="mx-auto mb-3 h-14 w-14 rounded-2xl border-[3px] border-brand-border bg-accent-info flex items-center justify-center shadow-[inset_0_-5px_0_#2F5BD0]">
          <CalendarDays className="h-7 w-7 text-white" />
        </span>
        <div className="font-display text-3xl leading-tight">Ta semaine de pêche</div>
        <p className="text-sm font-bold text-tx-secondary mt-1">Semaine du {label}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border-[3px] border-brand-border bg-brand-inner p-2">
            <div className="text-xs font-black text-tx-secondary">Poissons</div>
            <div className="font-display text-3xl">{fmtBig(recap.caught)}</div>
          </div>
          <div className="rounded-xl border-[3px] border-brand-border bg-brand-inner p-2">
            <div className="text-xs font-black text-tx-secondary">Points</div>
            <div className="font-display text-3xl">{fmtBig(recap.points)}</div>
          </div>
        </div>
        <p className="mt-3 text-sm font-bold text-tx-secondary">Nouvelle semaine : les points, le monstre et les missions de la semaine repartent à zéro.</p>
        <button onClick={onClose} className={cn(BRAWL.yellow, 'mt-5 w-full h-14 text-xl')}>C’est reparti</button>
      </div>
    </div>
  );
}
