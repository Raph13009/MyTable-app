'use client'

import { useMemo } from 'react'
import { MapView, MapChefPoint } from '@/components/map/MapView'
import { ExploreChef } from './types'

interface ExploreMapProps {
  chefs: ExploreChef[]
  selectedChefId: string | null
}

export function ExploreMap({ chefs, selectedChefId }: ExploreMapProps) {
  const mapChefs = useMemo<MapChefPoint[]>(() => {
    return chefs
      .filter((chef) => typeof chef.latitude === 'number' && typeof chef.longitude === 'number')
      .map((chef) => ({
        id: chef.id,
        name: chef.name,
        latitude: chef.latitude as number,
        longitude: chef.longitude as number,
        cuisineType: chef.cuisineType,
      }))
  }, [chefs])

  return (
    <div className="h-full w-full">
      <MapView chefs={mapChefs} selectedChefId={selectedChefId} className="h-full w-full" />
    </div>
  )
}
