import { createAdminClient } from '@/lib/supabase/admin'
import { ExploreLayout } from '@/components/explore/ExploreLayout'
import { ExploreChef } from '@/components/explore/types'

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export default async function ExplorePage() {
  const supabase = createAdminClient()

  const { data, error } = await (supabase.from('chefs') as any)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[explore] Failed to load chefs:', error.message)
  }

  const chefs: ExploreChef[] = (data || []).map((row: any) => ({
    id: String(row.id),
    name: row.name || 'Chef',
    image: row.image || row.profile_picture || null,
    cuisineType: row.cuisine_type || row.cuisine_style || null,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
  }))

  return <ExploreLayout chefs={chefs} />
}
