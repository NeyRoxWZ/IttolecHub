import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import CelebrationLayer from './_components/CelebrationLayer';
import CasinoSkin from './_components/CasinoSkin';
import SyndicateLock from './_components/SyndicateLock';
import GiftWatcher from './_components/GiftWatcher';
import PushPrompt from './_components/PushPrompt';
import PatchNotesModal from '@/components/PatchNotesModal';

/**
 * Its own manifest, so "add to home screen" from the casino installs an app
 * that opens straight on the casino instead of on the hub.
 */
export const metadata: Metadata = {
  manifest: '/manifest-casino.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Casino' },
  icons: { apple: [{ url: '/api/pwa-icon/casino?size=180&v=2', sizes: '180x180', type: 'image/png' }] },
};

/** Mounted once so any casino page can fire a celebration without wiring. */
export default function CasinoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CasinoSkin />
      {children}
      <SyndicateLock />
      <GiftWatcher />
      <PushPrompt />
      <PatchNotesModal area="casino" />
      <CelebrationLayer />
    </>
  );
}
