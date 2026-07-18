/**
 * Regression tests for participant idempotency + submit guard.
 * Run: npx --yes tsx --test lib/__tests__/ensureParticipants.test.ts
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ensureConversationParticipants,
  prepareParticipantsForUpsert,
  type ParticipantInput,
} from '../ensureParticipants'
import { createInFlightGuard } from '../submitGuard'

type MockRow = {
  id: string
  conversation_id: string
  email: string
  role: 'client' | 'chef'
  user_id: string | null
}

function createMockSupabase(options?: {
  failFirstUpsertWithUnique?: boolean
  failUpsertWithOtherError?: boolean
}) {
  const store = new Map<string, MockRow>()
  let upsertCalls = 0
  let selectCalls = 0

  const keyOf = (conversationId: string, email: string) =>
    `${conversationId}::${email.toLowerCase()}`

  const api = {
    upsertCalls: () => upsertCalls,
    selectCalls: () => selectCalls,
    rows: () => Array.from(store.values()),
    from(_table: string) {
      const chain: any = {
        upsert(rows: ParticipantInput[], _opts?: unknown) {
          upsertCalls += 1
          return {
            select() {
              return (async () => {
                if (options?.failUpsertWithOtherError) {
                  return {
                    data: null,
                    error: { code: '42501', message: 'permission denied for table participants' },
                  }
                }

                if (options?.failFirstUpsertWithUnique && upsertCalls === 1) {
                  // Simulate concurrent insert already present
                  for (const row of rows) {
                    const key = keyOf(row.conversation_id, row.email)
                    if (!store.has(key)) {
                      store.set(key, {
                        id: `existing-${store.size + 1}`,
                        conversation_id: row.conversation_id,
                        email: row.email.toLowerCase(),
                        role: row.role,
                        user_id: row.user_id ?? null,
                      })
                    }
                  }
                  return {
                    data: null,
                    error: {
                      code: '23505',
                      message:
                        'duplicate key value violates unique constraint "participants_conversation_id_email_key"',
                    },
                  }
                }

                const result: MockRow[] = []
                for (const row of rows) {
                  const key = keyOf(row.conversation_id, row.email)
                  const existing = store.get(key)
                  if (existing) {
                    const updated = {
                      ...existing,
                      role: row.role,
                      user_id: row.user_id ?? existing.user_id,
                    }
                    store.set(key, updated)
                    result.push(updated)
                  } else {
                    const created: MockRow = {
                      id: `id-${store.size + 1}`,
                      conversation_id: row.conversation_id,
                      email: row.email.toLowerCase(),
                      role: row.role,
                      user_id: row.user_id ?? null,
                    }
                    store.set(key, created)
                    result.push(created)
                  }
                }
                return { data: result, error: null }
              })()
            },
          }
        },
        update(payload: { user_id?: string | null }) {
          let conversationId = ''
          let email = ''
          let onlyNullUser = false
          const updateChain: any = {
            eq(col: string, val: string) {
              if (col === 'conversation_id') conversationId = val
              if (col === 'email') email = val
              return updateChain
            },
            is(col: string, val: null) {
              if (col === 'user_id' && val === null) onlyNullUser = true
              return (async () => {
                const key = keyOf(conversationId, email)
                const row = store.get(key)
                if (row && (!onlyNullUser || row.user_id === null)) {
                  store.set(key, { ...row, user_id: payload.user_id ?? row.user_id })
                }
                return { data: null, error: null }
              })()
            },
          }
          return updateChain
        },
        select(_cols?: string) {
          selectCalls += 1
          let conversationId = ''
          let emails: string[] = []
          const selectChain: any = {
            eq(col: string, val: string) {
              if (col === 'conversation_id') conversationId = val
              return selectChain
            },
            in(col: string, vals: string[]) {
              if (col === 'email') emails = vals.map((e) => e.toLowerCase())
              return (async () => {
                const data = Array.from(store.values()).filter(
                  (r) =>
                    r.conversation_id === conversationId &&
                    (emails.length === 0 || emails.includes(r.email.toLowerCase()))
                )
                return { data, error: null }
              })()
            },
          }
          return selectChain
        },
      }
      return chain
    },
  }

  return api
}

describe('prepareParticipantsForUpsert', () => {
  it('normalizes emails and keeps distinct client/chef rows', () => {
    const result = prepareParticipantsForUpsert([
      {
        conversation_id: 'c1',
        email: ' Client@Example.com ',
        role: 'client',
        user_id: 'u1',
      },
      {
        conversation_id: 'c1',
        email: 'chef@example.com',
        role: 'chef',
        user_id: null,
      },
    ])

    assert.equal(result.length, 2)
    assert.equal(result[0].email, 'client@example.com')
    assert.equal(result[0].role, 'client')
    assert.equal(result[1].email, 'chef@example.com')
    assert.equal(result[1].role, 'chef')
  })

  it('dedupes same conversation + email and keeps first role', () => {
    const result = prepareParticipantsForUpsert([
      {
        conversation_id: 'c1',
        email: 'same@example.com',
        role: 'client',
        user_id: null,
      },
      {
        conversation_id: 'c1',
        email: 'SAME@example.com',
        role: 'chef',
        user_id: 'u-chef',
      },
    ])

    assert.equal(result.length, 1)
    assert.equal(result[0].role, 'client')
    assert.equal(result[0].user_id, 'u-chef')
  })
})

describe('ensureConversationParticipants', () => {
  it('first participant insert succeeds', async () => {
    const supabase = createMockSupabase()
    const { data, error } = await ensureConversationParticipants(supabase as any, [
      {
        conversation_id: 'conv-1',
        email: 'client@test.com',
        role: 'client',
        user_id: 'u1',
      },
      {
        conversation_id: 'conv-1',
        email: 'chef@test.com',
        role: 'chef',
        user_id: null,
      },
    ])

    assert.equal(error, null)
    assert.equal(data?.length, 2)
    assert.equal(supabase.upsertCalls(), 1)
    assert.equal(supabase.rows().length, 2)
  })

  it('repeated insert for same conversation + email is idempotent', async () => {
    const supabase = createMockSupabase()
    const payload = [
      {
        conversation_id: 'conv-2',
        email: 'client@test.com',
        role: 'client' as const,
        user_id: 'u1',
      },
      {
        conversation_id: 'conv-2',
        email: 'chef@test.com',
        role: 'chef' as const,
        user_id: null,
      },
    ]

    const first = await ensureConversationParticipants(supabase as any, payload)
    const second = await ensureConversationParticipants(supabase as any, payload)

    assert.equal(first.error, null)
    assert.equal(second.error, null)
    assert.equal(supabase.rows().length, 2)
    assert.equal(supabase.upsertCalls(), 2)
  })

  it('near-simultaneous unique conflict does not fail the booking', async () => {
    const supabase = createMockSupabase({ failFirstUpsertWithUnique: true })
    const { data, error } = await ensureConversationParticipants(supabase as any, [
      {
        conversation_id: 'conv-race',
        email: 'client@test.com',
        role: 'client',
        user_id: 'u1',
      },
      {
        conversation_id: 'conv-race',
        email: 'chef@test.com',
        role: 'chef',
        user_id: null,
      },
    ])

    assert.equal(error, null)
    assert.ok(data && data.length >= 1)
    assert.ok(supabase.selectCalls() >= 1)
  })

  it('does not hide unrelated database errors', async () => {
    const supabase = createMockSupabase({ failUpsertWithOtherError: true })
    const { data, error } = await ensureConversationParticipants(supabase as any, [
      {
        conversation_id: 'conv-err',
        email: 'client@test.com',
        role: 'client',
      },
    ])

    assert.equal(data, null)
    assert.ok(error)
    assert.match(error!.message, /permission denied/)
  })
})

describe('createInFlightGuard (mobile double-submit)', () => {
  it('allows only one in-flight submission', () => {
    const guard = createInFlightGuard()
    assert.equal(guard.tryStart(), true)
    assert.equal(guard.tryStart(), false)
    assert.equal(guard.pending, true)
    guard.finish()
    assert.equal(guard.tryStart(), true)
  })
})
