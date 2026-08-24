'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ChefMapPopup } from './ChefMapPopup'
import { ChefList } from './ChefList'
import { ChefProfilePanel } from './ChefProfilePanel'
import { ExploreMap } from './ExploreMap'
import { LocationSearchBar } from './LocationSearchBar'
import { ExploreChef } from './types'
import { FRANCE_CENTER, FRANCE_ZOOM, EMBEDDED_FRANCE_ZOOM, RegionBBox, getChefAvailabilityRadiusKm } from '@/lib/regions'
import BookingLanguageSwitcher from '@/components/BookingLanguageSwitcher'
import { useTranslation } from '@/hooks/useTranslation'
import { trackEvent } from '@/lib/analytics/track'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  buildSearchStateFromSelection,
  type ExploreLocationSelection,
  type ExploreLocationSuggestion,
} from '@/lib/exploreLocationSearch'

interface ExploreLayoutProps {
  chefs: ExploreChef[]
  initialRegionBBox?: RegionBBox | null
  focusedRegionSlug?: string | null
  initialLocation?: ExploreLocationSelection | null
  /** Version embeddée : pas de header avec logo, barre de recherche compacte + bouton translate à droite */
  embedded?: boolean
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

const EMBEDDED_BASE_PATH = '/explore2'

export function ExploreLayout({
  chefs,
  initialRegionBBox = null,
  focusedRegionSlug: initialFocusedRegionSlug = null,
  initialLocation = null,
  embedded = false,
}: ExploreLayoutProps) {
  const router = useRouter()
  const { t, locale } = useTranslation()
  const initialSearchState = initialLocation ? buildSearchStateFromSelection(initialLocation) : null
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const isMobile = useIsMobile()
  const [pinnedChefId, setPinnedChefId] = useState<string | null>(null)
  const [profileChefId, setProfileChefId] = useState<string | null>(null)
  const [hoveredChefId, setHoveredChefId] = useState<string | null>(null)
  const [focusedRegionSlug, setFocusedRegionSlug] = useState<string | null>(
    initialLocation ? null : initialFocusedRegionSlug
  )
  const [searchQuery, setSearchQuery] = useState(initialSearchState?.query ?? '')
  const [searchViewport, setSearchViewport] = useState<{
    key: string
    center: [number, number]
    zoom: number
    bbox?: RegionBBox | null
  } | null>(initialSearchState?.viewport ?? null)
  const [activeSearch, setActiveSearch] = useState<{
    center: [number, number]
    bbox?: RegionBBox | null
  } | null>(initialSearchState?.activeSearch ?? null)
  const [mapVisibleChefIds, setMapVisibleChefIds] = useState<string[] | null>(null)
  const [searchPin, setSearchPin] = useState<SearchPin | null>(initialSearchState?.pin ?? null)
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
  const mobileSheetScrollRef = useRef<HTMLDivElement | null>(null)
  const desktopListScrollRef = useRef<HTMLDivElement | null>(null)
  const sheetDragRef = useRef<{ startY: number; startTranslate: number; hasMoved: boolean } | null>(null)
  const [mobileSheetSnap, setMobileSheetSnap] = useState<'bottom' | 'mid' | 'full'>('bottom')
  const [mobileSheetDragTranslate, setMobileSheetDragTranslate] = useState<number | null>(null)
  const selectedChefId = pinnedChefId ?? hoveredChefId

  const sortedChefs = useMemo(() => {
    return [...chefs].sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [chefs, locale])

  const profileChef = profileChefId
    ? sortedChefs.find((chef) => chef.id === profileChefId) || null
    : null

  const outOfRangeChefIdsSet = useMemo(() => {
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

  const outOfRangeChefIds = useMemo(
    () => [...outOfRangeChefIdsSet],
    [outOfRangeChefIdsSet]
  )

  const mapDataChefs = useMemo(() => {
    if (searchPin) {
      return sortedChefs.filter((chef) => !outOfRangeChefIdsSet.has(chef.id))
    }
    if (!activeSearch) return sortedChefs
    return sortedChefs.filter((chef) => {
      if (typeof chef.latitude !== 'number' || typeof chef.longitude !== 'number') return false
      if (activeSearch.bbox) {
        return inBBox(chef.longitude, chef.latitude, activeSearch.bbox)
      }
      return distanceKm(chef.latitude, chef.longitude, activeSearch.center[1], activeSearch.center[0]) <= 70
    })
  }, [activeSearch, searchPin, sortedChefs, outOfRangeChefIdsSet])

  const visibleChefs = useMemo(() => {
    if (!mapVisibleChefIds) return mapDataChefs
    const visibleSet = new Set(mapVisibleChefIds)
    return mapDataChefs.filter((chef) => visibleSet.has(chef.id))
  }, [mapDataChefs, mapVisibleChefIds])

  const orderedVisibleChefs = useMemo(() => {
    if (!searchPin) return visibleChefs
    const inRange = visibleChefs.filter((chef) => !outOfRangeChefIdsSet.has(chef.id))
    const outOfRange = visibleChefs.filter((chef) => outOfRangeChefIdsSet.has(chef.id))
    inRange.sort((a, b) => a.name.localeCompare(b.name, locale))
    outOfRange.sort((a, b) => a.name.localeCompare(b.name, locale))
    return [...inRange, ...outOfRange]
  }, [visibleChefs, searchPin, outOfRangeChefIdsSet, locale])

  const mobileListChefs = useMemo(() => {
    if ((!isMobile && !embedded) || !pinnedChefId) return orderedVisibleChefs
    const pinned = orderedVisibleChefs.find((c) => c.id === pinnedChefId)
    if (!pinned) return orderedVisibleChefs
    const rest = orderedVisibleChefs.filter((c) => c.id !== pinnedChefId)
    return [pinned, ...rest]
  }, [isMobile, embedded, pinnedChefId, orderedVisibleChefs])

  const desktopListChefs = useMemo(() => {
    if (!pinnedChefId) return orderedVisibleChefs
    const pinned = orderedVisibleChefs.find((c) => c.id === pinnedChefId)
    if (!pinned) return orderedVisibleChefs
    const rest = orderedVisibleChefs.filter((c) => c.id !== pinnedChefId)
    return [pinned, ...rest]
  }, [pinnedChefId, orderedVisibleChefs])

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
    }
  }, [])

  useEffect(() => {
    if (!isMobile) return
    setViewMode('map')
  }, [isMobile])

  useEffect(() => {
    if (isMobile || viewMode !== 'list' || !pinnedChefId) return
    desktopListScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pinnedChefId, viewMode, isMobile])

  useEffect(() => {
    if (initialLocation) return
    setFocusedRegionSlug(initialFocusedRegionSlug)
  }, [initialFocusedRegionSlug, initialLocation])

  useEffect(() => {
    if (initialLocation) return
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
  }, [initialLocation, initialRegionBBox, initialFocusedRegionSlug])

  const handleChefMountRef = useCallback((chefId: string, element: HTMLElement | null) => {
    cardRefs.current[chefId] = element
  }, [])

  const handleChefBubbleClick = useCallback((chefId: string) => {
    setPinnedChefId(chefId)
    setHoveredChefId(null)
    setProfileChefId((openId) => (openId ? chefId : openId))
  }, [])

  const handleOpenProfile = useCallback((chefId: string) => {
    setPinnedChefId(chefId)
    setHoveredChefId(null)
    setProfileChefId(chefId)
  }, [])

  const handleCloseProfile = useCallback(() => {
    setProfileChefId(null)
  }, [])

  const handleSelectionClear = useCallback(() => {
    setProfileChefId(null)
    setPinnedChefId(null)
    setHoveredChefId(null)
  }, [])

  const handleChefHover = useCallback((chefId: string | null) => {
    setHoveredChefId(chefId)
  }, [])

  const handleChefNameToggle = useCallback((chefId: string) => {
    setPinnedChefId((prev) => {
      if (prev === chefId) {
        setProfileChefId(null)
        return null
      }
      return chefId
    })
    setHoveredChefId((prev) => (prev === chefId ? null : prev))
  }, [])

  const applySuggestion = (suggestion: ExploreLocationSuggestion) => {
    const state = buildSearchStateFromSelection(suggestion)
    const key = `${suggestion.id}-${Date.now()}`
    setFocusedRegionSlug(null)
    setSearchQuery(state.query)
    setSearchPin({ key, center: state.pin.center })
    setActiveSearch(state.activeSearch)
    setSearchViewport({ ...state.viewport, key })
    setMapVisibleChefIds(null)
    trackEvent('search', { search_query: suggestion.label, search_label: suggestion.label })
    router.replace(embedded ? EMBEDDED_BASE_PATH : '/explore')
  }

  const handleResetRegionFocus = () => {
    setFocusedRegionSlug(null)
    setSearchPin(null)
    setActiveSearch(null)
    setSearchQuery('')
    setSearchViewport({
      key: `france-${Date.now()}`,
      center: FRANCE_CENTER,
      zoom: embedded ? EMBEDDED_FRANCE_ZOOM : FRANCE_ZOOM,
      bbox: null,
    })
    setMapVisibleChefIds(null)
    router.replace(embedded ? EMBEDDED_BASE_PATH : '/explore')
  }

  const handleResetSearchPin = () => {
    setSearchPin(null)
    setActiveSearch(null)
    setSearchQuery('')
    setSearchViewport({
      key: `france-${Date.now()}`,
      center: FRANCE_CENTER,
      zoom: embedded ? EMBEDDED_FRANCE_ZOOM : FRANCE_ZOOM,
      bbox: null,
    })
    setMapVisibleChefIds(null)
  }

  const mobileSnapTranslate = (snap: 'bottom' | 'mid' | 'full') => {
    if (snap === 'full') return 0
    if (snap === 'mid') return 38
    return 90
  }

  const handleSheetPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobile && !embedded) return
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
      { id: 'mid', value: 38 },
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
  /** Explore2 embed: pas de header, layout compact. Mobile/tablet: carte en bas (pas de drawer) pour explore ET explore2. */
  const useExplore2MobileLayout = embedded && isMobile
  const showMobileLayout = isMobile
  const useBottomCardOnMobile = isMobile

