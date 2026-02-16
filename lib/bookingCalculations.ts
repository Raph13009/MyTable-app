/**
 * Calcul du montant total d'une réservation selon le type de service
 * 
 * @param serviceType - Type de service: 'repas_domicile' | 'cours_cuisine' | 'mise_en_demeure'
 * @param menuPrice - Prix du menu (pour repas_domicile uniquement)
 * @param guestsCount - Nombre de convives (pour repas_domicile uniquement)
 * @param budget - Prix par personne (pour cours_cuisine uniquement)
 * @param totalPrice - Prix par personne (pour mise_en_demeure uniquement)
 * @param isPriceCustom - Si true, totalPrice est traité comme le montant final (override)
 * @param extras - Tableau des extras avec { name: string; price: number }
 * @returns Le montant total calculé
 */
export function calculateBookingTotal(
  serviceType: 'repas_domicile' | 'cours_cuisine' | 'mise_en_demeure' | null | undefined,
  options: {
    menuPrice?: number | string | null
    guestsCount?: number | string | null
    budget?: number | string | null
    totalPrice?: number | string | null
    isPriceCustom?: boolean | null
    extras?: Array<{ name: string; price: number | string }> | null
  }
): number {
  const normalizeNumber = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return 0
    if (typeof value === 'string') {
      const parsed = parseFloat(value)
      return isNaN(parsed) ? 0 : parsed
    }
    return value
  }

  const {
    menuPrice = 0,
    guestsCount = 0,
    budget = 0,
    totalPrice = 0,
    isPriceCustom = false,
    extras = [],
  } = options

  // Prix personnalisé saisi par le chef: total final forcé (sans addition automatique des extras)
  if (isPriceCustom) {
    return normalizeNumber(totalPrice)
  }

  // Calculer le total des extras
  const extrasTotal = (extras || []).reduce((sum, extra) => sum + normalizeNumber(extra?.price), 0)

  // Calculer le total selon le type de service
  switch (serviceType) {
    case 'repas_domicile':
      // Repas à domicile : nb convives * prix menu + extras
      const safeMenuPrice = normalizeNumber(menuPrice)
      const safeGuestsCount = normalizeNumber(guestsCount)
      return (safeMenuPrice * safeGuestsCount) + extrasTotal

    case 'cours_cuisine':
      // Cours de cuisine : prix/pers * nb convives + extras
      const safeBudget = normalizeNumber(budget)
      const safeCourseGuestsCount = normalizeNumber(guestsCount)
      return (safeBudget * safeCourseGuestsCount) + extrasTotal

    case 'mise_en_demeure':
      // Chef à demeure : prix/pers * nb convives + extras
      const safeTotalPrice = normalizeNumber(totalPrice)
      const safeHomeChefGuestsCount = normalizeNumber(guestsCount)
      return (safeTotalPrice * safeHomeChefGuestsCount) + extrasTotal

    default:
      // Par défaut, si le type n'est pas reconnu, retourner 0 + extras
      console.warn(`[calculateBookingTotal] Unknown service type: ${serviceType}, returning extras only`)
      return extrasTotal
  }
}
