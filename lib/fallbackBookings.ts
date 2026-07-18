import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { generateDecisionToken, hashToken, getBaseUrl, sanitizeBookingNotes } from '@/lib/utils'
import { insertBookingNotesAsFirstMessage } from '@/lib/bookingConversation'
import { ensureConversationParticipants } from '@/lib/ensureParticipants'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import { getServiceTypeLabel } from '@/lib/i18n/constants'
import { formatDateForDisplay } from '@/lib/dateUtils'
import { notifyChefFallbackBookingWhatsApp } from '@/lib/whatsapp'

type AdminClient = SupabaseClient<Database>

/** Exclusive window for the primary chef before backups are contacted. */
export const FALLBACK_EXCLUSIVE_WINDOW_HOURS = 4
export const FALLBACK_EXCLUSIVE_WINDOW_MS = FALLBACK_EXCLUSIVE_WINDOW_HOURS * 60 * 60 * 1000

/** After broadcast, stop accepting once this many backup chefs have accepted. */
export const FALLBACK_MAX_ACCEPTED_CANDIDATES = 2

export type FallbackDispatchResult = { bookingId: string; chefId: string }

function getFallbackQueue(booking: any): string[] {
  return Array.isArray(booking?.fallback_next_chef_ids)
    ? booking.fallback_next_chef_ids.filter((id: unknown) => typeof id === 'string')
    : []
}

async function buildBookingDetailsForChefEmail(
  supabase: AdminClient,
  currentBooking: any
): Promise<any> {
  const mealOptions = currentBooking.meal_options
  let mealOptionsLabel: string | null = null
  if (mealOptions && typeof mealOptions === 'object' && !Array.isArray(mealOptions)) {
    const allOptions = Object.values(mealOptions).flat() as string[]
    mealOptionsLabel = [...new Set(allOptions)]
      .map((opt) => (opt === 'pdj' ? 'Petit-déjeuner' : opt === 'dejeuner' ? 'Déjeuner' : 'Dîner'))
      .join(', ')
  } else if (Array.isArray(mealOptions)) {
    mealOptionsLabel = mealOptions
      .map((opt) => (opt === 'pdj' ? 'Petit-déjeuner' : opt === 'dejeuner' ? 'Déjeuner' : 'Dîner'))
      .join(', ')
  }

  const bookingDetails: any = {
    firstName: currentBooking.first_name,
    lastName: currentBooking.last_name,
    phone: currentBooking.phone,
    serviceType: currentBooking.service_type,
    serviceTypeLabel: getServiceTypeLabel(currentBooking.service_type, 'fr'),
    city: currentBooking.city,
    postalCode: currentBooking.postal_code,
    guestsCount: currentBooking.guests_count,
    childrenCount: currentBooking.children_count || 0,
    hasAllergies: currentBooking.has_allergies || false,
    allergiesDetails: currentBooking.allergies_details || '',
    notes: currentBooking.notes || '',
    isDateFlexible: Boolean(currentBooking.is_date_flexible),
    alternativeDates: Array.isArray(currentBooking.alternative_dates)
      ? currentBooking.alternative_dates.map((d: string) => formatDateForDisplay(d, 'fr-FR'))
      : [],
  }

  let selectedMenuName: string | null = null
  let selectedMenuPrice: number | null = null
  if (currentBooking.menu_id) {
    const { data: menu } = await (supabase
      .from('menus') as any)
      .select('name, price')
      .eq('id', currentBooking.menu_id)
      .maybeSingle()

    if (menu) {
      selectedMenuName = menu.name || null
      selectedMenuPrice = menu.price !== null && menu.price !== undefined ? Number(menu.price) : null
    }
  }

  if (currentBooking.service_type === 'repas_domicile') {
    bookingDetails.bookingDate = currentBooking.booking_date
      ? formatDateForDisplay(currentBooking.booking_date, 'fr-FR')
      : null
    bookingDetails.mealTimeLabel = currentBooking.meal_time === 'dejeuner'
      ? 'Déjeuner'
      : currentBooking.meal_time === 'diner'
        ? 'Dîner'
        : null
    bookingDetails.menuName = selectedMenuName
    bookingDetails.menuPricePerPerson = selectedMenuPrice
    if (selectedMenuPrice && currentBooking.guests_count) {
      bookingDetails.estimatedTotalPrice = Number(selectedMenuPrice) * Number(currentBooking.guests_count)
    }
  } else if (currentBooking.service_type === 'cours_cuisine') {
    bookingDetails.bookingDate = currentBooking.booking_date
      ? formatDateForDisplay(currentBooking.booking_date, 'fr-FR')
      : null
    const pricePerPerson = currentBooking.budget ? Number(currentBooking.budget) : null
    bookingDetails.budgetPerPerson = pricePerPerson
    bookingDetails.estimatedTotalPrice = pricePerPerson
      ? pricePerPerson * Number(currentBooking.guests_count || 0)
      : null
    bookingDetails.courseTopic = currentBooking.course_topic || null
  } else if (currentBooking.service_type === 'mise_en_demeure') {
    bookingDetails.selectedDates = Array.isArray(currentBooking.selected_dates) ? currentBooking.selected_dates : null
    bookingDetails.mealOptionsLabel = mealOptionsLabel
    const pricePerDay = currentBooking.total_price ? Number(currentBooking.total_price) : null
    const daysCount = Array.isArray(currentBooking.selected_dates) ? currentBooking.selected_dates.length : 0
    bookingDetails.pricePerDay = pricePerDay
    bookingDetails.estimatedTotalPrice = pricePerDay
      ? pricePerDay * daysCount
      : null
  }

  return bookingDetails
}

