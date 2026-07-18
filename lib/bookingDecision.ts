import type { SupabaseClient } from '@supabase/supabase-js'
import {
  dispatchFallbackToAllBackupChefs,
  handleFallbackGroupAfterAccept,
  isFallbackGroupAcceptSlotsFull,
  shouldNotifyClientOfFallbackExhaustion,
} from '@/lib/fallbackBookings'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import { sendBookingRefusedClientEmail } from '@/lib/sendBookingRefusedClientEmail'
import { getBaseUrl } from '@/lib/utils'

type AdminClient = SupabaseClient

export type BookingDecisionAction = 'accept' | 'refuse'

export type BookingDecisionResult =
  | { ok: true; status: 'accepted' | 'refused'; conversationId?: string }
  | { ok: false; code: 'not_found' | 'not_pending' | 'already_handled'; message: string }

export async function processBookingDecision(
  supabase: AdminClient,
  bookingRequestId: string,
  action: BookingDecisionAction
): Promise<BookingDecisionResult> {
  const { data: bookingRequest, error } = await supabase
    .from('booking_requests')
    .select('*')
    .eq('id', bookingRequestId)
    .maybeSingle()

  if (error || !bookingRequest) {
    return { ok: false, code: 'not_found', message: 'Demande introuvable' }
  }

  const currentStatus = (bookingRequest as any).status as string
  if (currentStatus !== 'pending') {
    if (action === 'accept' && currentStatus === 'accepted') {
      return {
        ok: true,
        status: 'accepted',
        conversationId: (bookingRequest as any).conversation_id,
      }
    }
    if (action === 'refuse' && currentStatus === 'refused') {
      return {
        ok: true,
        status: 'refused',
        conversationId: (bookingRequest as any).conversation_id,
      }
    }
    return {
      ok: false,
      code: 'not_pending',
      message: 'Cette demande a déjà été traitée.',
    }
  }

  await (supabase.from('decision_tokens') as any)
    .update({ used: true })
    .eq('booking_request_id', bookingRequestId)
    .eq('used', false)

  const baseUrl = getBaseUrl()
  const booking = bookingRequest as any

  if (action === 'refuse') {
    const { data: refusedBooking } = await (supabase.from('booking_requests') as any)
      .update({ status: 'refused' })
      .eq('status', 'pending')
      .eq('id', bookingRequestId)
      .select('conversation_id')
      .maybeSingle()

    if (!refusedBooking?.id) {
      return {
        ok: false,
        code: 'already_handled',
        message: 'Cette demande a déjà été traitée ou attribuée à un autre chef.',
      }
    }

    let fallbackDispatched = false
    if (booking.fallback_enabled) {
      const fallbackResults = await dispatchFallbackToAllBackupChefs(supabase, booking, 'refused')
      fallbackDispatched = fallbackResults.length > 0
    }

    const { data: chef } = await supabase
      .from('chefs')
      .select('name')
      .eq('id', booking.chef_id)
      .single()

    const chefFirstName = chef ? ((chef as any).name?.split(' ')[0] || (chef as any).name) : 'Chef'

    if (!fallbackDispatched) {
      const shouldNotify = await shouldNotifyClientOfFallbackExhaustion(supabase, booking)
      if (shouldNotify) {
        try {
          await sendBookingRefusedClientEmail(supabase, booking, chefFirstName, baseUrl)
        } catch (emailError) {
          console.error('[bookingDecision] Error sending refuse email to client:', emailError)
        }
      }
    }

    return {
      ok: true,
      status: 'refused',
      conversationId: refusedBooking.conversation_id,
    }
  }

  // Backup broadcast phase: reject accept if two candidates already locked in.
  const fallbackGroupId = booking.fallback_group_id || booking.id
  if (booking.fallback_previous_booking_id && fallbackGroupId) {
    const slotsFull = await isFallbackGroupAcceptSlotsFull(supabase, fallbackGroupId)
    if (slotsFull) {
      return {
        ok: false,
        code: 'already_handled',
        message: 'La mission a déjà été attribuée à un autre chef.',
      }
    }
  }

  const { data: updatedBooking } = await (supabase.from('booking_requests') as any)
    .update({ status: 'accepted' })
    .eq('status', 'pending')
    .eq('id', bookingRequestId)
    .select('conversation_id')
    .maybeSingle()

  if (!updatedBooking) {
    return {
      ok: false,
      code: 'already_handled',
      message: 'La mission a déjà été attribuée à un autre chef.',
    }
  }

  if (fallbackGroupId) {
    await handleFallbackGroupAfterAccept(supabase, booking, bookingRequestId)
  }

  const conversationId = updatedBooking.conversation_id
  const chatUrl = conversationId ? `${baseUrl}/chat/${conversationId}` : baseUrl

  const { data: chef } = await supabase
    .from('chefs')
    .select('email, name')
    .eq('id', booking.chef_id)
    .single()

  const chefFullName = chef ? (chef as any).name : 'Chef'
  const chefNameParts = chefFullName.split(' ')
  const chefFirstName = chefNameParts[0] || chefFullName
  const chefLastName = chefNameParts.slice(1).join(' ') || ''

  try {
    await sendEmail({
      to: booking.email,
      subject: emailSubjects.bookingAcceptedToClient,
      html: emailTemplates.bookingAcceptedToClient(
        `${booking.first_name} ${booking.last_name}`,
        chefFirstName,
        chefLastName,
        chatUrl,
        baseUrl
      ),
    })
  } catch (emailError) {
    console.error('[bookingDecision] Error sending accept email to client:', emailError)
  }

  return { ok: true, status: 'accepted', conversationId }
}
