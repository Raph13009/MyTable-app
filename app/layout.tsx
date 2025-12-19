import type { Metadata } from 'next'
import './globals.css'

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
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}

