import { ExploreLayout } from '@/components/explore/ExploreLayout'
import { loadExploreChefs } from '@/lib/mapExploreChefs'
import { getRegionBBoxBySlug, RegionBBox } from '@/lib/regions'

export const revalidate = 60

interface ExploreRegionPageProps {
  params: {
    region: string
  }
}

export default async function ExploreRegionPage({ params }: ExploreRegionPageProps) {
  const regionBBox: RegionBBox | null = getRegionBBoxBySlug(params.region)
  const chefs = await loadExploreChefs('[explore-region]')
  return <ExploreLayout chefs={chefs} initialRegionBBox={regionBBox} focusedRegionSlug={params.region} />
}
