import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ToasterProvider } from '@/components/ToasterProvider'
import { AuthProvider } from '@/hooks/useAuth'

export const metadata: Metadata = {
  title: 'ItollecHub - Mini-jeux multijoueurs',
  description: 'Plateforme de mini-jeux Guessr multijoueurs basés sur des APIs publiques',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ItollecHub',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#6366f1',
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
