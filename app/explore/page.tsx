import { ExploreLayout } from '@/components/explore/ExploreLayout'
import { loadExploreChefs } from '@/lib/mapExploreChefs'
import { getRegionBBoxBySlug, RegionBBox } from '@/lib/regions'

export const revalidate = 60

interface ExplorePageProps {
  searchParams?: {
    region?: string
  }
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const regionParam = typeof searchParams?.region === 'string' ? searchParams.region : null
  const regionBBox: RegionBBox | null = getRegionBBoxBySlug(regionParam)
  const chefs = await loadExploreChefs('[explore]')
  return <ExploreLayout chefs={chefs} initialRegionBBox={regionBBox} focusedRegionSlug={regionParam} />
}
