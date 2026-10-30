import type { MetadataRoute } from 'next'

const siteUrl = 'https://khadsetu-mvp.onrender.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/farmer',
        '/operator',
        '/console',
        '/forecast',
        '/model-b',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
