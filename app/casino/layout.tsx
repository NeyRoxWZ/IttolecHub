import type { ReactNode } from 'react';
import CelebrationLayer from './_components/CelebrationLayer';
import CasinoSkin from './_components/CasinoSkin';
import SyndicateLock from './_components/SyndicateLock';
import GiftWatcher from './_components/GiftWatcher';

/** Mounted once so any casino page can fire a celebration without wiring. */
export default function CasinoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CasinoSkin />
      {children}
      <SyndicateLock />
      <GiftWatcher />
      <CelebrationLayer />
    </>
  );
}
