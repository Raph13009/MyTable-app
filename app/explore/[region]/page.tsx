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

interface ExploreRegionPageProps {
  params: {
    region: string
  }
}

export default async function ExploreRegionPage({ params }: ExploreRegionPageProps) {
  const supabase = createAdminClient()
  const regionBBox: RegionBBox | null = getRegionBBoxBySlug(params.region)

  const { data, error } = await (supabase.from('chefs') as any)
    .select('id, slug, name, profile_picture, cuisine_style, latitude, longitude, menus(price)')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[explore-region] Failed to load chefs:', error.message)
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
      image: row.profile_picture || null,
      cuisineType: row.cuisine_style || null,
      minPrice,
      latitude: toNumber(row.latitude),
      longitude: toNumber(row.longitude),
    }
  })

  return <ExploreLayout chefs={chefs} initialRegionBBox={regionBBox} focusedRegionSlug={params.region} />
}
