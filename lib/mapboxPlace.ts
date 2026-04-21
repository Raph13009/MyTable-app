export interface MapboxGeocodeFeature {
  id: string
  place_name?: string
  text?: string
  center?: [number, number]
  context?: Array<{ id?: string; text?: string }>
  place_type?: string[]
  properties?: { postcode?: string }
}

/**
 * Récupère la première valeur de contexte dont l’id commence par l’un des préfixes,
 * en respectant l’ordre de priorité des préfixes (le premier préfixe gagne).
 */
export function extractMapboxContextValue(feature: MapboxGeocodeFeature, prefixes: string[]): string {
  for (const prefix of prefixes) {
    const match = feature.context?.find((item) => (item.id || '').startsWith(prefix))
    if (match?.text) return match.text
  }
  return ''
}

/** Supprime « 15e Arrondissement », « 1er Arrondissement », etc. d’un libellé ville. */
function stripArrondissement(city: string): string {
  return city
    .replace(/\s+\d{1,2}(?:er|re|e|ème|eme)\s+Arrondissement/gi, '')
    .replace(/\s+Arrondissement\s*\d+/gi, '')
    .trim()
}

const FR_ARRONDISSEMENT_CITY: Array<{ prefix: string; city: string }> = [
  { prefix: '75', city: 'Paris' },
  { prefix: '13', city: 'Marseille' },
  { prefix: '69', city: 'Lyon' },
]

/** Si le code postal correspond à une grande ville à arrondissements, renvoie le nom de la ville parente. */
function frenchParentCityFromPostcode(postalCode: string): string | null {
  if (!/^\d{5}$/.test(postalCode)) return null
  for (const entry of FR_ARRONDISSEMENT_CITY) {
    if (postalCode.startsWith(entry.prefix)) return entry.city
  }
  return null
}

/**
 * Code postal « central » pour permettre aux features de type `place` / `locality` (ville seule)
 * d’être sélectionnables dans l’autocomplete de réservation. Réservé aux grandes villes FR.
 */
const FR_CITY_DEFAULT_POSTCODE: Record<string, string> = {
  paris: '75001',
  marseille: '13001',
  lyon: '69001',
  toulouse: '31000',
  nice: '06000',
  nantes: '44000',
  bordeaux: '33000',
  lille: '59000',
  strasbourg: '67000',
  montpellier: '34000',
  rennes: '35000',
  'aix-en-provence': '13100',
}

function normalizeFrCityKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .trim()
}

function isPlaceFeature(feature: MapboxGeocodeFeature): boolean {
  if (feature.place_type?.some((t) => t === 'place')) return true
  if ((feature.id || '').startsWith('place.')) return true
  return false
}

/**
 * Convertit une feature Mapbox Places en champs structurés pour la réservation (France).
 * - `city` est normalisée sur la ville parente (Paris, Marseille, Lyon) lorsque la feature
 *   correspond à un arrondissement.
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
    extractMapboxContextValue(feature, ['place']) ||
    extractMapboxContextValue(feature, ['locality', 'district']) ||
    feature.text ||
    ''

  if (!city && postalCode) {
    const name = feature.place_name || ''
    const tail = name.split(postalCode)[1]?.replace(/^[, ]+/, '').trim()
    if (tail) {
      city = tail.split(',')[0].trim()
    }
  }

  city = stripArrondissement(city)

  // Fallback ville seule (feature `place`) pour grandes villes FR connues.
  if (!postalCode && isPlaceFeature(feature)) {
    const key = normalizeFrCityKey(city)
    const defaultPostcode = key ? FR_CITY_DEFAULT_POSTCODE[key] : undefined
    if (defaultPostcode) postalCode = defaultPostcode
  }

  const parentCity = frenchParentCityFromPostcode(postalCode)
  if (parentCity) city = parentCity

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