async function createFallbackBookingForChef(
  supabase: AdminClient,
  currentBooking: any,
  chef: any,
  trigger: 'refused' | 'timeout',
  bookingDetails: any
): Promise<FallbackDispatchResult | null> {
  const now = new Date()

  const { data: conversation, error: conversationError } = await (supabase
    .from('conversations') as any)
    .insert({} as any)
    .select('id')
    .single()

  if (conversationError || !conversation?.id) {
    console.error('[fallback] Failed to create conversation:', conversationError?.message)
    return null
  }

  const bookingInsertPayload = {
    chef_id: chef.id,
    conversation_id: conversation.id,
    first_name: currentBooking.first_name,
    last_name: currentBooking.last_name,
    email: currentBooking.email,
    phone: currentBooking.phone,
    booking_date: currentBooking.booking_date,
    is_date_flexible: currentBooking.is_date_flexible || false,
    alternative_dates: Array.isArray(currentBooking.alternative_dates) ? currentBooking.alternative_dates : [],
    city: currentBooking.city,
    postal_code: currentBooking.postal_code,
    guests_count: currentBooking.guests_count,
    children_count: currentBooking.children_count || 0,
    has_allergies: currentBooking.has_allergies || false,
    allergies_details: currentBooking.allergies_details,
    menu_id: currentBooking.menu_id || null,
    notes: currentBooking.notes,
    service_type: currentBooking.service_type,
    period_days: currentBooking.period_days,
    meal_time: currentBooking.meal_time,
    budget: currentBooking.budget,
    course_topic: currentBooking.course_topic,
    selected_dates: currentBooking.selected_dates,
    meal_options: currentBooking.meal_options,
    total_price: currentBooking.total_price,
    is_price_custom: currentBooking.is_price_custom || false,
    menu_content: currentBooking.menu_content,
    status: 'pending',
    request_sent_at: now.toISOString(),
    fallback_enabled: true,
    // Broadcast phase: no further sequential queue; no exclusive timeout.
    fallback_next_chef_ids: [],
    fallback_group_id: currentBooking.fallback_group_id || currentBooking.id,
    fallback_timeout_at: null,
    fallback_previous_booking_id: currentBooking.id,
  }

  const { data: newBooking, error: bookingError } = await (supabase
    .from('booking_requests') as any)
    .insert(bookingInsertPayload as any)
    .select('*')
    .single()

  if (bookingError || !newBooking?.id) {
    console.error('[fallback] Failed to create booking:', bookingError?.message)
    return null
  }

  await (supabase
    .from('conversations') as any)
    .update({ booking_request_id: newBooking.id })
    .eq('id', conversation.id)

  const normalizedClientEmail = (currentBooking.email || '').toLowerCase().trim()
  const normalizedChefEmail = (chef.email || '').toLowerCase().trim()
  const sanitizedNotes = sanitizeBookingNotes(currentBooking.notes)

  const { error: participantsError } = await ensureConversationParticipants(supabase, [
    {
      conversation_id: conversation.id,
      email: normalizedClientEmail,
      role: 'client',
      user_id: null,
    },
    {
      conversation_id: conversation.id,
      email: normalizedChefEmail,
      role: 'chef',
      user_id: null,
    },
  ])

  if (participantsError) {
    throw new Error(`Impossible de créer les participants fallback: ${participantsError.message}`)
  }

  await insertBookingNotesAsFirstMessage(
    supabase,
    conversation.id,
    normalizedClientEmail,
    sanitizedNotes
  )

  const acceptToken = generateDecisionToken()
  const refuseToken = generateDecisionToken()
  const acceptTokenHash = await hashToken(acceptToken)
  const refuseTokenHash = await hashToken(refuseToken)

  const tokenExpiresAt = new Date()
  tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7)

  await (supabase.from('decision_tokens') as any).insert([
    {
      booking_request_id: newBooking.id,
      token_hash: acceptTokenHash,
      action: 'accept',
      expires_at: tokenExpiresAt.toISOString(),
    },
    {
      booking_request_id: newBooking.id,
      token_hash: refuseTokenHash,
      action: 'refuse',
      expires_at: tokenExpiresAt.toISOString(),
    },
  ])

  const baseUrl = getBaseUrl()
  const acceptUrl = `${baseUrl}/decision?token=${acceptToken}&action=accept`
  const refuseUrl = `${baseUrl}/decision?token=${refuseToken}&action=refuse`

  await sendEmail({
    to: chef.email,
    subject: emailSubjects.bookingReplacementRequestToChef,
    html: emailTemplates.bookingReplacementRequestToChef(
      chef.name,
      bookingDetails,
      acceptUrl,
      refuseUrl,
      baseUrl
    ),
  })

  try {
    await notifyChefFallbackBookingWhatsApp({
      supabase,
      chefPhone: chef.phone,
      chefName: chef.name,
      bookingDetails,
      bookingRequestId: newBooking.id,
      logContext: `[fallback:${trigger}]`,
    })
  } catch (whatsappError) {
    console.error('[fallback] WhatsApp notification error (booking unaffected):', whatsappError)
  }

  return { bookingId: newBooking.id, chefId: chef.id }
}

