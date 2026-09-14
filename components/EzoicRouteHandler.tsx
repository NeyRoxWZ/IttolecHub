'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { adsAllowedOn, runEzoic } from '@/lib/ezoic';

/**
 * Pages change without a reload in the App Router, so Ezoic's placeholders
 * are cleared and requested again on every navigation. On pages without ads
 * (the casino) they are only cleared.
 */
export default function EzoicRouteHandler() {
  const pathname = usePathname();

  useEffect(() => {
    runEzoic(() => {
      window.ezstandalone?.destroyPlaceholders();
      if (!adsAllowedOn(pathname || '/')) return;
      requestAnimationFrame(() => {
        window.ezstandalone?.showAds();
      });
    });
  }, [pathname]);

  return null;
}
