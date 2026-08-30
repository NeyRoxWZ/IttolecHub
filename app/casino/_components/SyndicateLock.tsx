'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCasinoWallet } from '@/hooks/useCasinoWallet';

/**
 * While a run is on, the cagnotte page is the only page.
 *
 * The arena itself swallows the back button, but a reload, a bookmark or a
 * link from elsewhere would still drop a player into the ordinary casino —
 * where their balance is their own and the pot is nowhere to be seen. This
 * sends them back in.
 */
export default function SyndicateLock() {
  const { syndicate } = useCasinoWallet();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!syndicate) return;
    if (pathname === '/casino/cagnotte') return;
    router.replace('/casino/cagnotte');
  }, [syndicate, pathname, router]);

  return null;
}
