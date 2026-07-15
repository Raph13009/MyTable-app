import { SupabaseClient } from '@supabase/supabase-js'
import { formatDateForDisplay } from '@/lib/dateUtils'
import { Database } from '@/types/database'

const WHATSAPP_GRAPH_API_VERSION = 'v25.0'
const WHATSAPP_LANGUAGE = 'fr'

export const WHATSAPP_TEMPLATES = {
  newBookingChef:
    process.env.WHATSAPP_TEMPLATE_NEW_BOOKING_CHEF ?? 'mytable_demande_reservation_chef',
  fallbackBookingChef:
    process.env.WHATSAPP_TEMPLATE_FALLBACK_BOOKING_CHEF ?? 'mytable_chef_fallback_booking',
} as const

type AdminClient = SupabaseClient<Database>

/**
 * Booking WhatsApp notifications are disabled by default.
 * Set WHATSAPP_BOOKING_NOTIFICATIONS_ENABLED=true only after production validation.
 */
export function isWhatsAppBookingNotificationsEnabled(): boolean {
  return process.env.WHATSAPP_BOOKING_NOTIFICATIONS_ENABLED === 'true'
}

export class WhatsAppConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WhatsAppConfigError'
  }
}

export class WhatsAppValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WhatsAppValidationError'
  }
}

export class WhatsAppApiError extends Error {
  status: number
  details: unknown

  constructor(message: string, status: number, details: unknown) {
    super(message)
    this.name = 'WhatsAppApiError'
    this.status = status
    this.details = details
  }
}

export interface WhatsAppTemplateOptions {
  to: string
  templateName: string
  languageCode?: string
  bodyParameters?: string[]
}

export interface WhatsAppPhoneValidationResult {
  valid: boolean
  normalized?: string
  error?: string
}

export interface ChefBookingWhatsAppDetails {
  firstName: string
  lastName: string
  serviceType?: string
  serviceTypeLabel?: string
  city: string
  postalCode: string
  guestsCount: number | string
  childrenCount?: number
  bookingDate?: string | null
  selectedDates?: string[] | null
  isDateFlexible?: boolean
  alternativeDates?: string[]
}

function getWhatsAppConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!accessToken || !phoneNumberId) {
    throw new WhatsAppConfigError(
      'Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID environment variables'
    )
  }

  if (phoneNumberId !== '1175854655612281') {
    throw new WhatsAppConfigError(
      `Unexpected WHATSAPP_PHONE_NUMBER_ID (${phoneNumberId}). Production ID 1175854655612281 is required.`
    )
  }

  return { accessToken, phoneNumberId }
}

