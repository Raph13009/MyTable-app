/**
 * Navigate to a URL. If breakOutOfIframe is true and the app is inside an iframe,
 * opens the URL in the top window (full screen). Otherwise uses the provided router.
 */
export function isInIframe(): boolean {
  if (typeof window === 'undefined') return false
  return window.top !== window.self
}

export function resolveFullUrl(url: string): string {
  if (typeof window === 'undefined') return url
  return url.startsWith('http') ? url : new URL(url, window.location.origin).href
}
