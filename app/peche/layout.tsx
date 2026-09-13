import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import PatchNotesModal from '@/components/PatchNotesModal';

/**
 * Its own manifest, so "add to home screen" from Pêche installs an app
 * that opens straight on the game instead of on the hub.
 */
export const metadata: Metadata = {
  title: 'Pêche — IttolecHub',
  manifest: '/manifest-peche.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Pêche' },
  icons: { apple: [{ url: '/api/pwa-icon/peche?size=180&v=2', sizes: '180x180', type: 'image/png' }] },
};

export default function PecheLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PatchNotesModal area="peche" />
    </>
  );
}
