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

/** GA4 web stream used by booking funnel tags (G-CB834F9YGR). */
const GA4_MEASUREMENT_ID = 'G-CB834F9YGR'

/**
 * Also send via gtag so GA4 receives event params reliably.
 * (GTM GA4 Event tags were resolving DLV/CJS params to boolean false.)
 * Uses send_to so the hit goes to GA4 even without a dedicated config tag.
 */
function sendGtagEvent(payload: DataLayerEvent): void {
  if (typeof window.gtag !== 'function') return
  const { event, ...rest } = payload
  if (!event) return
  const params: Record<string, unknown> = { send_to: GA4_MEASUREMENT_ID }
  for (const [k, v] of Object.entries(rest)) {
    if (v === undefined || v === null) continue
    // GA4 Explore step filters expect text; stringify primitives.
    params[k] = typeof v === 'number' || typeof v === 'boolean' ? String(v) : v
  }
  window.gtag('event', event, params)
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
  sendGtagEvent(payload)
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
