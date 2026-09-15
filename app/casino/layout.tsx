import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import CelebrationLayer from './_components/CelebrationLayer';
import CasinoSkin from './_components/CasinoSkin';
import SyndicateLock from './_components/SyndicateLock';
import GiftWatcher from './_components/GiftWatcher';
import PushPrompt from './_components/PushPrompt';
import CasinoTabBar from './_components/CasinoTabBar';
import SignInPrompt from '@/components/SignInPrompt';
import PatchNotesModal from '@/components/PatchNotesModal';

/**
 * Its own manifest, so "add to home screen" from the casino installs an app
 * that opens straight on the casino instead of on the hub.
 */
export const metadata: Metadata = {
  title: { default: 'Casino', template: '%s · Casino · IttolecHub' },
  description: 'Mise tes FrenlyCoins, une monnaie fictive, sur 20 mini-jeux avec pass, coffres, missions et cagnotte. Gratuit, sans argent réel.',
  manifest: '/manifest-casino.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Casino' },
  // The casino's own tab icon, like its home-screen app.
  icons: {
    icon: [{ url: '/api/pwa-icon/casino?size=192&v=2', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/api/pwa-icon/casino?size=180&v=2', sizes: '180x180', type: 'image/png' }],
  },
};

/** Mounted once so any casino page can fire a celebration without wiring. */
export default function CasinoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CasinoSkin />
      {children}
      <CasinoTabBar />
      <SignInPrompt />
      <SyndicateLock />
      <GiftWatcher />
      <PushPrompt />
      <PatchNotesModal area="casino" />
      <CelebrationLayer />
    </>
  );
}
