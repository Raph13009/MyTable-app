import { createAdminClient } from '@/lib/supabase/admin'
import { ExploreLayout } from '@/components/explore/ExploreLayout'
import { ExploreChef } from '@/components/explore/types'
import { getRegionBBoxBySlug, RegionBBox } from '@/lib/regions'

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

interface ExplorePageProps {
  searchParams?: {
    region?: string
  }
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const supabase = createAdminClient()
  const regionParam = typeof searchParams?.region === 'string' ? searchParams.region : null
  const regionBBox: RegionBBox | null = getRegionBBoxBySlug(regionParam)

  const { data, error } = await (supabase.from('chefs') as any)
    .select('id, slug, name, info_link_xx, profile_picture, cuisine_style, cuisine_style_en, availability_radius_km, min_guests, max_guests, latitude, longitude, menus(price)')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[explore] Failed to load chefs:', error.message)
  }

  const chefs: ExploreChef[] = (data || []).map((row: any) => {
    const menuPrices = Array.isArray(row.menus)
      ? row.menus
          .map((menu: any) => (typeof menu?.price === 'number' ? menu.price : Number(menu?.price)))
          .filter((price: number) => Number.isFinite(price))
      : []
    const minPrice = menuPrices.length > 0 ? Math.min(...menuPrices) : null

    return {
      id: String(row.id),
      slug: String(row.slug || row.id),
      name: row.name || 'Chef',
      infoLinkXx: typeof row.info_link_xx === 'string' && row.info_link_xx.trim() ? row.info_link_xx.trim() : null,
      image: row.profile_picture || null,
      cuisineType: row.cuisine_style || null,
      cuisineTypeEn: row.cuisine_style_en || null,
      availabilityRadiusKm:
        typeof row.availability_radius_km === 'number' && Number.isFinite(row.availability_radius_km)
          ? row.availability_radius_km
          : null,
      minPrice,
      minGuests: typeof row.min_guests === 'number' && Number.isFinite(row.min_guests) ? row.min_guests : null,
      maxGuests: typeof row.max_guests === 'number' && Number.isFinite(row.max_guests) ? row.max_guests : null,
      latitude: toNumber(row.latitude),
      longitude: toNumber(row.longitude),
    }
  })

  return <ExploreLayout chefs={chefs} initialRegionBBox={regionBBox} focusedRegionSlug={regionParam} />
}
