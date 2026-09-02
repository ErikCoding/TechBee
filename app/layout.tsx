import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Runbee — ucz się umiejętności technicznych od ekspertów z przemysłu',
    template: '%s | Runbee',
  },
  description:
    'Połącz się z certyfikowanymi specjalistami PLC, CNC, CAD i automatyki przemysłowej na indywidualne lekcje online. Praktyczne umiejętności, realni profesjonaliści, konkretne efekty.',
  keywords: ['programowanie PLC', 'obróbka CNC', 'projektowanie CAD', 'automatyka przemysłowa', 'korepetycje techniczne'],
  generator: 'Runbee',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4B400' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pl" className={`${inter.variable} bg-background`}>
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
