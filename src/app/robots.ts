import { MetadataRoute } from 'next'
import { FRONTEND_URL } from '@/lib/env'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '*',
    },
    sitemap: `${FRONTEND_URL}/sitemap.xml`,
  }
}
