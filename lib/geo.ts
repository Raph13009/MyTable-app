/** Rayon par défaut pour les suggestions de chefs « à proximité » (fallback réservation). */
export const BOOKING_FALLBACK_RADIUS_KM = 100

export function parseClientCoord(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number.parseFloat(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const EARTH_RADIUS_KM = 6371

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

export function boundingBoxForRadiusKm(latitude: number, longitude: number, radiusKm: number) {
  const latDelta = radiusKm / 111
  const cosLat = Math.cos((latitude * Math.PI) / 180)
  const lonDelta = cosLat > 1e-6 ? radiusKm / (111 * cosLat) : latDelta
  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLon: longitude - lonDelta,
    maxLon: longitude + lonDelta,
  }
}
