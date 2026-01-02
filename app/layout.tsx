import type { Metadata } from 'next'
import './globals.css'
import LocaleProvider from '@/components/LocaleProvider'

export const metadata: Metadata = {
  title: 'MyTable - Chat + Booking',
  description: 'Plateforme de réservation et chat avec les chefs',
  icons: {
    icon: '/logo-cercle.ico',
    shortcut: '/logo-cercle.ico',
    apple: '/logo-cercle.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Default to French, but will be overridden by client-side detection
  return (
    <html lang="fr">
      <body>
        <LocaleProvider />
        {children}
      </body>
    </html>
  )
}

