/**
 * Typed, deduped window.dataLayer pushes for GTM / GA4.
 * Never include PII (names, emails, phones, free-text answers).
 */

export type DataLayerEvent = Record<string, unknown> & { event: string }

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[]
    gtag?: (...args: unknown[]) => void
  }
}

const DEDUPE_WINDOW_MS = 500
const recentPushes = new Map<string, number>()
const onceFlags = new Set<string>()

function pruneRecent(now: number) {
  for (const [key, ts] of recentPushes) {
    if (now - ts > DEDUPE_WINDOW_MS * 4) recentPushes.delete(key)
  }
}

/** Stable fingerprint without relying on key order quirks for primitives. */
function fingerprint(payload: DataLayerEvent): string {
  const keys = Object.keys(payload).sort()
  return keys.map((k) => `${k}:${JSON.stringify(payload[k])}`).join('|')
}

/**
 * Push to dataLayer. Skips identical payloads within a short window
 * (React Strict Mode remounts / double effects).
 */
export function pushDataLayer(payload: DataLayerEvent): boolean {
  if (typeof window === 'undefined') return false

  const now = Date.now()
  pruneRecent(now)
  const key = fingerprint(payload)
  const last = recentPushes.get(key)
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) {
    return false
  }
  recentPushes.set(key, now)

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(payload)
  return true
}

/** Fire at most once per browser tab session for a given flag. */
export function pushDataLayerOnce(flag: string, payload: DataLayerEvent): boolean {
  if (typeof window === 'undefined') return false
  if (onceFlags.has(flag)) return false
  const pushed = pushDataLayer(payload)
  if (pushed) onceFlags.add(flag)
  return pushed
}

/** Test helper — clears in-memory dedupe / once state. */
export function resetDataLayerDedupeForTests(): void {
  recentPushes.clear()
  onceFlags.clear()
}
