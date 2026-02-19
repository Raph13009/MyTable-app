'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { ChefList } from './ChefList'
import { ExploreMap } from './ExploreMap'
import { ExploreChef } from './types'

interface ExploreLayoutProps {
  chefs: ExploreChef[]
}

export function ExploreLayout({ chefs }: ExploreLayoutProps) {
  const [selectedChefId, setSelectedChefId] = useState<string | null>(null)
  const [sheetTopVh, setSheetTopVh] = useState(62)
  const dragRef = useRef<{ startY: number; startTop: number } | null>(null)

  const sortedChefs = useMemo(() => {
    return [...chefs].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [chefs])

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [])

  const handleDragStart = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      startY: event.clientY,
      startTop: sheetTopVh,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleDragMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const deltaY = event.clientY - dragRef.current.startY
    const deltaVh = (deltaY / window.innerHeight) * 100
    const nextTop = dragRef.current.startTop + deltaVh
    setSheetTopVh(Math.min(76, Math.max(14, nextTop)))
  }

  const handleDragEnd = () => {
    if (!dragRef.current) return
    dragRef.current = null
    const snapPoints = [14, 42, 66]
    const snapped = snapPoints.reduce((closest, current) =>
      Math.abs(current - sheetTopVh) < Math.abs(closest - sheetTopVh) ? current : closest
    )
    setSheetTopVh(snapped)
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-white">
      <div className="hidden h-full w-full overflow-hidden lg:flex lg:flex-row">
        <section className="explore-scroll h-screen w-[50%] overflow-y-auto bg-white p-8">
          <ChefList chefs={sortedChefs} onChefHover={setSelectedChefId} />
        </section>

        <aside className="relative h-screen w-[50%] bg-[#F7F7F7] p-6">
          <div className="sticky top-6 h-[calc(100vh-48px)] overflow-hidden rounded-[24px] shadow-[0_6px_26px_rgba(0,0,0,0.10)]">
            <ExploreMap chefs={sortedChefs} selectedChefId={selectedChefId} />
          </div>
        </aside>
      </div>

      <div className="relative h-full w-full lg:hidden">
        <div className="absolute inset-0">
          <ExploreMap chefs={sortedChefs} selectedChefId={selectedChefId} />
        </div>

        <section
          className="absolute inset-x-0 bottom-0 rounded-t-[24px] bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.16)] transition-[top] duration-200"
          style={{ top: `${sheetTopVh}vh` }}
        >
          <div
            className="flex cursor-grab touch-none items-center justify-center py-3 active:cursor-grabbing"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            <div className="h-1.5 w-12 rounded-full bg-[#D9D9D9]" />
          </div>

          <div
            className="overflow-y-auto"
            style={{ height: `calc(${100 - sheetTopVh}vh - 44px)` }}
          >
            <ChefList chefs={sortedChefs} onChefHover={setSelectedChefId} />
          </div>
        </section>
      </div>
    </main>
  )
}
