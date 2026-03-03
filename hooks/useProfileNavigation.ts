'use client'

import { useCallback } from 'react'
import { resolveFullUrl } from '@/lib/navigation'

/**
 * Returns a navigation function for profile links.
 * Always opens the URL in a new browser tab to break out of any embedded context.
 */
export function useProfileNavigation(_breakOutOfIframe?: boolean) {
  return useCallback(
    (url: string) => {
      const fullUrl = resolveFullUrl(url)
      window.open(fullUrl, '_blank', 'noopener,noreferrer')
    },
    []
  )
}
