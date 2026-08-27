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
          'h-11 flex items-center gap-2 bg-brand-inner border-2 border-brand-border px-3 sm:px-4 rounded-xl shadow-brutal',
          user && 'hover:border-accent-primary transition-colors focus:outline-none',
          className
        )}
      >
        <Coins className="h-4 w-4 text-accent-primary" />
        {isLoaded
          ? <CountUp value={balance} className="font-display font-black text-base" />
          : <span className="font-display font-black">···</span>}
        <span className="text-tx-secondary font-bold text-sm">₶</span>
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
