import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import PatchNotesModal from '@/components/PatchNotesModal';

/**
 * Its own manifest, so "add to home screen" from Pêche installs an app
 * that opens straight on the game instead of on the hub.
 */
export const metadata: Metadata = {
  title: 'Pêche',
  description: 'Pêche des centaines d’espèces, améliore ton matériel, remplis ton Poissodex et enchaîne les Marées. Gratuit, en bêta.',
  manifest: '/manifest-peche.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Pêche' },
  // Pêche's own tab icon, like its home-screen app.
  icons: {
    icon: [{ url: '/api/pwa-icon/peche?size=192&v=2', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/api/pwa-icon/peche?size=180&v=2', sizes: '180x180', type: 'image/png' }],
  },
};

export default function PecheLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PatchNotesModal area="peche" />
    </>
  );
}
