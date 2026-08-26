import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ToasterProvider } from '@/components/ToasterProvider'
import { AuthProvider } from '@/hooks/useAuth'

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
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
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
  themeColor: '#13131A',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',t!=='light');})();`,
          }}
        />
      </head>
      <body className="bg-brand-bg text-tx-base font-body antialiased">
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
