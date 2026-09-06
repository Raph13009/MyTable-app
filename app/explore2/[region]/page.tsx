import { createAdminClient } from '@/lib/supabase/admin'
import { ExploreLayout } from '@/components/explore/ExploreLayout'
import { ExploreChef } from '@/components/explore/types'
import { getRegionBBoxBySlug, RegionBBox } from '@/lib/regions'
import { geocodeCitySlug } from '@/lib/geocodeCitySlug'
import { redirect } from 'next/navigation'

// Revalider les données toutes les 5 minutes (cache CDN plus long = chargement embed plus rapide)
export const revalidate = 300

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

interface Explore2RegionPageProps {
  params: {
    region: string
  }
}

export default async function Explore2RegionPage({ params }: Explore2RegionPageProps) {
  const supabase = createAdminClient()
  const regionBBox: RegionBBox | null = getRegionBBoxBySlug(params.region)

  let initialLocation = null

  if (!regionBBox) {
    const cityResult = await geocodeCitySlug(params.region, 'fr')
    
    if (!cityResult) {
      console.warn(`[explore2-region-city] Failed to resolve as region or city: ${params.region}`)
      redirect('/explore2')
    }

    initialLocation = {
      label: cityResult.label,
      center: cityResult.center,
      bbox: cityResult.bbox || null,
      source: 'city-url',
    }
  }

  const { data, error } = await (supabase.from('chefs') as any)
    .select('id, slug, name, info_link_xx, profile_picture, dish_photos, primary_dish_photo, cuisine_style, cuisine_style_en, availability_radius_km, min_guests, max_guests, latitude, longitude, menus(name,price)')
    .eq('is_publicly_visible', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[explore2-region] Failed to load chefs:', error.message)
  }

  const chefs: ExploreChef[] = (data || []).map((row: any) => {
    const menus = Array.isArray(row.menus) ? row.menus : []
    const pricedMenus = menus
      .map((menu: any) => {
        const price = typeof menu?.price === 'number' ? menu.price : Number(menu?.price)
        if (!Number.isFinite(price)) return null
        return {
          name: typeof menu?.name === 'string' ? menu.name.trim() : '',
          price,
        }
      })
      .filter((menu: { name: string; price: number } | null): menu is { name: string; price: number } => !!menu)
    const minPricedMenu = pricedMenus.reduce((best: { name: string; price: number } | null, menu: { name: string; price: number }) => {
      if (!best) return menu
      return menu.price < best.price ? menu : best
    }, null as { name: string; price: number } | null)
    const dishPhotos = Array.isArray(row.dish_photos)
      ? row.dish_photos.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : []
    const primaryDishPhoto = typeof row.primary_dish_photo === 'string' && row.primary_dish_photo.trim() ? row.primary_dish_photo.trim() : null

    return {
      id: String(row.id),
      slug: String(row.slug || row.id),
      name: row.name || 'Chef',
      infoLinkXx: typeof row.info_link_xx === 'string' && row.info_link_xx.trim() ? row.info_link_xx.trim() : null,
      image: row.profile_picture || null,
      heroImage: (primaryDishPhoto && dishPhotos.includes(primaryDishPhoto) ? primaryDishPhoto : null) || dishPhotos[0] || row.profile_picture || null,
      avatarImage: row.profile_picture || null,
      dishPhotos: dishPhotos.filter((url: string) => url !== row.profile_picture),
      cuisineType: row.cuisine_style || null,
      cuisineTypeEn: row.cuisine_style_en || null,
      availabilityRadiusKm:
        typeof row.availability_radius_km === 'number' && Number.isFinite(row.availability_radius_km)
          ? row.availability_radius_km
          : null,
      minPrice: minPricedMenu?.price ?? null,
      minMenuName: minPricedMenu?.name || null,
      minGuests: typeof row.min_guests === 'number' && Number.isFinite(row.min_guests) ? row.min_guests : null,
      maxGuests: typeof row.max_guests === 'number' && Number.isFinite(row.max_guests) ? row.max_guests : null,
      latitude: toNumber(row.latitude),
      longitude: toNumber(row.longitude),
    }
  })

  if (initialLocation) {
    return (
      <ExploreLayout
        chefs={chefs}
        initialRegionBBox={null}
        focusedRegionSlug={null}
        initialLocation={initialLocation}
        embedded
      />
    )
  }

  return <ExploreLayout chefs={chefs} initialRegionBBox={regionBBox} focusedRegionSlug={params.region} embedded />
}
