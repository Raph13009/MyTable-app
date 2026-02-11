import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { generateDecisionToken, hashToken, getBaseUrl } from '@/lib/utils'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import { getServiceTypeLabel } from '@/lib/i18n/constants'
import { formatDateForDisplay } from '@/lib/dateUtils'

type AdminClient = SupabaseClient<Database>

export async function createNextFallbackBooking(
  supabase: AdminClient,
  currentBooking: any,
  trigger: 'refused' | 'timeout'
): Promise<{ bookingId: string; chefId: string } | null> {
  if (!currentBooking?.fallback_enabled) {
    return null
  }

  const queue = Array.isArray(currentBooking.fallback_next_chef_ids)
    ? currentBooking.fallback_next_chef_ids.filter((id: unknown) => typeof id === 'string')
    : []

  if (queue.length === 0) {
    return null
  }

  let nextChef: any = null
  let remainingChefIds: string[] = []

  for (let index = 0; index < queue.length; index += 1) {
    const candidateChefId = queue[index]
    const { data: candidate } = await (supabase
      .from('chefs') as any)
      .select('id, name, email, city, profile_picture')
      .eq('id', candidateChefId)
      .single()

    if (candidate?.id) {
      nextChef = candidate
      remainingChefIds = queue.slice(index + 1)
      break
    }
  }

  if (!nextChef) {
    return null
  }

  const now = new Date()
  const timeoutAt = new Date(now.getTime() + 6 * 60 * 60 * 1000)

  const { data: conversation, error: conversationError } = await (supabase
    .from('conversations') as any)
    .insert({} as any)
    .select('id')
    .single()

  if (conversationError || !conversation?.id) {
    throw new Error(`Impossible de créer la conversation fallback: ${conversationError?.message || 'Unknown error'}`)
  }

  const bookingInsertPayload = {
    chef_id: nextChef.id,
    conversation_id: conversation.id,
    first_name: currentBooking.first_name,
    last_name: currentBooking.last_name,
    email: currentBooking.email,
    phone: currentBooking.phone,
    booking_date: currentBooking.booking_date,
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
    menu_content: currentBooking.menu_content,
    status: 'pending',
    request_sent_at: now.toISOString(),
    fallback_enabled: true,
    fallback_next_chef_ids: remainingChefIds,
    fallback_group_id: currentBooking.fallback_group_id || currentBooking.id,
    fallback_timeout_at: timeoutAt.toISOString(),
    fallback_previous_booking_id: currentBooking.id,
  }

  const { data: newBooking, error: bookingError } = await (supabase
    .from('booking_requests') as any)
    .insert(bookingInsertPayload as any)
    .select('*')
    .single()

  if (bookingError || !newBooking?.id) {
    throw new Error(`Impossible de créer la réservation fallback: ${bookingError?.message || 'Unknown error'}`)
  }

  await (supabase
    .from('conversations') as any)
    .update({ booking_request_id: newBooking.id })
    .eq('id', conversation.id)

  const normalizedClientEmail = (currentBooking.email || '').toLowerCase().trim()
  const normalizedChefEmail = (nextChef.email || '').toLowerCase().trim()

  await supabase
    .from('participants')
    .insert([
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
    ] as any)

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
    bookingDetails.budget = currentBooking.budget ? Number(currentBooking.budget) : null
    bookingDetails.courseTopic = currentBooking.course_topic || null
  } else if (currentBooking.service_type === 'mise_en_demeure') {
    bookingDetails.selectedDates = Array.isArray(currentBooking.selected_dates) ? currentBooking.selected_dates : null
    bookingDetails.mealOptionsLabel = mealOptionsLabel
    bookingDetails.totalPrice = currentBooking.total_price ? Number(currentBooking.total_price) : null
  }

  await sendEmail({
    to: nextChef.email,
    subject: emailSubjects.bookingReplacementRequestToChef,
    html: emailTemplates.bookingReplacementRequestToChef(
      nextChef.name,
      bookingDetails,
      acceptUrl,
      refuseUrl,
      baseUrl
    ),
  })

  console.log('[fallback] Created next booking', {
    trigger,
    sourceBookingId: currentBooking.id,
    newBookingId: newBooking.id,
    nextChefId: nextChef.id,
    remainingCount: remainingChefIds.length,
  })

  return { bookingId: newBooking.id, chefId: nextChef.id }
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
