'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { X } from 'lucide-react'
import { ChefMapPopup } from './ChefMapPopup'
import { ExploreChef } from './types'
import { FRANCE_CENTER, FRANCE_ZOOM, EMBEDDED_FRANCE_ZOOM, RegionBBox, getChefAvailabilityRadiusKm, getRegionBySlug } from '@/lib/regions'
import type { Locale } from '@/lib/i18n'

const SOURCE_ID = 'chefs'
const CLUSTER_LAYER_ID = 'chefs-clusters'
const CLUSTER_COUNT_LAYER_ID = 'chefs-cluster-count'
const REGIONS_SOURCE_ID = 'explore-regions-focus'
const REGIONS_FILL_LAYER_ID = 'explore-regions-focus-fill'
const REGIONS_BORDER_LAYER_ID = 'explore-regions-focus-border'
const REGION_DIM_SOURCE_ID = 'explore-region-dim-mask'
const REGION_DIM_LAYER_ID = 'explore-region-dim-layer'
const CHEF_RADIUS_SOURCE_ID = 'explore-chef-radius-source'
const CHEF_RADIUS_FILL_LAYER_ID = 'explore-chef-radius-fill'
const CHEF_RADIUS_STROKE_LAYER_ID = 'explore-chef-radius-stroke'
const CHEF_SPIDER_LINES_SOURCE_ID = 'explore-chef-spider-lines'
const CHEF_SPIDER_LINES_LAYER_ID = 'explore-chef-spider-lines-layer'

/** Min zoom to apply pixel-based spiderfy (avoids recalculations when clustered) */
const MIN_ZOOM_FOR_SPIDERFY = 7
/** Markers within this pixel distance are grouped and spiderfied */
const PIXEL_PROXIMITY_THRESHOLD = 28
/** Minimum gap in pixels between bubble bounding boxes (no touching) */
const MIN_BUBBLE_GAP_PX = 10
/** Chef marker: padding 6px 14px, font 14px ~8.5px/char */
const BUBBLE_PADDING_H = 28
const BUBBLE_PADDING_V = 12
const BUBBLE_CHAR_WIDTH = 8.5
const BUBBLE_MIN_WIDTH = 70
const BUBBLE_MAX_WIDTH = 200
const BUBBLE_BASE_HEIGHT = 32
const EUROPE_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-12, 34],
  [32, 72],
]

const DEFAULT_REGION_BORDER_COLOR = '#E8E8E8'
const FOCUS_REGION_BORDER_COLOR = '#606060'
const RADIUS_BUBBLE_STORAGE_KEY = 'mytable_explore_radius_bubble_dismissed'

function getRadiusBubbleDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(RADIUS_BUBBLE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function setRadiusBubbleDismissed(dismissed: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (dismissed) {
      localStorage.setItem(RADIUS_BUBBLE_STORAGE_KEY, '1')
    } else {
      localStorage.removeItem(RADIUS_BUBBLE_STORAGE_KEY)
    }
  } catch {
    // Ignore storage errors (private mode, quota, etc.)
  }
}

function getRegionsFillColorExpression(_regionCode: string | null): any {
  return '#FFFFFF'
}

function getRegionsFillOpacityExpression(_regionCode: string | null): any {
  return 0
}

function getRegionsBorderColorExpression(regionCode: string | null): any {
  if (!regionCode) return DEFAULT_REGION_BORDER_COLOR
  return ['case', ['==', ['get', 'code'], regionCode], FOCUS_REGION_BORDER_COLOR, DEFAULT_REGION_BORDER_COLOR]
}

function getRegionsBorderWidthExpression(regionCode: string | null): any {
  if (!regionCode) return 1.15
  return ['case', ['==', ['get', 'code'], regionCode], 1.35, 0.95]
}

function getRegionsBorderOpacityExpression(regionCode: string | null): any {
  if (!regionCode) return 0.7
  return ['case', ['==', ['get', 'code'], regionCode], 0.85, 0.45]
}

function hideMapNoiseLayers(map: mapboxgl.Map) {
  if (!map.isStyleLoaded()) return
  const style = map.getStyle()
  const layers = style?.layers || []
  const hiddenKeywords = [
    'road-label',
    'motorway',
    'country-label',
    'state-label',
    'settlement-label',
    'settlement-subdivision-label',
    'airport-label',
    'transit-label',
    'poi-label',
    'marine',
    'waterway-label',
    'water-label',
    'natural-line-label',
    'natural-point-label',
    'water-line-label',
    'water-point-label',
  ]

  layers.forEach((layer) => {
    const id = layer.id.toLowerCase()
    if (hiddenKeywords.some((keyword) => id.includes(keyword))) {
      try {
        map.setLayoutProperty(layer.id, 'visibility', 'none')
      } catch {
        // Ignore non-layout layers
      }
    }
  })
}

function extractOuterRings(geometry: GeoJSON.Geometry | null | undefined): Array<Array<[number, number]>> {
  if (!geometry) return []
  if (geometry.type === 'Polygon') {
    const outer = geometry.coordinates?.[0]
    return outer ? [outer as Array<[number, number]>] : []
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((polygon) => polygon?.[0] as Array<[number, number]> | undefined)
      .filter((ring): ring is Array<[number, number]> => Array.isArray(ring) && ring.length > 2)
  }
  return []
}

function buildDimMaskGeoJSON(
  regionsGeojson: GeoJSON.FeatureCollection<GeoJSON.Geometry, { code?: string }> | null,
  focusedRegionCode: string | null
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const [minLng, minLat] = EUROPE_MAX_BOUNDS[0]
  const [maxLng, maxLat] = EUROPE_MAX_BOUNDS[1]
  const outerRing: Array<[number, number]> = [
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat],
  ]

  if (!focusedRegionCode || !regionsGeojson) {
    return {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [outerRing] } }],
    }
  }

  const focusedFeature = regionsGeojson.features.find((feature) => String(feature.properties?.code || '') === focusedRegionCode)
  const holeRings = extractOuterRings(focusedFeature?.geometry)

  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [outerRing, ...holeRings] } }],
  }
}

interface SearchViewport {
  center: [number, number]
  zoom: number
  bbox?: RegionBBox | null
  key: string
}

interface SearchPin {
  key: string
  center: [number, number]
}

