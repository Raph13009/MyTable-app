import { parseClientCoord } from '@/lib/geo'

export type GeocodedPoint = { latitude: number; longitude: number }

function getMapboxToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim()
  return token || null
}

/**
 * Géocode une adresse de prestation (serveur) via Mapbox.
 * Utilise full_address en priorité, sinon « code postal + ville ».
 */
export async function geocodeBookingAddress(input: {
  fullAddress?: string | null
  city?: string | null
  postalCode?: string | null
}): Promise<GeocodedPoint | null> {
  const token = getMapboxToken()
  if (!token) return null

  const full = typeof input.fullAddress === 'string' ? input.fullAddress.trim() : ''
  const city = typeof input.city === 'string' ? input.city.trim() : ''
  const postal = typeof input.postalCode === 'string' ? input.postalCode.replace(/\s/g, '').trim() : ''

  const query =
    full.length >= 4
      ? `${full}, France`
      : postal && city
        ? `${postal} ${city}, France`
        : ''

  if (!query) return null

  try {
    const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?autocomplete=false&limit=1&language=fr&country=fr&types=address,place,postcode,locality,neighborhood&access_token=${token}`
    const res = await fetch(endpoint)
    if (!res.ok) return null

    const json = await res.json()
    const center = json?.features?.[0]?.center
    if (!Array.isArray(center) || center.length < 2) return null

    const longitude = parseClientCoord(center[0])
    const latitude = parseClientCoord(center[1])
    if (
      latitude === null ||
      longitude === null ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return null
    }

    return { latitude, longitude }
  } catch {
    return null
  }
}
