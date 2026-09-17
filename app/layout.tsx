import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/lib/auth-context'
import { siteConfig } from '@/config/site'
import { absoluteUrl, defaultSeoDescription, seoKeywords, siteUrl } from '@/lib/seo'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: siteConfig.name,
  title: {
    default: 'Runbee — lekcje online ze zweryfikowanymi nauczycielami',
    template: `%s | ${siteConfig.name}`,
  },
  description: defaultSeoDescription,
  keywords: seoKeywords,
  authors: [{ name: siteConfig.legalName }],
  creator: siteConfig.legalName,
  publisher: siteConfig.legalName,
  category: 'education',
  generator: siteConfig.name,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Runbee — lekcje online ze zweryfikowanymi nauczycielami',
    description: defaultSeoDescription,
    url: absoluteUrl('/'),
    siteName: siteConfig.name,
    locale: siteConfig.locale,
    type: 'website',
    images: [
      {
        url: '/icon.svg',
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Runbee — lekcje online ze zweryfikowanymi nauczycielami',
    description: defaultSeoDescription,
    images: ['/icon.svg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
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
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteConfig.url}/#organization`,
        name: siteConfig.name,
        legalName: siteConfig.legalName,
        url: siteConfig.url,
        logo: absoluteUrl('/icon.svg'),
        sameAs: [siteConfig.url],
      },
      {
        '@type': 'WebSite',
        '@id': `${siteConfig.url}/#website`,
        url: siteConfig.url,
        name: siteConfig.name,
        inLanguage: siteConfig.locale,
        publisher: {
          '@id': `${siteConfig.url}/#organization`,
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${absoluteUrl('/marketplace')}?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }

  return (
    <html lang="pl" className={`${inter.variable} bg-background`}>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <AuthProvider>{children}</AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
