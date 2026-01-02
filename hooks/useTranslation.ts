'use client'

import { useState, useEffect, useMemo } from 'react'
import { detectBrowserLocale, setLocale, type Locale } from '@/lib/i18n'
import frMessages from '@/messages/fr.json'
import enMessages from '@/messages/en.json'

type Messages = typeof frMessages

const messages: Record<Locale, Messages> = {
  fr: frMessages,
  en: enMessages,
}

/**
 * Professional translation hook with browser detection and persistence
 * Usage: const t = useTranslation()
 * t('common.loading') => "Chargement..." (fr) or "Loading..." (en)
 */
export function useTranslation() {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return 'fr'
    return detectBrowserLocale()
  })

  // Sync with localStorage changes (from other tabs) and custom events (same tab)
  useEffect(() => {
    const handleLocaleChange = () => {
      const newLocale = detectBrowserLocale()
      setLocaleState(newLocale)
    }

    // Écouter les changements de localStorage (autres onglets)
    window.addEventListener('storage', handleLocaleChange)
    
    // Écouter les changements via custom event (même onglet)
    window.addEventListener('localechange', handleLocaleChange)

    return () => {
      window.removeEventListener('storage', handleLocaleChange)
      window.removeEventListener('localechange', handleLocaleChange)
    }
  }, [])

  const t = useMemo(() => {
    const currentMessages = messages[locale]

    return (key: string, params?: Record<string, string | number>): string => {
      const keys = key.split('.')
      let value: any = currentMessages

      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k as keyof typeof value]
        } else {
          console.warn(`Translation key not found: ${key}`)
          return key
        }
      }

      if (typeof value !== 'string') {
        console.warn(`Translation value is not a string: ${key}`)
        return key
      }

      // Replace parameters
      if (params) {
        return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
          return params[paramKey]?.toString() || match
        })
      }

      return value
    }
  }, [locale])

  const changeLocale = (newLocale: Locale) => {
    // Sauvegarder dans localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', newLocale)
    }
    // Mettre à jour le state immédiatement (sans recharger la page)
    setLocaleState(newLocale)
    // Mettre à jour l'attribut lang du HTML
    if (typeof window !== 'undefined') {
      document.documentElement.lang = newLocale
      // Déclencher un custom event pour notifier les autres composants
      window.dispatchEvent(new Event('localechange'))
    }
  }

  return {
    t,
    locale,
    changeLocale,
  }
}
