export interface MapboxGeocodeFeature {
  id: string
  place_name?: string
  text?: string
  center?: [number, number]
  context?: Array<{ id?: string; text?: string }>
  properties?: { postcode?: string }
}

export function extractMapboxContextValue(feature: MapboxGeocodeFeature, prefixes: string[]): string {
  const match = feature.context?.find((item) => {
    const id = item.id || ''
    return prefixes.some((prefix) => id.startsWith(prefix))
  })
  return match?.text || ''
}

/**
 * Convertit une feature Mapbox Places en champs structurés pour la réservation (France).
 */
export function mapboxFeatureToBookingPlace(feature: MapboxGeocodeFeature): {
  fullAddress: string
  city: string
  postalCode: string
  latitude: number
  longitude: number
} | null {
  if (!feature.center || feature.center.length !== 2) return null
  const [longitude, latitude] = feature.center
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  let postalCode =
    feature.properties?.postcode ||
    extractMapboxContextValue(feature, ['postcode']) ||
    ''
  if (!postalCode) {
    const m = (feature.place_name || '').match(/\b(\d{5})\b/)
    if (m) postalCode = m[1]
  }

  let city =
    extractMapboxContextValue(feature, ['place', 'locality', 'district']) ||
    feature.text ||
    ''

  if (!city && postalCode) {
    const name = feature.place_name || ''
    const tail = name.split(postalCode)[1]?.replace(/^[, ]+/, '').trim()
    if (tail) {
      city = tail.split(',')[0].trim()
    }
  }

  if (!postalCode || !city) return null
  if (!/^\d{5}$/.test(postalCode)) return null

  const fullAddress = (feature.place_name || feature.text || '').trim()
  if (!fullAddress) return null

  return {
    fullAddress,
    city: city.trim(),
    postalCode,
    latitude,
    longitude,
  }
}
