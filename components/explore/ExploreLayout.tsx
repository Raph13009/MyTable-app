'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ChefList } from './ChefList'
import { ExploreMap } from './ExploreMap'
import { ExploreChef } from './types'
import { FRANCE_CENTER, FRANCE_ZOOM, RegionBBox } from '@/lib/regions'
import BookingLanguageSwitcher from '@/components/BookingLanguageSwitcher'
import { useTranslation } from '@/hooks/useTranslation'

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

interface SearchPin {
  key: string
  center: [number, number]
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
  const { t, locale } = useTranslation()
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
  const [searchPin, setSearchPin] = useState<SearchPin | null>(null)

  const cardRefs = useRef<Record<string, HTMLElement | null>>({})
  const searchContainerRef = useRef<HTMLDivElement | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mobileSheetScrollRef = useRef<HTMLDivElement | null>(null)
  const sheetDragRef = useRef<{ startY: number; startTranslate: number } | null>(null)
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const [mobileSheetSnap, setMobileSheetSnap] = useState<'bottom' | 'mid' | 'full'>('bottom')
  const [mobileSheetDragTranslate, setMobileSheetDragTranslate] = useState<number | null>(null)

  const sortedChefs = useMemo(() => {
    return [...chefs].sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [chefs, locale])

  const mapDataChefs = useMemo(() => {
    if (searchPin) return sortedChefs
    if (!activeSearch) return sortedChefs

    return sortedChefs.filter((chef) => {
      if (typeof chef.latitude !== 'number' || typeof chef.longitude !== 'number') return false
      if (activeSearch.bbox) {
        return inBBox(chef.longitude, chef.latitude, activeSearch.bbox)
      }
      return distanceKm(chef.latitude, chef.longitude, activeSearch.center[1], activeSearch.center[0]) <= 70
    })
  }, [activeSearch, searchPin, sortedChefs])

  const outOfRangeChefIds = useMemo(() => {
    if (!searchPin) return new Set<string>()
    const [targetLng, targetLat] = searchPin.center
    const ids = new Set<string>()

    sortedChefs.forEach((chef) => {
      if (typeof chef.latitude !== 'number' || typeof chef.longitude !== 'number') return
      const radiusKm =
        typeof chef.availabilityRadiusKm === 'number' && Number.isFinite(chef.availabilityRadiusKm) && chef.availabilityRadiusKm > 0
          ? chef.availabilityRadiusKm
          : 10
      const distance = distanceKm(chef.latitude, chef.longitude, targetLat, targetLng)
      if (distance > radiusKm) ids.add(chef.id)
    })

    return ids
  }, [searchPin, sortedChefs])

  const visibleChefs = useMemo(() => {
    if (searchPin) return mapDataChefs
    if (!mapVisibleChefIds) return mapDataChefs
    const visibleSet = new Set(mapVisibleChefIds)
    return mapDataChefs.filter((chef) => visibleSet.has(chef.id))
  }, [mapDataChefs, mapVisibleChefIds, searchPin])

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string } | undefined
      if (
        reason?.name === 'AbortError' ||
        reason?.message?.includes('signal is aborted') ||
        reason?.message?.toLowerCase().includes('aborted without reason')
      ) {
        event.preventDefault()
      }
    }

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
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
        const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?autocomplete=true&limit=8&language=${locale}&country=fr&types=address,place,locality,postcode,neighborhood&access_token=${mapboxToken}`
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
  }, [isSearchOpen, locale, mapboxToken, searchQuery])

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
    setSearchPin({
      key: `${suggestion.id}-${Date.now()}`,
      center: suggestion.center,
    })
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
      const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?autocomplete=false&limit=1&language=${locale}&country=fr&types=address,place,locality,postcode,neighborhood&access_token=${mapboxToken}`
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
    setSearchPin(null)
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

  const handleResetSearchPin = () => {
    setSearchPin(null)
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
  }

  const mobileSnapTranslate = (snap: 'bottom' | 'mid' | 'full') => {
    if (snap === 'full') return 0
    if (snap === 'mid') return 48
    return 90
  }

  const handleSheetPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobile) return
    event.preventDefault()
    event.stopPropagation()
    sheetDragRef.current = {
      startY: event.clientY,
      startTranslate: mobileSheetDragTranslate ?? mobileSnapTranslate(mobileSheetSnap),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleSheetPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!sheetDragRef.current) return
    event.preventDefault()
    event.stopPropagation()
    const delta = event.clientY - sheetDragRef.current.startY
    const next = sheetDragRef.current.startTranslate + (delta / window.innerHeight) * 100
    setMobileSheetDragTranslate(Math.max(0, Math.min(90, next)))
  }

  const handleSheetPointerUp = (event?: React.PointerEvent<HTMLDivElement>) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    if (!sheetDragRef.current) return
    const value = mobileSheetDragTranslate ?? mobileSnapTranslate(mobileSheetSnap)
    sheetDragRef.current = null
    const snaps: Array<{ id: 'bottom' | 'mid' | 'full'; value: number }> = [
      { id: 'full', value: 0 },
      { id: 'mid', value: 48 },
      { id: 'bottom', value: 90 },
    ]
    const closest = snaps.reduce((prev, curr) =>
      Math.abs(curr.value - value) < Math.abs(prev.value - value) ? curr : prev
    )
    setMobileSheetSnap(closest.id)
    setMobileSheetDragTranslate(null)
  }

  const mobileOverCount = Math.max(visibleChefs.length - 1, 0)
  const mobileCountLabel = t('explore.overCount', {
    count: mobileOverCount,
    label: mobileOverCount > 1 ? t('explore.chefPlural') : t('explore.chefSingular'),
  })
  const currentMobileSheetTranslate = mobileSheetDragTranslate ?? mobileSnapTranslate(mobileSheetSnap)
  const isMobileSheetExpanded = currentMobileSheetTranslate < mobileSnapTranslate('bottom') - 1
  const showMobileBackButton = Boolean(focusedRegionSlug) || isMobileSheetExpanded

  return (
    <main className={`h-[100dvh] w-screen overflow-hidden ${viewMode === 'list' ? 'bg-white' : 'bg-[#F7F7F7]'}`}>
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[#EAEAEA] bg-white/95 shadow-[0_6px_16px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto flex h-[64px] w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:h-[84px] lg:px-8">
          {isMobile ? (
            <>
              {showMobileBackButton ? (
                <button
                  type="button"
                  onClick={() => {
                    if (focusedRegionSlug) {
                      handleResetRegionFocus()
                      return
                    }
                    if (mobileSheetSnap !== 'bottom' || mobileSheetDragTranslate !== null) {
                      setMobileSheetSnap('bottom')
                      setMobileSheetDragTranslate(null)
                    }
                  }}
                  className="inline-flex h-10 items-center justify-center px-1 text-[#2A2A2A] transition"
                  aria-label={focusedRegionSlug ? t('explore.resetRegion') : t('explore.collapseList')}
                >
                  <ArrowLeft className="h-5 w-5" strokeWidth={2} />
                </button>
              ) : (
                <div className="h-10 w-7" aria-hidden />
              )}

              <a href="/" className="absolute left-1/2 -translate-x-1/2">
                <img src="/logo-cercle.png" alt="MyTable" className="h-8 w-8 object-contain lg:h-10 lg:w-10" />
              </a>

              <div className="ml-auto flex items-center gap-2">
                <BookingLanguageSwitcher />
              </div>
            </>
          ) : (
            <>
              <a href="/" className="shrink-0">
                <img src="/logo-cercle.png" alt="MyTable" className="h-10 w-10 object-contain" />
              </a>

              <div
                ref={searchContainerRef}
                className="relative hidden flex-1 min-w-0 transition-all duration-200 md:block"
              >
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
                    placeholder={t('explore.searchPlaceholder')}
                    className="w-full bg-transparent text-sm text-[#2A2A2A] outline-none placeholder:text-[#9A9A9A]"
                  />
                </form>

                {isSearchOpen && (isSearchLoading || searchSuggestions.length > 0) && (
                  <div className="absolute left-0 right-0 top-[50px] overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
                    {isSearchLoading ? (
                      <p className="px-4 py-3 text-sm text-[#6B7280]">{t('explore.searchLoading')}</p>
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
              {searchPin && (
                <button
                  type="button"
                  onClick={handleResetSearchPin}
                  className="hidden h-10 items-center rounded-full border border-[#E3E3E3] bg-white px-4 text-sm font-medium text-[#333333] shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition hover:bg-[#F9F9F9] md:inline-flex"
                >
                  {t('explore.resetPin')}
                </button>
              )}

              <div className="ml-auto flex items-center gap-3">
                {focusedRegionSlug && (
                  <button
                    type="button"
                    onClick={handleResetRegionFocus}
                    className="inline-flex h-10 items-center rounded-full border border-[#E3E3E3] bg-white px-4 text-sm font-medium text-[#333333] shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition hover:bg-[#F9F9F9]"
                  >
                    {t('explore.resetRegion')}
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
                    {t('explore.map')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                      viewMode === 'list' ? 'bg-[#111111] text-white' : 'text-[#555555] hover:bg-[#F5F5F5]'
                    }`}
                  >
                    {t('explore.list')}
                  </button>
                </div>
                <BookingLanguageSwitcher />
              </div>
            </>
          )}
        </div>
      </header>

      <section className="pt-[64px] lg:pt-[84px]">
        {isMobile ? (
          <div className="relative h-[calc(100dvh-64px)] w-full overflow-hidden">
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
              searchPin={searchPin}
              outOfRangeChefIds={[...outOfRangeChefIds]}
              locale={locale}
            />

            <aside
              className="absolute inset-x-0 bottom-0 z-20 h-full rounded-t-[24px] border-t border-[#EAEAEA] bg-white shadow-[0_-14px_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                bottom: 'env(safe-area-inset-bottom)',
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
                  mobileSheetSnap === 'bottom' ? 'overflow-hidden' : 'overflow-y-auto'
                }`}
              >
                <div className={mobileSheetSnap === 'bottom' ? 'pointer-events-none opacity-0' : 'opacity-100 transition-opacity'}>
                  <ChefList
                    chefs={visibleChefs}
                    onChefHover={setSelectedChefId}
                    highlightedChefId={selectedChefId}
                    outOfRangeChefIds={outOfRangeChefIds}
                    onChefMountRef={handleChefMountRef}
                  />
                  <div className="h-[42vh]" aria-hidden />
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="h-[calc(100dvh-64px)] w-full overflow-hidden lg:h-[calc(100dvh-84px)]">
            <div className="relative h-full w-full">
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                  viewMode === 'map'
                    ? 'w-0 pointer-events-none opacity-0'
                    : 'w-full lg:w-1/2 opacity-100'
                }`}
              >
                <div
                  className={`explore-scroll explore-scroll--hidden h-full overflow-y-auto px-4 pb-10 pt-5 sm:px-6 lg:px-8 ${
                    viewMode === 'map' ? 'invisible' : 'visible'
                  }`}
                >
                  <ChefList
                    chefs={visibleChefs}
                    onChefHover={setSelectedChefId}
                    highlightedChefId={selectedChefId}
                    outOfRangeChefIds={outOfRangeChefIds}
                    onChefMountRef={handleChefMountRef}
                  />
                </div>
              </div>

              <div
                className={`absolute inset-y-0 right-0 transition-all duration-300 ${
                  viewMode === 'map' ? 'w-full p-4' : 'hidden w-1/2 p-4 lg:block'
                }`}
              >
                <div
                  className={`h-full w-full overflow-hidden rounded-[24px] ${
                    viewMode === 'map'
                      ? 'bg-[#F7F7F7] shadow-[0_12px_34px_rgba(0,0,0,0.10)]'
                      : 'border border-[#EAEAEA] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.08)]'
                  }`}
                >
                  <ExploreMap
                    chefs={mapDataChefs}
                    selectedChefId={selectedChefId}
                    isMapMode={viewMode === 'map'}
                    onChefHover={setSelectedChefId}
                    onChefClick={handleChefBubbleClick}
                    onVisibleChefIdsChange={setMapVisibleChefIds}
                    initialRegionBBox={initialRegionBBox}
                    focusedRegionSlug={focusedRegionSlug}
                    searchViewport={searchViewport}
                    searchPin={searchPin}
                    outOfRangeChefIds={[...outOfRangeChefIds]}
                    locale={locale}
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
