'use client'

import { useEffect } from 'react'
import { detectBrowserLocale } from '@/lib/i18n'

/**
 * Client component to update HTML lang attribute based on detected locale
 */
export default function LocaleProvider() {
  useEffect(() => {
    const locale = detectBrowserLocale()
    document.documentElement.lang = locale
  }, [])

  return null
}
