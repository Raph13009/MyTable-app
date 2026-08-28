import type { SupabaseClient } from '@supabase/supabase-js'
import {
  dispatchFallbackToAllBackupChefs,
  fetchExpiredPrimaryExclusiveWindowBookings,
  shouldNotifyClientOfFallbackExhaustion,
  type FallbackDispatchResult,
} from '@/lib/fallbackBookings'
import { sendBookingRefusedClientEmail } from '@/lib/sendBookingRefusedClientEmail'
import { getBaseUrl } from '@/lib/utils'

type AdminClient = SupabaseClient

export type ProcessExpiredPrimaryWindowsResult = {
  processed: number
  expired: number
  forwarded: number
  notified: number
}

type ProcessExpiredPrimaryWindowsOptions = {
  now?: Date
  baseUrl?: string
  fetchExpired?: typeof fetchExpiredPrimaryExclusiveWindowBookings
  dispatchFallback?: typeof dispatchFallbackToAllBackupChefs
  shouldNotifyClient?: typeof shouldNotifyClientOfFallbackExhaustion
  notifyClient?: typeof sendBookingRefusedClientEmail
}

/**
 * Expire primary bookings whose 3h exclusive window has elapsed.
 * If the client selected replacement chefs, broadcast to them.
 * Otherwise (or if none could be contacted), always email the client
 * nearby-chef suggestions.
 */
export async function processExpiredPrimaryExclusiveWindows(
  supabase: AdminClient,
  options?: ProcessExpiredPrimaryWindowsOptions
): Promise<ProcessExpiredPrimaryWindowsResult> {
  const now = options?.now ?? new Date()
  const baseUrl = options?.baseUrl ?? getBaseUrl()
  const fetchExpired = options?.fetchExpired ?? fetchExpiredPrimaryExclusiveWindowBookings
  const dispatchFallback = options?.dispatchFallback ?? dispatchFallbackToAllBackupChefs
  const shouldNotifyClient = options?.shouldNotifyClient ?? shouldNotifyClientOfFallbackExhaustion
  const notifyClient = options?.notifyClient ?? sendBookingRefusedClientEmail

  const timedOutBookings = await fetchExpired(supabase as any, now)

  const result: ProcessExpiredPrimaryWindowsResult = {
    processed: timedOutBookings.length,
    expired: 0,
    forwarded: 0,
    notified: 0,
  }

  for (const booking of timedOutBookings) {
    const { data: lockedRow } = await (supabase.from('booking_requests') as any)
      .update({ status: 'expired' })
      .eq('id', booking.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    if (!lockedRow?.id) {
      continue
    }

    result.expired += 1

    await (supabase.from('decision_tokens') as any)
      .update({ used: true })
      .eq('booking_request_id', booking.id)
      .eq('used', false)

    const fallbackResults: FallbackDispatchResult[] = await dispatchFallback(
      supabase as any,
      booking,
      'timeout'
    )

    if (fallbackResults.length > 0) {
      result.forwarded += fallbackResults.length
      continue
    }

    const shouldNotify = await shouldNotifyClient(supabase as any, booking)
    if (!shouldNotify) {
      continue
    }

    const { data: chef } = await supabase
      .from('chefs')
      .select('name')
      .eq('id', booking.chef_id)
      .single()

    const chefFirstName = chef
      ? ((chef as any).name?.split(' ')[0] || (chef as any).name)
      : 'Chef'

    try {
      await notifyClient(supabase as any, booking, chefFirstName, baseUrl)
      result.notified += 1
    } catch (emailError) {
      console.error('[check-fallback-bookings] Error sending client email:', emailError)
    }
  }

  return result
}
