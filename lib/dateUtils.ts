/**
 * Utilitaires pour la gestion des dates dans l'application
 * 
 * Ces fonctions normalisent la gestion des dates pour éviter les problèmes de timezone.
 * La base de données stocke les dates en format DATE (sans timezone), donc on traite
 * toujours les dates comme des dates locales (pas UTC).
 */

/**
 * Convertit une Date locale en format YYYY-MM-DD (sans timezone)
 * Évite les problèmes de décalage liés à toISOString() qui utilise UTC
 */
export function getLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Convertit une Date locale en format YYYY-MM-DD pour les inputs HTML
 * Alias de getLocalDateString pour plus de clarté
 */
export function formatDateForInput(date: Date): string {
  return getLocalDateString(date)
}

/**
 * Parse une date depuis la base de données (format YYYY-MM-DD)
 * La DB stocke en DATE (sans timezone), donc on traite comme date locale
 * 
 * @param dateString - Date au format YYYY-MM-DD ou null
 * @returns Date locale ou null
 */
export function parseDateFromDB(dateString: string | null): Date | null {
  if (!dateString) return null
  
  // Valider le format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    console.warn(`Invalid date format: ${dateString}`)
    return null
  }
  
  // Parser comme date locale (pas UTC)
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  
  // Vérifier que la date est valide
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date: ${dateString}`)
    return null
  }
  
  return date
}

/**
 * Formate une date pour l'affichage
 * 
 * @param date - Date (objet Date ou string YYYY-MM-DD) ou null
 * @param locale - Locale pour le formatage ('fr-FR' ou 'en-US')
 * @param options - Options de formatage (optionnel)
 * @returns String formatée ou string vide si date invalide
 */
export function formatDateForDisplay(
  date: Date | string | null,
  locale: string = 'fr-FR',
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return ''
  
  let dateObj: Date
  
  if (typeof date === 'string') {
    // Parser depuis string YYYY-MM-DD
    const parsed = parseDateFromDB(date)
    if (!parsed) return ''
    dateObj = parsed
  } else {
    dateObj = date
  }
  
  // Options par défaut si non fournies
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }
  
  const formatOptions = options || defaultOptions
  
  try {
    return dateObj.toLocaleDateString(locale, formatOptions)
  } catch (error) {
    console.warn(`Error formatting date: ${error}`)
    return ''
  }
}

/**
 * Numeric date for booking fields. Independent of OS/browser locale.
 * French UI always uses DD/MM/YYYY; English UI uses MM/DD/YYYY.
 */
export function formatDateNumeric(
  date: Date | string | null,
  locale: 'fr' | 'en' | string = 'fr'
): string {
  if (!date) return ''

  const dateObj = typeof date === 'string' ? parseDateFromDB(date) : date
  if (!dateObj || isNaN(dateObj.getTime())) return ''

  const day = String(dateObj.getDate()).padStart(2, '0')
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const year = dateObj.getFullYear()
  const isEnglish = locale === 'en' || locale.startsWith('en')

  return isEnglish ? `${month}/${day}/${year}` : `${day}/${month}/${year}`
}

export function numericDatePlaceholder(locale: 'fr' | 'en' | string = 'fr'): string {
  return locale === 'en' || String(locale).startsWith('en') ? 'MM/DD/YYYY' : 'JJ/MM/AAAA'
}

/**
 * Valide qu'une string est au format YYYY-MM-DD
 */
export function isValidDateString(dateString: string): boolean {
  if (!dateString || typeof dateString !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false
  
  const parsed = parseDateFromDB(dateString)
  return parsed !== null && !isNaN(parsed.getTime())
}

/**
 * Obtient la date minimale pour la réservation (J+3)
 * Retourne au format YYYY-MM-DD
 */
export function getMinBookingDate(): string {
  const today = new Date()
  const minDate = new Date(today)
  minDate.setDate(today.getDate() + 3)
  return getLocalDateString(minDate)
}

/**
 * Vérifie si une date est valide pour la réservation (au moins J+3)
 */
export function isValidBookingDate(dateString: string): boolean {
  if (!isValidDateString(dateString)) return false
  
  const selectedDate = parseDateFromDB(dateString)
  if (!selectedDate) return false
  
  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 3)
  minDate.setHours(0, 0, 0, 0)
  
  const checkDate = new Date(selectedDate)
  checkDate.setHours(0, 0, 0, 0)
  
  return checkDate >= minDate
}
