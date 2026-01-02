'use client'

import { useEffect } from 'react'
import { detectBrowserLocale } from '@/lib/i18n'

/**
 * Client component to update HTML lang attribute based on detected locale
 * Écoute aussi les changements de locale dans localStorage
 */
export default function LocaleProvider() {
  useEffect(() => {
    const updateLang = () => {
      const locale = detectBrowserLocale()
      document.documentElement.lang = locale
    }

    // Mettre à jour au montage
    updateLang()

    // Écouter les changements de localStorage (quand la langue change)
    const handleStorageChange = () => {
      updateLang()
    }

    window.addEventListener('storage', handleStorageChange)
    
    // Écouter aussi les changements via un custom event (pour le même onglet)
    window.addEventListener('localechange', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('localechange', handleStorageChange)
    }
  }, [])

  return null
}
