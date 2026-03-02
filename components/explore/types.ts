export interface ExploreChef {
  id: string
  slug: string
  name: string
  infoLinkXx: string | null
  image: string | null
  heroImage: string | null
  avatarImage: string | null
  /** Dish photos (excluding profile picture) for second image in mobile card */
  dishPhotos?: string[]
  cuisineType: string | null
  cuisineTypeEn: string | null
  availabilityRadiusKm: number | null
  minPrice: number | null
  minMenuName: string | null
  minGuests: number | null
  maxGuests: number | null
  latitude: number | null
  longitude: number | null
}