  return (
    <main className={`h-[100dvh] w-screen overflow-hidden ${viewMode === 'list' ? 'bg-white' : 'bg-[#F7F7F7]'}`}>
      {!useExplore2MobileLayout && (
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

              <LocationSearchBar
                query={searchQuery}
                onQueryChange={setSearchQuery}
                onSelect={applySuggestion}
                locale={locale}
                placeholder={t('explore.searchPlaceholder')}
                loadingLabel={t('explore.searchLoading')}
                clearLabel={t('explore.resetPin')}
                showClear={!!searchPin}
                onClear={handleResetSearchPin}
                variant="header"
              />

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
      )}

      <section className={useExplore2MobileLayout ? 'pt-0' : 'pt-[64px] lg:pt-[84px]'}>
        {showMobileLayout ? (
          <div className={`relative w-full overflow-hidden ${useExplore2MobileLayout ? 'h-[100dvh]' : 'h-[calc(100dvh-64px)]'}`}>
            <ExploreMap
              chefs={mapDataChefs}
              selectedChefId={selectedChefId}
              isMapMode
              isMobile
              embedded={useBottomCardOnMobile}
              onChefHover={handleChefHover}
              onChefClick={handleChefBubbleClick}
              onSelectionClear={handleSelectionClear}
              onVisibleChefIdsChange={setMapVisibleChefIds}
              onOpenProfile={handleOpenProfile}
              profileOpen={!!profileChef}
              initialRegionBBox={initialRegionBBox}
              focusedRegionSlug={focusedRegionSlug}
              searchViewport={searchViewport}
              searchPin={searchPin}
              outOfRangeChefIds={outOfRangeChefIds}
              locale={locale}
            />

            <div
              className={`absolute left-4 right-4 top-4 flex w-[calc(100%-2rem)] items-center gap-2 ${
                useExplore2MobileLayout ? '' : 'md:hidden'
              } ${
                profileChef && useExplore2MobileLayout
                  ? 'z-[55]'
                  : profileChef
                    ? 'pointer-events-none invisible'
                    : 'z-30'
              }`}
            >
              <LocationSearchBar
                query={searchQuery}
                onQueryChange={setSearchQuery}
                onSelect={applySuggestion}
                locale={locale}
                placeholder={useExplore2MobileLayout ? t('explore.searchPlaceholderEmbedded') : t('explore.searchPlaceholder')}
                loadingLabel={t('explore.searchLoading')}
                clearLabel={t('explore.resetPin')}
                showClear={!!searchPin}
                onClear={handleResetSearchPin}
                variant="overlay"
              />
              {useExplore2MobileLayout && (
                <div className="shrink-0">
                  <BookingLanguageSwitcher variant="embedded" />
                </div>
              )}
            </div>
            {!useBottomCardOnMobile && showMobileLayout && (
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
                      outOfRangeChefIds={outOfRangeChefIdsSet}
                      onChefMountRef={handleChefMountRef}
                      onChefNameClick={handleChefNameToggle}
                      forceMobileCardStyle
                      compact
                      onOpenProfile={handleOpenProfile}
                    />
                    <div className="h-[42vh]" aria-hidden />
                  </div>
                </div>
              </aside>
            )}
            {useBottomCardOnMobile && pinnedChefId && !profileChef && (() => {
              const chef = mapDataChefs.find((c) => c.id === pinnedChefId)
              if (!chef) return null
              return (
                <ChefMapPopup
                  chef={chef}
                  onRequestClose={() => setPinnedChefId(null)}
                  onOpenProfile={handleOpenProfile}
                  bottomSheet
                />
              )
            })()}
            {profileChef && (
              <>
                <button
                  type="button"
                  className="absolute inset-0 z-40 bg-black/20"
                  aria-label={t('common.close')}
                  onClick={handleCloseProfile}
                />
                <ChefProfilePanel
                  chef={profileChef}
                  variant="sheet"
                  onClose={handleCloseProfile}
                  sitBelowOverlay={useExplore2MobileLayout}
                />
              </>
            )}
          </div>
        ) : (
          <div className="w-full overflow-hidden h-[calc(100dvh-64px)] lg:h-[calc(100dvh-84px)]">
            <div className="relative h-full w-full">
              <div
                className={`absolute inset-y-0 left-0 ${
                  viewMode === 'map'
                    ? 'w-0 pointer-events-none opacity-0'
                    : 'w-full lg:w-1/2 opacity-100'
                }`}
              >
                <div
                  ref={desktopListScrollRef}
                  className={`explore-scroll explore-scroll--hidden h-full overflow-y-auto px-4 pb-10 pt-5 sm:px-6 lg:px-8 ${
                    viewMode === 'map' ? 'invisible' : 'visible'
                  }`}
                >
                  <ChefList
                    chefs={desktopListChefs}
                    onChefHover={handleChefHover}
                    highlightedChefId={selectedChefId}
                    outOfRangeChefIds={outOfRangeChefIdsSet}
                    onChefMountRef={handleChefMountRef}
                    onChefNameClick={handleChefNameToggle}
                    horizontal
                    onOpenProfile={handleOpenProfile}
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
                      onOpenProfile={handleOpenProfile}
                      profileOpen={!!profileChef}
                      initialRegionBBox={initialRegionBBox}
                      focusedRegionSlug={focusedRegionSlug}
                      searchViewport={searchViewport}
                      searchPin={searchPin}
                      outOfRangeChefIds={outOfRangeChefIds}
                      locale={locale}
                    />
                  </div>
                  {profileChef && (
                    <ChefProfilePanel chef={profileChef} variant="drawer" onClose={handleCloseProfile} />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
