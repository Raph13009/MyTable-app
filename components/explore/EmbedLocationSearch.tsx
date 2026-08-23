'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LocationSearchBar } from '@/components/explore/LocationSearchBar'
import { trackEvent } from '@/lib/analytics/track'
import {
  buildExplore2LocationUrl,
  type ExploreLocationSuggestion,
} from '@/lib/exploreLocationSearch'
import { parseEmbedSearchLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'
import { navigateBreakingOutOfIframe } from '@/lib/navigation'
import frMessages from '@/messages/fr.json'
import enMessages from '@/messages/en.json'

const EMBED_HEIGHT_MESSAGE = 'guidemytable-search-embed-height'
const EMBED_LANG_MESSAGE = 'guidemytable-search-embed-lang'
const PARENT_ORIGINS = new Set(['https://guidemytable.fr', 'https://www.guidemytable.fr'])

const messagesByLocale = {
  fr: frMessages,
  en: enMessages,
} as const

function isAllowedParentOrigin(origin: string): boolean {
  if (PARENT_ORIGINS.has(origin)) return true
  try {
    return new URL(origin).hostname === 'localhost'
  } catch {
    return false
  }
}

export function EmbedLocationSearch({ initialLocale = 'fr' }: { initialLocale?: Locale }) {
  const [query, setQuery] = useState('')
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const messages = messagesByLocale[locale]

  useEffect(() => {
    setLocale(initialLocale)
  }, [initialLocale])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

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

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isAllowedParentOrigin(event.origin)) return
      if (!event.data || event.data.type !== EMBED_LANG_MESSAGE) return
      setLocale(parseEmbedSearchLocale(event.data.lang))
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
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
    <div ref={rootRef} className="gmt-embed-search w-full p-1">
      <LocationSearchBar
        query={query}
        onQueryChange={setQuery}
        onSelect={handleSelect}
        locale={locale}
        placeholder={messages.explore.searchPlaceholderWordpress}
        loadingLabel={messages.explore.searchLoading}
        variant="embed"
      />
    </div>
  )
}
