import { test } from 'node:test'
import assert from 'node:assert'
import { slugToCityName } from '../geocodeCitySlug'

test('slugToCityName: converts simple city names', () => {
  assert.strictEqual(slugToCityName('paris'), 'Paris')
  assert.strictEqual(slugToCityName('lyon'), 'Lyon')
  assert.strictEqual(slugToCityName('nice'), 'Nice')
})

test('slugToCityName: converts hyphenated city names', () => {
  assert.strictEqual(slugToCityName('saint-tropez'), 'Saint-Tropez')
  assert.strictEqual(slugToCityName('aix-en-provence'), 'Aix-En-Provence')
  assert.strictEqual(slugToCityName('la-rochelle'), 'La-Rochelle')
})

test('slugToCityName: handles multiple hyphens', () => {
  assert.strictEqual(slugToCityName('saint-jean-de-luz'), 'Saint-Jean-De-Luz')
  assert.strictEqual(slugToCityName('boulogne-billancourt'), 'Boulogne-Billancourt')
})

test('slugToCityName: handles mixed case input', () => {
  assert.strictEqual(slugToCityName('PARIS'), 'Paris')
  assert.strictEqual(slugToCityName('SaInT-TrOpEz'), 'Saint-Tropez')
  assert.strictEqual(slugToCityName('AIX-EN-PROVENCE'), 'Aix-En-Provence')
})

test('slugToCityName: handles empty and edge cases', () => {
  assert.strictEqual(slugToCityName(''), '')
  assert.strictEqual(slugToCityName('a'), 'A')
  assert.strictEqual(slugToCityName('a-b'), 'A-B')
})
