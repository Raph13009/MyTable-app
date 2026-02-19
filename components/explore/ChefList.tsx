'use client'

import { ChefCard } from './ChefCard'
import { ExploreChef } from './types'

interface ChefListProps {
  chefs: ExploreChef[]
  onChefHover?: (chefId: string | null) => void
}

export function ChefList({ chefs, onChefHover }: ChefListProps) {
  return (
    <section className="min-h-full">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7B7B7B]">Explore</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight text-[#222222]">Chefs disponibles</h1>
        </div>
        <p className="text-sm font-medium text-[#717171]">{chefs.length} résultat{chefs.length > 1 ? 's' : ''}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {chefs.map((chef) => (
          <ChefCard
            key={chef.id}
            chef={chef}
            onHover={onChefHover}
          />
        ))}
      </div>
    </section>
  )
}