interface PopupAnchor {
  chefId: string
  lng: number
  lat: number
}

interface ExploreMapProps {
  chefs: ExploreChef[]
  selectedChefId: string | null
  locale?: Locale
  isMapMode?: boolean
  isMobile?: boolean
  embedded?: boolean
  initialRegionBBox?: RegionBBox | null
  focusedRegionSlug?: string | null
  searchViewport?: SearchViewport | null
  searchPin?: SearchPin | null
  outOfRangeChefIds?: string[]
  onChefHover?: (chefId: string | null) => void
  onChefClick?: (chefId: string) => void
  onVisibleChefIdsChange?: (chefIds: string[]) => void
  onSelectionClear?: () => void
}

function formatChefNameWithPrefix(name: string, fallback = 'Chef'): string {
  const firstName = (name || '').trim().split(/\s+/)[0] || ''
  return firstName ? `Chef ${firstName}` : fallback
}

function applyMapLanguage(map: mapboxgl.Map, locale: Locale) {
  if (!map.isStyleLoaded()) return
  const style = map.getStyle()
  const layers = style?.layers || []
  const nameToMatch = ['coalesce', ['get', 'name_fr'], ['get', 'name_en'], ['get', 'name'], '']
  const fallbackName = ['coalesce', ['get', 'name_fr'], ['get', 'name'], ['get', 'name_en'], '']
  const frenchSeaFallbackExpression: any = [
    'match',
    nameToMatch,
    'English Channel', 'Manche',
    'The English Channel', 'La Manche',
    'Bay of Biscay', 'Golfe de Gascogne',
    'Celtic Sea', 'Mer Celtique',
    'North Sea', 'Mer du Nord',
    'Mediterranean Sea', 'Mer Méditerranée',
    'Mediterranean', 'Mer Méditerranée',
    'Tyrrhenian Sea', 'Mer Tyrrhénienne',
    'Ligurian Sea', 'Mer Ligure',
    'Alboran Sea', "Mer d'Alboran",
    'Atlantic Ocean', 'Océan Atlantique',
    'North Atlantic', 'Atlantique Nord',
    'South Atlantic', 'Atlantique Sud',
    'Strait of Gibraltar', 'Détroit de Gibraltar',
    'Irish Sea', "Mer d'Irlande",
    "St George's Channel", 'Canal de Saint George',
    'Bristol Channel', 'Canal de Bristol',
    'Ionian Sea', 'Mer Ionienne',
    'Adriatic Sea', 'Mer Adriatique',
    'Aegean Sea', 'Mer Égée',
    'Balearic Sea', 'Mer des Baléares',
    'Gulf of Lion', 'Golfe du Lion',
    'Gulf of Valencia', 'Golfe de Valence',
    'Gulf of Genoa', 'Golfe de Gênes',
    'Black Sea', 'Mer Noire',
    'Baltic Sea', 'Mer Baltique',
    'Norwegian Sea', 'Mer de Norvège',
    'Labrador Sea', 'Mer du Labrador',
    'Sea of Marmara', 'Mer de Marmara',
    'Sea of Azov', "Mer d'Azov",
    'Marmara Sea', 'Mer de Marmara',
    'Azov Sea', "Mer d'Azov",
    fallbackName,
  ]

  layers.forEach((layer) => {
    if (layer.type !== 'symbol') return
    if (layer.source === SOURCE_ID || layer.id === CLUSTER_COUNT_LAYER_ID) return

    try {
      const currentTextField = map.getLayoutProperty(layer.id, 'text-field')
      if (!currentTextField) return

      if (locale === 'fr') {
        map.setLayoutProperty(layer.id, 'text-field', [
          'coalesce',
          ['get', 'name_fr'],
          frenchSeaFallbackExpression,
          currentTextField as any,
        ])
        return
      }

      map.setLayoutProperty(layer.id, 'text-field', [
        'coalesce',
        ['get', `name_${locale}`],
        ['get', 'name'],
        currentTextField as any,
      ])
    } catch {
      // Ignore unsupported symbol layers.
    }
  })
}

/** Estimate bubble size from display name (chef-marker CSS: 6px 14px padding, 14px font) */
function estimateBubbleSize(displayName: string): { w: number; h: number } {
  const textWidth = displayName.length * BUBBLE_CHAR_WIDTH
  const w = Math.min(BUBBLE_MAX_WIDTH, Math.max(BUBBLE_MIN_WIDTH, BUBBLE_PADDING_H + textWidth))
  return { w, h: BUBBLE_BASE_HEIGHT }
}

/** Check if two rects (center + half-size) overlap with required gap */
function rectsOverlapWithGap(
  cx1: number,
  cy1: number,
  w1: number,
  h1: number,
  cx2: number,
  cy2: number,
  w2: number,
  h2: number,
  gap: number
): boolean {
  const half = gap / 2
  const l1 = cx1 - w1 / 2 - half
  const r1 = cx1 + w1 / 2 + half
  const t1 = cy1 - h1 / 2 - half
  const b1 = cy1 + h1 / 2 + half
  const l2 = cx2 - w2 / 2 - half
  const r2 = cx2 + w2 / 2 + half
  const t2 = cy2 - h2 / 2 - half
  const b2 = cy2 + h2 / 2 + half
  return !(r1 < l2 || l1 > r2 || b1 < t2 || t1 > b2)
}

/**
 * Place bubbles around center using spiral candidate positions.
 * Returns screen positions (px, py) for each item, ensuring MIN_BUBBLE_GAP_PX between all bubbles.
 */
