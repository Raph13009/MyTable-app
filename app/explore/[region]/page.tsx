import { redirect } from 'next/navigation'
import { ExploreLayout } from '@/components/explore/ExploreLayout'
import { geocodeCitySlug } from '@/lib/geocodeCitySlug'
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

  if (!regionBBox) {
    const cityResult = await geocodeCitySlug(params.region, 'fr')
    if (!cityResult) {
      console.warn(`[explore-region-city] Failed to resolve as region or city: ${params.region}`)
      redirect('/explore')
    }

    return (
      <ExploreLayout
        chefs={chefs}
        initialRegionBBox={null}
        focusedRegionSlug={null}
        initialLocation={{
          label: cityResult.label,
          center: cityResult.center,
          bbox: cityResult.bbox || null,
          source: 'city-url',
        }}
      />
    )
  }

  return <ExploreLayout chefs={chefs} initialRegionBBox={regionBBox} focusedRegionSlug={params.region} />
}
