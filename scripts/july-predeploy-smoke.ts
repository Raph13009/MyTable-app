/**
 * Safe offline smoke checks for July fallback/finalize behavior.
 * No network, no real users, no emails/WhatsApp.
 *
 *   RESEND_API_KEY=re_test_dummy npx tsx scripts/july-predeploy-smoke.ts
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  FALLBACK_EXCLUSIVE_WINDOW_HOURS,
  FALLBACK_EXCLUSIVE_WINDOW_MS,
  FALLBACK_MAX_ACCEPTED_CANDIDATES,
  resolveFallbackAcceptClaim,
  selectFallbackAcceptWinnerIds,
} from '../lib/fallbackBookings'
import { emailSubjects, emailTemplates } from '../lib/email'
import { isWhatsAppBookingNotificationsEnabled } from '../lib/whatsapp'

type Row = { id: string; status: string; updated_at: string; fallback_group_id?: string }

function createMemorySupabase(rows: Row[]) {
  const decisionTokens: Array<{ booking_request_id: string; used: boolean }> = []

  const api = {
    from(table: string) {
      if (table === 'booking_requests') {
        return {
          select(_cols: string) {
            const filters: Array<[string, string, 'eq' | 'neq']> = []
            const run = () => {
              const data = rows.filter((r) =>
                filters.every(([col, val, op]) =>
                  op === 'eq' ? (r as any)[col] === val : (r as any)[col] !== val
                )
              )
              return Promise.resolve({ data, error: null })
            }
            const chain: any = {
              eq(col: string, val: string) {
                filters.push([col, val, 'eq'])
                return chain
              },
              neq(col: string, val: string) {
                filters.push([col, val, 'neq'])
                return chain
              },
              then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
                return run().then(resolve, reject)
              },
            }
            return chain
          },
          update(payload: Record<string, unknown>) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    for (const r of rows) {
                      if ((r as any)[col] === val && (r as any)[col2] === val2) {
                        Object.assign(r, payload)
                      }
                    }
                    return Promise.resolve({ data: null, error: null })
                  },
                  in(colIn: string, ids: string[]) {
                    return {
                      eq(col2: string, val2: string) {
                        for (const r of rows) {
                          if (ids.includes((r as any)[colIn]) && (r as any)[col2] === val2) {
                            Object.assign(r, payload)
                          }
                        }
                        return Promise.resolve({ data: null, error: null })
                      },
                    }
                  },
                }
              },
              in(colIn: string, ids: string[]) {
                // .update().in('id', ids) — may or may not chain .eq
                for (const r of rows) {
                  if (ids.includes((r as any)[colIn])) {
                    Object.assign(r, payload)
                  }
                }
                return {
                  eq(col2: string, val2: string) {
                    for (const r of rows) {
                      if (ids.includes((r as any)[colIn]) && (r as any)[col2] === val2) {
                        Object.assign(r, payload)
                      }
                    }
                    return Promise.resolve({ data: null, error: null })
                  },
                  then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
                    return Promise.resolve({ data: null, error: null }).then(resolve, reject)
                  },
                }
              },
            }
          },
        }
      }

      if (table === 'decision_tokens') {
        return {
          update(payload: Record<string, unknown>) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: unknown) {
                    for (const t of decisionTokens) {
                      if ((t as any)[col] === val && (t as any)[col2] === val2) {
                        Object.assign(t, payload)
                      }
                    }
                    return Promise.resolve({ data: null, error: null })
                  },
                }
              },
              in(col: string, ids: string[]) {
                return {
                  eq(col2: string, val2: unknown) {
                    for (const t of decisionTokens) {
                      if (ids.includes((t as any)[col]) && (t as any)[col2] === val2) {
                        Object.assign(t, payload)
                      }
                    }
                    return Promise.resolve({ data: null, error: null })
                  },
                }
              },
            }
          },
        }
      }

      throw new Error(`Unexpected table ${table}`)
    },
  }

  return api as any
}

async function smokeFallbackRace() {
  const groupId = 'group-1'
  const rows: Row[] = [
    { id: 'a', status: 'accepted', updated_at: '2026-07-18T12:00:01Z', fallback_group_id: groupId },
    { id: 'b', status: 'accepted', updated_at: '2026-07-18T12:00:02Z', fallback_group_id: groupId },
    { id: 'c', status: 'accepted', updated_at: '2026-07-18T12:00:03Z', fallback_group_id: groupId },
    { id: 'd', status: 'pending', updated_at: '2026-07-18T12:00:00Z', fallback_group_id: groupId },
  ]

  const supabase = createMemorySupabase(rows)
  const backupBooking = {
    id: 'c',
    fallback_group_id: groupId,
    fallback_previous_booking_id: 'primary-1',
  }

  const [claimA, claimB, claimC] = await Promise.all([
    resolveFallbackAcceptClaim(supabase, { ...backupBooking, id: 'a' }, 'a'),
    resolveFallbackAcceptClaim(supabase, { ...backupBooking, id: 'b' }, 'b'),
    resolveFallbackAcceptClaim(supabase, backupBooking, 'c'),
  ])

  assert.equal(claimA.ok, true)
  assert.equal(claimB.ok, true)
  assert.equal(claimC.ok, false)

  const accepted = rows.filter((r) => r.status === 'accepted').map((r) => r.id).sort()
  assert.deepEqual(accepted, ['a', 'b'])
  assert.equal(rows.find((r) => r.id === 'c')?.status, 'expired')
  assert.equal(rows.find((r) => r.id === 'd')?.status, 'expired')
  assert.equal(FALLBACK_MAX_ACCEPTED_CANDIDATES, 2)
}

function smokeStaticFinalizeAndNotifications() {
  const root = process.cwd()
  const validate = fs.readFileSync(path.join(root, 'app/api/booking-validate/route.ts'), 'utf8')
  assert.equal(validate.includes('bookingValidatedToChef'), false)
  assert.equal(validate.includes('getValidationMessage'), false)
  assert.equal(validate.includes('bookingValidatedToAdmin'), true)
  assert.match(validate, /phone/)

  const checkFallback = fs.readFileSync(
    path.join(root, 'app/api/check-fallback-bookings/route.ts'),
    'utf8'
  )
  assert.match(checkFallback, /dispatchFallbackToAllBackupChefs/)
  assert.doesNotMatch(checkFallback, /createNextFallbackBooking/)

  assert.equal(FALLBACK_EXCLUSIVE_WINDOW_HOURS, 4)
  assert.equal(FALLBACK_EXCLUSIVE_WINDOW_MS, 4 * 60 * 60 * 1000)

  assert.equal(
    emailSubjects.bookingRequestToChef('Ada', 'Lovelace'),
    'Demande exclusive : Ada Lovelace vous a choisi comme chef'
  )

  const primaryHtml = emailTemplates.bookingRequestToChef(
    'Chef Test',
    {
      firstName: 'Ada',
      lastName: 'Lovelace',
      serviceTypeLabel: 'Repas à domicile',
      serviceType: 'repas_domicile',
      guestsCount: 4,
      childrenCount: 0,
      city: 'Paris',
      postalCode: '75001',
      phone: '0600000000',
      hasAllergies: false,
      allergiesDetails: '',
      notes: '',
      bookingDate: 'samedi 1 janvier 2026',
      mealTimeLabel: 'Dîner',
    },
    'https://example.com/accept',
    'https://example.com/refuse',
    'https://example.com',
    { showFallbackPriority: true }
  )
  assert.match(primaryHtml, /pendant 6 heures/)

  // WhatsApp must stay off unless explicitly enabled in env
  assert.equal(isWhatsAppBookingNotificationsEnabled(), process.env.WHATSAPP_BOOKING_NOTIFICATIONS_ENABLED === 'true')
}

async function main() {
  console.log('Smoke: winner selection helper')
  assert.deepEqual(
    selectFallbackAcceptWinnerIds([
      { id: 'c', updated_at: '3' },
      { id: 'a', updated_at: '1' },
      { id: 'b', updated_at: '2' },
    ]),
    ['a', 'b']
  )

  console.log('Smoke: concurrent backup accepts keep only first two')
  await smokeFallbackRace()

  console.log('Smoke: finalize / cron / email / WhatsApp static checks')
  smokeStaticFinalizeAndNotifications()

  console.log('OK — july predeploy smoke passed (offline, no real users)')
}

main().catch((err) => {
  console.error('FAIL', err)
  process.exit(1)
})
