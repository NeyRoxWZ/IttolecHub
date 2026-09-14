import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ToasterProvider } from '@/components/ToasterProvider'
import { AuthProvider } from '@/hooks/useAuth'
import EzoicRouteHandler from '@/components/EzoicRouteHandler'

export const metadata: Metadata = {
  title: 'IttolecHub',
  description: 'Casino FrenlyCoins et mini-jeux multijoueurs.',
  manifest: '/manifest.json',
  applicationName: 'IttolecHub',
  appleWebApp: {
    capable: true,
    // The app paints its own dark background behind the status bar.
    statusBarStyle: 'black-translucent',
    title: 'IttolecHub',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32x32.png?v=2', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png?v=2', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png?v=2', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png?v=2', sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: { telephone: false },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Lets the page draw under the notch and the home indicator; the safe-area
  // insets in globals.css keep the content clear of them.
  viewportFit: 'cover' as const,
  themeColor: '#161A45',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Ezoic: consent first (never delayed), then the ads and analytics scripts. */}
        {/* Plain tags, so they are in the HTML Ezoic reads; data-cfasync before src keeps Cloudflare from reordering them. */}
        {/* Ezoic requires the consent scripts to load synchronously, before the ads script. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script data-cfasync="false" src="https://cmp.gatekeeperconsent.com/min.js" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script data-cfasync="false" src="https://the.gatekeeperconsent.com/cmp.min.js" />
        {/* defer, not async: React hoists async scripts above everything, ahead of the consent scripts. */}
        <script defer src="//www.ezojs.com/ezoic/sa.min.js" />
        <script defer src="//ezoicanalytics.com/analytics.js" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',t!=='light');})();`,
          }}
        />
      </head>
      <body className="bg-brand-bg text-tx-base font-body antialiased">
        <EzoicRouteHandler />
        <AuthProvider>
          <ThemeProvider>
            {children}
            <ToasterProvider />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
