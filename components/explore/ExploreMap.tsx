'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { ChefMapPopup } from './ChefMapPopup'
import { ExploreChef } from './types'
import { FRANCE_CENTER, FRANCE_ZOOM, RegionBBox, getRegionBySlug } from '@/lib/regions'
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
const POPUP_WIDTH = 234
const POPUP_HEIGHT = 236
const POPUP_MARGIN = 12
const EUROPE_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-12, 34],
  [32, 72],
]

const DEFAULT_REGION_BORDER_COLOR = '#E8E8E8'
const FOCUS_REGION_BORDER_COLOR = '#606060'

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
  initialRegionBBox?: RegionBBox | null
  focusedRegionSlug?: string | null
  searchViewport?: SearchViewport | null
  searchPin?: SearchPin | null
  outOfRangeChefIds?: string[]
  onChefHover?: (chefId: string | null) => void
  onChefClick?: (chefId: string) => void
  onVisibleChefIdsChange?: (chefIds: string[]) => void
}

function getChefFirstName(name: string, fallback = 'Chef'): string {
  return (name || '').trim().split(/\s+/)[0] || fallback
}

function applyMapLanguage(map: mapboxgl.Map, locale: Locale) {
  if (!map.isStyleLoaded()) return
  const style = map.getStyle()
  const layers = style?.layers || []

  layers.forEach((layer) => {
    if (layer.type !== 'symbol') return
    if (layer.source === SOURCE_ID || layer.id === CLUSTER_COUNT_LAYER_ID) return

    try {
      const currentTextField = map.getLayoutProperty(layer.id, 'text-field')
      if (!currentTextField) return
      const isMarineLabelLayer = layer.id.includes('marine')

      if (locale === 'fr' && isMarineLabelLayer) {
        map.setLayoutProperty(layer.id, 'text-field', [
          'coalesce',
          ['get', 'name_fr'],
          [
            'match',
            ['coalesce', ['get', 'name_en'], ['get', 'name'], ''],
            'English Channel', 'Manche',
            'Bay of Biscay', 'Golfe de Gascogne',
            'Celtic Sea', 'Mer Celtique',
            'North Sea', 'Mer du Nord',
            'Mediterranean Sea', 'Mer Mediterranee',
            'Tyrrhenian Sea', 'Mer Tyrrhenienne',
            'Ligurian Sea', 'Mer Ligure',
            'Alboran Sea', "Mer d'Alboran",
            'Atlantic Ocean', 'Ocean Atlantique',
            'Strait of Gibraltar', 'Detroit de Gibraltar',
            ['coalesce', ['get', 'name'], ['get', 'name_en'], currentTextField as any],
          ],
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

function isAbortLikeError(value: unknown): boolean {
  if (!value) return false
  if (typeof value === 'string') {
    const lowered = value.toLowerCase()
    return (
      lowered.includes('aborterror') ||
      lowered.includes('signal is aborted') ||
      lowered.includes('aborted without reason')
    )
  }

  const maybeError = value as { name?: string; message?: string; cause?: unknown }
  const name = String(maybeError.name || '').toLowerCase()
  const message = String(maybeError.message || '').toLowerCase()
  if (name.includes('abort')) return true
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

function getChefAvailabilityRadiusKm(chef: ExploreChef | null | undefined): number {
  const raw = typeof chef?.availabilityRadiusKm === 'number' ? chef.availabilityRadiusKm : 10
  return [10, 20, 30, 40, 50, 60].includes(raw) ? raw : 10
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
  initialRegionBBox = null,
  focusedRegionSlug = null,
  searchViewport = null,
  searchPin = null,
  outOfRangeChefIds = [],
  onChefHover,
  onChefClick,
  onVisibleChefIdsChange,
}: ExploreMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const searchPinMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const markersRef = useRef<Map<string, { marker: mapboxgl.Marker; el: HTMLDivElement }>>(new Map())
  const isUnmountingRef = useRef(false)
  const onChefHoverRef = useRef<ExploreMapProps['onChefHover']>(onChefHover)
  const onChefClickRef = useRef<ExploreMapProps['onChefClick']>(onChefClick)
  const onVisibleChefIdsChangeRef = useRef<ExploreMapProps['onVisibleChefIdsChange']>(onVisibleChefIdsChange)
  const selectedChefIdRef = useRef<string | null>(selectedChefId)
  const initialRegionBBoxRef = useRef<RegionBBox | null>(initialRegionBBox)
  const focusedRegionCodeRef = useRef<string | null>(getRegionBySlug(focusedRegionSlug)?.code || null)
  const regionsGeojsonRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Geometry, { code?: string }> | null>(null)
  const validChefsRef = useRef<ExploreChef[]>([])
  const isMapModeRef = useRef<boolean>(isMapMode)
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
  const [popupPosition, setPopupPosition] = useState<{ left: number; top: number } | null>(null)
  const radiusInfoTitle = locale === 'en' ? 'Chef travel area' : 'Zone de déplacement du chef'
  const radiusInfoText =
    locale === 'en'
      ? 'Inside the yellow radius, the chef usually travels. You can still request outside this area.'
      : 'Le chef se déplace généralement dans cette zone. Vous pouvez toutefois faire une demande hors zone et voir via la messagerie si cela convient au chef.'
  const radiusTargetChefId = isMapMode ? activePopupChefId : selectedChefId

  const closePopup = useCallback(() => {
    if (popupCloseTimerRef.current) {
      clearTimeout(popupCloseTimerRef.current)
      popupCloseTimerRef.current = null
    }
    popupAnchorRef.current = null
    popupPinnedRef.current = false
    popupHoveredRef.current = false
    setActivePopupChefId(null)
    setPopupPosition(null)
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
    localeRef.current = locale
  }, [locale])

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) return
    ensureGlobalAbortSuppression()
    isUnmountingRef.current = false
    const markerStore = markersRef.current
    const regionsFetchController = new AbortController()
    let isDisposed = false

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: FRANCE_CENTER,
      zoom: FRANCE_ZOOM,
      maxBounds: EUROPE_MAX_BOUNDS,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

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

    const updatePopupPosition = () => {
      const anchor = popupAnchorRef.current
      if (!anchor || !containerRef.current) {
        setPopupPosition(null)
        return
      }

      const chef = validChefsRef.current.find((item) => item.id === anchor.chefId)
      if (!chef || typeof chef.longitude !== 'number' || typeof chef.latitude !== 'number') {
        setPopupPosition(null)
        popupAnchorRef.current = null
        setActivePopupChefId(null)
        return
      }

      const point = map.project([anchor.lng, anchor.lat])
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return
      }
      const containerRect = containerRef.current.getBoundingClientRect()
      const minLeft = POPUP_MARGIN
      const maxLeft = Math.max(POPUP_MARGIN, containerRect.width - POPUP_WIDTH - POPUP_MARGIN)
      const left = Math.min(Math.max(point.x - POPUP_WIDTH / 2, minLeft), maxLeft)
      const preferredTop = point.y - POPUP_HEIGHT - 18
      const fallbackTop = point.y + 18
      const top =
        preferredTop >= POPUP_MARGIN
          ? preferredTop
          : Math.min(
              fallbackTop,
              Math.max(POPUP_MARGIN, containerRect.height - POPUP_HEIGHT - POPUP_MARGIN)
            )

      setPopupPosition({ left, top })
    }

    const refreshUnclusteredMarkers = () => {
      if (!map.getSource(SOURCE_ID)) return

      const features = map.querySourceFeatures(SOURCE_ID, {
        filter: ['!', ['has', 'point_count']],
      })

      const seen = new Set<string>()
      const nextFeatures: Array<{
        id: string
        name: string
        lng: number
        lat: number
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

        nextFeatures.push({ id, name, lng, lat, unavailableForSearch })
      }

      markerStore.forEach(({ marker }, chefId) => {
        if (!seen.has(chefId)) {
          marker.remove()
          markerStore.delete(chefId)
        }
      })

      nextFeatures.forEach((item) => {
        const existing = markerStore.get(item.id)
        const firstName = getChefFirstName(item.name, locale === 'en' ? 'Chef' : 'Chef')

        if (!existing) {
          const el = document.createElement('div')
          el.className = item.unavailableForSearch ? 'chef-marker unavailable' : 'chef-marker'
          el.textContent = firstName
          el.setAttribute('aria-label', locale === 'en' ? `View ${item.name}` : `Voir ${item.name}`)

          el.addEventListener('mouseenter', () => {
            onChefHoverRef.current?.(item.id)
            if (!isMapModeRef.current || popupPinnedRef.current) return
            if (popupCloseTimerRef.current) {
              clearTimeout(popupCloseTimerRef.current)
              popupCloseTimerRef.current = null
            }
            popupAnchorRef.current = { chefId: item.id, lng: item.lng, lat: item.lat }
            setActivePopupChefId(item.id)
            requestAnimationFrame(updatePopupPosition)
          })
          el.addEventListener('mouseleave', () => {
            onChefHoverRef.current?.(null)
            schedulePopupClose()
          })
          el.addEventListener('click', (event) => {
            event.stopPropagation()

            if (isMapModeRef.current) {
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
                lng: item.lng,
                lat: item.lat,
              }
              setActivePopupChefId(item.id)
              requestAnimationFrame(updatePopupPosition)
              return
            }

            map.flyTo({
              center: [item.lng, item.lat],
              zoom: Math.max(13, map.getZoom()),
              duration: 700,
              essential: true,
            })
            onChefClickRef.current?.(item.id)
          })

          const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([item.lng, item.lat])
            .addTo(map)

          markerStore.set(item.id, { marker, el })
        } else {
          if (item.unavailableForSearch) {
            existing.el.classList.add('unavailable')
          } else {
            existing.el.classList.remove('unavailable')
          }
          if (existing.el.textContent !== firstName) {
            existing.el.textContent = firstName
          }
          existing.marker.setLngLat([item.lng, item.lat])
        }
      })

      syncMarkerActiveState()
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
        clusterMaxZoom: 8,
        clusterRadius: 35,
        promoteId: 'id',
      })

      map.addLayer({
        id: CLUSTER_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#FFFFFF',
          'circle-radius': ['step', ['get', 'point_count'], 34, 5, 40, 10, 50, 25, 62],
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
          'text-size': 17,
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

      refreshUnclusteredMarkers()
      emitVisibleChefsInBounds()
    }
    map.on('load', onMapLoad)

    map.on('moveend', refreshUnclusteredMarkers)
    map.on('moveend', emitVisibleChefsInBounds)
    map.on('move', updatePopupPosition)
    map.on('zoomend', refreshUnclusteredMarkers)
    map.on('zoomend', emitVisibleChefsInBounds)
    map.on('zoom', updatePopupPosition)
    const onMapInteraction = () => {
      if (popupPinnedRef.current) return
      closePopup()
    }
    map.on('click', onMapInteraction)
    map.on('dragstart', onMapInteraction)
    const onSourceData = (event: mapboxgl.MapSourceDataEvent) => {
      if (event.sourceId === SOURCE_ID) {
        refreshUnclusteredMarkers()
        emitVisibleChefsInBounds()
        updatePopupPosition()
      }
    }
    map.on('sourcedata', onSourceData)

    return () => {
      isDisposed = true
      isUnmountingRef.current = true
      regionsFetchController.abort()
      clearAllMarkers()
      if (searchPinMarkerRef.current) {
        searchPinMarkerRef.current.remove()
        searchPinMarkerRef.current = null
      }
      map.off('load', onMapLoad)
      map.off('moveend', refreshUnclusteredMarkers)
      map.off('moveend', emitVisibleChefsInBounds)
      map.off('move', updatePopupPosition)
      map.off('zoomend', refreshUnclusteredMarkers)
      map.off('zoomend', emitVisibleChefsInBounds)
      map.off('zoom', updatePopupPosition)
      map.off('click', onMapInteraction)
      map.off('dragstart', onMapInteraction)
      map.off('sourcedata', onSourceData)
      map.stop()
      try {
        if (process.env.NODE_ENV !== 'production') {
          ;(map as any)._removed = true
        } else if (!(map as any)._removed) {
          map.remove()
        }
      } catch (error: any) {
        if (!isAbortLikeError(error)) {
          console.error('[ExploreMap] map.remove cleanup error:', error)
        }
      }
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
    setPopupPosition(null)
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
      searchPinMarkerRef.current = new mapboxgl.Marker({ color: '#2563EB' })
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
      <div className="pointer-events-none absolute left-1/2 top-4 z-20 w-[calc(100%-1.5rem)] max-w-[330px] -translate-x-1/2 rounded-2xl border border-white/75 bg-white/88 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.12)] backdrop-blur md:left-4 md:bottom-4 md:top-auto md:w-auto md:translate-x-0">
          <div className="flex items-start gap-3">
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
      {isMapMode && popupChef && popupPosition && (
        <ChefMapPopup
          chef={popupChef}
          left={popupPosition.left}
          top={popupPosition.top}
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
