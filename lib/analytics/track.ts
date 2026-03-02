/**
 * Event tracking utility - fire-and-forget, non-blocking, no re-renders.
 * Errors are silently ignored.
 */

const SESSION_KEY = 'mt_session_id'

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return ''
  }
}

export type EventType =
  | 'search'
  | 'profile_view'
  | 'message_sent'
  | 'booking_request'
  | 'signup'
  | 'login'

export interface TrackMetadata {
  chef_id?: string
  chef_slug?: string
  conversation_id?: string
  booking_request_id?: string
  search_query?: string
  search_label?: string
  source?: string
  [key: string]: unknown
}

/**
 * Track an analytics event. Fire-and-forget, never blocks or throws.
 * Call from event handlers only - avoid calling in render or effect to prevent re-renders.
 */
export function trackEvent(
  eventType: EventType,
  metadata?: TrackMetadata | null
): void {
  if (typeof window === 'undefined') return

  const payload = {
    event_type: eventType,
    page: window.location.pathname || undefined,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    session_id: getOrCreateSessionId(),
  }

  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})
}
