import { MetadataRoute } from 'next'
import { FRONTEND_URL } from '@/lib/env'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    {
      url: FRONTEND_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ]
}
