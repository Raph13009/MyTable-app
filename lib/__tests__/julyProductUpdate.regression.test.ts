/**
 * Focused regression tests for July product-update critical logic.
 * Runnable without Jest/Vitest (not configured in this repo):
 *   npx tsx --test lib/__tests__/julyProductUpdate.regression.test.ts
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  FALLBACK_EXCLUSIVE_WINDOW_HOURS,
  FALLBACK_EXCLUSIVE_WINDOW_MS,
  FALLBACK_MAX_ACCEPTED_CANDIDATES,
} from '../fallbackBookings'
import { emailSubjects, emailTemplates } from '../email'

describe('July product update — fallback exclusivity constants', () => {
  it('uses a 4-hour exclusive window for the primary chef', () => {
    assert.equal(FALLBACK_EXCLUSIVE_WINDOW_HOURS, 4)
    assert.equal(FALLBACK_EXCLUSIVE_WINDOW_MS, 4 * 60 * 60 * 1000)
  })

  it('locks the backup broadcast after two accepts', () => {
    assert.equal(FALLBACK_MAX_ACCEPTED_CANDIDATES, 2)
  })
})

describe('July product update — chef booking request email subject', () => {
  it('builds the exclusive subject with customer first and last name', () => {
    assert.equal(
      emailSubjects.bookingRequestToChef('Marie', 'Dupont'),
      'Demande exclusive : Marie Dupont vous a choisi comme chef'
    )
  })

  it('falls back when names are missing', () => {
    assert.equal(
      emailSubjects.bookingRequestToChef('', ''),
      'Demande exclusive : Un client vous a choisi comme chef'
    )
  })
})

describe('July product update — chef email copy', () => {
  it('states the 4-hour priority window in the primary request email', () => {
    const html = emailTemplates.bookingRequestToChef(
      'Chef Test',
      {
        firstName: 'Marie',
        lastName: 'Dupont',
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
    assert.match(html, /pendant 4 heures/)
    assert.doesNotMatch(html, /pendant 6 heures/)
  })

  it('tells backup chefs that the first two accepts become candidates', () => {
    const html = emailTemplates.bookingReplacementRequestToChef(
      'Chef Backup',
      {
        firstName: 'Marie',
        lastName: 'Dupont',
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
        menuPricePerPerson: 80,
        estimatedTotalPrice: 320,
      },
      'https://example.com/accept',
      'https://example.com/refuse',
      'https://example.com'
    )
    assert.match(html, /Les 2 premiers chefs qui acceptent/)
    assert.doesNotMatch(html, /Le premier chef qui accepte obtient la mission/)
  })
})
