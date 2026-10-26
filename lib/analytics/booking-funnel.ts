/**
 * Booking funnel events for GTM → GA4.
 * Stable English step_name values (not UI translations).
 */

import { pushDataLayer, pushDataLayerOnce } from './dataLayer'

export const BOOKING_FUNNEL_NAME = 'booking' as const

export const BOOKING_STEP_NAMES = {
  1: 'service_type',
  2: 'service_details',
  3: 'additional_info',
  4: 'personal_info',
  5: 'account',
} as const

export type BookingStepNumber = keyof typeof BOOKING_STEP_NAMES
export type BookingStepName = (typeof BOOKING_STEP_NAMES)[BookingStepNumber]

/** Non-PII validation error classifications. */
export type BookingValidationErrorType =
  | 'missing_required'
  | 'invalid_format'
  | 'business_rule'
  | 'terms_not_accepted'
  | 'auth_invalid'
  | 'generic'

const FORMAT_FIELDS = new Set([
  'loginEmail',
  'accountEmail',
  'email',
])

const AUTH_FIELDS = new Set([
  'loginEmail',
  'loginPassword',
  'accountEmail',
  'password',
  'confirmPassword',
])

const BUSINESS_RULE_FIELDS = new Set([
  'bookingDate',
  'alternativeDates',
  'selectedDates',
  'mealOptions',
  'childrenCount',
  'nearbyChefIds',
  'budget',
])

export function getBookingStepName(stepNumber: number): BookingStepName | null {
  if (stepNumber >= 1 && stepNumber <= 5) {
    return BOOKING_STEP_NAMES[stepNumber as BookingStepNumber]
  }
  return null
}

/**
 * Classify validation error field keys into a single generic error_type.
 * Field keys only — never values.
 */
export function classifyBookingValidationError(
  errorFields: string[]
): BookingValidationErrorType {
  if (errorFields.length === 0) return 'generic'
  if (errorFields.includes('terms')) return 'terms_not_accepted'
  if (errorFields.some((f) => AUTH_FIELDS.has(f))) {
    if (errorFields.some((f) => FORMAT_FIELDS.has(f))) return 'invalid_format'
    return 'auth_invalid'
  }
  if (errorFields.some((f) => BUSINESS_RULE_FIELDS.has(f))) return 'business_rule'
  if (errorFields.some((f) => FORMAT_FIELDS.has(f))) return 'invalid_format'
  return 'missing_required'
}

export function trackBookingFormStarted(meta?: {
  chef_id?: string
  chef_slug?: string
}): boolean {
  return pushDataLayerOnce('booking_form_started', {
    event: 'booking_form_started',
    funnel_name: BOOKING_FUNNEL_NAME,
    ...(meta?.chef_id ? { chef_id: meta.chef_id } : {}),
    ...(meta?.chef_slug ? { chef_slug: meta.chef_slug } : {}),
  })
}

export function trackBookingStepView(opts: {
  step_number: number
  chef_id?: string
  chef_slug?: string
}): boolean {
  const step_name = getBookingStepName(opts.step_number)
  if (!step_name) return false
  return pushDataLayer({
    event: 'booking_step_view',
    funnel_name: BOOKING_FUNNEL_NAME,
    step_number: opts.step_number,
    step_name,
    ...(opts.chef_id ? { chef_id: opts.chef_id } : {}),
    ...(opts.chef_slug ? { chef_slug: opts.chef_slug } : {}),
  })
}

export function trackBookingStepCompleted(opts: {
  step_number: number
  chef_id?: string
  chef_slug?: string
}): boolean {
  const step_name = getBookingStepName(opts.step_number)
  if (!step_name) return false
  return pushDataLayer({
    event: 'booking_step_completed',
    funnel_name: BOOKING_FUNNEL_NAME,
    step_number: opts.step_number,
    step_name,
    ...(opts.chef_id ? { chef_id: opts.chef_id } : {}),
    ...(opts.chef_slug ? { chef_slug: opts.chef_slug } : {}),
  })
}

export function trackBookingValidationError(opts: {
  step_number: number
  errorFields: string[]
  chef_id?: string
  chef_slug?: string
}): boolean {
  const step_name = getBookingStepName(opts.step_number)
  if (!step_name) return false
  const fields = Array.from(new Set(opts.errorFields.filter(Boolean))).sort()
  return pushDataLayer({
    event: 'booking_validation_error',
    funnel_name: BOOKING_FUNNEL_NAME,
    step_number: opts.step_number,
    step_name,
    error_type: classifyBookingValidationError(fields),
    error_fields: fields,
    ...(opts.chef_id ? { chef_id: opts.chef_id } : {}),
    ...(opts.chef_slug ? { chef_slug: opts.chef_slug } : {}),
  })
}

export function trackBookingCompleted(opts: {
  chef_id?: string
  chef_slug?: string
  service_type?: string
  /** Opaque id only — not PII */
  booking_request_id?: string
}): boolean {
  return pushDataLayerOnce('booking_completed', {
    event: 'booking_completed',
    funnel_name: BOOKING_FUNNEL_NAME,
    ...(opts.chef_id ? { chef_id: opts.chef_id } : {}),
    ...(opts.chef_slug ? { chef_slug: opts.chef_slug } : {}),
    ...(opts.service_type ? { service_type: opts.service_type } : {}),
    ...(opts.booking_request_id
      ? { booking_request_id: opts.booking_request_id }
      : {}),
  })
}