function truncateTemplateParameter(value: string, maxLength = 256): string {
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1)}…`
}

/**
 * Normalize a phone number for the WhatsApp Cloud API (E.164 without the leading "+").
 */
export function normalizeWhatsAppPhoneNumber(input: string): string {
  return input.trim().replace(/\D/g, '')
}

/**
 * Validate a recipient phone number for WhatsApp template messages.
 */
export function validateWhatsAppPhoneNumber(input: string): WhatsAppPhoneValidationResult {
  const normalized = normalizeWhatsAppPhoneNumber(input)

  if (!normalized) {
    return { valid: false, error: 'Phone number is required' }
  }

  if (normalized.startsWith('0')) {
    return {
      valid: false,
      error: 'Phone number must include a country code (e.g. 33612345678, not 0612345678)',
    }
  }

  if (!/^[1-9]\d{7,14}$/.test(normalized)) {
    return {
      valid: false,
      error: 'Phone number must be 8 to 15 digits in international format without "+"',
    }
  }

  return { valid: true, normalized }
}

function buildTemplateComponents(bodyParameters?: string[]) {
  if (!bodyParameters?.length) return undefined

  return [
    {
      type: 'body',
      parameters: bodyParameters.map((text) => ({
        type: 'text',
        text: truncateTemplateParameter(text),
      })),
    },
  ]
}

function extractWhatsAppMessageId(data: unknown): string | undefined {
  if (
    typeof data === 'object' &&
    data !== null &&
    'messages' in data &&
    Array.isArray((data as { messages?: Array<{ id?: string }> }).messages)
  ) {
    return (data as { messages: Array<{ id?: string }> }).messages[0]?.id
  }
  return undefined
}

/**
 * Send a WhatsApp template message via the Meta Graph API.
 */
export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode = WHATSAPP_LANGUAGE,
  bodyParameters,
}: WhatsAppTemplateOptions): Promise<unknown> {
  const validation = validateWhatsAppPhoneNumber(to)
  if (!validation.valid || !validation.normalized) {
    throw new WhatsAppValidationError(validation.error || 'Invalid phone number')
  }

  const { accessToken, phoneNumberId } = getWhatsAppConfig()
  const url = `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${phoneNumberId}/messages`
  const components = buildTemplateComponents(bodyParameters)

  const startTime = Date.now()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: validation.normalized,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
          ...(components ? { components } : {}),
        },
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        typeof data === 'object' &&
        data !== null &&
        'error' in data &&
        typeof (data as { error?: { message?: string } }).error?.message === 'string'
          ? (data as { error: { message: string } }).error.message
          : `WhatsApp API request failed with status ${response.status}`

      console.error('[whatsapp] ❌ API error:', {
        status: response.status,
        to: validation.normalized,
        templateName,
        body: data,
      })

      throw new WhatsAppApiError(message, response.status, data)
    }

    console.log('[whatsapp] ✅ Template sent', {
      to: validation.normalized,
      templateName,
      languageCode,
      durationMs: Date.now() - startTime,
      messageId: extractWhatsAppMessageId(data),
    })

    return data
  } catch (error) {
    if (
      error instanceof WhatsAppValidationError ||
      error instanceof WhatsAppConfigError ||
      error instanceof WhatsAppApiError
    ) {
      throw error
    }

    console.error('[whatsapp] ❌ Unexpected error:', error)
    throw error
  }
}

async function claimBookingWhatsAppNotification(
  supabase: AdminClient,
  bookingRequestId: string
): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc('claim_chef_whatsapp_notification', {
    p_booking_id: bookingRequestId,
  })

  if (error) {
    console.error('[whatsapp] ❌ Failed to claim notification slot:', {
      bookingRequestId,
      error,
    })
    return false
  }

  return Boolean(data)
}

async function completeBookingWhatsAppNotification(
  supabase: AdminClient,
  bookingRequestId: string,
  status: 'sent' | 'failed' | 'skipped',
  options?: { messageId?: string; error?: string }
): Promise<void> {
  const { error } = await (supabase as any).rpc('complete_chef_whatsapp_notification', {
    p_booking_id: bookingRequestId,
    p_status: status,
    p_message_id: options?.messageId ?? null,
    p_error: options?.error ?? null,
  })

  if (error) {
    console.error('[whatsapp] ❌ Failed to persist notification status:', {
      bookingRequestId,
      status,
      error,
    })
  }
}

function formatBookingDateForWhatsApp(bookingDetails: ChefBookingWhatsAppDetails): string {
  if (bookingDetails.bookingDate) {
    if (bookingDetails.isDateFlexible) {
      const alternatives = Array.isArray(bookingDetails.alternativeDates)
        ? bookingDetails.alternativeDates.filter(Boolean)
        : []
      if (alternatives.length > 0) {
        return `Flexible (${[bookingDetails.bookingDate, ...alternatives].join(' ou ')})`
      }
      return `Flexible (${bookingDetails.bookingDate})`
    }
    return bookingDetails.bookingDate
  }

  if (Array.isArray(bookingDetails.selectedDates) && bookingDetails.selectedDates.length > 0) {
    return bookingDetails.selectedDates
      .map((date) => formatDateForDisplay(date, 'fr-FR'))
      .join(', ')
  }

  return 'À préciser'
}

function formatLocationForWhatsApp(bookingDetails: ChefBookingWhatsAppDetails): string {
  return `${bookingDetails.city} (${bookingDetails.postalCode})`
}

function formatGuestsForWhatsApp(bookingDetails: ChefBookingWhatsAppDetails): string {
  const guests = String(bookingDetails.guestsCount)
  const children = Number(bookingDetails.childrenCount || 0)
  if (children > 0) {
    return `${guests} (dont ${children} ${children === 1 ? 'enfant' : 'enfants'})`
  }
  return guests
}

function formatClientName(bookingDetails: ChefBookingWhatsAppDetails): string {
  return [bookingDetails.firstName, bookingDetails.lastName].filter(Boolean).join(' ').trim()
}

function formatServiceLabel(bookingDetails: ChefBookingWhatsAppDetails): string {
  return (
    bookingDetails.serviceTypeLabel ||
    bookingDetails.serviceType ||
    'réservation'
  ).toLowerCase()
}

function logWhatsAppSkip(
  reason: string,
  context: {
    logContext?: string
    bookingRequestId?: string
    chefName?: string
    templateName: string
  }
) {
  console.warn('[whatsapp] ⚠️ Skipped chef notification', {
    reason,
    templateName: context.templateName,
    bookingRequestId: context.bookingRequestId,
    chefName: context.chefName,
    logContext: context.logContext,
  })
}

function logWhatsAppFailure(
  error: unknown,
  context: {
    logContext?: string
    bookingRequestId?: string
    chefName?: string
    chefPhone?: string | null
    templateName: string
  }
) {
  console.error('[whatsapp] ❌ Chef notification failed (booking unaffected)', {
    templateName: context.templateName,
    bookingRequestId: context.bookingRequestId,
    chefName: context.chefName,
    chefPhone: context.chefPhone ? `${context.chefPhone.slice(0, 4)}***` : null,
    logContext: context.logContext,
    error: error instanceof Error ? error.message : error,
  })
}

async function sendChefBookingAssignedWhatsApp({
  supabase,
  chefPhone,
  chefName,
  bookingDetails,
  bookingRequestId,
  logContext,
  templateName,
  bodyParameters,
  notificationKind,
}: {
  supabase: AdminClient
  chefPhone: string | null | undefined
  chefName: string
  bookingDetails: ChefBookingWhatsAppDetails
  bookingRequestId?: string
  logContext?: string
  templateName: string
  bodyParameters: string[]
  notificationKind: 'new_booking' | 'fallback_booking'
}): Promise<void> {
  if (!isWhatsAppBookingNotificationsEnabled()) {
    logWhatsAppSkip('Feature flag disabled (WHATSAPP_BOOKING_NOTIFICATIONS_ENABLED)', {
      logContext,
      bookingRequestId,
      chefName,
      templateName,
    })
    return
  }

  if (!bookingRequestId) {
    logWhatsAppSkip('Missing booking request ID for DB-backed deduplication', {
      logContext,
      bookingRequestId,
      chefName,
      templateName,
    })
    return
  }

  const claimed = await claimBookingWhatsAppNotification(supabase, bookingRequestId)
  if (!claimed) {
    logWhatsAppSkip('Duplicate send prevented by database claim', {
      logContext,
      bookingRequestId,
      chefName,
      templateName,
    })
    return
  }

  if (!chefPhone?.trim()) {
    await completeBookingWhatsAppNotification(supabase, bookingRequestId, 'skipped', {
      error: 'Chef has no phone number',
    })
    logWhatsAppSkip('Chef has no phone number', {
      logContext,
      bookingRequestId,
      chefName,
      templateName,
    })
    return
  }

  const phoneValidation = validateWhatsAppPhoneNumber(chefPhone)
  if (!phoneValidation.valid) {
    await completeBookingWhatsAppNotification(supabase, bookingRequestId, 'skipped', {
      error: phoneValidation.error || 'Invalid chef phone number',
    })
    logWhatsAppSkip(phoneValidation.error || 'Invalid chef phone number', {
      logContext,
      bookingRequestId,
      chefName,
      templateName,
    })
    return
  }

  try {
    const metaResponse = await sendWhatsAppTemplate({
      to: chefPhone,
      templateName,
      languageCode: WHATSAPP_LANGUAGE,
      bodyParameters,
    })

    const messageId = extractWhatsAppMessageId(metaResponse)
    await completeBookingWhatsAppNotification(supabase, bookingRequestId, 'sent', {
      messageId,
    })

    console.log('[whatsapp] ✅ Chef booking assignment notification sent', {
      notificationKind,
      templateName,
      bookingRequestId,
      chefName,
      messageId,
      logContext,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown WhatsApp error'
    await completeBookingWhatsAppNotification(supabase, bookingRequestId, 'failed', {
      error: errorMessage,
    })
    logWhatsAppFailure(error, {
      logContext,
      bookingRequestId,
      chefName,
      chefPhone,
      templateName,
    })
  }
}

/**
 * Notify chef of a new booking assignment. Non-blocking; gated by feature flag.
 */
export async function notifyChefNewBookingWhatsApp({
  supabase,
  chefPhone,
  chefName,
  bookingDetails,
  bookingRequestId,
  logContext,
}: {
  supabase: AdminClient
  chefPhone: string | null | undefined
  chefName: string
  bookingDetails: ChefBookingWhatsAppDetails
  bookingRequestId?: string
  logContext?: string
}): Promise<void> {
  const templateName = WHATSAPP_TEMPLATES.newBookingChef

  await sendChefBookingAssignedWhatsApp({
    supabase,
    chefPhone,
    chefName,
    bookingDetails,
    bookingRequestId,
    logContext,
    templateName,
    notificationKind: 'new_booking',
    bodyParameters: [
      chefName,
      formatServiceLabel(bookingDetails),
      formatClientName(bookingDetails),
      formatBookingDateForWhatsApp(bookingDetails),
      formatLocationForWhatsApp(bookingDetails),
      formatGuestsForWhatsApp(bookingDetails),
    ],
  })
}

/**
 * Notify fallback chef of a booking assignment. Non-blocking; gated by feature flag.
 */
export async function notifyChefFallbackBookingWhatsApp({
  supabase,
  chefPhone,
  chefName,
  bookingDetails,
  bookingRequestId,
  logContext,
}: {
  supabase: AdminClient
  chefPhone: string | null | undefined
  chefName: string
  bookingDetails: ChefBookingWhatsAppDetails
  bookingRequestId?: string
  logContext?: string
}): Promise<void> {
  const templateName = WHATSAPP_TEMPLATES.fallbackBookingChef

  await sendChefBookingAssignedWhatsApp({
    supabase,
    chefPhone,
    chefName,
    bookingDetails,
    bookingRequestId,
    logContext,
    templateName,
    notificationKind: 'fallback_booking',
    bodyParameters: [
      chefName,
      formatServiceLabel(bookingDetails),
      formatGuestsForWhatsApp(bookingDetails),
      formatBookingDateForWhatsApp(bookingDetails),
      formatLocationForWhatsApp(bookingDetails),
    ],
  })
}
