import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ChefProfileMenu, ChefProfilePayload, MAX_CHEF_DISH_PHOTOS } from '@/lib/chefProfile'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: { slug: string }
}

export async function GET(_request: Request, context: RouteContext) {
  const slug = decodeURIComponent(context.params.slug || '').trim()
  if (!slug) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const supabase = createAdminClient()
  const { data, error } = await (supabase.from('chefs') as any)
    .select(
      'id, slug, name, city, profile_picture, primary_dish_photo, dish_photos, cuisine_style, cuisine_style_en, portrait_fr, portrait_en, availability_radius_km, min_guests, max_guests, menus(id, name, description, price)'
    )
    .eq('slug', slug)
    .eq('is_publicly_visible', true)
    .maybeSingle()

  if (error) {
    console.error('[chef-profile] Failed to load chef:', error.message)
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const dishPhotos = Array.isArray(data.dish_photos)
    ? data.dish_photos
        .filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value: string) => value.trim())
        .slice(0, MAX_CHEF_DISH_PHOTOS)
    : []

  const menus: ChefProfileMenu[] = (Array.isArray(data.menus) ? data.menus : [])
    .map((menu: any) => {
      const name = typeof menu?.name === 'string' ? menu.name.trim() : ''
      if (!name) return null
      const rawPrice = menu?.price
      const parsed = typeof rawPrice === 'number' ? rawPrice : Number.parseFloat(String(rawPrice ?? ''))
      return {
        id: String(menu.id || `${name}-${parsed}`),
        name,
        description: typeof menu?.description === 'string' && menu.description.trim() ? menu.description.trim() : null,
        price: Number.isFinite(parsed) ? parsed : null,
      } satisfies ChefProfileMenu
    })
    .filter((menu: ChefProfileMenu | null): menu is ChefProfileMenu => !!menu)

  const priced = menus
    .map((menu) => menu.price)
    .filter((price): price is number => typeof price === 'number' && Number.isFinite(price))
  const minPrice = priced.length > 0 ? Math.min(...priced) : null

  const payload: ChefProfilePayload = {
    id: String(data.id),
    slug: String(data.slug),
    name: data.name || 'Chef',
    city: typeof data.city === 'string' && data.city.trim() ? data.city.trim() : null,
    profilePicture: typeof data.profile_picture === 'string' && data.profile_picture.trim() ? data.profile_picture.trim() : null,
    primaryDishPhoto:
      typeof data.primary_dish_photo === 'string' && data.primary_dish_photo.trim()
        ? data.primary_dish_photo.trim()
        : null,
    dishPhotos,
    cuisineType: data.cuisine_style || null,
    cuisineTypeEn: data.cuisine_style_en || null,
    portraitFr: typeof data.portrait_fr === 'string' && data.portrait_fr.trim() ? data.portrait_fr.trim() : null,
    portraitEn: typeof data.portrait_en === 'string' && data.portrait_en.trim() ? data.portrait_en.trim() : null,
    availabilityRadiusKm:
      typeof data.availability_radius_km === 'number' && Number.isFinite(data.availability_radius_km)
        ? data.availability_radius_km
        : null,
    minGuests: typeof data.min_guests === 'number' && Number.isFinite(data.min_guests) ? data.min_guests : null,
    maxGuests: typeof data.max_guests === 'number' && Number.isFinite(data.max_guests) ? data.max_guests : null,
    minPrice,
    menus,
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'private, max-age=30',
    },
  })
}
