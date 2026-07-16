/**
 * Booking authentication rules.
 * A customer must always have a valid Supabase session before a booking is created.
 */

export type BookingAuthUser = {
  id: string
  email?: string | null
}

export type BookingAuthGate = 'wait' | 'account_step' | 'ready'

/** UI gate: never skip account/sign-in while auth is still loading. */
export function resolveBookingAuthGate(opts: {
  userLoading: boolean
  currentUser: BookingAuthUser | null
}): BookingAuthGate {
  if (opts.currentUser?.id) return 'ready'
  if (opts.userLoading) return 'wait'
  return 'account_step'
}

export function shouldShowAccountStep(opts: {
  userLoading: boolean
  currentUser: BookingAuthUser | null
}): boolean {
  return resolveBookingAuthGate(opts) === 'account_step'
}

export function canSubmitBookingRequest(opts: {
  userLoading: boolean
  currentUser: BookingAuthUser | null
}): { ok: true } | { ok: false; reason: 'auth_loading' | 'unauthenticated' } {
  const gate = resolveBookingAuthGate(opts)
  if (gate === 'ready') return { ok: true }
  if (gate === 'wait') return { ok: false, reason: 'auth_loading' }
  return { ok: false, reason: 'unauthenticated' }
}

/**
 * Server-side session check for POST /api/bookings.
 * Returns normalized email + user id, or an unauthorized payload.
 */
export function requireBookingSession(sessionUser: BookingAuthUser | null):
  | { ok: true; userId: string; email: string }
  | { ok: false; status: 401; error: 'unauthorized'; message: string } {
  const email = (sessionUser?.email || '').toLowerCase().trim()
  if (!sessionUser?.id || !email) {
    return {
      ok: false,
      status: 401,
      error: 'unauthorized',
      message: 'Vous devez être connecté pour envoyer une demande de réservation.',
    }
  }
  return { ok: true, userId: sessionUser.id, email }
}
