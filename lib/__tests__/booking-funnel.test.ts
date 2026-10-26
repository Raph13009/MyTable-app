/**
 * Booking funnel dataLayer helpers.
 * Run: npx --yes tsx --test lib/__tests__/booking-funnel.test.ts
 */

import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
  classifyBookingValidationError,
  getBookingStepName,
  trackBookingCompleted,
  trackBookingFormStarted,
  trackBookingStepCompleted,
  trackBookingStepView,
  trackBookingValidationError,
} from '../analytics/booking-funnel'
import { resetDataLayerDedupeForTests } from '../analytics/dataLayer'

describe('booking funnel helpers', () => {
  beforeEach(() => {
    resetDataLayerDedupeForTests()
    ;(globalThis as any).window = {
      dataLayer: [],
    }
  })

  it('maps step numbers to stable English names', () => {
    assert.equal(getBookingStepName(1), 'service_type')
    assert.equal(getBookingStepName(2), 'service_details')
    assert.equal(getBookingStepName(3), 'additional_info')
    assert.equal(getBookingStepName(4), 'personal_info')
    assert.equal(getBookingStepName(5), 'account')
    assert.equal(getBookingStepName(99), null)
  })

  it('classifies validation errors without using values', () => {
    assert.equal(classifyBookingValidationError(['terms']), 'terms_not_accepted')
    assert.equal(classifyBookingValidationError(['fullName', 'phone']), 'missing_required')
    assert.equal(classifyBookingValidationError(['bookingDate']), 'business_rule')
    assert.equal(classifyBookingValidationError(['accountEmail']), 'invalid_format')
    assert.equal(classifyBookingValidationError(['password']), 'auth_invalid')
  })

  it('pushes funnel events without PII fields', () => {
    trackBookingFormStarted({ chef_id: 'c1', chef_slug: 'chef-demo' })
    trackBookingStepView({ step_number: 1, chef_id: 'c1' })
    trackBookingStepCompleted({ step_number: 1, chef_id: 'c1' })
    trackBookingValidationError({
      step_number: 2,
      errorFields: ['guestsCount', 'bookingDate'],
      chef_id: 'c1',
    })
    trackBookingCompleted({
      chef_id: 'c1',
      service_type: 'repas_domicile',
      booking_request_id: 'br_1',
    })

    const layer = (globalThis as any).window.dataLayer as Record<string, unknown>[]
    assert.equal(layer.length, 5)
    assert.equal(layer[0].event, 'booking_form_started')
    assert.equal(layer[1].event, 'booking_step_view')
    assert.equal(layer[1].step_name, 'service_type')
    assert.equal(layer[1].funnel_name, 'booking')
    assert.equal(layer[3].event, 'booking_validation_error')
    assert.equal(layer[3].error_type, 'business_rule')
    assert.deepEqual(layer[3].error_fields, ['bookingDate', 'guestsCount'])
    assert.equal(layer[4].event, 'booking_completed')

    const serialized = JSON.stringify(layer)
    assert.equal(serialized.includes('@'), false)
    assert.equal(serialized.includes('email'), false)
    assert.equal(serialized.includes('phone'), false)
  })

  it('dedupes form_started and identical rapid pushes', () => {
    assert.equal(trackBookingFormStarted({ chef_id: 'c1' }), true)
    assert.equal(trackBookingFormStarted({ chef_id: 'c1' }), false)
    assert.equal(trackBookingStepView({ step_number: 2, chef_id: 'c1' }), true)
    assert.equal(trackBookingStepView({ step_number: 2, chef_id: 'c1' }), false)
    const layer = (globalThis as any).window.dataLayer as unknown[]
    assert.equal(layer.length, 2)
  })
})
