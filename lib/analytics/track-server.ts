/**
 * Server-side event tracking. Fire-and-forget, never blocks.
 * Use only in server contexts (API routes, server components, route handlers).
 */
import { createAdminClient } from '@/lib/supabase/admin'

const NEW_USER_THRESHOLD_SEC = 300 // 5 min: created_at within this = signup

export async function trackEventServer(payload: {
  event_type: string
  user_id?: string | null
  role?: string | null
  page?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('analytics_events').insert({
      user_id: payload.user_id ?? null,
      role: payload.role ?? null,
      event_type: payload.event_type,
      page: payload.page ?? null,
      metadata: payload.metadata ?? {},
    })
  } catch {
    // silent
  }
}

/**
 * Track auth success: signup (new user) or login (returning user).
 */
export function trackAuthSuccess(user: { id: string; created_at?: string }): void {
  const nowSec = Date.now() / 1000
  const createdAt = user.created_at ? new Date(user.created_at).getTime() / 1000 : 0
  const isNewUser = nowSec - createdAt < NEW_USER_THRESHOLD_SEC
  const eventType = isNewUser ? 'signup' : 'login'

  trackEventServer({
    event_type: eventType,
    user_id: user.id,
    metadata: { is_new_user: isNewUser },
  })
}
