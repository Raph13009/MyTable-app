'use client'

import Link from 'next/link'
import { ExploreChef } from './types'

interface ChefCardProps {
  chef: ExploreChef
  onHover?: (chefId: string | null) => void
}

export function ChefCard({ chef, onHover }: ChefCardProps) {
  return (
    <Link
      href={`/chef/${chef.id}`}
      className="group block overflow-hidden rounded-[24px] border border-[#ECECEC] bg-white shadow-[0_1px_6px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(0,0,0,0.10)]"
      onMouseEnter={() => onHover?.(chef.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F6F6F6]">
        {chef.image ? (
          <img
            src={chef.image}
            alt={chef.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#F5F5F5] to-[#ECECEC] text-sm font-medium text-[#8A8A8A]">
            Photo indisponible
          </div>
        )}
      </div>

      <div className="space-y-1 px-4 pb-4 pt-3">
        <h3 className="line-clamp-1 text-[15px] font-bold text-[#222222]">{chef.name}</h3>
        <p className="line-clamp-1 text-sm text-[#717171]">{chef.cuisineType || 'Cuisine signature'}</p>
      </div>
    </Link>
  )
}
