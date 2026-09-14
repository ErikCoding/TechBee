import type { Metadata } from 'next'
import { siteConfig } from '@/config/site'

export const siteUrl = new URL(siteConfig.url)

export const defaultSeoDescription =
  'Runbee łączy uczniów ze zweryfikowanymi nauczycielami na indywidualne lekcje online z różnych dziedzin, w tym matematyki, chemii, fizyki, polskiego, angielskiego i programowania.'

export const seoKeywords = [
  'korepetycje online',
  'lekcje online',
  'korepetycje z polskiego',
  'korepetycje z angielskiego',
  'korepetycje z matematyki',
  'korepetycje z chemii',
  'korepetycje z fizyki',
  'korepetycje z informatyki',
  'nauka programowania online',
  'nauczyciel online',
  'indywidualne lekcje online',
  'zweryfikowani nauczyciele online',
]

export const publicSeoRoutes = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/marketplace', priority: 0.95, changeFrequency: 'daily' },
  { path: '/teach', priority: 0.85, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.35, changeFrequency: 'yearly' },
  { path: '/privacy', priority: 0.35, changeFrequency: 'yearly' },
  { path: '/cookies', priority: 0.3, changeFrequency: 'yearly' },
] as const

export const privateSeoPaths = [
  '/admin',
  '/api',
  '/beepoints',
  '/chat',
  '/dashboard',
  '/lesson',
  '/login',
  '/payment',
  '/register',
  '/reports',
  '/wallet',
] as const

export function absoluteUrl(path = '/'): string {
  return new URL(path, siteUrl).toString()
}

export function noIndexMetadata(title?: string): Metadata {
  return {
    ...(title ? { title } : {}),
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  }
}

export function pageMetadata({
  title,
  description,
  path,
  image = '/icon.svg',
}: {
  title: string
  description: string
  path: string
  image?: string
}): Metadata {
  const url = absoluteUrl(path)

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: 'website',
      images: [
        {
          url: image,
          alt: siteConfig.name,
        },
      ],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [image],
    },
  }
}
