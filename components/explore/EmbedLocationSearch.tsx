'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LocationSearchBar } from '@/components/explore/LocationSearchBar'
import { trackEvent } from '@/lib/analytics/track'
import {
  buildExplore2LocationUrl,
  type ExploreLocationSuggestion,
} from '@/lib/exploreLocationSearch'
import { navigateBreakingOutOfIframe } from '@/lib/navigation'
import frMessages from '@/messages/fr.json'

const EMBED_HEIGHT_MESSAGE = 'guidemytable-search-embed-height'

export function EmbedLocationSearch() {
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    const reportHeight = () => {
      const height = Math.ceil(el.getBoundingClientRect().height)
      window.parent?.postMessage({ type: EMBED_HEIGHT_MESSAGE, height }, '*')
    }

    reportHeight()
    const observer = new ResizeObserver(reportHeight)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleSelect = useCallback((suggestion: ExploreLocationSuggestion) => {
    setQuery(suggestion.label)
    trackEvent('search', {
      search_query: suggestion.label,
      search_label: suggestion.label,
      source: 'wordpress',
    })
    const url = buildExplore2LocationUrl(
      {
        label: suggestion.label,
        center: suggestion.center,
        bbox: suggestion.bbox,
        source: 'wordpress',
      },
      window.location.origin
    )
    navigateBreakingOutOfIframe(url)
  }, [])

  return (
    <div ref={rootRef} className="w-full p-1">
      <LocationSearchBar
        query={query}
        onQueryChange={setQuery}
        onSelect={handleSelect}
        locale="fr"
        placeholder={frMessages.explore.searchPlaceholder}
        loadingLabel={frMessages.explore.searchLoading}
        variant="embed"
      />
    </div>
  )
}
