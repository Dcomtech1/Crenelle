/**
 * Scales and optimizes event banner image URLs dynamically.
 * Resolves project Supabase Storage URLs to edge-based transform URLs
 * and appends size/compression params to Unsplash and other recognized CDN links.
 */
export function getOptimizedBannerUrl(
  url: string | null | undefined,
  type: 'email' | 'web'
): string {
  if (!url) return ''

  // 1. Handle Supabase Storage bucket URLs
  // Standard Supabase URL: https://[project-ref].supabase.co/storage/v1/object/public/banners/[filename]
  // Transform URL: https://[project-ref].supabase.co/storage/v1/render/image/public/banners/[filename]
  if (url.includes('/storage/v1/object/public/banners/')) {
    const transformUrl = url.replace('/storage/v1/object/public/banners/', '/storage/v1/render/image/public/banners/')
    
    if (type === 'email') {
      // 600px width, contain ratio, 75% quality compression
      return `${transformUrl}?width=600&resize=contain&quality=75`
    } else {
      // 1200px width, 80% quality compression for high-res web displays
      return `${transformUrl}?width=1200&quality=80`
    }
  }

  // 2. Handle Unsplash URLs (very common pasted URLs)
  // Standard format: https://images.unsplash.com/photo-xxx?auto=format&fit=crop&w=xxx&q=xxx
  if (url.includes('images.unsplash.com/')) {
    const baseUrl = url.split('?')[0]
    
    if (type === 'email') {
      return `${baseUrl}?auto=format&fit=crop&w=600&q=75`
    } else {
      return `${baseUrl}?auto=format&fit=crop&w=1200&q=80`
    }
  }

  // 3. Fallback for other arbitrary URLs
  return url
}
