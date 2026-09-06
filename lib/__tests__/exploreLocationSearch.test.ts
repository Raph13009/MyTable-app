/**
 * Regression tests for explore location search URL + Mapbox mapping.
 * Run: npx --yes tsx --test lib/__tests__/exploreLocationSearch.test.ts
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseEmbedSearchLocale } from '../i18n'
import {
  bbox100kmAroundCenter,
  buildExplore2LocationUrl,
  buildSearchStateFromSelection,
  mapboxFeatureToSuggestion,
  parseExploreLocationParams,
} from '../exploreLocationSearch'

describe('parseEmbedSearchLocale', () => {
  it('maps WordPress/html lang values to fr or en', () => {
    assert.equal(parseEmbedSearchLocale('en'), 'en')
    assert.equal(parseEmbedSearchLocale('en-US'), 'en')
    assert.equal(parseEmbedSearchLocale('fr_FR'), 'fr')
    assert.equal(parseEmbedSearchLocale('de'), 'fr')
    assert.equal(parseEmbedSearchLocale(undefined), 'fr')
  })
})

describe('parseExploreLocationParams', () => {
  it('parses a valid lat/lng/q contract', () => {
    const parsed = parseExploreLocationParams({
      lat: '48.8566',
      lng: '2.3522',
      q: 'Paris, France',
      source: 'wordpress',
    })
    assert.ok(parsed)
    assert.equal(parsed?.label, 'Paris, France')
    assert.deepEqual(parsed?.center, [2.3522, 48.8566])
    assert.equal(parsed?.source, 'wordpress')
  })

  it('rejects invalid coordinates', () => {
    assert.equal(parseExploreLocationParams({ lat: '99', lng: '2' }), null)
    assert.equal(parseExploreLocationParams({ lat: 'paris', lng: '2' }), null)
    assert.equal(parseExploreLocationParams({}), null)
  })
})

describe('buildExplore2LocationUrl', () => {
  it('serializes lat, lng, q and source', () => {
    const url = buildExplore2LocationUrl({
      label: 'Lyon, France',
      center: [4.8357, 45.764],
      source: 'wordpress',
    })
    assert.equal(url.startsWith('/explore2?'), true)
    assert.match(url, /lat=45\.764/)
    assert.match(url, /lng=4\.8357/)
    assert.match(url, /q=Lyon/)
    assert.match(url, /source=wordpress/)
  })
})

describe('bbox100kmAroundCenter', () => {
  it('builds a ~100km bounding box around a point', () => {
    const bbox = bbox100kmAroundCenter([2.3522, 48.8566])
    assert.equal(bbox.length, 4)
    assert.ok(bbox[0] < 2.3522 && bbox[2] > 2.3522)
    assert.ok(bbox[1] < 48.8566 && bbox[3] > 48.8566)
    const latDeltaKm = (bbox[3] - bbox[1]) * 111.32
    assert.ok(Math.abs(latDeltaKm - 200) < 1)
  })
})

describe('mapboxFeatureToSuggestion', () => {
  it('maps a Mapbox feature to a suggestion', () => {
    const suggestion = mapboxFeatureToSuggestion({
      id: 'place.1',
      place_name: 'Paris, France',
      center: [2.35, 48.85],
      bbox: [2.2, 48.8, 2.5, 48.9],
    })
    assert.ok(suggestion)
    assert.equal(suggestion?.label, 'Paris, France')
    assert.deepEqual(suggestion?.center, [2.35, 48.85])
  })

  it('returns null without a usable center or label', () => {
    assert.equal(mapboxFeatureToSuggestion({ place_name: 'Paris' }), null)
    assert.equal(mapboxFeatureToSuggestion({ center: [2.35, 48.85] }), null)
  })
})

describe('buildSearchStateFromSelection', () => {
  it('creates pin, viewport and query from a selection', () => {
    const state = buildSearchStateFromSelection({
      label: 'Nantes, France',
      center: [-1.5536, 47.2184],
    })
    assert.equal(state.query, 'Nantes, France')
    assert.deepEqual(state.pin.center, [-1.5536, 47.2184])
    assert.equal(state.viewport.zoom, 6)
    assert.equal(state.viewport.bbox?.length, 4)
  })

  it('reuses the 100km search viewport for city deep links', () => {
    const center: [number, number] = [6.6398, 43.2727]
    const searchState = buildSearchStateFromSelection({
      label: 'Saint-Tropez, France',
      center,
    })
    const cityUrlState = buildSearchStateFromSelection({
      label: 'Saint-Tropez, France',
      center,
      source: 'city-url',
    })
    assert.deepEqual(cityUrlState.viewport.bbox, searchState.viewport.bbox)
    assert.deepEqual(cityUrlState.viewport.bbox, bbox100kmAroundCenter(center))
    assert.equal(cityUrlState.viewport.zoom, searchState.viewport.zoom)
    assert.deepEqual(cityUrlState.pin.center, center)
  })
})
