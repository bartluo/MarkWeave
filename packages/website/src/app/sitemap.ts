import type { MetadataRoute } from 'next'

const SITE = 'https://markweave.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: SITE + '/',
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 1
    },
    {
      url: SITE + '/download',
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9
    },
    {
      url: SITE + '/pricing',
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9
    },
    {
      url: SITE + '/privacy',
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4
    },
    {
      url: SITE + '/contact',
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6
    },
  ]
}
