/**
 * Adds Supabase Storage image transformation params to reduce bandwidth and memory on mobile.
 * Uses /render/image/ endpoint when URL is from Supabase Storage.
 * @param square - When true, forces 1:1 output (width=height, resize=cover) for dish photos cropped in admin.
 */
export function getOptimizedSupabaseImageUrl(
  url: string | null,
  width: number = 400,
  quality: number = 70,
  square: boolean = false
): string | null {
  if (!url || typeof url !== 'string' || !url.trim()) return null
  if (!url.includes('supabase.co/storage')) return url
  if (url.includes('width=')) return url

  const renderUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  )
  const separator = renderUrl.includes('?') ? '&' : '?'
  if (square) {
    return `${renderUrl}${separator}width=${width}&height=${width}&resize=cover&quality=${quality}`
  }
  return `${renderUrl}${separator}width=${width}&quality=${quality}`
}
