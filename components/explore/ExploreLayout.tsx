'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, User } from 'lucide-react'
import { ChefList } from './ChefList'
import { ExploreMap } from './ExploreMap'
import { ExploreChef } from './types'
import { FRANCE_CENTER, FRANCE_ZOOM, RegionBBox } from '@/lib/regions'

interface ExploreLayoutProps {
  chefs: ExploreChef[]
  initialRegionBBox?: RegionBBox | null
  focusedRegionSlug?: string | null
}

interface SearchSuggestion {
  id: string
  label: string
  center: [number, number]
  bbox?: RegionBBox | null
}

function inBBox(longitude: number, latitude: number, bbox: RegionBBox) {
  return longitude >= bbox[0] && longitude <= bbox[2] && latitude >= bbox[1] && latitude <= bbox[3]
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const r = 6371
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const c =
    2 *
    Math.atan2(
      Math.sqrt(sinLat * sinLat + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sinLng * sinLng),
      Math.sqrt(1 - (sinLat * sinLat + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * sinLng * sinLng))
    )
  return r * c
}

export function ExploreLayout({ chefs, initialRegionBBox = null, focusedRegionSlug: initialFocusedRegionSlug = null }: ExploreLayoutProps) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [isMobile, setIsMobile] = useState(false)
  const [selectedChefId, setSelectedChefId] = useState<string | null>(null)
  const [focusedRegionSlug, setFocusedRegionSlug] = useState<string | null>(initialFocusedRegionSlug)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([])
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSearchLoading, setIsSearchLoading] = useState(false)
  const [searchViewport, setSearchViewport] = useState<{
    key: string
    center: [number, number]
    zoom: number
    bbox?: RegionBBox | null
  } | null>(null)
  const [activeSearch, setActiveSearch] = useState<{
    center: [number, number]
    bbox?: RegionBBox | null
  } | null>(null)
  const [mapVisibleChefIds, setMapVisibleChefIds] = useState<string[] | null>(null)

  const cardRefs = useRef<Record<string, HTMLElement | null>>({})
  const searchContainerRef = useRef<HTMLDivElement | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mobileSheetScrollRef = useRef<HTMLDivElement | null>(null)
  const sheetDragRef = useRef<{ startY: number; startTranslate: number } | null>(null)
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const [mobileSheetSnap, setMobileSheetSnap] = useState<'mini' | 'medium' | 'full'>('mini')
  const [mobileSheetDragTranslate, setMobileSheetDragTranslate] = useState<number | null>(null)

  const sortedChefs = useMemo(() => {
    return [...chefs].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [chefs])

  const mapDataChefs = useMemo(() => {
    if (!activeSearch) return sortedChefs

    return sortedChefs.filter((chef) => {
      if (typeof chef.latitude !== 'number' || typeof chef.longitude !== 'number') return false
      if (activeSearch.bbox) {
        return inBBox(chef.longitude, chef.latitude, activeSearch.bbox)
      }
      return distanceKm(chef.latitude, chef.longitude, activeSearch.center[1], activeSearch.center[0]) <= 70
    })
  }, [activeSearch, sortedChefs])

  const visibleChefs = useMemo(() => {
    if (!mapVisibleChefIds) return mapDataChefs
    const visibleSet = new Set(mapVisibleChefIds)
    return mapDataChefs.filter((chef) => visibleSet.has(chef.id))
  }, [mapDataChefs, mapVisibleChefIds])

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
      if (searchAbortRef.current) searchAbortRef.current.abort()
    }
  }, [])

  useEffect(() => {
    const syncViewport = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  useEffect(() => {
    if (!isMobile) return
    setViewMode('map')
  }, [isMobile])

  useEffect(() => {
    setFocusedRegionSlug(initialFocusedRegionSlug)
  }, [initialFocusedRegionSlug])

  useEffect(() => {
    if (!initialRegionBBox || !initialFocusedRegionSlug) return
    const center: [number, number] = [
      (initialRegionBBox[0] + initialRegionBBox[2]) / 2,
      (initialRegionBBox[1] + initialRegionBBox[3]) / 2,
    ]
    setSearchViewport({
      key: `region-${initialRegionBBox.join(',')}`,
      center,
      zoom: 8.5,
      bbox: initialRegionBBox,
    })
    setMapVisibleChefIds(null)
  }, [initialRegionBBox, initialFocusedRegionSlug])

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!searchContainerRef.current) return
      if (searchContainerRef.current.contains(event.target as Node)) return
      setIsSearchOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    const query = searchQuery.trim()
    if (!isSearchOpen || query.length < 2 || !mapboxToken) {
      setSearchSuggestions([])
      setIsSearchLoading(false)
      return
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(async () => {
      if (searchAbortRef.current) searchAbortRef.current.abort()
      const controller = new AbortController()
      searchAbortRef.current = controller
      setIsSearchLoading(true)

      try {
        const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?autocomplete=true&limit=6&language=fr&country=fr&types=place,locality,postcode&access_token=${mapboxToken}`
        const response = await fetch(endpoint, { signal: controller.signal })
        if (!response.ok) throw new Error('Erreur recherche')
        const payload = await response.json()
        const suggestions: SearchSuggestion[] = Array.isArray(payload?.features)
          ? payload.features
              .map((feature: any) => {
                const center = Array.isArray(feature?.center) ? feature.center : null
                if (!center || center.length < 2) return null
                const bbox = Array.isArray(feature?.bbox) && feature.bbox.length === 4 ? (feature.bbox as RegionBBox) : null
                return {
                  id: String(feature.id || crypto.randomUUID()),
                  label: String(feature.place_name || feature.text || ''),
                  center: [Number(center[0]), Number(center[1])] as [number, number],
                  bbox,
                }
              })
              .filter((item: SearchSuggestion | null): item is SearchSuggestion => !!item && !!item.label)
          : []
        setSearchSuggestions(suggestions)
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          console.error('[explore] search autocomplete error:', error)
        }
      } finally {
        setIsSearchLoading(false)
      }
    }, 180)

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [isSearchOpen, mapboxToken, searchQuery])

  const handleChefMountRef = (chefId: string, element: HTMLElement | null) => {
    cardRefs.current[chefId] = element
  }

  const handleChefBubbleClick = (chefId: string) => {
    setSelectedChefId(chefId)
    if (isMobile) {
      setMobileSheetSnap('full')
      requestAnimationFrame(() => {
        const element = cardRefs.current[chefId]
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      })
      return
    }

    setViewMode('list')
    const element = cardRefs.current[chefId]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const applySuggestion = (suggestion: SearchSuggestion) => {
    setFocusedRegionSlug(null)
    setSearchQuery(suggestion.label)
    setIsSearchOpen(false)
    setSearchSuggestions([])
    setActiveSearch({ center: suggestion.center, bbox: suggestion.bbox || null })
    setSearchViewport({
      key: `${suggestion.id}-${Date.now()}`,
      center: suggestion.center,
      zoom: suggestion.bbox ? 8.5 : 10.5,
      bbox: suggestion.bbox || null,
    })
    setMapVisibleChefIds(null)
    router.replace('/explore')
  }

  const handleSearchSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchQuery.trim()
    if (!query || !mapboxToken) return

    if (searchSuggestions.length > 0) {
      applySuggestion(searchSuggestions[0])
      return
    }

    try {
      const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?autocomplete=false&limit=1&language=fr&country=fr&types=place,locality,postcode&access_token=${mapboxToken}`
      const response = await fetch(endpoint)
      if (!response.ok) return
      const payload = await response.json()
      const first = Array.isArray(payload?.features) ? payload.features[0] : null
      if (!first?.center || first.center.length < 2) return
      applySuggestion({
        id: String(first.id || crypto.randomUUID()),
        label: String(first.place_name || first.text || query),
        center: [Number(first.center[0]), Number(first.center[1])],
        bbox: Array.isArray(first.bbox) && first.bbox.length === 4 ? (first.bbox as RegionBBox) : null,
      })
    } catch (error) {
      console.error('[explore] search submit error:', error)
    }
  }

  const handleResetRegionFocus = () => {
    setFocusedRegionSlug(null)
    setActiveSearch(null)
    setSearchQuery('')
    setSearchSuggestions([])
    setIsSearchOpen(false)
    setSearchViewport({
      key: `france-${Date.now()}`,
      center: FRANCE_CENTER,
      zoom: FRANCE_ZOOM,
      bbox: null,
    })
    setMapVisibleChefIds(null)
    router.replace('/explore')
  }

  const mobileSnapTranslate = (snap: 'mini' | 'medium' | 'full') => {
    if (snap === 'full') return 0
    if (snap === 'medium') return 44
    return 92
  }

  const handleSheetPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobile) return
    sheetDragRef.current = {
      startY: event.clientY,
      startTranslate: mobileSheetDragTranslate ?? mobileSnapTranslate(mobileSheetSnap),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleSheetPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!sheetDragRef.current) return
    const delta = event.clientY - sheetDragRef.current.startY
    const next = sheetDragRef.current.startTranslate + (delta / window.innerHeight) * 100
    setMobileSheetDragTranslate(Math.max(0, Math.min(82, next)))
  }

  const handleSheetPointerUp = () => {
    if (!sheetDragRef.current) return
    const value = mobileSheetDragTranslate ?? mobileSnapTranslate(mobileSheetSnap)
    sheetDragRef.current = null
    const snaps: Array<{ id: 'mini' | 'medium' | 'full'; value: number }> = [
      { id: 'full', value: 0 },
      { id: 'medium', value: 44 },
      { id: 'mini', value: 92 },
    ]
    const closest = snaps.reduce((prev, curr) =>
      Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev
    )
    setMobileSheetSnap(closest.id)
    setMobileSheetDragTranslate(null)
  }

  const mobileOverCount = Math.max(visibleChefs.length - 1, 0)
  const mobileCountLabel = `Plus de ${mobileOverCount} ${mobileOverCount > 1 ? 'chefs' : 'chef'}`

  return (
    <main className={`h-screen w-screen overflow-hidden ${viewMode === 'list' ? 'bg-white' : 'bg-[#F7F7F7]'}`}>
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[#EAEAEA] bg-white/95 shadow-[0_6px_16px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto flex h-[84px] w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          {isMobile ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (mobileSheetSnap === 'full') setMobileSheetSnap('mini')
                }}
                className={`inline-flex h-10 items-center justify-center px-1 text-[#2A2A2A] transition ${
                  mobileSheetSnap === 'full' ? 'opacity-100' : 'opacity-50'
                }`}
                aria-label="Replier la liste"
              >
                <ArrowLeft className="h-5 w-5" strokeWidth={2} />
              </button>

              <a href="/" className="absolute left-1/2 -translate-x-1/2">
                <img src="/logo-cercle.png" alt="MyTable" className="h-10 w-10 object-contain" />
              </a>

              <div className="ml-auto flex items-center gap-2">
                <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#EAEAEA] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
                  <User className="h-4 w-4 text-[#3A3A3A]" />
                </button>
              </div>
            </>
          ) : (
            <>
              <a href="/" className="shrink-0">
                <img src="/logo-cercle.png" alt="MyTable" className="h-10 w-10 object-contain" />
              </a>

              <div ref={searchContainerRef} className="relative hidden flex-1 md:block">
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex h-11 items-center rounded-full border border-[#EAEAEA] bg-white px-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
                >
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value)
                      setIsSearchOpen(true)
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    placeholder="Rechercher une ville"
                    className="w-full bg-transparent text-sm text-[#2A2A2A] outline-none placeholder:text-[#9A9A9A]"
                  />
                </form>

                {isSearchOpen && (isSearchLoading || searchSuggestions.length > 0) && (
                  <div className="absolute left-0 right-0 top-[50px] overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
                    {isSearchLoading ? (
                      <p className="px-4 py-3 text-sm text-[#6B7280]">Recherche...</p>
                    ) : (
                      searchSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => applySuggestion(suggestion)}
                          className="block w-full border-b border-[#F3F3F3] px-4 py-3 text-left text-sm text-[#222222] last:border-b-0 hover:bg-[#FAFAFA]"
                        >
                          {suggestion.label}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="ml-auto flex items-center gap-3">
                {focusedRegionSlug && (
                  <button
                    type="button"
                    onClick={handleResetRegionFocus}
                    className="inline-flex h-10 items-center rounded-full border border-[#E3E3E3] bg-white px-4 text-sm font-medium text-[#333333] shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition hover:bg-[#F9F9F9]"
                  >
                    Réinitialiser la région
                  </button>
                )}
                <div className="inline-flex rounded-full border border-[#EAEAEA] bg-white p-1 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
                  <button
                    type="button"
                    onClick={() => setViewMode('map')}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                      viewMode === 'map' ? 'bg-[#111111] text-white' : 'text-[#555555] hover:bg-[#F5F5F5]'
                    }`}
                  >
                    Carte
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                      viewMode === 'list' ? 'bg-[#111111] text-white' : 'text-[#555555] hover:bg-[#F5F5F5]'
                    }`}
                  >
                    Liste
                  </button>
                </div>
                <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#EAEAEA] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
                  <User className="h-4 w-4 text-[#3A3A3A]" />
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <section className="pt-[84px]">
        {isMobile ? (
          <div className="relative h-[calc(100vh-84px)] w-full overflow-hidden">
            <ExploreMap
              chefs={mapDataChefs}
              selectedChefId={selectedChefId}
              isMapMode
              onChefHover={setSelectedChefId}
              onChefClick={handleChefBubbleClick}
              onVisibleChefIdsChange={setMapVisibleChefIds}
              initialRegionBBox={initialRegionBBox}
              focusedRegionSlug={focusedRegionSlug}
              searchViewport={searchViewport}
            />

            <aside
              className="absolute inset-x-0 bottom-0 z-20 h-[calc(100vh-32px)] rounded-t-[24px] border-t border-[#EAEAEA] bg-white shadow-[0_-14px_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                transform: `translateY(${mobileSheetDragTranslate ?? mobileSnapTranslate(mobileSheetSnap)}%)`,
              }}
            >
              <div
                className="flex cursor-grab touch-none flex-col px-4 pb-3 pt-2 active:cursor-grabbing"
                onPointerDown={handleSheetPointerDown}
                onPointerMove={handleSheetPointerMove}
                onPointerUp={handleSheetPointerUp}
                onPointerCancel={handleSheetPointerUp}
              >
                <div className="mx-auto h-1.5 w-12 rounded-full bg-[#D8D8D8]" />
                <p className="mt-2 text-center text-sm font-medium text-[#2B2B2B]">{mobileCountLabel}</p>
              </div>

              <div
                ref={mobileSheetScrollRef}
                className={`explore-scroll explore-scroll--hidden h-[calc(100%-56px)] overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+8rem)] ${
                  mobileSheetSnap === 'mini' ? 'overflow-hidden' : 'overflow-y-auto'
                }`}
              >
                <div className={mobileSheetSnap === 'mini' ? 'pointer-events-none opacity-0' : 'opacity-100 transition-opacity'}>
                  <ChefList
                    chefs={visibleChefs}
                    onChefHover={setSelectedChefId}
                    highlightedChefId={selectedChefId}
                    onChefMountRef={handleChefMountRef}
                  />
                </div>
              </div>
            </aside>
          </div>
        ) : viewMode === 'map' ? (
          <div className="h-[calc(100vh-84px)] w-full overflow-hidden px-4 pb-4 pt-4 sm:px-6 lg:px-8">
            <div className="relative h-full w-full overflow-hidden rounded-[24px] bg-[#F7F7F7] shadow-[0_12px_34px_rgba(0,0,0,0.10)]">
              <div className="absolute inset-0">
                <ExploreMap
                  chefs={mapDataChefs}
                  selectedChefId={selectedChefId}
                  isMapMode
                  onChefHover={setSelectedChefId}
                  onChefClick={handleChefBubbleClick}
                  onVisibleChefIdsChange={setMapVisibleChefIds}
                  initialRegionBBox={initialRegionBBox}
                  focusedRegionSlug={focusedRegionSlug}
                  searchViewport={searchViewport}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[calc(100vh-84px)] w-full overflow-hidden">
            <div className="relative h-full w-full">
              <div className="absolute inset-y-0 left-0 w-full lg:w-1/2">
                <div className="explore-scroll explore-scroll--hidden h-full overflow-y-auto px-4 pb-10 pt-5 sm:px-6 lg:px-8">
                  <ChefList
                    chefs={visibleChefs}
                    onChefHover={setSelectedChefId}
                    highlightedChefId={selectedChefId}
                    onChefMountRef={handleChefMountRef}
                  />
                </div>
              </div>

              <div className="absolute inset-y-0 right-0 hidden w-1/2 p-4 lg:block">
                <div className="h-full w-full overflow-hidden rounded-[24px] border border-[#EAEAEA] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.08)]">
                  <ExploreMap
                    chefs={mapDataChefs}
                    selectedChefId={selectedChefId}
                    isMapMode={false}
                    onChefHover={setSelectedChefId}
                    onChefClick={handleChefBubbleClick}
                    onVisibleChefIdsChange={setMapVisibleChefIds}
                    initialRegionBBox={initialRegionBBox}
                    focusedRegionSlug={focusedRegionSlug}
                    searchViewport={searchViewport}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
