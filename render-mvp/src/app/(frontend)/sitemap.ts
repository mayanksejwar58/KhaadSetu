import type { MetadataRoute } from 'next'

const siteUrl = 'https://khadsetu-mvp.onrender.com'

// Only the public landing page is indexed. Workspaces and APIs are private operational surfaces.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
