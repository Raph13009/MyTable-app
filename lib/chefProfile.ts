export const MAX_CHEF_DISH_PHOTOS = 12

/** Lean map/list payload — no portraits, galleries, or menu descriptions. */
export const EXPLORE_CHEFS_SELECT =
  'id, slug, name, city, profile_picture, primary_dish_photo, cuisine_style, cuisine_style_en, availability_radius_km, min_guests, max_guests, latitude, longitude, menus(name,price)'

export type ChefProfileMenu = {
  id: string
  name: string
  description: string | null
  price: number | null
}

export type ChefProfilePayload = {
  id: string
  slug: string
  name: string
  city: string | null
  profilePicture: string | null
  primaryDishPhoto: string | null
  dishPhotos: string[]
  cuisineType: string | null
  cuisineTypeEn: string | null
  portraitFr: string | null
  portraitEn: string | null
  availabilityRadiusKm: number | null
  minGuests: number | null
  maxGuests: number | null
  minPrice: number | null
  menus: ChefProfileMenu[]
}

export function resolvePortrait(profile: Pick<ChefProfilePayload, 'portraitFr' | 'portraitEn'>, locale: string): string | null {
  const en = profile.portraitEn?.trim() || ''
  const fr = profile.portraitFr?.trim() || ''
  if (locale === 'en') return en || fr || null
  return fr || en || null
}

export function galleryUrls(profile: Pick<ChefProfilePayload, 'dishPhotos' | 'primaryDishPhoto' | 'profilePicture'>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (url: string | null | undefined) => {
    const value = typeof url === 'string' ? url.trim() : ''
    if (!value || seen.has(value)) return
    seen.add(value)
    out.push(value)
  }
  push(profile.primaryDishPhoto)
  for (const url of profile.dishPhotos) push(url)
  return out
}

const profileCache = new Map<string, ChefProfilePayload>()

export function getCachedChefProfile(slug: string): ChefProfilePayload | undefined {
  return profileCache.get(slug)
}

export function setCachedChefProfile(slug: string, profile: ChefProfilePayload): void {
  profileCache.set(slug, profile)
}

export async function fetchChefProfile(slug: string): Promise<ChefProfilePayload> {
  const cached = profileCache.get(slug)
  if (cached) return cached
  const response = await fetch(`/api/chefs/${encodeURIComponent(slug)}/profile`)
  if (!response.ok) {
    throw new Error('profile_unavailable')
  }
  const data = (await response.json()) as ChefProfilePayload
  profileCache.set(slug, data)
  return data
}

export function prefetchChefProfile(slug: string): void {
  if (!slug || profileCache.has(slug)) return
  void fetchChefProfile(slug).catch(() => {})
}
