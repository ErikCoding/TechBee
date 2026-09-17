import type { MetadataRoute } from 'next'
import { absoluteUrl, privateSeoPaths, siteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/marketplace', '/marketplace/', '/teach', '/teach/', '/teacher/', '/teacher/*'],
        disallow: privateSeoPaths.flatMap((path) => [path, `${path}/`]),
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: siteUrl.origin,
  }
}
