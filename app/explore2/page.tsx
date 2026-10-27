import { ExploreLayout } from '@/components/explore/ExploreLayout'
import { parseExploreLocationParams } from '@/lib/exploreLocationSearch'
import { loadExploreChefs } from '@/lib/mapExploreChefs'
import { getRegionBBoxBySlug, RegionBBox } from '@/lib/regions'

export const revalidate = 300

interface Explore2PageProps {
  searchParams?: {
    region?: string
    lat?: string
    lng?: string
    q?: string
    source?: string
  }
}

export default async function Explore2Page({ searchParams }: Explore2PageProps) {
  const regionParam = typeof searchParams?.region === 'string' ? searchParams.region : null
  const regionBBox: RegionBBox | null = getRegionBBoxBySlug(regionParam)
  const chefs = await loadExploreChefs('[explore2]')
  const initialLocation = parseExploreLocationParams(searchParams)

  return (
    <ExploreLayout
      chefs={chefs}
      initialRegionBBox={initialLocation ? null : regionBBox}
      focusedRegionSlug={initialLocation ? null : regionParam}
      initialLocation={initialLocation}
      embedded
    />
  )
}
