import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * Its own manifest, so "add to home screen" from the clicker installs an app
 * that opens straight on the clicker instead of on the hub.
 */
export const metadata: Metadata = {
  manifest: '/manifest-clicker.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Clicker' },
  icons: { apple: [{ url: '/api/pwa-icon/clicker?size=180', sizes: '180x180', type: 'image/png' }] },
};

export default function ClickerLayout({ children }: { children: ReactNode }) {
  return children;
}
