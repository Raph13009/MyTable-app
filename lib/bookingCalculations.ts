/**
 * Calcul du montant total d'une réservation selon le type de service
 * 
 * @param serviceType - Type de service: 'repas_domicile' | 'cours_cuisine' | 'mise_en_demeure'
 * @param menuPrice - Prix du menu (pour repas_domicile uniquement)
 * @param guestsCount - Nombre de convives (pour repas_domicile uniquement)
 * @param budget - Budget global (pour cours_cuisine uniquement)
 * @param totalPrice - Prix total (pour mise_en_demeure uniquement)
 * @param extras - Tableau des extras avec { name: string; price: number }
 * @returns Le montant total calculé
 */
export function calculateBookingTotal(
  serviceType: 'repas_domicile' | 'cours_cuisine' | 'mise_en_demeure' | null | undefined,
  options: {
    menuPrice?: number | null
    guestsCount?: number | null
    budget?: number | null
    totalPrice?: number | null
    extras?: Array<{ name: string; price: number }> | null
  }
): number {
  const { menuPrice = 0, guestsCount = 0, budget = 0, totalPrice = 0, extras = [] } = options

  // Calculer le total des extras
  const extrasTotal = (extras || []).reduce((sum, extra) => sum + (extra.price || 0), 0)

  // Calculer le total selon le type de service
  switch (serviceType) {
    case 'repas_domicile':
      // Repas à domicile : nb convives * prix menu + extras
      const safeMenuPrice = menuPrice || 0
      const safeGuestsCount = guestsCount || 0
      return (safeMenuPrice * safeGuestsCount) + extrasTotal

    case 'cours_cuisine':
      // Cours de cuisine : budget global + extras
      const safeBudget = budget || 0
      return safeBudget + extrasTotal

    case 'mise_en_demeure':
      // Chef à demeure : budget global (total_price) + extras
      const safeTotalPrice = totalPrice || 0
      return safeTotalPrice + extrasTotal

    default:
      // Par défaut, si le type n'est pas reconnu, retourner 0 + extras
      console.warn(`[calculateBookingTotal] Unknown service type: ${serviceType}, returning extras only`)
      return extrasTotal
  }
}
