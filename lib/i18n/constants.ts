/**
 * i18n Constants and Utilities
 * Centralized functions for service type labels and other i18n helpers
 */

import type { Locale } from '../i18n'
import frMessages from '@/messages/fr.json'
import enMessages from '@/messages/en.json'

type Messages = typeof frMessages

const messages: Record<Locale, Messages> = {
  fr: frMessages,
  en: enMessages,
}

/**
 * Get service type label from i18n
 * Works both client-side and server-side
 */
export function getServiceTypeLabel(
  serviceType: string,
  locale: Locale = 'fr'
): string {
  const translations = messages[locale]
  
  switch (serviceType) {
    case 'repas_domicile':
      return translations.booking.serviceType.repas_domicile
    case 'cours_cuisine':
      return translations.booking.serviceType.cours_cuisine
    case 'mise_en_demeure':
      return translations.booking.serviceType.mise_en_demeure
    default:
      return serviceType
  }
}

/**
 * Get validation message with client name
 * Works both client-side and server-side
 */
export function getValidationMessage(
  clientName: string,
  locale: Locale = 'fr'
): string {
  const translations = messages[locale]
  return translations.booking.validation.clientValidated.replace(
    '{{clientName}}',
    clientName
  )
}

/**
 * Get budget global label
 * Works both client-side and server-side
 */
export function getBudgetGlobalLabel(locale: Locale = 'fr'): string {
  const translations = messages[locale]
  return translations.offer.budgetGlobalLabel
}

/**
 * Get email subject for booking validated to chef
 * Works both client-side and server-side
 */
export function getBookingValidatedToChefSubject(locale: Locale = 'fr'): string {
  const translations = messages[locale]
  return translations.booking.validation.emailSubjectToChef
}
