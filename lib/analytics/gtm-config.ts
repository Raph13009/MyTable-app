/**
 * Shared GTM container already used on https://guidemytable.fr (WordPress / GTM4WP).
 * Set NEXT_PUBLIC_GTM_ID="" to disable injection on the Next.js app.
 */
export const DEFAULT_GTM_CONTAINER_ID = 'GTM-W6XLJMD5'

export function resolveGtmId(): string | null {
  const raw = process.env.NEXT_PUBLIC_GTM_ID
  if (raw === '') return null
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  return DEFAULT_GTM_CONTAINER_ID
}
