/**
 * i18n Configuration
 * Professional internationalization system with browser detection and persistence
 */

export type Locale = 'fr' | 'en'

export const defaultLocale: Locale = 'fr'
export const supportedLocales: Locale[] = ['fr', 'en']

/**
 * Detect browser language with fallback
 */
export function detectBrowserLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale

  // Check localStorage first (user preference)
  const stored = localStorage.getItem('locale') as Locale | null
  if (stored && supportedLocales.includes(stored)) {
    return stored
  }

  // Detect from browser
  const browserLang = navigator.language || (navigator as any).userLanguage
  const lang = browserLang.split('-')[0].toLowerCase()

  if (lang === 'en') return 'en'
  if (lang === 'fr') return 'fr'
  
  return defaultLocale
}

/**
 * Set locale and persist to localStorage
 */
export function setLocale(locale: Locale): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('locale', locale)
  // Reload to apply changes
  window.location.reload()
}

/**
 * Get current locale
 */
export function getLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale
  return detectBrowserLocale()
}

/** Parse a WordPress/html lang value (`en`, `en-US`, `fr_FR`) into an app locale. */
export function parseEmbedSearchLocale(value?: string | string[] | null): Locale {
  const raw = Array.isArray(value) ? value[0] : value
  const lang = String(raw || '')
    .trim()
    .toLowerCase()
    .replace('_', '-')
    .split('-')[0]
  if (lang === 'en') return 'en'
  if (lang === 'fr') return 'fr'
  return defaultLocale
}
