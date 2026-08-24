import { ExploreChef } from '@/components/explore/types'
import { EXPLORE_CHEFS_SELECT } from '@/lib/chefProfile'
import { createAdminClient } from '@/lib/supabase/admin'

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function mapExploreChefRow(row: any): ExploreChef {
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
  const minPricedMenu = pricedMenus.reduce(
    (best: { name: string; price: number } | null, menu: { name: string; price: number }) => {
      if (!best) return menu
      return menu.price < best.price ? menu : best
    },
    null as { name: string; price: number } | null
  )
  const primaryDishPhoto =
    typeof row.primary_dish_photo === 'string' && row.primary_dish_photo.trim()
      ? row.primary_dish_photo.trim()
      : null
  const profilePicture =
    typeof row.profile_picture === 'string' && row.profile_picture.trim() ? row.profile_picture.trim() : null

  return {
    id: String(row.id),
    slug: String(row.slug || row.id),
    name: row.name || 'Chef',
    city: typeof row.city === 'string' && row.city.trim() ? row.city.trim() : null,
    image: profilePicture,
    heroImage: primaryDishPhoto || profilePicture,
    avatarImage: profilePicture,
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
}

export async function loadExploreChefs(logLabel = '[explore]'): Promise<ExploreChef[]> {
  const supabase = createAdminClient()
  const { data, error } = await (supabase.from('chefs') as any)
    .select(EXPLORE_CHEFS_SELECT)
    .eq('is_publicly_visible', true)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`${logLabel} Failed to load chefs:`, error.message)
    return []
  }

  return (data || []).map(mapExploreChefRow)
}
