import type { RegionBBox } from '@/lib/regions'

export interface ExploreLocationSuggestion {
  id: string
  label: string
  center: [number, number]
  bbox?: RegionBBox | null
}

export interface ExploreLocationSelection {
  label: string
  center: [number, number]
  bbox?: RegionBBox | null
  source?: string
  zoom?: number
}

export interface ExploreLocationSearchState {
  query: string
  pin: {
    key: string
    center: [number, number]
  }
  activeSearch: {
    center: [number, number]
    bbox?: RegionBBox | null
  }
  viewport: {
    key: string
    center: [number, number]
    zoom: number
    bbox?: RegionBBox | null
  }
}

export const EXPLORE2_PATH = '/explore2'
export const EXPLORE_LOCATION_SEARCH_DEBOUNCE_MS = 300
export const MAPBOX_EXPLORE_PLACE_TYPES = 'address,place,locality,postcode,neighborhood'

interface MapboxGeocodeFeature {
  id?: string
  text?: string
  place_name?: string
  center?: number[]
  bbox?: number[]
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export function bbox100kmAroundCenter(center: [number, number]): RegionBBox {
  const [lng, lat] = center
  const kmPerDegLat = 111.32
  const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180)
  const deltaLat = 100 / kmPerDegLat
  const deltaLng = 100 / kmPerDegLng
  return [lng - deltaLng, lat - deltaLat, lng + deltaLng, lat + deltaLat]
}

export function mapboxFeatureToSuggestion(feature: MapboxGeocodeFeature): ExploreLocationSuggestion | null {
  const center = Array.isArray(feature?.center) ? feature.center : null
  if (!center || center.length < 2) return null
  const lng = Number(center[0])
  const lat = Number(center[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  const bbox =
    Array.isArray(feature?.bbox) && feature.bbox.length === 4
      ? ([Number(feature.bbox[0]), Number(feature.bbox[1]), Number(feature.bbox[2]), Number(feature.bbox[3])] as RegionBBox)
      : null
  const label = String(feature.place_name || feature.text || '').trim()
  if (!label) return null
  return {
    id: String(feature.id || `${lng},${lat}`),
    label,
    center: [lng, lat],
    bbox,
  }
}

export function parseExploreLocationParams(searchParams: {
  lat?: string | string[]
  lng?: string | string[]
  q?: string | string[]
  source?: string | string[]
} | null | undefined): ExploreLocationSelection | null {
  if (!searchParams) return null
  const lat = Number(firstParam(searchParams.lat))
  const lng = Number(firstParam(searchParams.lng))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  const label = (firstParam(searchParams.q) || '').trim()
  const source = (firstParam(searchParams.source) || '').trim()
  return {
    label: label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    center: [lng, lat],
    bbox: null,
    source: source || undefined,
  }
}

export function buildExplore2LocationUrl(
  selection: ExploreLocationSelection,
  origin?: string
): string {
  const params = new URLSearchParams()
  params.set('lat', String(selection.center[1]))
  params.set('lng', String(selection.center[0]))
  params.set('q', selection.label)
  if (selection.source) params.set('source', selection.source)
  const path = `${EXPLORE2_PATH}?${params.toString()}`
  if (!origin) return path
  return new URL(path, origin).toString()
}

export function buildSearchStateFromSelection(
  selection: ExploreLocationSelection,
  keyPrefix = 'location'
): ExploreLocationSearchState {
  const key = `${keyPrefix}-${selection.center[0]},${selection.center[1]}`
  const zoom = selection.zoom ?? 6
  return {
    query: selection.label,
    pin: {
      key,
      center: selection.center,
    },
    activeSearch: {
      center: selection.center,
      bbox: selection.bbox || null,
    },
    viewport: {
      key,
      center: selection.center,
      zoom,
      bbox: bbox100kmAroundCenter(selection.center),
    },
  }
}

function buildMapboxGeocodeUrl(query: string, locale: string, token: string, autocomplete: boolean, limit: number): string {
  return `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?autocomplete=${autocomplete ? 'true' : 'false'}&limit=${limit}&language=${locale}&country=fr&types=${MAPBOX_EXPLORE_PLACE_TYPES}&access_token=${token}`
}

export async function fetchExploreLocationSuggestions(
  query: string,
  locale: string,
  token: string,
  signal?: AbortSignal
): Promise<ExploreLocationSuggestion[]> {
  const response = await fetch(buildMapboxGeocodeUrl(query, locale, token, true, 8), { signal })
  if (!response.ok) throw new Error('Erreur recherche')
  const payload = await response.json()
  if (!Array.isArray(payload?.features)) return []
  return payload.features
    .map((feature: MapboxGeocodeFeature) => mapboxFeatureToSuggestion(feature))
    .filter((item: ExploreLocationSuggestion | null): item is ExploreLocationSuggestion => !!item)
}

export async function geocodeExploreLocationQuery(
  query: string,
  locale: string,
  token: string,
  signal?: AbortSignal
): Promise<ExploreLocationSuggestion | null> {
  const response = await fetch(buildMapboxGeocodeUrl(query, locale, token, false, 1), { signal })
  if (!response.ok) throw new Error('Erreur recherche')
  const payload = await response.json()
  const feature = Array.isArray(payload?.features) ? payload.features[0] : null
  if (!feature) return null
  return mapboxFeatureToSuggestion(feature)
}
