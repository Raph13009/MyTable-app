import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BOOKING_FALLBACK_RADIUS_KM,
  boundingBoxForRadiusKm,
  haversineDistanceKm,
} from '@/lib/geo'
import { getBaseUrl } from '@/lib/utils'

export type NearbyChefSuggestion = {
  id: string
  name: string
  slug: string
  profileUrl: string
  cuisineStyle: string | null
}

type AdminClient = SupabaseClient

export async function findNearbyChefSuggestions(
  supabase: AdminClient,
  params: {
    latitude: number
    longitude: number
    excludeChefId: string
    limit?: number
    radiusKm?: number
    baseUrl?: string
  }
): Promise<NearbyChefSuggestion[]> {
  const limit = params.limit ?? 3
  const radiusKm = params.radiusKm ?? BOOKING_FALLBACK_RADIUS_KM
  const baseUrl = getBaseUrl(params.baseUrl)

  const { minLat, maxLat, minLon, maxLon } = boundingBoxForRadiusKm(
    params.latitude,
    params.longitude,
    radiusKm
  )

  const { data: rows, error } = await supabase
    .from('chefs')
    .select('id, name, slug, cuisine_style, latitude, longitude')
    .eq('is_publicly_visible', true)
    .neq('id', params.excludeChefId)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .not('slug', 'is', null)
    .gte('latitude', minLat)
    .lte('latitude', maxLat)
    .gte('longitude', minLon)
    .lte('longitude', maxLon)

  if (error || !rows?.length) return []

  const typed = rows as Array<{
    id: string
    name: string
    slug: string | null
    cuisine_style: string | null
    latitude: number
    longitude: number
  }>

  return typed
    .map((row) => {
      const lat = Number(row.latitude)
      const lon = Number(row.longitude)
      const slug = typeof row.slug === 'string' ? row.slug.trim() : ''
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !slug) return null
      const km = haversineDistanceKm(params.latitude, params.longitude, lat, lon)
      if (km > radiusKm) return null
      return {
        id: row.id,
        name: row.name,
        slug,
        profileUrl: `${baseUrl}/book/${encodeURIComponent(slug)}`,
        cuisineStyle: row.cuisine_style,
        distanceKm: km,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map(({ distanceKm: _distanceKm, ...chef }) => chef)
}
