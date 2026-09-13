'use client';

import { useState } from 'react';
import { Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sfx } from '@/lib/casino/sfx';
import { useAuth } from '@/hooks/useAuth';
import { CountUp } from './CasinoUI';
import PlayerCard from './PlayerCard';

/**
 * The balance, and a way into your own curve.
 *
 * Clicking someone in the leaderboard already opened their card; clicking your
 * own money did nothing, which was the one place you'd expect it.
 */
export default function BalanceChip({
  balance, isLoaded, isLocal, className,
}: {
  balance: number;
  isLoaded: boolean;
  isLocal?: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && user && <PlayerCard pseudo={user.pseudo} onClose={() => setOpen(false)} />}

      <button
        onClick={() => { if (!user) return; sfx.click(); setOpen(true); }}
        disabled={!user}
        title={user ? 'Voir ta courbe' : undefined}
        className={cn(
          'h-12 flex items-center gap-2 bg-brand-bg border-[3px] border-brand-border pl-1.5 pr-3 sm:pr-4 rounded-2xl',
          user && 'hover:bg-[#1A1E4A] transition-colors focus:outline-none',
          className
        )}
      >
        <span className="h-8 w-8 rounded-full bg-accent-primary border-2 border-brand-border flex items-center justify-center shadow-[inset_0_-3px_0_#D98E00]">
          <Coins className="h-4 w-4 text-brand-bg" strokeWidth={2.5} />
        </span>
        {isLoaded
          ? <CountUp value={balance} className="font-display text-lg text-white" />
          : <span className="font-display text-lg">···</span>}
        <span className="text-tx-secondary font-black text-sm">₶</span>
        {isLocal && (
          <span
            className="text-[8px] font-black uppercase bg-brand-card border border-brand-border px-1 py-0.5 rounded text-tx-muted"
            title="Connecte-toi pour sauvegarder ton solde"
          >
            Local
          </span>
        )}
      </button>
    </>
  );
}
