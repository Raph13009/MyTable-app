'use client'

import { ChefCard } from './ChefCard'
import { ExploreChef } from './types'

interface ChefListProps {
  chefs: ExploreChef[]
  onChefHover?: (chefId: string | null) => void
  highlightedChefId?: string | null
  onChefMountRef?: (chefId: string, element: HTMLElement | null) => void
}

export function ChefList({ chefs, onChefHover, highlightedChefId = null, onChefMountRef }: ChefListProps) {
  return (
    <section className="min-h-full">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {chefs.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-5 py-8 text-center text-sm text-[#666666]">
            Aucun chef dans cette zone
          </div>
        ) : (
          chefs.map((chef) => (
            <ChefCard
              key={chef.id}
              chef={chef}
              onHover={onChefHover}
              isHighlighted={highlightedChefId === chef.id}
              onMountRef={onChefMountRef}
            />
          ))
        )}
      </div>
    </section>
  )
}
