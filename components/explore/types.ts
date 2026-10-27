export interface ExploreChef {
  id: string
  slug: string
  name: string
  city: string | null
  image: string | null
  heroImage: string | null
  avatarImage: string | null
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