/**
 * After the primary chef refuses or their exclusive window expires,
 * send the request to ALL remaining backup chefs at the same time.
 */
export async function dispatchFallbackToAllBackupChefs(
  supabase: AdminClient,
  currentBooking: any,
  trigger: 'refused' | 'timeout'
): Promise<FallbackDispatchResult[]> {
  if (!currentBooking?.fallback_enabled) {
    return []
  }

  const queue = getFallbackQueue(currentBooking)
  if (queue.length === 0) {
    return []
  }

  const visibleChefs: any[] = []
  for (const candidateChefId of queue) {
    const { data: candidate } = await (supabase
      .from('chefs') as any)
      .select('id, name, email, phone, city, profile_picture, is_publicly_visible')
      .eq('id', candidateChefId)
      .single()

    if (candidate?.id && candidate.is_publicly_visible !== false) {
      visibleChefs.push(candidate)
    }
  }

  if (visibleChefs.length === 0) {
    return []
  }

  // Clear the queue on the source booking so retries don't re-broadcast.
  await (supabase
    .from('booking_requests') as any)
    .update({ fallback_next_chef_ids: [] })
    .eq('id', currentBooking.id)

  const bookingDetails = await buildBookingDetailsForChefEmail(supabase, currentBooking)
  const created: FallbackDispatchResult[] = []

  // Create all backup bookings in parallel so every chef is contacted at once.
  const results = await Promise.all(
    visibleChefs.map((chef) =>
      createFallbackBookingForChef(supabase, currentBooking, chef, trigger, bookingDetails)
    )
  )

  for (const result of results) {
    if (result) created.push(result)
  }

  console.log('[fallback] Broadcast to backup chefs', {
    trigger,
    sourceBookingId: currentBooking.id,
    requested: visibleChefs.length,
    created: created.length,
    chefIds: created.map((r) => r.chefId),
  })

  return created
}