function computeCollisionFreePositions(
  centerX: number,
  centerY: number,
  items: Array<{ name: string }>,
  formatName: (name: string) => string
): Array<{ px: number; py: number }> {
  if (items.length <= 1) {
    return items.map(() => ({ px: centerX, py: centerY }))
  }

  const placed: Array<{ px: number; py: number; w: number; h: number }> = []
  const R0 = 24
  const dr = 10
  const dtheta = Math.PI / 6
  const maxR = 200

  const withSize = items.map((item, origIndex) => ({
    item,
    origIndex,
    ...estimateBubbleSize(formatName(item.name)),
  }))
  withSize.sort((a, b) => b.w - a.w)

  for (const { w, h } of withSize) {
    let found = false
    for (let r = R0; r <= maxR && !found; r += dr) {
      for (let t = 0; t < 2 * Math.PI && !found; t += dtheta) {
        const px = centerX + r * Math.cos(t)
        const py = centerY + r * Math.sin(t)

        let collides = false
        for (const p of placed) {
          if (rectsOverlapWithGap(px, py, w, h, p.px, p.py, p.w, p.h, MIN_BUBBLE_GAP_PX)) {
            collides = true
            break
          }
        }

        if (!collides) {
          placed.push({ px, py, w, h })
          found = true
        }
      }
    }

    if (!found) {
      const fallbackR = R0 + (placed.length + 1) * 50
      const fallbackT = (2 * Math.PI * placed.length) / Math.max(1, items.length)
      placed.push({
        px: centerX + fallbackR * Math.cos(fallbackT),
        py: centerY + fallbackR * Math.sin(fallbackT),
        w,
        h,
      })
    }
  }

  const indexAtPlace = withSize.map((x) => x.origIndex)
  return placed
    .map((p, i) => ({ ...p, origIndex: indexAtPlace[i] }))
    .sort((a, b) => a.origIndex - b.origIndex)
    .map((p) => ({ px: p.px, py: p.py }))
}

/**
 * Groups indices by pixel proximity (connected components).
 * Returns array of groups; each group is array of indices into items.
 */
function groupByPixelProximity<T extends { screenX: number; screenY: number }>(
  items: T[],
  thresholdPx: number
): number[][] {
  const n = items.length
  const parent = items.map((_, i) => i)
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i])
    return parent[i]
  }
  const union = (i: number, j: number) => {
    const pi = find(i)
    const pj = find(j)
    if (pi !== pj) parent[pi] = pj
  }
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const dx = items[i].screenX - items[j].screenX
      const dy = items[i].screenY - items[j].screenY
      if (dx * dx + dy * dy <= thresholdPx * thresholdPx) union(i, j)
    }
  }
  const byRoot = new Map<number, number[]>()
  for (let i = 0; i < n; i += 1) {
    const r = find(i)
    const list = byRoot.get(r) ?? []
    list.push(i)
    byRoot.set(r, list)
  }
  return [...byRoot.values()]
}

function isAbortLikeError(value: unknown): boolean {
  if (!value) return false
  // DOMException AbortError (code 20)
  if (typeof DOMException !== 'undefined' && value instanceof DOMException && value.name === 'AbortError') return true
  if (typeof value === 'string') {
    const lowered = value.toLowerCase()
    return (
      lowered.includes('aborterror') ||
      lowered.includes('signal is aborted') ||
      lowered.includes('aborted without reason')
    )
  }

  const maybeError = value as { name?: string; message?: string; cause?: unknown; code?: number }
  const name = String(maybeError.name || '').toLowerCase()
  const message = String(maybeError.message || '').toLowerCase()
  if (name === 'aborterror' || name.includes('abort')) return true
  if (maybeError.code === 20) return true // ABORT_ERR
  if (message.includes('signal is aborted') || message.includes('aborterror') || message.includes('aborted without reason')) {
    return true
  }
  if (maybeError.cause && maybeError.cause !== value) return isAbortLikeError(maybeError.cause)
  return false
}

declare global {
  interface Window {
    __mytableAbortSuppressionInstalled?: boolean
  }
}

function ensureGlobalAbortSuppression() {
  if (typeof window === 'undefined') return
  if (window.__mytableAbortSuppressionInstalled) return
  window.__mytableAbortSuppressionInstalled = true

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (!isAbortLikeError(event.reason)) return
    event.preventDefault()
    event.stopPropagation()
  }

  const onWindowError = (event: ErrorEvent) => {
    if (!isAbortLikeError(event.error || event.message)) return
    event.preventDefault()
    event.stopPropagation()
  }

  window.addEventListener('unhandledrejection', onUnhandledRejection, { capture: true })
  window.addEventListener('error', onWindowError, { capture: true })
}

// Installer la suppression des AbortError dès le chargement du module (avant toute création de map)
if (typeof window !== 'undefined') {
  ensureGlobalAbortSuppression()
}

function buildRadiusPolygon(
  longitude: number,
  latitude: number,
  radiusKm: number,
  points = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const earthRadiusKm = 6371
  const latRad = (latitude * Math.PI) / 180
  const lngRad = (longitude * Math.PI) / 180
  const angularDistance = radiusKm / earthRadiusKm
  const coordinates: Array<[number, number]> = []

  for (let i = 0; i <= points; i += 1) {
    const bearing = (2 * Math.PI * i) / points
    const lat2 = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
        Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
    )
    const lng2 =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(lat2)
      )

    coordinates.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI])
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
  }
}

