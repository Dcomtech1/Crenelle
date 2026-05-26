import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crenelle.org'
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/signup', '/register'],
        disallow: ['/events/', '/settings/', '/scan/', '/admin/'],
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
