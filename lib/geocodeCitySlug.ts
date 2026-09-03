import { geocodeExploreLocationQuery, type ExploreLocationSuggestion } from './exploreLocationSearch'

/**
 * Converts a URL slug like "saint-tropez" or "aix-en-provence" 
 * to a properly formatted city name "Saint-Tropez", "Aix-en-Provence"
 */
export function slugToCityName(slug: string): string {
  return slug
    .split('-')
    .map(word => {
      // Capitalize first letter, lowercase rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join('-')
}

/**
 * Server-side function to geocode a city slug to coordinates.
 * Returns null if the city cannot be resolved.
 * 
 * @param citySlug - URL slug like "saint-tropez", "paris", "aix-en-provence"
 * @param locale - Locale for geocoding (e.g., "fr")
 * @returns ExploreLocationSuggestion or null if geocoding fails
 */
export async function geocodeCitySlug(
  citySlug: string,
  locale: string = 'fr'
): Promise<ExploreLocationSuggestion | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim()
  
  if (!token) {
    console.error('[geocodeCitySlug] Missing NEXT_PUBLIC_MAPBOX_TOKEN')
    return null
  }

  const normalizedSlug = citySlug.trim().toLowerCase()
  if (!normalizedSlug) {
    return null
  }

  const cityQuery = slugToCityName(normalizedSlug)

  try {
    const result = await geocodeExploreLocationQuery(cityQuery, locale, token)
    return result
  } catch (error) {
    console.error(`[geocodeCitySlug] Failed to geocode "${cityQuery}":`, error)
    return null
  }
}