export function ExploreMap({
  chefs,
  selectedChefId,
  locale = 'fr',
  isMapMode = true,
  isMobile = false,
  embedded = false,
  initialRegionBBox = null,
  focusedRegionSlug = null,
  searchViewport = null,
  searchPin = null,
  outOfRangeChefIds = [],
  onChefHover,
  onChefClick,
  onVisibleChefIdsChange,
  onSelectionClear,
}: ExploreMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const searchPinMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement }>>(new Map())
  const isUnmountingRef = useRef(false)
  const onChefHoverRef = useRef<ExploreMapProps['onChefHover']>(onChefHover)
  const onChefClickRef = useRef<ExploreMapProps['onChefClick']>(onChefClick)
  const onVisibleChefIdsChangeRef = useRef<ExploreMapProps['onVisibleChefIdsChange']>(onVisibleChefIdsChange)
  const onSelectionClearRef = useRef<ExploreMapProps['onSelectionClear']>(onSelectionClear)
  const selectedChefIdRef = useRef<string | null>(selectedChefId)
  const initialRegionBBoxRef = useRef<RegionBBox | null>(initialRegionBBox)
  const focusedRegionCodeRef = useRef<string | null>(getRegionBySlug(focusedRegionSlug)?.code || null)
  const regionsGeojsonRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Geometry, { code?: string }> | null>(null)
  const validChefsRef = useRef<ExploreChef[]>([])
  const isMapModeRef = useRef<boolean>(isMapMode)
  const isMobileRef = useRef<boolean>(isMobile)
  const popupAnchorRef = useRef<PopupAnchor | null>(null)
  const popupPinnedRef = useRef<boolean>(false)
  const popupHoveredRef = useRef<boolean>(false)
  const popupCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const geojsonRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; name: string }>>({
    type: 'FeatureCollection',
    features: [],
  })
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const localeRef = useRef<Locale>(locale)
  const [activePopupChefId, setActivePopupChefId] = useState<string | null>(null)
  const [radiusInfoDismissed, setRadiusInfoDismissed] = useState(false)
  const [webglContextLost, setWebglContextLost] = useState(false)

  useEffect(() => {
    setRadiusInfoDismissed(getRadiusBubbleDismissed())
  }, [])
  const radiusInfoTitle = locale === 'en' ? 'Chef travel area' : 'Zone de déplacement du chef'
  const radiusInfoText =
    locale === 'en'
      ? 'The Chef usually travels within this area. You can still book outside this zone; the Chef will get back to you to confirm your request.'
      : "Le Chef se déplace généralement dans cette zone. Vous pouvez toutefois faire une réservation hors zone, le Chef reviendra vers vous pour confirmer votre demande."
  const radiusTargetChefId = selectedChefId

  const closePopup = useCallback(() => {
    if (popupCloseTimerRef.current) {
      clearTimeout(popupCloseTimerRef.current)
      popupCloseTimerRef.current = null
    }
    popupAnchorRef.current = null
    popupPinnedRef.current = false
    popupHoveredRef.current = false
    setActivePopupChefId(null)
  }, [])

  const schedulePopupClose = useCallback(() => {
    if (popupPinnedRef.current || popupHoveredRef.current) return
    if (popupCloseTimerRef.current) clearTimeout(popupCloseTimerRef.current)
    popupCloseTimerRef.current = setTimeout(() => {
      if (!popupPinnedRef.current && !popupHoveredRef.current) {
        closePopup()
      }
    }, 90)
  }, [closePopup])

  const closePinnedPopup = useCallback(() => {
    popupPinnedRef.current = false
    onSelectionClearRef.current?.()
    closePopup()
  }, [closePopup])

  const validChefs = useMemo(
    () =>
      chefs.filter(
        (chef) =>
          typeof chef.latitude === 'number' &&
          typeof chef.longitude === 'number' &&
          Number.isFinite(chef.latitude) &&
          Number.isFinite(chef.longitude)
      ),
    [chefs]
  )

  const geojson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; name: string; unavailableForSearch: number }>>(
    () => {
      const outOfRangeSet = new Set(outOfRangeChefIds)
      return {
        type: 'FeatureCollection',
        features: validChefs.map((chef) => ({
          type: 'Feature',
          id: chef.id,
          geometry: {
            type: 'Point',
            coordinates: [chef.longitude as number, chef.latitude as number],
          },
          properties: {
            id: chef.id,
            name: chef.name,
            unavailableForSearch: outOfRangeSet.has(chef.id) ? 1 : 0,
          },
        })),
      }
    },
    [outOfRangeChefIds, validChefs]
  )

  const chefById = useMemo(() => {
    const map = new Map<string, ExploreChef>()
    validChefs.forEach((chef) => map.set(chef.id, chef))
    return map
  }, [validChefs])

  useEffect(() => {
    onChefHoverRef.current = onChefHover
  }, [onChefHover])

  useEffect(() => {
    onChefClickRef.current = onChefClick
  }, [onChefClick])

  useEffect(() => {
    onVisibleChefIdsChangeRef.current = onVisibleChefIdsChange
  }, [onVisibleChefIdsChange])

  useEffect(() => {
    onSelectionClearRef.current = onSelectionClear
  }, [onSelectionClear])

  useEffect(() => {
    selectedChefIdRef.current = selectedChefId
  }, [selectedChefId])

  useEffect(() => {
    initialRegionBBoxRef.current = initialRegionBBox || null
  }, [initialRegionBBox])

  useEffect(() => {
    focusedRegionCodeRef.current = getRegionBySlug(focusedRegionSlug)?.code || null
  }, [focusedRegionSlug])

  useEffect(() => {
    geojsonRef.current = geojson
  }, [geojson])

  useEffect(() => {
    validChefsRef.current = validChefs
  }, [validChefs])

  useEffect(() => {
    isMapModeRef.current = isMapMode
  }, [isMapMode])

  useEffect(() => {
    isMobileRef.current = isMobile
  }, [isMobile])

  useEffect(() => {
    localeRef.current = locale
  }, [locale])

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) return
    ensureGlobalAbortSuppression()
    isUnmountingRef.current = false
    const isMobileViewport = window.matchMedia('(max-width: 768px)').matches
    const clusterRadiusExpression: any = isMobileViewport
      ? ['step', ['get', 'point_count'], 26, 5, 30, 10, 38, 25, 47]
      : ['step', ['get', 'point_count'], 34, 5, 40, 10, 50, 25, 62]
    const clusterTextSize = isMobileViewport ? 14 : 17
    const markerStore = markersRef.current
    const regionsFetchController = new AbortController()
    let isDisposed = false

    mapboxgl.accessToken = token
    const initialZoom = embedded ? EMBEDDED_FRANCE_ZOOM : FRANCE_ZOOM
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: FRANCE_CENTER,
      zoom: initialZoom,
      maxBounds: EUROPE_MAX_BOUNDS,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    const canvas = map.getCanvas()
    const onWebGLContextLost = (e: Event) => {
      e.preventDefault()
      setWebglContextLost(true)
    }
    canvas.addEventListener('webglcontextlost', onWebGLContextLost)

    const clearAllMarkers = () => {
      markerStore.forEach(({ marker }) => marker.remove())
      markerStore.clear()
    }

    const syncMarkerActiveState = () => {
      markerStore.forEach(({ el }, chefId) => {
        if (selectedChefIdRef.current === chefId) {
          el.classList.add('active')
        } else {
          el.classList.remove('active')
        }
      })
    }

    let refreshMarkersRaf: number | null = null
    let refreshMarkersTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefreshMarkers = () => {
      if (refreshMarkersTimer) return
      refreshMarkersTimer = setTimeout(() => {
        refreshMarkersTimer = null
        if (isDisposed) return
        if (refreshMarkersRaf) cancelAnimationFrame(refreshMarkersRaf)
        refreshMarkersRaf = requestAnimationFrame(() => {
          refreshMarkersRaf = null
          if (isDisposed) return
          refreshUnclusteredMarkersImmediate()
        })
      }, 80)
    }

    const refreshUnclusteredMarkersImmediate = () => {
      if (!map.getSource(SOURCE_ID)) return

      const features = map.querySourceFeatures(SOURCE_ID, {
        filter: ['!', ['has', 'point_count']],
      })

      if (features.length === 0 && map.isStyleLoaded()) {
        setTimeout(() => {
          if (!isDisposed) refreshUnclusteredMarkersImmediate()
        }, 250)
        return
      }

      const seen = new Set<string>()
      const nextFeatures: Array<{
        id: string
        name: string
        lng: number
        lat: number
        displayLng: number
        displayLat: number
        screenX: number
        screenY: number
        unavailableForSearch: boolean
      }> = []

      for (const feature of features) {
        const rawId = feature.id ?? feature.properties?.id
        const id = rawId ? String(rawId) : ''
        if (!id || seen.has(id)) continue
        seen.add(id)

        const name = String(feature.properties?.name || (locale === 'en' ? 'Chef' : 'Chef'))
        const point = feature.geometry as GeoJSON.Point | undefined
        if (!point || !Array.isArray(point.coordinates) || point.coordinates.length < 2) continue
        const [lng, lat] = point.coordinates
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
        const unavailableForSearch = Number(feature.properties?.unavailableForSearch || 0) === 1

        const projected = map.project([lng, lat])
        const screenX = projected.x
        const screenY = projected.y

        nextFeatures.push({
          id,
          name,
          lng,
          lat,
          displayLng: lng,
          displayLat: lat,
          screenX,
          screenY,
          unavailableForSearch,
        })
      }

      const spiderLineFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = []
      const zoom = map.getZoom()

      if (zoom >= MIN_ZOOM_FOR_SPIDERFY && nextFeatures.length > 0) {
        const groups = groupByPixelProximity(nextFeatures, PIXEL_PROXIMITY_THRESHOLD)

        for (const indices of groups) {
          if (indices.length <= 1) continue

          const items = indices.map((i) => nextFeatures[i])
          const centerX = items.reduce((s, p) => s + p.screenX, 0) / items.length
          const centerY = items.reduce((s, p) => s + p.screenY, 0) / items.length
          const centerLngLat = map.unproject([centerX, centerY])

          const positions = computeCollisionFreePositions(
            centerX,
            centerY,
            items,
            (name) => formatChefNameWithPrefix(name, locale === 'en' ? 'Chef' : 'Chef')
          )

          for (let i = 0; i < items.length; i += 1) {
            const { px, py } = positions[i]
            const pos = map.unproject([px, py])

            items[i].displayLng = pos.lng
            items[i].displayLat = pos.lat

            spiderLineFeatures.push({
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [
                  [centerLngLat.lng, centerLngLat.lat],
                  [pos.lng, pos.lat],
                ],
              },
            })
          }
        }
      }

      const spiderSource = map.getSource(CHEF_SPIDER_LINES_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
      if (spiderSource) {
        spiderSource.setData({
          type: 'FeatureCollection',
          features: spiderLineFeatures,
        })
      }

      const MAX_DOM_MARKERS_MOBILE = 35
      let featuresToRender = nextFeatures
      if (isMobileViewport && nextFeatures.length > MAX_DOM_MARKERS_MOBILE) {
        const center = map.getCenter()
        featuresToRender = [...nextFeatures]
          .sort((a, b) => {
            const da = (a.displayLng - center.lng) ** 2 + (a.displayLat - center.lat) ** 2
            const db = (b.displayLng - center.lng) ** 2 + (b.displayLat - center.lat) ** 2
            return da - db
          })
          .slice(0, MAX_DOM_MARKERS_MOBILE)
      }

      const seenRender = new Set(featuresToRender.map((f) => f.id))
      markerStore.forEach(({ marker }, chefId) => {
        if (!seenRender.has(chefId)) {
          marker.remove()
          markerStore.delete(chefId)
        }
      })

      featuresToRender.forEach((item) => {
        const existing = markerStore.get(item.id)
        const displayChefName = formatChefNameWithPrefix(item.name)

        if (!existing) {
          const el = document.createElement('div')
          el.className = item.unavailableForSearch ? 'chef-marker unavailable' : 'chef-marker'
          el.textContent = displayChefName
          el.setAttribute('aria-label', locale === 'en' ? `View ${item.name}` : `Voir ${item.name}`)

          el.addEventListener('mouseenter', () => {
            onChefHoverRef.current?.(item.id)
            if (!isMapModeRef.current || popupPinnedRef.current) return
            if (popupCloseTimerRef.current) {
              clearTimeout(popupCloseTimerRef.current)
              popupCloseTimerRef.current = null
            }
            popupAnchorRef.current = { chefId: item.id, lng: item.displayLng, lat: item.displayLat }
            setActivePopupChefId(item.id)
          })
          el.addEventListener('mouseleave', () => {
            onChefHoverRef.current?.(null)
            schedulePopupClose()
          })
          el.addEventListener('click', (event) => {
            event.stopPropagation()

            if (isMapModeRef.current) {
              if (isMobileRef.current) {
                setActivePopupChefId(item.id)
                onChefClickRef.current?.(item.id)
                return
              }
              const isSamePinnedMarker =
                popupPinnedRef.current && popupAnchorRef.current?.chefId === item.id
              if (isSamePinnedMarker) {
                closePinnedPopup()
                return
              }
              if (popupCloseTimerRef.current) {
                clearTimeout(popupCloseTimerRef.current)
                popupCloseTimerRef.current = null
              }
              popupPinnedRef.current = true
              popupAnchorRef.current = {
                chefId: item.id,
                lng: item.displayLng,
                lat: item.displayLat,
              }
              setActivePopupChefId(item.id)
              onChefClickRef.current?.(item.id)
              return
            }

            onChefClickRef.current?.(item.id)
          })

          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([item.displayLng, item.displayLat])
            .addTo(map)

          markerStore.set(item.id, { marker, el })
        } else {
          if (item.unavailableForSearch) {
            existing.el.classList.add('unavailable')
          } else {
            existing.el.classList.remove('unavailable')
          }
          if (existing.el.textContent !== displayChefName) {
            existing.el.textContent = displayChefName
          }
          existing.marker.setLngLat([item.displayLng, item.displayLat])
        }
      })

      syncMarkerActiveState()
    }

    let emitVisibleTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleEmitVisible = () => {
      if (emitVisibleTimer) return
      emitVisibleTimer = setTimeout(() => {
        emitVisibleTimer = null
        if (isDisposed) return
        emitVisibleChefsInBounds()
      }, 100)
    }

    const emitVisibleChefsInBounds = () => {
      if (!onVisibleChefIdsChangeRef.current) return
      const bounds = map.getBounds()
      if (!bounds) return
      const visibleIds = validChefsRef.current
        .filter((chef) => bounds.contains([chef.longitude as number, chef.latitude as number]))
        .map((chef) => chef.id)
      onVisibleChefIdsChangeRef.current(visibleIds)
    }

    const onMapError = (event: mapboxgl.ErrorEvent) => {
      const error = (event as any)?.error
      if (isUnmountingRef.current && isAbortLikeError(error || event)) return
      if (isAbortLikeError(error || event)) return
      console.error('[ExploreMap] Mapbox error:', error || event)
    }
    map.on('error', onMapError)

    const onMapLoad = () => {
      hideMapNoiseLayers(map)
      applyMapLanguage(map, localeRef.current)

      if (initialRegionBBoxRef.current) {
        const [minLng, minLat, maxLng, maxLat] = initialRegionBBoxRef.current
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding: 80, duration: 800 }
        )
      }

      ;(async () => {
        try {
          const regionsResponse = await fetch('/data/regions-fr.geojson', { signal: regionsFetchController.signal })
          if (!regionsResponse.ok) throw new Error('Unable to load regions geojson')
          const regionsGeojson = await regionsResponse.json()
          if (isDisposed || mapRef.current !== map) return

          if (map.getSource(REGIONS_SOURCE_ID)) return

          map.addSource(REGIONS_SOURCE_ID, {
            type: 'geojson',
            data: regionsGeojson,
            promoteId: 'code',
          })
          regionsGeojsonRef.current = regionsGeojson

          map.addLayer({
            id: REGIONS_FILL_LAYER_ID,
            type: 'fill',
            source: REGIONS_SOURCE_ID,
            paint: {
              'fill-color': getRegionsFillColorExpression(focusedRegionCodeRef.current),
              'fill-opacity': getRegionsFillOpacityExpression(focusedRegionCodeRef.current),
              'fill-color-transition': { duration: 200, delay: 0 },
              'fill-opacity-transition': { duration: 200, delay: 0 },
            },
          })

          map.addLayer({
            id: REGIONS_BORDER_LAYER_ID,
            type: 'line',
            source: REGIONS_SOURCE_ID,
            paint: {
              'line-color': getRegionsBorderColorExpression(focusedRegionCodeRef.current),
              'line-width': getRegionsBorderWidthExpression(focusedRegionCodeRef.current),
              'line-opacity': getRegionsBorderOpacityExpression(focusedRegionCodeRef.current),
              'line-color-transition': { duration: 200, delay: 0 },
              'line-width-transition': { duration: 200, delay: 0 },
            },
          })

          map.addSource(REGION_DIM_SOURCE_ID, {
            type: 'geojson',
            data: buildDimMaskGeoJSON(regionsGeojsonRef.current, focusedRegionCodeRef.current),
          })

          map.addLayer(
            {
              id: REGION_DIM_LAYER_ID,
              type: 'fill',
              source: REGION_DIM_SOURCE_ID,
              paint: {
                'fill-color': '#FFFFFF',
                'fill-opacity': focusedRegionCodeRef.current ? 0.62 : 0,
                'fill-opacity-transition': { duration: 220, delay: 0 },
              },
            },
            REGIONS_BORDER_LAYER_ID
          )

          // Region layers are added asynchronously; force cluster layers back on top.
          if (map.getLayer(CLUSTER_LAYER_ID)) map.moveLayer(CLUSTER_LAYER_ID)
          if (map.getLayer(CLUSTER_COUNT_LAYER_ID)) map.moveLayer(CLUSTER_COUNT_LAYER_ID)
        } catch (error) {
          if (isAbortLikeError(error) || isDisposed) return
          console.error('[ExploreMap] Unable to initialize region focus layer:', error)
        }
      })()

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: geojsonRef.current,
        cluster: true,
        clusterMaxZoom: 6,
        clusterRadius: 20,
        promoteId: 'id',
      })

      if (isMobileViewport) {
        map.addLayer({
          id: 'chefs-clusters-shadow',
          type: 'circle',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': 'rgba(0,0,0,0.04)',
            'circle-radius': ['+', clusterRadiusExpression, 3],
            'circle-opacity': 1,
          },
        })
      }

      map.addLayer({
        id: CLUSTER_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: isMobileViewport
          ? {
              'circle-color': '#FFFFFF',
              'circle-radius': clusterRadiusExpression,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#E2E2E2',
              'circle-opacity': 0.98,
            }
          : {
              'circle-color': '#FFFFFF',
              'circle-radius': clusterRadiusExpression,
              'circle-stroke-width': 2.2,
              'circle-stroke-color': '#D7D7D7',
              'circle-opacity': 0.98,
            },
      })

      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': clusterTextSize,
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
        },
        paint: {
          'text-color': '#222222',
        },
      })

      // Ensure clusters always stay visually above region focus layers.
      map.moveLayer(CLUSTER_LAYER_ID)
      map.moveLayer(CLUSTER_COUNT_LAYER_ID)

      map.addSource(CHEF_RADIUS_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      map.addLayer({
        id: CHEF_RADIUS_FILL_LAYER_ID,
        type: 'fill',
        source: CHEF_RADIUS_SOURCE_ID,
        paint: {
          'fill-color': '#FBCF03',
          'fill-opacity': 0.16,
        },
      })

      map.addLayer({
        id: CHEF_RADIUS_STROKE_LAYER_ID,
        type: 'line',
        source: CHEF_RADIUS_SOURCE_ID,
        paint: {
          'line-color': '#D9A901',
          'line-opacity': 0.66,
          'line-width': 2,
        },
      })

      map.addSource(CHEF_SPIDER_LINES_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: CHEF_SPIDER_LINES_LAYER_ID,
        type: 'line',
        source: CHEF_SPIDER_LINES_SOURCE_ID,
        paint: {
          'line-color': '#606060',
          'line-opacity': 0.5,
          'line-width': 1.5,
        },
      })

      if (map.getLayer(CLUSTER_LAYER_ID)) map.moveLayer(CLUSTER_LAYER_ID)
      if (map.getLayer(CLUSTER_COUNT_LAYER_ID)) map.moveLayer(CLUSTER_COUNT_LAYER_ID)

      map.on('mouseenter', CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('click', CLUSTER_LAYER_ID, (event) => {
        const feature = event.features?.[0]
        if (!feature) return
        const point = feature.geometry as GeoJSON.Point
        map.easeTo({
          center: point.coordinates as [number, number],
          zoom: map.getZoom() + 2,
          duration: 550,
        })
      })

      refreshUnclusteredMarkersImmediate()
      emitVisibleChefsInBounds()
    }
    map.on('load', onMapLoad)

    map.on('moveend', scheduleRefreshMarkers)
    map.on('moveend', scheduleEmitVisible)
    map.on('zoomend', scheduleRefreshMarkers)
    map.on('zoomend', scheduleEmitVisible)
    const onMapClick = () => {
      onSelectionClearRef.current?.()
      closePopup()
    }
    map.on('click', onMapClick)
    const onSourceData = (event: mapboxgl.MapSourceDataEvent) => {
      if (event.sourceId === SOURCE_ID && event.isSourceLoaded) {
        scheduleRefreshMarkers()
        scheduleEmitVisible()
      }
    }
    map.on('sourcedata', onSourceData)

    const container = containerRef.current
    let resizeRaf: number | null = null
    let resizeDebounce: ReturnType<typeof setTimeout> | null = null
    let lastWidth = 0
    let lastHeight = 0
    const resizeDebounceMs = isMobileViewport ? 250 : 50
    const resizeThresholdPx = isMobileViewport ? 25 : 10
    const resizeObserver =
      container &&
      new ResizeObserver((entries) => {
        const m = mapRef.current
        if (!m || isDisposed) return
        if (typeof document !== 'undefined' && document.hidden) return
        const entry = entries[0]
        if (!entry?.contentRect) return
        const w = Math.round(entry.contentRect.width)
        const h = Math.round(entry.contentRect.height)
        const dw = Math.abs(w - lastWidth)
        const dh = Math.abs(h - lastHeight)
        if (lastWidth > 0 && lastHeight > 0 && dw < resizeThresholdPx && dh < resizeThresholdPx) return
        lastWidth = w
        lastHeight = h
        const center = m.getCenter()
        const zoom = m.getZoom()
        if (resizeDebounce) clearTimeout(resizeDebounce)
        resizeDebounce = setTimeout(() => {
          resizeDebounce = null
          if (resizeRaf) cancelAnimationFrame(resizeRaf)
          resizeRaf = requestAnimationFrame(() => {
            resizeRaf = null
            if (!mapRef.current || mapRef.current !== m || isDisposed) return
            if (typeof document !== 'undefined' && document.hidden) return
            m.resize()
            m.setCenter(center)
            m.setZoom(zoom)
          })
        }, resizeDebounceMs)
      })
    if (resizeObserver && container) {
      const rect = container.getBoundingClientRect()
      lastWidth = Math.round(rect.width)
      lastHeight = Math.round(rect.height)
      resizeObserver.observe(container)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mapRef.current && !isDisposed) {
        lastWidth = 0
        lastHeight = 0
        requestAnimationFrame(() => {
          if (mapRef.current && !isDisposed) mapRef.current.resize()
        })
      }
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }

    return () => {
      if (resizeDebounce) clearTimeout(resizeDebounce)
      if (resizeRaf) cancelAnimationFrame(resizeRaf)
      resizeObserver?.disconnect()
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibilityChange)
      isDisposed = true
      isUnmountingRef.current = true
      regionsFetchController.abort()
      clearAllMarkers()
      if (searchPinMarkerRef.current) {
        searchPinMarkerRef.current.remove()
        searchPinMarkerRef.current = null
      }
      if (refreshMarkersTimer) clearTimeout(refreshMarkersTimer)
      if (refreshMarkersRaf) cancelAnimationFrame(refreshMarkersRaf)
      if (emitVisibleTimer) clearTimeout(emitVisibleTimer)
      try {
        map.off('load', onMapLoad)
        map.off('moveend', scheduleRefreshMarkers)
        map.off('moveend', scheduleEmitVisible)
        map.off('zoomend', scheduleRefreshMarkers)
        map.off('zoomend', scheduleEmitVisible)
        map.off('click', onMapClick)
        map.off('sourcedata', onSourceData)
        map.stop()
        if (!(map as any)._removed) {
          ;(map as any)._removed = true
          map.remove()
        }
      } catch (error: unknown) {
        ;(map as any)._removed = true
        // AbortError au cleanup est attendu (MapLibre/Signal) — on ignore silencieusement
        if (!isAbortLikeError(error)) {
          console.error('[ExploreMap] map cleanup error:', error)
        }
      }
      canvas.removeEventListener('webglcontextlost', onWebGLContextLost)
      map.off('error', onMapError)
      if (popupCloseTimerRef.current) {
        clearTimeout(popupCloseTimerRef.current)
        popupCloseTimerRef.current = null
      }
      mapRef.current = null
    }
  }, [closePinnedPopup, closePopup, schedulePopupClose, token])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try {
      applyMapLanguage(map, locale)
    } catch {
      // Style may still be initializing; language will be applied on load.
    }
  }, [locale])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    if (!source) return
    source.setData(geojson)
  }, [geojson])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !onVisibleChefIdsChangeRef.current) return
    const bounds = map.getBounds()
    if (!bounds) return
    const visibleIds = validChefs
      .filter((chef) => bounds.contains([chef.longitude as number, chef.latitude as number]))
      .map((chef) => chef.id)
    onVisibleChefIdsChangeRef.current(visibleIds)
  }, [validChefs])

  useEffect(() => {
    if (!activePopupChefId) return
    if (chefById.has(activePopupChefId)) return
    popupAnchorRef.current = null
    setActivePopupChefId(null)
  }, [activePopupChefId, chefById])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource(CHEF_RADIUS_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    if (!source) return

    const activeChef = radiusTargetChefId ? chefById.get(radiusTargetChefId) || null : null
    if (!activeChef || typeof activeChef.latitude !== 'number' || typeof activeChef.longitude !== 'number') {
      source.setData({
        type: 'FeatureCollection',
        features: [],
      })
      return
    }

    source.setData({
      type: 'FeatureCollection',
      features: [
        buildRadiusPolygon(
          activeChef.longitude,
          activeChef.latitude,
          getChefAvailabilityRadiusKm(activeChef)
        ),
      ],
    })

    if (map.getLayer(CLUSTER_LAYER_ID)) map.moveLayer(CLUSTER_LAYER_ID)
    if (map.getLayer(CLUSTER_COUNT_LAYER_ID)) map.moveLayer(CLUSTER_COUNT_LAYER_ID)
  }, [chefById, radiusTargetChefId])

  useEffect(() => {
    markersRef.current.forEach(({ el }, chefId) => {
      if (selectedChefId === chefId) {
        el.classList.add('active')
      } else {
        el.classList.remove('active')
      }
    })
  }, [selectedChefId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !searchViewport) return

    if (searchViewport.bbox) {
      const [minLng, minLat, maxLng, maxLat] = searchViewport.bbox
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 80, duration: 800 }
      )
      return
    }

    map.flyTo({
      center: searchViewport.center,
      zoom: searchViewport.zoom,
      duration: 800,
      essential: true,
    })
  }, [searchViewport])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!searchPin) {
      if (searchPinMarkerRef.current) {
        searchPinMarkerRef.current.remove()
        searchPinMarkerRef.current = null
      }
      return
    }

    if (!searchPinMarkerRef.current) {
      searchPinMarkerRef.current = new mapboxgl.Marker({ color: '#FBCF03' })
    }

    searchPinMarkerRef.current
      .setLngLat(searchPin.center)
      .addTo(map)
  }, [searchPin])

  useEffect(() => {
    if (isMapMode) return
    closePopup()
  }, [closePopup, isMapMode])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!map.getLayer(REGIONS_FILL_LAYER_ID) || !map.getLayer(REGIONS_BORDER_LAYER_ID)) return

    const focusedRegionCode = getRegionBySlug(focusedRegionSlug)?.code || null
    map.setPaintProperty(REGIONS_FILL_LAYER_ID, 'fill-color', getRegionsFillColorExpression(focusedRegionCode))
    map.setPaintProperty(REGIONS_FILL_LAYER_ID, 'fill-opacity', getRegionsFillOpacityExpression(focusedRegionCode))
    map.setPaintProperty(REGIONS_BORDER_LAYER_ID, 'line-color', getRegionsBorderColorExpression(focusedRegionCode))
    map.setPaintProperty(REGIONS_BORDER_LAYER_ID, 'line-width', getRegionsBorderWidthExpression(focusedRegionCode))
    map.setPaintProperty(REGIONS_BORDER_LAYER_ID, 'line-opacity', getRegionsBorderOpacityExpression(focusedRegionCode))

    const dimSource = map.getSource(REGION_DIM_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    if (dimSource) {
      dimSource.setData(buildDimMaskGeoJSON(regionsGeojsonRef.current, focusedRegionCode))
    }
    if (map.getLayer(REGION_DIM_LAYER_ID)) {
      map.setPaintProperty(REGION_DIM_LAYER_ID, 'fill-opacity', focusedRegionCode ? 0.62 : 0)
    }
  }, [focusedRegionSlug])

  const popupChef = activePopupChefId ? chefById.get(activePopupChefId) || null : null

  return (
    <div ref={containerRef} className="explore-map-shell relative h-full w-full">
      {webglContextLost && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#F7F7F7] text-center"
        >
          <span className="text-[15px] font-medium text-[#222222]">
            {locale === 'en' ? 'Map unavailable. Tap to reload.' : 'Carte indisponible. Touchez pour actualiser.'}
          </span>
        </button>
      )}
      {!radiusInfoDismissed && (
        <div
          className={`pointer-events-none absolute z-10 rounded-2xl border border-white/75 bg-white/88 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.12)] backdrop-blur ${
            embedded
              ? 'left-4 top-20 w-[min(calc(100%-2rem),320px)]'
              : 'left-1/2 top-20 w-[calc(100%-1.5rem)] max-w-[330px] -translate-x-1/2 md:left-4 md:top-auto md:bottom-4 md:translate-x-0 md:w-auto'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setRadiusInfoDismissed(true)
              setRadiusBubbleDismissed(true)
            }}
            className="pointer-events-auto absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#E5E7EB] hover:text-[#374151]"
            aria-label={locale === 'en' ? 'Close' : 'Fermer'}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <div className="relative mt-0.5 h-7 w-7 shrink-0">
              <div className="absolute inset-0 rounded-full border-2 border-[#D9A901] bg-[#FBCF03]/25" />
              <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D9A901]" />
            </div>
            <div>
              <p className="text-[12px] font-semibold leading-tight text-[#1F1F1F]">{radiusInfoTitle}</p>
              <p className="mt-1 text-[11px] leading-[1.35] text-[#4B4B4B]">{radiusInfoText}</p>
            </div>
          </div>
        </div>
      )}
      {isMapMode && !isMobile && popupChef && (
        <ChefMapPopup
          chef={popupChef}
          onRequestClose={closePinnedPopup}
          onCardClick={() => {
            if (popupPinnedRef.current) {
              closePinnedPopup()
              return
            }
            popupPinnedRef.current = true
            if (popupCloseTimerRef.current) {
              clearTimeout(popupCloseTimerRef.current)
              popupCloseTimerRef.current = null
            }
          }}
          onMouseEnter={() => {
            popupHoveredRef.current = true
            if (popupCloseTimerRef.current) {
              clearTimeout(popupCloseTimerRef.current)
              popupCloseTimerRef.current = null
            }
          }}
          onMouseLeave={() => {
            popupHoveredRef.current = false
            schedulePopupClose()
          }}
        />
      )}
      <style jsx global>{`
        @media (max-width: 767px) {
          .explore-map-shell .mapboxgl-ctrl-top-right {
            display: none;
          }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .explore-map-shell .mapboxgl-ctrl-top-right {
            top: 92px;
            right: 10px;
          }
        }
      `}</style>
    </div>
  )
}
