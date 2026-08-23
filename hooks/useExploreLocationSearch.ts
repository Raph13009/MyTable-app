'use client'

import { useEffect, useRef, useState } from 'react'
import {
  EXPLORE_LOCATION_SEARCH_DEBOUNCE_MS,
  fetchExploreLocationSuggestions,
  type ExploreLocationSuggestion,
} from '@/lib/exploreLocationSearch'

export function useExploreLocationSearch(query: string, locale: string) {
  const [suggestions, setSuggestions] = useState<ExploreLocationSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2 || !token) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setIsLoading(true)
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log('[explore] geocoding request', { query: trimmed })
      }

      try {
        const nextSuggestions = await fetchExploreLocationSuggestions(trimmed, locale, token, controller.signal)
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
          console.log('[explore] geocoding response', { query: trimmed, count: nextSuggestions.length })
        }
        setSuggestions(nextSuggestions)
      } catch (error: unknown) {
        const name = error instanceof Error ? error.name : ''
        if (name !== 'AbortError') {
          console.error('[explore] search autocomplete error:', error)
        }
      } finally {
        setIsLoading(false)
      }
    }, EXPLORE_LOCATION_SEARCH_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [locale, query, token])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  return { suggestions, isLoading, token }
}
