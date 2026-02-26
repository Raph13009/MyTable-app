'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { ArrowLeft, X } from 'lucide-react'
import { ChefList } from './ChefList'
import { ExploreMap } from './ExploreMap'
import { ExploreChef } from './types'
import { FRANCE_CENTER, FRANCE_ZOOM, RegionBBox, getChefAvailabilityRadiusKm } from '@/lib/regions'
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

/** Build a bbox ~100km around a center (for address search default view) */
function bbox100kmAroundCenter(center: [number, number]): RegionBBox {
  const [lng, lat] = center
  const kmPerDegLat = 111.32
  const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180)
  const deltaLat = 100 / kmPerDegLat
  const deltaLng = 100 / kmPerDegLng
  return [lng - deltaLng, lat - deltaLat, lng + deltaLng, lat + deltaLat]
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
  const [pinnedChefId, setPinnedChefId] = useState<string | null>(null)
  const [hoveredChefId, setHoveredChefId] = useState<string | null>(null)
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
  const [mobileDropdownBounds, setMobileDropdownBounds] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const [mapLayoutTransitioning, setMapLayoutTransitioning] = useState(false)
  const layoutTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setViewModeWithTransition = (mode: 'map' | 'list') => {
    if (mode === viewMode) return
    if (layoutTransitionTimerRef.current) {
      clearTimeout(layoutTransitionTimerRef.current)
      layoutTransitionTimerRef.current = null
    }
    setMapLayoutTransitioning(true)
    setViewMode(mode)
    layoutTransitionTimerRef.current = setTimeout(() => {
      layoutTransitionTimerRef.current = null
      setMapLayoutTransitioning(false)
    }, 1000)
  }

  useEffect(() => {
    return () => {
      if (layoutTransitionTimerRef.current) clearTimeout(layoutTransitionTimerRef.current)
    }
  }, [])

  const cardRefs = useRef<Record<string, HTMLElement | null>>({})
  const searchContainerRef = useRef<HTMLDivElement | null>(null)
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null)
  const mobileDropdownRef = useRef<HTMLDivElement | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mobileSheetScrollRef = useRef<HTMLDivElement | null>(null)
  const sheetDragRef = useRef<{ startY: number; startTranslate: number; hasMoved: boolean } | null>(null)
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const [mobileSheetSnap, setMobileSheetSnap] = useState<'bottom' | 'mid' | 'full'>('bottom')
  const [mobileSheetDragTranslate, setMobileSheetDragTranslate] = useState<number | null>(null)
  const selectedChefId = pinnedChefId ?? hoveredChefId

  const sortedChefs = useMemo(() => {
    return [...chefs].sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [chefs, locale])

  const outOfRangeChefIds = useMemo(() => {
    if (!searchPin) return new Set<string>()
    const [targetLng, targetLat] = searchPin.center
    const ids = new Set<string>()

    const EPSILON_KM = 0.1
    sortedChefs.forEach((chef) => {
      if (typeof chef.latitude !== 'number' || typeof chef.longitude !== 'number') return
      const radiusKm = getChefAvailabilityRadiusKm(chef)
      const distance = distanceKm(chef.latitude, chef.longitude, targetLat, targetLng)
      if (distance > radiusKm + EPSILON_KM) ids.add(chef.id)
    })

    return ids
  }, [searchPin, sortedChefs])

  const mapDataChefs = useMemo(() => {
    if (searchPin) {
      return sortedChefs.filter((chef) => !outOfRangeChefIds.has(chef.id))
    }
    if (!activeSearch) return sortedChefs
    return sortedChefs.filter((chef) => {
      if (typeof chef.latitude !== 'number' || typeof chef.longitude !== 'number') return false
      if (activeSearch.bbox) {
        return inBBox(chef.longitude, chef.latitude, activeSearch.bbox)
      }
      return distanceKm(chef.latitude, chef.longitude, activeSearch.center[1], activeSearch.center[0]) <= 70
    })
  }, [activeSearch, searchPin, sortedChefs, outOfRangeChefIds])

  const visibleChefs = useMemo(() => {
    if (searchPin) return mapDataChefs
    if (!mapVisibleChefIds) return mapDataChefs
    const visibleSet = new Set(mapVisibleChefIds)
    return mapDataChefs.filter((chef) => visibleSet.has(chef.id))
  }, [mapDataChefs, mapVisibleChefIds, searchPin])

  const orderedVisibleChefs = useMemo(() => {
    if (!searchPin) return visibleChefs
    const inRange = visibleChefs.filter((chef) => !outOfRangeChefIds.has(chef.id))
    inRange.sort((a, b) => a.name.localeCompare(b.name, locale))
    return inRange
  }, [visibleChefs, searchPin, outOfRangeChefIds, locale])

  const mobileListChefs = useMemo(() => {
    if (!isMobile || !pinnedChefId) return orderedVisibleChefs
    const pinned = orderedVisibleChefs.find((c) => c.id === pinnedChefId)
    if (!pinned) return orderedVisibleChefs
    const rest = orderedVisibleChefs.filter((c) => c.id !== pinnedChefId)
    return [pinned, ...rest]
  }, [isMobile, pinnedChefId, orderedVisibleChefs])

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
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (searchContainerRef.current?.contains(target)) return
      if (mobileDropdownRef.current?.contains(target)) return
      setIsSearchOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [])

  const SEARCH_DEBOUNCE_MS = 300

  useEffect(() => {
    const query = searchQuery.trim()
    if (query.length < 2 || !mapboxToken) {
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
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log('[explore] geocoding request', { query })
      }

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
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.log('[explore] geocoding response', { query, count: suggestions.length, features: payload?.features?.length })
        }
        setSearchSuggestions(suggestions)
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          console.error('[explore] search autocomplete error:', error)
        }
      } finally {
        setIsSearchLoading(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [locale, mapboxToken, searchQuery])

  const shouldShowMobileDropdown =
    isMobile && isSearchOpen && (isSearchLoading || searchSuggestions.length > 0)

  useEffect(() => {
    if (!shouldShowMobileDropdown) {
      setMobileDropdownBounds(null)
      return
    }
    const updateBounds = () => {
      const el = mobileSearchInputRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        setMobileDropdownBounds({
          top: rect.bottom + 8,
          left: rect.left,
          width: rect.width,
        })
      } else {
        setMobileDropdownBounds({ top: 80, left: 16, width: window.innerWidth - 32 })
      }
    }
    updateBounds()
    const raf = requestAnimationFrame(updateBounds)
    window.visualViewport?.addEventListener('resize', updateBounds)
    window.visualViewport?.addEventListener('scroll', updateBounds)
    return () => {
      cancelAnimationFrame(raf)
      window.visualViewport?.removeEventListener('resize', updateBounds)
      window.visualViewport?.removeEventListener('scroll', updateBounds)
    }
  }, [shouldShowMobileDropdown])

  const handleChefMountRef = (chefId: string, element: HTMLElement | null) => {
    cardRefs.current[chefId] = element
  }

  const handleChefBubbleClick = (chefId: string) => {
    setPinnedChefId(chefId)
    setHoveredChefId(null)
    if (isMobile) {
      setMobileSheetSnap('mid')
      return
    }
    if (viewMode === 'map') {
      return
    }
    setViewMode('list')
    const element = cardRefs.current[chefId]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleSelectionClear = () => {
    setPinnedChefId(null)
    setHoveredChefId(null)
  }

  const handleChefHover = (chefId: string | null) => {
    setHoveredChefId(chefId)
  }

  const handleChefNameToggle = (chefId: string) => {
    setPinnedChefId((prev) => (prev === chefId ? null : chefId))
    setHoveredChefId((prev) => (prev === chefId ? null : prev))
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
    const viewportBbox = bbox100kmAroundCenter(suggestion.center)
    setSearchViewport({
      key: `${suggestion.id}-${Date.now()}`,
      center: suggestion.center,
      zoom: 6,
      bbox: viewportBbox,
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
      hasMoved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleSheetPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!sheetDragRef.current) return
    const delta = event.clientY - sheetDragRef.current.startY
    if (Math.abs(delta) > 8) sheetDragRef.current.hasMoved = true
    event.preventDefault()
    event.stopPropagation()
    const SENSITIVITY = 2.8
    const next = sheetDragRef.current.startTranslate + (delta / window.innerHeight) * 100 * SENSITIVITY
    setMobileSheetDragTranslate(Math.max(0, Math.min(90, next)))
  }

  const handleSheetPointerUp = (event?: React.PointerEvent<HTMLDivElement>) => {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }
    if (!sheetDragRef.current) return
    const value = mobileSheetDragTranslate ?? mobileSnapTranslate(mobileSheetSnap)
    const hasMoved = sheetDragRef.current.hasMoved
    sheetDragRef.current = null

    if (!hasMoved) {
      const nextSnap: 'bottom' | 'mid' | 'full' =
        mobileSheetSnap === 'bottom' ? 'mid' : mobileSheetSnap === 'mid' ? 'full' : 'mid'
      setMobileSheetSnap(nextSnap)
      setMobileSheetDragTranslate(null)
      return
    }

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

  const mobileCountLabel =
    visibleChefs.length === 1
      ? t('explore.chefsAvailableInZone_one', { count: 1 })
      : t('explore.chefsAvailableInZone', { count: visibleChefs.length })
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
                  className="relative flex h-11 items-center rounded-full border border-[#EAEAEA] bg-white px-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
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
                    className={`w-full bg-transparent text-sm text-[#2A2A2A] outline-none placeholder:text-[#9A9A9A] ${searchPin ? 'pr-8' : ''}`}
                  />
                  {searchPin && (
                    <button
                      type="button"
                      onClick={handleResetSearchPin}
                      className="absolute right-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#F0F0F0] hover:text-[#374151]"
                      aria-label={t('explore.resetPin')}
                    >
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}
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
                    onClick={() => setViewModeWithTransition('map')}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                      viewMode === 'map' ? 'bg-[#111111] text-white' : 'text-[#555555] hover:bg-[#F5F5F5]'
                    }`}
                  >
                    {t('explore.map')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewModeWithTransition('list')}
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
              isMobile
              onChefHover={handleChefHover}
              onChefClick={handleChefBubbleClick}
              onSelectionClear={handleSelectionClear}
              onVisibleChefIdsChange={setMapVisibleChefIds}
              initialRegionBBox={initialRegionBBox}
              focusedRegionSlug={focusedRegionSlug}
              searchViewport={searchViewport}
              searchPin={searchPin}
              outOfRangeChefIds={[...outOfRangeChefIds]}
              locale={locale}
            />

            <div
              ref={searchContainerRef}
              className="absolute left-4 right-4 top-4 z-30 md:hidden"
            >
              <form
                onSubmit={handleSearchSubmit}
                className="relative flex h-11 items-center rounded-full border border-[#EAEAEA] bg-white px-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
              >
                <input
                  ref={mobileSearchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setIsSearchOpen(true)
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  onTouchStart={() => setIsSearchOpen(true)}
                  placeholder={t('explore.searchPlaceholder')}
                  className={`w-full flex-1 bg-transparent text-sm text-[#2A2A2A] outline-none placeholder:text-[#9A9A9A] ${searchPin ? 'pr-12' : ''}`}
                />
                {searchPin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      handleResetSearchPin()
                    }}
                    className="absolute right-1 flex h-9 min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#F0F0F0] hover:text-[#374151] active:bg-[#E5E7EB]"
                    aria-label={t('explore.resetPin')}
                  >
                    <X className="h-4 w-4 shrink-0" strokeWidth={2} />
                  </button>
                )}
              </form>
            </div>
            {isMobile &&
              mobileDropdownBounds &&
              createPortal(
                <div
                  ref={mobileDropdownRef}
                  className="fixed z-[100] max-h-[min(50vh,320px)] overflow-y-auto rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.12)]"
                  style={{
                    top: mobileDropdownBounds.top,
                    left: mobileDropdownBounds.left,
                    width: mobileDropdownBounds.width,
                  }}
                >
                  {isSearchLoading ? (
                    <p className="px-4 py-4 text-sm text-[#6B7280]">{t('explore.searchLoading')}</p>
                  ) : (
                    searchSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => applySuggestion(suggestion)}
                        className="flex min-h-[44px] w-full touch-manipulation items-center border-b border-[#F3F3F3] px-4 py-3 text-left text-sm text-[#222222] active:bg-[#F0F0F0] last:border-b-0 hover:bg-[#FAFAFA]"
                      >
                        {suggestion.label}
                      </button>
                    ))
                  )}
                </div>,
                document.body
              )}

            <aside
              className={`absolute inset-x-0 bottom-0 h-full rounded-t-[24px] border-t border-[#EAEAEA] bg-white shadow-[0_-14px_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isMobileSheetExpanded ? 'z-40' : 'z-20'}`}
              style={{
                bottom: 'env(safe-area-inset-bottom)',
                transform: `translateY(${mobileSheetDragTranslate ?? mobileSnapTranslate(mobileSheetSnap)}%)`,
              }}
            >
              <div
                className="flex min-h-[72px] cursor-grab touch-none flex-col items-center justify-center gap-2 px-4 py-4 active:cursor-grabbing"
                onPointerDown={handleSheetPointerDown}
                onPointerMove={handleSheetPointerMove}
                onPointerUp={handleSheetPointerUp}
                onPointerCancel={handleSheetPointerUp}
                style={{ touchAction: 'none' }}
              >
                <div className="h-1 w-14 rounded-full bg-[#D8D8D8]" />
                <p className="text-center text-sm font-medium text-[#2B2B2B]">{mobileCountLabel}</p>
              </div>

              <div
                ref={mobileSheetScrollRef}
                className={`explore-scroll explore-scroll--hidden h-[calc(100%-72px)] overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+8rem)] ${
                  mobileSheetSnap === 'bottom' ? 'overflow-hidden' : 'overflow-y-auto'
                }`}
              >
                <div className={mobileSheetSnap === 'bottom' ? 'pointer-events-none opacity-0' : 'opacity-100 transition-opacity'}>
                  <ChefList
                    chefs={mobileListChefs}
                    onChefHover={handleChefHover}
                    highlightedChefId={selectedChefId}
                    outOfRangeChefIds={outOfRangeChefIds}
                    onChefMountRef={handleChefMountRef}
                    onChefNameClick={handleChefNameToggle}
                    forceMobileCardStyle
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
                className={`absolute inset-y-0 left-0 ${
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
                    chefs={orderedVisibleChefs}
                    onChefHover={handleChefHover}
                    highlightedChefId={selectedChefId}
                    outOfRangeChefIds={outOfRangeChefIds}
                    onChefMountRef={handleChefMountRef}
                    onChefNameClick={handleChefNameToggle}
                    forceMobileCardStyle
                  />
                </div>
              </div>

              <div
                className={`absolute inset-y-0 right-0 ${
                  viewMode === 'map' ? 'w-full p-4' : 'hidden w-1/2 p-4 lg:block'
                }`}
              >
                <div
                  className={`relative h-full w-full overflow-hidden rounded-[24px] ${
                    viewMode === 'map'
                      ? 'bg-[#F7F7F7] shadow-[0_12px_34px_rgba(0,0,0,0.10)]'
                      : 'border border-[#EAEAEA] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.08)]'
                  }`}
                >
                  {mapLayoutTransitioning && (
                    <div
                      className="pointer-events-auto absolute inset-0 z-20 flex select-none items-center justify-center bg-[#F7F7F7]"
                      aria-hidden
                    >
                      <div className="relative h-24 w-24">
                        <div className="absolute inset-0 rounded-full border border-[#F8E7A0] animate-ping [animation-duration:1400ms]" />
                        <div className="absolute inset-[10px] rounded-full border-2 border-[#F1D56A]/60 border-t-[#D4A602] animate-spin [animation-duration:900ms]" />
                        <div className="absolute inset-[22px] rounded-full bg-white shadow-[0_6px_20px_rgba(0,0,0,0.08)]" />
                        <img
                          src="/logo-cercle.png"
                          alt="MyTable"
                          className="absolute inset-0 m-auto h-10 w-10 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.12)]"
                        />
                      </div>
                    </div>
                  )}
                  <div
                    className={`h-full w-full transition-opacity duration-500 ${
                      mapLayoutTransitioning ? 'pointer-events-none opacity-0' : 'opacity-100'
                    }`}
                  >
                    <ExploreMap
                      chefs={mapDataChefs}
                      selectedChefId={selectedChefId}
                      isMapMode={viewMode === 'map'}
                      onChefHover={handleChefHover}
                      onChefClick={handleChefBubbleClick}
                      onSelectionClear={handleSelectionClear}
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
          </div>
        )}
      </section>
    </main>
  )
}
