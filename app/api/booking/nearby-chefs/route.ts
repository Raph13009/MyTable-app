import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  BOOKING_FALLBACK_RADIUS_KM,
  boundingBoxForRadiusKm,
  haversineDistanceKm,
  parseClientCoord,
} from '@/lib/geo'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const clientLatitude = parseClientCoord(body.clientLatitude)
    const clientLongitude = parseClientCoord(body.clientLongitude)
    const excludeChefId = typeof body.excludeChefId === 'string' ? body.excludeChefId.trim() : ''
    const radiusKm =
      parseClientCoord(body.radiusKm) ?? BOOKING_FALLBACK_RADIUS_KM

    if (
      clientLatitude === null ||
      clientLongitude === null ||
      clientLatitude < -90 ||
      clientLatitude > 90 ||
      clientLongitude < -180 ||
      clientLongitude > 180
    ) {
      return NextResponse.json({ error: 'Coordonnées client invalides' }, { status: 400 })
    }

    if (!excludeChefId) {
      return NextResponse.json({ error: 'excludeChefId requis' }, { status: 400 })
    }

    if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 500) {
      return NextResponse.json({ error: 'Rayon invalide' }, { status: 400 })
    }

    const { minLat, maxLat, minLon, maxLon } = boundingBoxForRadiusKm(
      clientLatitude,
      clientLongitude,
      radiusKm
    )

    const supabase = createAdminClient()
    const { data: rows, error } = await supabase
      .from('chefs')
      .select(
        'id, name, profile_picture, slug, cuisine_style, dish_photos, min_guests, max_guests, latitude, longitude'
      )
      .neq('id', excludeChefId)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .gte('latitude', minLat)
      .lte('latitude', maxLat)
      .gte('longitude', minLon)
      .lte('longitude', maxLon)

    if (error) {
      console.error('[nearby-chefs] Supabase error:', error.message)
      return NextResponse.json({ error: 'Erreur lors de la recherche des chefs' }, { status: 500 })
    }

    const typed = (rows || []) as Array<{
      id: string
      name: string
      profile_picture: string | null
      slug: string | null
      cuisine_style: string | null
      dish_photos: unknown
      min_guests: number | null
      max_guests: number | null
      latitude: number
      longitude: number
    }>

    const withDistance = typed
      .map((row) => {
        const lat = Number(row.latitude)
        const lon = Number(row.longitude)
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
        const km = haversineDistanceKm(clientLatitude, clientLongitude, lat, lon)
        if (km > radiusKm) return null
        return { row, distanceKm: km }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 6)
      .map(({ row }) => ({
        id: row.id,
        name: row.name,
        profile_picture: row.profile_picture,
        slug: row.slug,
        cuisine_style: row.cuisine_style,
        dish_photos: row.dish_photos,
        min_guests: row.min_guests,
        max_guests: row.max_guests,
      }))

    return NextResponse.json({ chefs: withDistance })
  } catch (e) {
    console.error('[nearby-chefs] Unexpected error:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
