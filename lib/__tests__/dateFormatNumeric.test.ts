/**
 * Locale-stable numeric date formatting for the booking form.
 * Run: npx --yes tsx --test lib/__tests__/dateFormatNumeric.test.ts
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatDateNumeric, numericDatePlaceholder } from '../dateUtils'

describe('formatDateNumeric', () => {
  it('formats French dates as DD/MM/YYYY regardless of environment locale', () => {
    assert.equal(formatDateNumeric('2026-08-12', 'fr'), '12/08/2026')
    assert.equal(formatDateNumeric('2026-12-08', 'fr'), '08/12/2026')
    assert.equal(formatDateNumeric('2026-08-12', 'fr-FR'), '12/08/2026')
  })

  it('formats English dates as MM/DD/YYYY', () => {
    assert.equal(formatDateNumeric('2026-08-12', 'en'), '08/12/2026')
    assert.equal(formatDateNumeric('2026-12-08', 'en'), '12/08/2026')
  })

  it('returns empty string for invalid or missing values', () => {
    assert.equal(formatDateNumeric('', 'fr'), '')
    assert.equal(formatDateNumeric(null, 'fr'), '')
    assert.equal(formatDateNumeric('not-a-date', 'fr'), '')
  })
})

describe('numericDatePlaceholder', () => {
  it('uses French day-first placeholder by default', () => {
    assert.equal(numericDatePlaceholder('fr'), 'JJ/MM/AAAA')
    assert.equal(numericDatePlaceholder(), 'JJ/MM/AAAA')
  })

  it('uses English month-first placeholder', () => {
    assert.equal(numericDatePlaceholder('en'), 'MM/DD/YYYY')
  })
})
