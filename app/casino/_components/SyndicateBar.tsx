'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * The reminder that the money on screen is not yours.
 *
 * During a group run every balance in the casino is the shared pot, which is
 * a big enough change that it cannot be left implicit — a player who forgets
 * would think they were betting their own coins. It follows them onto every
 * casino page and stays until the run is settled.
 */
export default function SyndicateBar() {
  const { syndicate, balance } = useCasinoWallet();
  const pathname = usePathname();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!syndicate) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [syndicate]);

  if (!syndicate) return null;

  const remaining = Math.max(0, Math.floor((new Date(syndicate.endsAt).getTime() - now) / 1000));
  const delta = syndicate.seedPot > 0 ? balance / syndicate.seedPot : 1;
  const up = delta >= 1;
  const onHub = pathname === '/casino/cagnotte';

  return (
    <div className="fixed inset-x-0 bottom-0 z-[200] px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 pointer-events-none">
      <div className={cn(
        'mx-auto max-w-3xl pointer-events-auto rounded-2xl border-4 shadow-brutal px-3 py-2',
        'flex items-center gap-3',
        up ? 'border-accent-success bg-brand-card' : 'border-accent-secondary bg-brand-card'
      )}>
        <Users className={cn('h-5 w-5 shrink-0', up ? 'text-accent-success' : 'text-accent-secondary')} />

        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-display font-black text-[13px] tabular-nums flex items-center gap-1.5">
            {fmt(balance)} ₶
            <span className={cn(
              'inline-flex items-center gap-0.5 text-[11px]',
              up ? 'text-accent-success' : 'text-accent-secondary'
            )}>
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              ×{delta.toFixed(2)}
            </span>
          </div>
          <div className="text-[10px] font-bold text-tx-muted truncate">
            Cagnotte du groupe · tu joues avec cet argent
          </div>
        </div>

        <div className="shrink-0 text-right leading-tight">
          <div className="font-display font-black text-sm tabular-nums">
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
          </div>
          <div className="text-[9px] font-bold text-tx-muted">restantes</div>
        </div>

        {!onHub && (
          <Link
            href="/casino/cagnotte"
            className="shrink-0 h-9 px-3 rounded-xl border-2 border-brand-border bg-brand-inner flex items-center font-display font-black text-[10px] tracking-wider text-tx-secondary hover:border-accent-primary focus:outline-none"
          >
            LE GROUPE
          </Link>
        )}
      </div>
    </div>
  );
}
