import { ExploreLayout } from '@/components/explore/ExploreLayout'
import { loadExploreChefs } from '@/lib/mapExploreChefs'
import { getRegionBBoxBySlug, RegionBBox } from '@/lib/regions'

export const revalidate = 300

interface Explore2RegionPageProps {
  params: {
    region: string
  }
}

export default async function Explore2RegionPage({ params }: Explore2RegionPageProps) {
  const regionBBox: RegionBBox | null = getRegionBBoxBySlug(params.region)
  const chefs = await loadExploreChefs('[explore2-region]')
  return (
    <ExploreLayout chefs={chefs} initialRegionBBox={regionBBox} focusedRegionSlug={params.region} embedded />
  )
}
