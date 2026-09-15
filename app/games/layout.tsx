import type { Metadata } from 'next';

/** Every multiplayer game shares the multiplayer tab icon. */
export const metadata: Metadata = {
  icons: {
    icon: [{ url: '/api/pwa-icon/multi?size=192&v=1', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/api/pwa-icon/multi?size=180&v=1', sizes: '180x180', type: 'image/png' }],
  },
};

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
