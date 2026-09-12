import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import PatchNotesModal from '@/components/PatchNotesModal';

export const metadata: Metadata = {
  title: 'Krash — IttolecHub',
  manifest: '/manifest-krash.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Krash' },
  icons: { apple: [{ url: '/api/pwa-icon/krash?size=180', sizes: '180x180', type: 'image/png' }] },
};

export default function KrashLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PatchNotesModal area="krash" />
    </>
  );
}
