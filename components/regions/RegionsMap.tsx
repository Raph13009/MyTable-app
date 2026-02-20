'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [2.3, 46.5],
      zoom: 4.7,
      minZoom: 4.7,
      maxZoom: 4.7,
      renderWorldCopies: false,
    })
    mapRef.current = map
    map.scrollZoom.disable()
    map.boxZoom.disable()
    map.dragRotate.disable()
    map.dragPan.disable()
    map.keyboard.disable()
    map.doubleClickZoom.disable()
    map.touchZoomRotate.disable()

    const setHoveredState = (id: string | number | null, hover: boolean) => {
      if (id === null) return
      try {
        map.setFeatureState({ source: SOURCE_ID, id }, { hover })
      } catch {
        // Ignore feature-state race during style/source refresh.
      }
    }

    map.on('load', async () => {
      const response = await fetch('/data/regions-fr.geojson')
      const regions = await response.json()

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
        router.push(`/explore/${encodeURIComponent(slug)}`)
      })

      setIsMapVisible(true)
    })

    return () => {
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
          <div className="rounded-[18px] border border-white/75 bg-white/88 px-[22px] py-[18px] shadow-[0_14px_32px_rgba(20,20,20,0.14)] backdrop-blur-md">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7C7C7C]">Région</p>
            <h3 className="mt-1 text-[18px] font-semibold text-[#131313]">{hoveredRegionName}</h3>
          </div>
        </div>
      )}
    </div>
  )
}
