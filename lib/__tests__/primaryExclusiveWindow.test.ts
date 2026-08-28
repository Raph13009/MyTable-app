/**
 * Regression: after 3h without a chef reply, the client always gets the
 * nearby-chefs email — including when they did not opt into replacement chefs.
 *
 *   npx tsx --test lib/__tests__/primaryExclusiveWindow.test.ts
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  FALLBACK_PRIMARY_EXCLUSIVE_WINDOW_MS,
  dispatchFallbackToAllBackupChefs,
  fetchExpiredPrimaryExclusiveWindowBookings,
  getPrimaryExclusiveTimeoutAt,
  isPrimaryExclusiveWindowExpired,
  shouldNotifyClientOfFallbackExhaustion,
} from '../fallbackBookings'
import { processExpiredPrimaryExclusiveWindows } from '../processExpiredPrimaryBookings'

describe('primary exclusive window — always 3h', () => {
  it('computes timeout 3 hours from now', () => {
    const nowMs = Date.parse('2026-08-28T10:00:00.000Z')
    assert.equal(getPrimaryExclusiveTimeoutAt(nowMs), '2026-08-28T13:00:00.000Z')
    assert.equal(FALLBACK_PRIMARY_EXCLUSIVE_WINDOW_MS, 3 * 60 * 60 * 1000)
  })

  it('expires a primary booking whose fallback_timeout_at has passed, even without replacement chefs', () => {
    const now = new Date('2026-08-28T13:00:01.000Z')
    assert.equal(
      isPrimaryExclusiveWindowExpired(
        {
          status: 'pending',
          fallback_timeout_at: '2026-08-28T13:00:00.000Z',
          fallback_previous_booking_id: null,
        },
        now
      ),
      true
    )
  })

  it('does not expire a primary booking still inside the 3h window', () => {
    const now = new Date('2026-08-28T12:59:59.000Z')
    assert.equal(
      isPrimaryExclusiveWindowExpired(
        {
          status: 'pending',
          fallback_timeout_at: '2026-08-28T13:00:00.000Z',
          fallback_previous_booking_id: null,
        },
        now
      ),
      false
    )
  })

  it('heals legacy primary bookings with no timeout set after 3h of silence', () => {
    const now = new Date('2026-08-28T13:00:00.000Z')
    assert.equal(
      isPrimaryExclusiveWindowExpired(
        {
          status: 'pending',
          fallback_timeout_at: null,
          fallback_previous_booking_id: null,
          request_sent_at: '2026-08-28T10:00:00.000Z',
        },
        now
      ),
      true
    )
    assert.equal(
      isPrimaryExclusiveWindowExpired(
        {
          status: 'pending',
          fallback_timeout_at: null,
          fallback_previous_booking_id: null,
          request_sent_at: '2026-08-28T10:00:01.000Z',
        },
        now
      ),
      false
    )
  })

  it('never times out backup broadcast bookings (no exclusive window)', () => {
    const now = new Date('2026-08-28T20:00:00.000Z')
    assert.equal(
      isPrimaryExclusiveWindowExpired(
        {
          status: 'pending',
          fallback_timeout_at: null,
          fallback_previous_booking_id: 'primary-1',
          request_sent_at: '2026-08-28T10:00:00.000Z',
        },
        now
      ),
      false
    )
  })

  it('ignores already handled bookings', () => {
    const now = new Date('2026-08-28T13:00:01.000Z')
    assert.equal(
      isPrimaryExclusiveWindowExpired(
        {
          status: 'accepted',
          fallback_timeout_at: '2026-08-28T13:00:00.000Z',
        },
        now
      ),
      false
    )
  })

  it('always wants a client notification when replacement chefs were not selected', async () => {
    const notified = await shouldNotifyClientOfFallbackExhaustion({} as any, {
      fallback_enabled: false,
      id: 'booking-no-fallback',
    })
    assert.equal(notified, true)
  })
})

describe('fetchExpiredPrimaryExclusiveWindowBookings', () => {
  it('loads timed-out primaries regardless of fallback_enabled, plus legacy silent primaries', async () => {
    const calls: Array<{ table: string; filters: Record<string, unknown> }> = []
    const supabase = {
      from(table: string) {
        const filters: Record<string, unknown> = { table }
        const chain: any = {
          select() {
            return chain
          },
          eq(column: string, value: unknown) {
            filters[`eq:${column}`] = value
            return chain
          },
          is(column: string, value: unknown) {
            filters[`is:${column}`] = value
            return chain
          },
          not(column: string, operator: string, value: unknown) {
            filters[`not:${column}`] = `${operator}:${value}`
            return chain
          },
          lt(column: string, value: unknown) {
            filters[`lt:${column}`] = value
            return chain
          },
          limit() {
            calls.push({ table, filters })
            if (filters['not:fallback_timeout_at'] === 'is:null') {
              return Promise.resolve({
                data: [
                  {
                    id: 'with-timeout-no-fallback',
                    status: 'pending',
                    fallback_enabled: false,
                    fallback_timeout_at: '2026-08-28T13:00:00.000Z',
                    fallback_previous_booking_id: null,
                  },
                ],
                error: null,
              })
            }
            return Promise.resolve({
              data: [
                {
                  id: 'legacy-no-timeout',
                  status: 'pending',
                  fallback_enabled: false,
                  fallback_timeout_at: null,
                  fallback_previous_booking_id: null,
                  request_sent_at: '2026-08-28T09:00:00.000Z',
                },
              ],
              error: null,
            })
          },
        }
        return chain
      },
    }

    const rows = await fetchExpiredPrimaryExclusiveWindowBookings(
      supabase as any,
      new Date('2026-08-28T13:00:01.000Z')
    )

    assert.equal(calls.length, 2)
    assert.equal(
      calls.some((call) => call.filters['eq:fallback_enabled'] === true),
      false,
      'must not require fallback_enabled=true'
    )
    assert.deepEqual(
      rows.map((row) => row.id).sort(),
      ['legacy-no-timeout', 'with-timeout-no-fallback']
    )
  })
})

describe('dispatchFallbackToAllBackupChefs — chefs cochés', () => {
  it('does not contact backups when the client skipped replacement chefs', async () => {
    const result = await dispatchFallbackToAllBackupChefs(
      {} as any,
      {
        fallback_enabled: false,
        fallback_next_chef_ids: ['chef-b', 'chef-c'],
      },
      'timeout'
    )
    assert.deepEqual(result, [])
  })

  it('does not contact backups when the checked-chef queue is empty', async () => {
    const result = await dispatchFallbackToAllBackupChefs(
      {} as any,
      {
        fallback_enabled: true,
        fallback_next_chef_ids: [],
      },
      'refused'
    )
    assert.deepEqual(result, [])
  })

  it('loads every checked chef after timeout or refuse, then broadcasts', async () => {
    const lookedUp: string[] = []
    const cleared: string[] = []
    const chefsById: Record<string, any> = {
      'chef-b': { id: 'chef-b', name: 'Backup B', email: 'b@test.com', is_publicly_visible: true },
      'chef-c': { id: 'chef-c', name: 'Backup C', email: 'c@test.com', is_publicly_visible: true },
    }
    const supabase = {
      from(table: string) {
        if (table === 'chefs') {
          const chain: any = {
            _id: null as string | null,
            select() {
              return chain
            },
            eq(column: string, value: unknown) {
              if (column === 'id') chain._id = String(value)
              return chain
            },
            single() {
              lookedUp.push(chain._id as string)
              return Promise.resolve({ data: chefsById[chain._id as string] || null })
            },
          }
          return chain
        }
        if (table === 'booking_requests') {
          return {
            update() {
              return {
                eq(_column: string, id: string) {
                  cleared.push(id)
                  return Promise.resolve({ data: null, error: null })
                },
              }
            },
          }
        }
        if (table === 'conversations') {
          return {
            insert() {
              return {
                select() {
                  return {
                    single() {
                      return Promise.resolve({
                        data: null,
                        error: { message: 'stop-before-email-in-test' },
                      })
                    },
                  }
                },
              }
            },
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    }

    const result = await dispatchFallbackToAllBackupChefs(
      supabase as any,
      {
        id: 'primary-1',
        fallback_enabled: true,
        fallback_next_chef_ids: ['chef-b', 'chef-c'],
      },
      'timeout'
    )

    assert.deepEqual(lookedUp, ['chef-b', 'chef-c'])
    assert.deepEqual(cleared, ['primary-1'])
    assert.deepEqual(result, [])
  })
})

function createLockingSupabase(bookings: Array<{ id: string; chef_id: string; status?: string }>) {
  const store = new Map(bookings.map((row) => [row.id, { ...row, status: row.status ?? 'pending' }]))
  const usedTokens: string[] = []

  return {
    usedTokens,
    store,
    from(table: string) {
      if (table === 'booking_requests') {
        const chain: any = {
          _id: null as string | null,
          _status: null as string | null,
          update(values: { status?: string }) {
            chain._update = values
            return chain
          },
          eq(column: string, value: unknown) {
            if (column === 'id') chain._id = String(value)
            if (column === 'status') chain._status = String(value)
            return chain
          },
          select() {
            return chain
          },
          maybeSingle() {
            const row = chain._id ? store.get(chain._id) : undefined
            if (!row || (chain._status && row.status !== chain._status)) {
              return Promise.resolve({ data: null })
            }
            Object.assign(row, chain._update)
            return Promise.resolve({ data: { id: row.id } })
          },
        }
        return chain
      }

      if (table === 'decision_tokens') {
        const chain: any = {
          update() {
            return chain
          },
          eq(column: string, value: unknown) {
            if (column === 'booking_request_id') usedTokens.push(String(value))
            return chain
          },
        }
        return chain
      }

      if (table === 'chefs') {
        const chain: any = {
          select() {
            return chain
          },
          eq() {
            return chain
          },
          single() {
            return Promise.resolve({ data: { name: 'Marie Chef' } })
          },
        }
        return chain
      }

      throw new Error(`unexpected table ${table}`)
    },
  }
}

describe('processExpiredPrimaryExclusiveWindows — nearby chefs email', () => {
  it('emails the client after 3h when they did not select a replacement chef', async () => {
    const booking = {
      id: 'booking-no-fallback',
      chef_id: 'chef-1',
      email: 'client@example.com',
      first_name: 'Paul',
      fallback_enabled: false,
      fallback_timeout_at: '2026-08-28T13:00:00.000Z',
    }
    const supabase = createLockingSupabase([booking])
    const notified: Array<{ bookingId: string; chefFirstName: string }> = []
    const dispatched: unknown[] = []

    const result = await processExpiredPrimaryExclusiveWindows(supabase as any, {
      now: new Date('2026-08-28T13:05:00.000Z'),
      baseUrl: 'https://example.com',
      fetchExpired: async () => [booking],
      dispatchFallback: async (_supabase, current) => {
        dispatched.push(current.id)
        return []
      },
      shouldNotifyClient: async () => true,
      notifyClient: async (_supabase, current, chefFirstName) => {
        notified.push({ bookingId: current.id, chefFirstName })
      },
    })

    assert.equal(result.processed, 1)
    assert.equal(result.expired, 1)
    assert.equal(result.forwarded, 0)
    assert.equal(result.notified, 1)
    assert.deepEqual(dispatched, ['booking-no-fallback'])
    assert.deepEqual(notified, [{ bookingId: 'booking-no-fallback', chefFirstName: 'Marie' }])
    assert.equal(supabase.store.get('booking-no-fallback')?.status, 'expired')
  })

  it('still emails the client when replacement chefs were selected but none could be contacted', async () => {
    const booking = {
      id: 'booking-empty-queue',
      chef_id: 'chef-1',
      email: 'client@example.com',
      fallback_enabled: true,
      fallback_next_chef_ids: [],
      fallback_timeout_at: '2026-08-28T13:00:00.000Z',
    }
    const supabase = createLockingSupabase([booking])
    let notified = 0

    const result = await processExpiredPrimaryExclusiveWindows(supabase as any, {
      fetchExpired: async () => [booking],
      dispatchFallback: async () => [],
      shouldNotifyClient: async () => true,
      notifyClient: async () => {
        notified += 1
      },
    })

    assert.equal(result.notified, 1)
    assert.equal(notified, 1)
  })

  it('does not email the client when backup chefs were successfully contacted', async () => {
    const booking = {
      id: 'booking-with-backups',
      chef_id: 'chef-1',
      fallback_enabled: true,
      fallback_timeout_at: '2026-08-28T13:00:00.000Z',
    }
    const supabase = createLockingSupabase([booking])
    let notified = 0
    const dispatchedTriggers: string[] = []

    const result = await processExpiredPrimaryExclusiveWindows(supabase as any, {
      fetchExpired: async () => [booking],
      dispatchFallback: async (_supabase, current, trigger) => {
        dispatchedTriggers.push(`${trigger}:${current.id}`)
        return [{ bookingId: 'backup-1', chefId: 'chef-2' }]
      },
      shouldNotifyClient: async () => true,
      notifyClient: async () => {
        notified += 1
      },
    })

    assert.deepEqual(dispatchedTriggers, ['timeout:booking-with-backups'])
    assert.equal(result.forwarded, 1)
    assert.equal(result.notified, 0)
    assert.equal(notified, 0)
  })
})
