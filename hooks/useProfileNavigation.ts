'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { isInIframe, resolveFullUrl } from '@/lib/navigation'

/**
 * Returns a navigation function for profile links.
 * When breakOutOfIframe is true and the app is inside an iframe,
 * opens the URL in the top window (full screen). Otherwise uses router.push.
 */
export function useProfileNavigation(breakOutOfIframe: boolean) {
  const router = useRouter()

  return useCallback(
    (url: string) => {
      if (breakOutOfIframe && isInIframe()) {
        window.top!.location.href = resolveFullUrl(url)
      } else {
        router.push(url)
      }
    },
    [breakOutOfIframe, router]
  )
}
