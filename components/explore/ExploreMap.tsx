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
const POPUP_WIDTH = 272
const POPUP_HEIGHT = 276
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

export function ExploreMap({
  chefs,
  selectedChefId,
  locale = 'fr',
  isMapMode = true,
  initialRegionBBox = null,
  focusedRegionSlug = null,
  searchViewport = null,
  onChefHover,
  onChefClick,
  onVisibleChefIdsChange,
}: ExploreMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
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

  const geojson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; name: string }>>(
    () => ({
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
        },
      })),
    }),
    [validChefs]
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
    isUnmountingRef.current = false
    const markerStore = markersRef.current

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

        nextFeatures.push({ id, name, lng, lat })
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
          el.className = 'chef-marker'
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

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string } | undefined
      if (reason?.name === 'AbortError' || reason?.message?.includes('signal is aborted')) {
        event.preventDefault()
      }
    }
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    const onMapError = (event: mapboxgl.ErrorEvent) => {
      const error = (event as any)?.error
      if (isUnmountingRef.current && error?.name === 'AbortError') return
      if (error?.name === 'AbortError') return
      console.error('[ExploreMap] Mapbox error:', error || event)
    }
    map.on('error', onMapError)

    map.on('load', () => {
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
          const regionsResponse = await fetch('/data/regions-fr.geojson')
          if (!regionsResponse.ok) throw new Error('Unable to load regions geojson')
          const regionsGeojson = await regionsResponse.json()

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
    })

    map.on('moveend', refreshUnclusteredMarkers)
    map.on('moveend', emitVisibleChefsInBounds)
    map.on('move', updatePopupPosition)
    map.on('zoomend', refreshUnclusteredMarkers)
    map.on('zoomend', emitVisibleChefsInBounds)
    map.on('zoom', updatePopupPosition)
    map.on('click', closePopup)
    map.on('dragstart', closePopup)
    const onSourceData = (event: mapboxgl.MapSourceDataEvent) => {
      if (event.sourceId === SOURCE_ID) {
        refreshUnclusteredMarkers()
        emitVisibleChefsInBounds()
        updatePopupPosition()
      }
    }
    map.on('sourcedata', onSourceData)

    return () => {
      isUnmountingRef.current = true
      clearAllMarkers()
      map.off('error', onMapError)
      map.off('moveend', refreshUnclusteredMarkers)
      map.off('moveend', emitVisibleChefsInBounds)
      map.off('move', updatePopupPosition)
      map.off('zoomend', refreshUnclusteredMarkers)
      map.off('zoomend', emitVisibleChefsInBounds)
      map.off('zoom', updatePopupPosition)
      map.off('click', closePopup)
      map.off('dragstart', closePopup)
      map.off('sourcedata', onSourceData)
      map.stop()
      try {
        map.remove()
      } catch (error: any) {
        if (error?.name !== 'AbortError' && !String(error?.message || '').includes('signal is aborted')) {
          console.error('[ExploreMap] map.remove cleanup error:', error)
        }
      }
      // Keep the AbortError suppression active for the current microtask queue.
      setTimeout(() => {
        window.removeEventListener('unhandledrejection', onUnhandledRejection)
      }, 1200)
      if (popupCloseTimerRef.current) {
        clearTimeout(popupCloseTimerRef.current)
        popupCloseTimerRef.current = null
      }
      mapRef.current = null
    }
  }, [closePopup, schedulePopupClose, token])

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
    <div ref={containerRef} className="relative h-full w-full">
      {isMapMode && popupChef && popupPosition && (
        <ChefMapPopup
          chef={popupChef}
          left={popupPosition.left}
          top={popupPosition.top}
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
    </div>
  )
}
