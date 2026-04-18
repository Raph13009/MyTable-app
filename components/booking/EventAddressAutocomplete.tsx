'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { MapboxGeocodeFeature } from '@/lib/mapboxPlace'
import { mapboxFeatureToBookingPlace } from '@/lib/mapboxPlace'

const DEBOUNCE_MS = 320
const MIN_QUERY = 3

function isAbortError(e: unknown): boolean {
  if (e instanceof Error && e.name === 'AbortError') return true
  if (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError') return true
  return false
}

export type EventAddressPick = {
  fullAddress: string
  city: string
  postalCode: string
  latitude: number
  longitude: number
}

interface EventAddressAutocompleteProps {
  id?: string
  label: React.ReactNode
  value: string
  placeholder?: string
  error?: string
  locale?: string
  className?: string
  autoComplete?: string
  inputClassName?: string
  onChange: (value: string) => void
  onPick: (payload: EventAddressPick) => void
}

export function EventAddressAutocomplete({
  id: idProp,
  label,
  value,
  placeholder,
  error,
  locale = 'fr',
  className,
  autoComplete = 'street-address',
  inputClassName,
  onChange,
  onPick,
}: EventAddressAutocompleteProps) {
  const reactId = useId()
  const listboxId = idProp || `event-addr-${reactId}`
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<
    { id: string; label: string; feature: MapboxGeocodeFeature; parsed: ReturnType<typeof mapboxFeatureToBookingPlace> }[]
  >([])
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    const q = value.trim()
    const controller = new AbortController()

    if (!token || q.length < MIN_QUERY) {
      setSuggestions([])
      setLoading(false)
      setOpen(false)
      return () => {
        controller.abort()
      }
    }

    setLoading(true)

    const debounceTimer = window.setTimeout(() => {
      const run = async () => {
        try {
          const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?autocomplete=true&limit=8&language=${locale}&country=fr&types=address,place,postcode,locality,neighborhood&access_token=${token}`
          const res = await fetch(endpoint, { signal: controller.signal })
          if (controller.signal.aborted) return
          if (!res.ok) throw new Error('geocode')
          const payload = await res.json()
          if (controller.signal.aborted) return
          const features = Array.isArray(payload?.features) ? (payload.features as MapboxGeocodeFeature[]) : []
          const mapped = features
            .map((feature) => {
              const parsed = mapboxFeatureToBookingPlace(feature)
              return parsed
                ? {
                    id: String(feature.id),
                    label: feature.place_name || feature.text || '',
                    feature,
                    parsed,
                  }
                : null
            })
            .filter((item): item is NonNullable<typeof item> => !!item && !!item.label)
          setSuggestions(mapped)
          setOpen(mapped.length > 0)
        } catch (e: unknown) {
          if (isAbortError(e)) {
            return
          }
          setSuggestions([])
          setOpen(false)
        } finally {
          setLoading(false)
        }
      }

      void run()
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(debounceTimer)
      controller.abort()
    }
  }, [value, locale])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const handleSelect = useCallback(
    (parsed: NonNullable<ReturnType<typeof mapboxFeatureToBookingPlace>>) => {
      setOpen(false)
      onPick({
        fullAddress: parsed.fullAddress,
        city: parsed.city,
        postalCode: parsed.postalCode,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
      })
    },
    [onPick]
  )

  return (
    <div ref={wrapRef} className={cn('w-full relative', className)}>
      {label && (
        <label htmlFor={listboxId} className="block text-sm font-medium text-black mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={listboxId}
          type="text"
          name="eventAddress"
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value)
            if (!e.target.value.trim()) setOpen(false)
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true)
          }}
          className={cn(
            'w-full min-w-0 px-4 py-3 pr-10 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-black transition-colors',
            error && 'border-red-500',
            inputClassName
          )}
          aria-autocomplete="list"
          aria-controls={open ? `${listboxId}-listbox` : undefined}
        />
        {loading && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-[#FBCF03]"
              aria-hidden
            />
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}

      {open && suggestions.length > 0 && (
        <ul
          id={`${listboxId}-listbox`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((item) => (
            <li key={item.id} className="border-b border-neutral-100 last:border-0">
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="w-full px-3 py-2.5 text-left text-sm text-neutral-900 hover:bg-[#FBCF03]/15 focus:bg-[#FBCF03]/20 focus:outline-none"
                onMouseDown={(e) => {
                  e.preventDefault()
                  if (item.parsed) handleSelect(item.parsed)
                }}
              >
                <span className="line-clamp-2">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