export async function countAcceptedInFallbackGroup(
  supabase: AdminClient,
  fallbackGroupId: string
): Promise<number> {
  const { data: acceptedRows } = await supabase
    .from('booking_requests')
    .select('id')
    .eq('fallback_group_id', fallbackGroupId)
    .eq('status', 'accepted')

  return (acceptedRows || []).length
}

export async function isFallbackGroupAcceptSlotsFull(
  supabase: AdminClient,
  fallbackGroupId: string
): Promise<boolean> {
  const acceptedCount = await countAcceptedInFallbackGroup(supabase, fallbackGroupId)
  return acceptedCount >= FALLBACK_MAX_ACCEPTED_CANDIDATES
}

/**
 * Primary exclusive accept → lock immediately (expire all other pending).
 * Backup broadcast accept → lock only once FALLBACK_MAX_ACCEPTED_CANDIDATES have accepted.
 */
export async function handleFallbackGroupAfterAccept(
  supabase: AdminClient,
  booking: any,
  acceptedBookingId: string
): Promise<{ locked: boolean; acceptedCount: number }> {
  const fallbackGroupId = booking.fallback_group_id || booking.id
  if (!fallbackGroupId) {
    return { locked: false, acceptedCount: 1 }
  }

  const isPrimaryExclusive = !booking.fallback_previous_booking_id

  if (isPrimaryExclusive) {
    await expireOtherPendingInFallbackGroup(supabase, fallbackGroupId, acceptedBookingId)
    return { locked: true, acceptedCount: 1 }
  }

  const acceptedCount = await countAcceptedInFallbackGroup(supabase, fallbackGroupId)
  if (acceptedCount >= FALLBACK_MAX_ACCEPTED_CANDIDATES) {
    await expireOtherPendingInFallbackGroup(supabase, fallbackGroupId, acceptedBookingId)
    return { locked: true, acceptedCount }
  }

  return { locked: false, acceptedCount }
}

/**
 * After a refuse/timeout with no new dispatch: notify the client only if the
 * fallback group has no remaining pending bookings and no accepted candidates.
 */
export async function shouldNotifyClientOfFallbackExhaustion(
  supabase: AdminClient,
  booking: any
): Promise<boolean> {
  if (!booking?.fallback_enabled) {
    return true
  }

  const groupId = booking.fallback_group_id || booking.id
  if (!groupId) {
    return true
  }

  const { data: rows } = await supabase
    .from('booking_requests')
    .select('id, status')
    .eq('fallback_group_id', groupId)

  const group = rows || []
  const hasPending = group.some((row: any) => row.status === 'pending')
  const hasAccepted = group.some((row: any) => row.status === 'accepted')
  return !hasPending && !hasAccepted
}

export async function expireOtherPendingInFallbackGroup(
  supabase: AdminClient,
  fallbackGroupId: string,
  acceptedBookingId: string
): Promise<number> {
  const { data: pendingRows } = await supabase
    .from('booking_requests')
    .select('id')
    .eq('fallback_group_id', fallbackGroupId)
    .eq('status', 'pending')
    .neq('id', acceptedBookingId)

  const pendingIds = (pendingRows || []).map((row: any) => row.id)
  if (pendingIds.length === 0) {
    return 0
  }

  await (supabase
    .from('booking_requests') as any)
    .update({ status: 'expired' })
    .in('id', pendingIds)

  await (supabase
    .from('decision_tokens') as any)
    .update({ used: true })
    .in('booking_request_id', pendingIds)
    .eq('used', false)

  return pendingIds.length
}
