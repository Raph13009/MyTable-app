/**
 *   npx tsx --test lib/__tests__/chefInactivityReminder.test.ts
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getChefInactivityReminderCreatedAtRange,
  parisMidnightUtc,
} from '../chefInactivityReminder'

describe('chef inactivity reminder — J+1 window (Europe/Paris)', () => {
  it('resolves Paris midnight in summer (CEST, UTC+2)', () => {
    assert.equal(parisMidnightUtc('2026-08-22').toISOString(), '2026-08-21T22:00:00.000Z')
  })

  it('resolves Paris midnight in winter (CET, UTC+1)', () => {
    assert.equal(parisMidnightUtc('2026-01-14').toISOString(), '2026-01-13T23:00:00.000Z')
  })

  it('selects yesterday Paris during the daily 09:00 UTC cron (summer)', () => {
    const now = new Date('2026-08-23T09:00:00.000Z') // 11:00 à Paris
    const range = getChefInactivityReminderCreatedAtRange(now)
    assert.equal(range.fromInclusive, '2026-08-21T22:00:00.000Z') // 22 août 00:00 Paris
    assert.equal(range.toExclusive, '2026-08-22T22:00:00.000Z') // 23 août 00:00 Paris
  })

  it('selects yesterday Paris during the daily 09:00 UTC cron (winter)', () => {
    const now = new Date('2026-01-15T09:00:00.000Z') // 10:00 à Paris
    const range = getChefInactivityReminderCreatedAtRange(now)
    assert.equal(range.fromInclusive, '2026-01-13T23:00:00.000Z') // 14 janv. 00:00 Paris
    assert.equal(range.toExclusive, '2026-01-14T23:00:00.000Z') // 15 janv. 00:00 Paris
  })

  it('handles the spring DST night (Paris 29 mars 2026)', () => {
    const now = new Date('2026-03-30T09:00:00.000Z')
    const range = getChefInactivityReminderCreatedAtRange(now)
    assert.equal(range.fromInclusive, '2026-03-28T23:00:00.000Z') // 29 mars 00:00 CET
    assert.equal(range.toExclusive, '2026-03-29T22:00:00.000Z') // 30 mars 00:00 CEST
  })

  it('does not include bookings created today or before yesterday', () => {
    const now = new Date('2026-08-23T09:00:00.000Z')
    const { fromInclusive, toExclusive } = getChefInactivityReminderCreatedAtRange(now)
    const from = Date.parse(fromInclusive)
    const to = Date.parse(toExclusive)

    const createdYesterdayAfternoon = Date.parse('2026-08-22T14:00:00.000Z')
    const createdTodayMorning = Date.parse('2026-08-23T08:00:00.000Z')
    const createdTwoDaysAgo = Date.parse('2026-08-20T14:00:00.000Z')

    assert.equal(createdYesterdayAfternoon >= from && createdYesterdayAfternoon < to, true)
    assert.equal(createdTodayMorning >= from && createdTodayMorning < to, false)
    assert.equal(createdTwoDaysAgo >= from && createdTwoDaysAgo < to, false)
  })
})
