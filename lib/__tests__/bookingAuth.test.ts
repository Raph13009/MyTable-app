/**
 * Regression tests for booking authentication rules.
 * Run: npx --yes tsx --test lib/__tests__/bookingAuth.test.ts
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canSubmitBookingRequest,
  requireBookingSession,
  resolveBookingAuthGate,
  shouldShowAccountStep,
} from '../bookingAuth'

describe('requireBookingSession (server-side)', () => {
  it('blocks unauthenticated submission', () => {
    const result = requireBookingSession(null)
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.status, 401)
      assert.equal(result.error, 'unauthorized')
    }
  })

  it('blocks session without email', () => {
    const result = requireBookingSession({ id: 'user-1', email: null })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.status, 401)
    }
  })

  it('allows authenticated submission', () => {
    const result = requireBookingSession({
      id: 'user-1',
      email: ' Client@Example.com ',
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.userId, 'user-1')
      assert.equal(result.email, 'client@example.com')
    }
  })
})

describe('resolveBookingAuthGate / account step', () => {
  it('auth loading cannot bypass the account step', () => {
    assert.equal(
      resolveBookingAuthGate({ userLoading: true, currentUser: null }),
      'wait'
    )
    assert.equal(
      shouldShowAccountStep({ userLoading: true, currentUser: null }),
      false
    )
    assert.deepEqual(
      canSubmitBookingRequest({ userLoading: true, currentUser: null }),
      { ok: false, reason: 'auth_loading' }
    )
  })

  it('unauthenticated user must see account step', () => {
    assert.equal(
      resolveBookingAuthGate({ userLoading: false, currentUser: null }),
      'account_step'
    )
    assert.equal(
      shouldShowAccountStep({ userLoading: false, currentUser: null }),
      true
    )
    assert.deepEqual(
      canSubmitBookingRequest({ userLoading: false, currentUser: null }),
      { ok: false, reason: 'unauthenticated' }
    )
  })

  it('authenticated user can submit without account step', () => {
    const user = { id: 'u1', email: 'a@b.com' }
    assert.equal(
      resolveBookingAuthGate({ userLoading: false, currentUser: user }),
      'ready'
    )
    assert.equal(
      shouldShowAccountStep({ userLoading: false, currentUser: user }),
      false
    )
    assert.deepEqual(
      canSubmitBookingRequest({ userLoading: false, currentUser: user }),
      { ok: true }
    )
  })

  it('authenticated user stays ready even if a loading flag flickers', () => {
    const user = { id: 'u1', email: 'a@b.com' }
    assert.equal(
      resolveBookingAuthGate({ userLoading: true, currentUser: user }),
      'ready'
    )
  })
})
