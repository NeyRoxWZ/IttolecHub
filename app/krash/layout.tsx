import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import PatchNotesModal from '@/components/PatchNotesModal';
import PushPrompt from '@/app/casino/_components/PushPrompt';

export const metadata: Metadata = {
  title: 'Krash — IttolecHub',
  manifest: '/manifest-krash.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Krash' },
  icons: { apple: [{ url: '/api/pwa-icon/krash?size=180', sizes: '180x180', type: 'image/png' }] },
};

/** What the notifications announce, as far as Krash is concerned. */
const KRASH_REASONS = [
  'Ton coffre Krash et tes nouvelles missions, chaque matin',
  'Le récap de la semaine, le lundi',
  'Le nouveau pass, chaque mois',
  'Les cadeaux que tes potes t’envoient au casino',
];

export default function KrashLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <PushPrompt reasons={KRASH_REASONS} />
      <PatchNotesModal area="krash" />
    </>
  );
}
