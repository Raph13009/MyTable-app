'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { slugifyRegionName } from '@/lib/regions'

const SOURCE_ID = 'regions-fr'
const FILL_LAYER_ID = 'regions-fr-fill'
const BORDER_LAYER_ID = 'regions-fr-border'

interface RegionFeatureProperties {
  code?: string
  nom?: string
}

export function RegionsMap() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const hoveredRegionIdRef = useRef<string | number | null>(null)
  const [hoveredRegionName, setHoveredRegionName] = useState<string | null>(null)
  const [isMapVisible, setIsMapVisible] = useState(false)
  const [isRouting, setIsRouting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return
    const isMobileViewport = window.matchMedia('(max-width: 767px)').matches
    const initialZoom = isMobileViewport ? 3.7 : 4.7
    const regionsFetchController = new AbortController()
    let isDisposed = false

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [2.3, 46.5],
      zoom: initialZoom,
      minZoom: isMobileViewport ? initialZoom : 3.7,
      maxZoom: isMobileViewport ? initialZoom : 7.5,
      renderWorldCopies: false,
    })
    mapRef.current = map
    if (isMobileViewport) {
      map.scrollZoom.disable()
      map.boxZoom.disable()
      map.keyboard.disable()
      map.doubleClickZoom.disable()
      map.touchZoomRotate.disable()
    }
    map.dragRotate.disable()
    map.dragPan.disable()

    const setHoveredState = (id: string | number | null, hover: boolean) => {
      if (id === null) return
      try {
        map.setFeatureState({ source: SOURCE_ID, id }, { hover })
      } catch {
        // Ignore feature-state race during style/source refresh.
      }
    }

    map.on('load', () => {
      void (async () => {
        try {
          const response = await fetch('/data/regions-fr.geojson', { signal: regionsFetchController.signal })
          const regions = await response.json()
          if (isDisposed || mapRef.current !== map) return

          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: regions,
            promoteId: 'code',
          })

          map.addLayer({
            id: FILL_LAYER_ID,
            type: 'fill',
            source: SOURCE_ID,
            paint: {
              'fill-color': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                [
                  'match',
                  ['get', 'code'],
                  '11', '#9FC4F6',
                  '24', '#AEE2A4',
                  '27', '#BFA8EE',
                  '28', '#F4BABA',
                  '32', '#B5D5F5',
                  '44', '#D0B7E9',
                  '52', '#F7C69A',
                  '53', '#A9DCD3',
                  '75', '#AAC8F7',
                  '76', '#F8C9A1',
                  '84', '#BFA5EE',
                  '93', '#AEE0B8',
                  '94', '#CFC0F1',
                  '#E2E2E2',
                ],
                [
                  'match',
                  ['get', 'code'],
                  '11', '#C7DCFA',
                  '24', '#CBEBC4',
                  '27', '#D6C7F5',
                  '28', '#F9D3D3',
                  '32', '#CDE2F9',
                  '44', '#DECEF2',
                  '52', '#FCDDBF',
                  '53', '#CBE9E4',
                  '75', '#C3D9FA',
                  '76', '#FDE0C3',
                  '84', '#D6C5F5',
                  '93', '#CDEBD4',
                  '94', '#DFD4F7',
                  '#F5F5F5',
                ],
              ],
              'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.98],
              'fill-color-transition': { duration: 200, delay: 0 },
              'fill-opacity-transition': { duration: 200, delay: 0 },
            },
          })

          map.addLayer({
            id: BORDER_LAYER_ID,
            type: 'line',
            source: SOURCE_ID,
            paint: {
              'line-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#E8E8E8', '#FFFFFF'],
              'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.4, 1.7],
              'line-opacity': 1,
              'line-color-transition': { duration: 200, delay: 0 },
              'line-width-transition': { duration: 200, delay: 0 },
            },
          })

          const layers = map.getStyle()?.layers || []
          layers.forEach((layer) => {
            if (!layer.id) return
            if (layer.id === FILL_LAYER_ID || layer.id === BORDER_LAYER_ID) return
            try {
              map.setLayoutProperty(layer.id, 'visibility', 'none')
            } catch {
              // Some base layers don't expose visibility.
            }
          })

          map.on('mouseenter', FILL_LAYER_ID, () => {
            map.getCanvas().style.cursor = 'pointer'
          })
          map.on('mouseleave', FILL_LAYER_ID, () => {
            map.getCanvas().style.cursor = ''
          })

          map.on('mousemove', FILL_LAYER_ID, (event) => {
            const feature = event.features?.[0]
            if (!feature) return
            const id = feature.id ?? null
            if (id === hoveredRegionIdRef.current) return
            setHoveredState(hoveredRegionIdRef.current, false)
            hoveredRegionIdRef.current = id
            setHoveredState(hoveredRegionIdRef.current, true)
            const properties = (feature.properties || {}) as RegionFeatureProperties
            setHoveredRegionName(properties.nom || null)
          })

          map.on('mouseleave', FILL_LAYER_ID, () => {
            setHoveredState(hoveredRegionIdRef.current, false)
            hoveredRegionIdRef.current = null
            setHoveredRegionName(null)
          })

          map.on('click', FILL_LAYER_ID, (event) => {
            const feature = event.features?.[0]
            if (!feature) return
            const properties = (feature.properties || {}) as RegionFeatureProperties
            const regionName = properties.nom || ''
            if (!regionName) return
            const slug = slugifyRegionName(regionName)
            setIsRouting(true)
            router.push(`/explore/${encodeURIComponent(slug)}`)
          })

          setIsMapVisible(true)
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
          console.error('[RegionsMap] Map initialization error:', error)
        }
      })()
    })

    return () => {
      isDisposed = true
      regionsFetchController.abort()
      try {
        map.remove()
      } catch {
        // Ignore map teardown errors during unmount.
      }
      mapRef.current = null
      hoveredRegionIdRef.current = null
      setHoveredRegionName(null)
    }
  }, [router])

  return (
    <div className="relative h-[80vh] min-h-[620px] w-full overflow-hidden rounded-[24px] border border-[#ECECEC] bg-[#F7F7F7] shadow-[0_16px_34px_rgba(0,0,0,0.08)]">
      <div
        ref={containerRef}
        className={`h-full w-full transition-opacity duration-500 ${isMapVisible ? 'opacity-100' : 'opacity-0'}`}
      />

      {hoveredRegionName && (
        <div className="pointer-events-none absolute left-5 top-5">
          <div className="max-w-[330px] rounded-2xl border border-white/75 bg-white/88 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.12)] backdrop-blur">
            <div>
              <p className="text-[12px] font-semibold leading-tight text-[#1F1F1F]">Région sélectionnée</p>
              <p className="mt-1 text-[11px] leading-[1.35] text-[#4B4B4B]">{hoveredRegionName}</p>
            </div>
          </div>
        </div>
      )}

      {mounted && isRouting
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-white/96 backdrop-blur-[2px]">
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
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
