'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const FRANCE_CENTER: [number, number] = [2.2137, 46.2276]
const FRANCE_ZOOM = 5

export interface MapChefPoint {
  id: string
  name: string
  latitude: number
  longitude: number
  cuisineType?: string | null
}

interface MapViewProps {
  chefs?: MapChefPoint[]
  selectedChefId?: string | null
  className?: string
}

export function MapView({ chefs = [], selectedChefId = null, className = 'w-full h-screen' }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const didFitBoundsRef = useRef(false)
  const hasInitializedRef = useRef(false)
  const isUnmountingRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current || hasInitializedRef.current) return
    hasInitializedRef.current = true
    isUnmountingRef.current = false

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) {
      hasInitializedRef.current = false
      console.error('Missing NEXT_PUBLIC_MAPBOX_TOKEN environment variable')
      return
    }

    mapboxgl.accessToken = token

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: FRANCE_CENTER,
      zoom: FRANCE_ZOOM,
    })

    const map = mapRef.current
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string } | undefined
      if (reason?.name === 'AbortError' || reason?.message?.includes('signal is aborted')) {
        event.preventDefault()
      }
    }
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    const onMapError = (event: mapboxgl.ErrorEvent) => {
      const error = (event as any)?.error
      if (isUnmountingRef.current && error?.name === 'AbortError') {
        return
      }
      if (error?.name === 'AbortError') {
        return
      }
      console.error('[MapView] Mapbox error:', error || event)
    }
    map.on('error', onMapError)

    return () => {
      isUnmountingRef.current = true
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      map.off('error', onMapError)
      try {
        map.remove()
      } catch (error: any) {
        if (error?.name !== 'AbortError' && !String(error?.message || '').includes('signal is aborted')) {
          console.error('[MapView] map.remove cleanup error:', error)
        }
      }
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
      mapRef.current = null
      didFitBoundsRef.current = false
      hasInitializedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    const validChefs = chefs.filter(
      (chef) =>
        Number.isFinite(chef.latitude) &&
        Number.isFinite(chef.longitude) &&
        Math.abs(chef.latitude) <= 90 &&
        Math.abs(chef.longitude) <= 180
    )

    validChefs.forEach((chef) => {
      const markerElement = document.createElement('button')
      const isSelected = chef.id === selectedChefId

      markerElement.type = 'button'
      markerElement.className = [
        'rounded-full border px-3 py-[7px] text-[12px] font-semibold leading-none shadow-sm transition-all',
        'bg-white text-[#222222] border-[#D9D9D9]',
        isSelected
          ? 'scale-105 border-[#222222] bg-[#222222] text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)]'
          : 'hover:shadow-md hover:scale-[1.03]',
      ].join(' ')
      markerElement.textContent = chef.name
      markerElement.setAttribute('aria-label', `Voir ${chef.name}`)
      markerElement.addEventListener('click', () => {
        mapRef.current?.flyTo({
          center: [chef.longitude, chef.latitude],
          zoom: Math.max((mapRef.current?.getZoom() ?? FRANCE_ZOOM), 8),
          duration: 800,
        })
      })

      const marker = new mapboxgl.Marker({ element: markerElement, anchor: 'bottom' })
        .setLngLat([chef.longitude, chef.latitude])
        .addTo(mapRef.current as mapboxgl.Map)

      markersRef.current.push(marker)
    })

    if (validChefs.length > 0 && !didFitBoundsRef.current) {
      const bounds = new mapboxgl.LngLatBounds()
      validChefs.forEach((chef) => bounds.extend([chef.longitude, chef.latitude]))
      mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 11, duration: 700 })
      didFitBoundsRef.current = true
    }
  }, [chefs, selectedChefId])

  return (
    <div className={className}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
