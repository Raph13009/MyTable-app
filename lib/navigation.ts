/**
 * Navigate to a URL. If breakOutOfIframe is true and the app is inside an iframe,
 * opens the URL in the top window (full screen). Otherwise uses the provided router.
 */
export function isInIframe(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.top !== window.self
  } catch {
    return true
  }
}

export function resolveFullUrl(url: string): string {
  if (typeof window === 'undefined') return url
  return url.startsWith('http') ? url : new URL(url, window.location.origin).href
}

/** Navigate in the top window when embedded, so WordPress iframes do not trap the map. */
export function navigateBreakingOutOfIframe(url: string): void {
  if (typeof window === 'undefined') return
  const fullUrl = resolveFullUrl(url)
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.assign(fullUrl)
      return
    }
  } catch {
    window.open(fullUrl, '_top')
    return
  }
  window.location.assign(fullUrl)
}
