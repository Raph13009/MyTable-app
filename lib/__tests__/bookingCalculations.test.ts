/**
 * Tests unitaires pour lib/bookingCalculations.ts
 * 
 * Ces tests vérifient que le calcul du montant total est correct pour chaque type de service :
 * - Repas à domicile : nb convives * prix menu + extras
 * - Chef à demeure : budget global (total_price) + extras
 * - Cours de cuisine : budget global (budget) + extras
 * 
 * Pour exécuter ces tests, vous devez installer un framework de test:
 * - Jest: npm install --save-dev jest @types/jest ts-jest
 * - Vitest: npm install --save-dev vitest @vitest/ui
 */

import { calculateBookingTotal } from '../bookingCalculations'

describe('calculateBookingTotal', () => {
  describe('Repas à domicile (repas_domicile)', () => {
    it('devrait calculer correctement avec menu et convives', () => {
      const result = calculateBookingTotal('repas_domicile', {
        menuPrice: 50,
        guestsCount: 4,
        extras: [],
      })
      expect(result).toBe(200) // 50 * 4 = 200
    })

    it('devrait ajouter les extras au total', () => {
      const result = calculateBookingTotal('repas_domicile', {
        menuPrice: 50,
        guestsCount: 4,
        extras: [
          { name: 'Vin', price: 30 },
          { name: 'Dessert', price: 20 },
        ],
      })
      expect(result).toBe(250) // (50 * 4) + 30 + 20 = 250
    })

    it('devrait gérer les valeurs nulles', () => {
      const result = calculateBookingTotal('repas_domicile', {
        menuPrice: null,
        guestsCount: null,
        extras: [],
      })
      expect(result).toBe(0) // 0 * 0 = 0
    })

    it('devrait gérer les valeurs zéro', () => {
      const result = calculateBookingTotal('repas_domicile', {
        menuPrice: 0,
        guestsCount: 0,
        extras: [],
      })
      expect(result).toBe(0)
    })

    it('devrait gérer les extras avec prix nul', () => {
      const result = calculateBookingTotal('repas_domicile', {
        menuPrice: 50,
        guestsCount: 2,
        extras: [
          { name: 'Vin', price: 30 },
          { name: 'Gratuit', price: 0 },
          { name: 'Autre', price: null as any },
        ],
      })
      expect(result).toBe(130) // (50 * 2) + 30 + 0 + 0 = 130
    })
  })

  describe('Cours de cuisine (cours_cuisine)', () => {
    it('devrait calculer correctement avec budget global', () => {
      const result = calculateBookingTotal('cours_cuisine', {
        budget: 150,
        extras: [],
      })
      expect(result).toBe(150)
    })

    it('devrait ajouter les extras au budget', () => {
      const result = calculateBookingTotal('cours_cuisine', {
        budget: 150,
        extras: [
          { name: 'Matériel', price: 25 },
          { name: 'Ingrédients premium', price: 40 },
        ],
      })
      expect(result).toBe(215) // 150 + 25 + 40 = 215
    })

    it('devrait ignorer menuPrice et guestsCount', () => {
      const result = calculateBookingTotal('cours_cuisine', {
        budget: 150,
        menuPrice: 50, // devrait être ignoré
        guestsCount: 4, // devrait être ignoré
        extras: [],
      })
      expect(result).toBe(150) // Seulement le budget compte
    })

    it('devrait gérer les valeurs nulles', () => {
      const result = calculateBookingTotal('cours_cuisine', {
        budget: null,
        extras: [],
      })
      expect(result).toBe(0)
    })
  })

  describe('Chef à demeure (mise_en_demeure)', () => {
    it('devrait calculer correctement avec total_price', () => {
      const result = calculateBookingTotal('mise_en_demeure', {
        totalPrice: 500,
        extras: [],
      })
      expect(result).toBe(500)
    })

    it('devrait ajouter les extras au total_price', () => {
      const result = calculateBookingTotal('mise_en_demeure', {
        totalPrice: 500,
        extras: [
          { name: 'Service supplémentaire', price: 100 },
          { name: 'Décoration', price: 50 },
        ],
      })
      expect(result).toBe(650) // 500 + 100 + 50 = 650
    })

    it('devrait ignorer menuPrice, guestsCount et budget', () => {
      const result = calculateBookingTotal('mise_en_demeure', {
        totalPrice: 500,
        menuPrice: 50, // devrait être ignoré
        guestsCount: 4, // devrait être ignoré
        budget: 200, // devrait être ignoré
        extras: [],
      })
      expect(result).toBe(500) // Seulement total_price compte
    })

    it('devrait gérer les valeurs nulles', () => {
      const result = calculateBookingTotal('mise_en_demeure', {
        totalPrice: null,
        extras: [],
      })
      expect(result).toBe(0)
    })
  })

  describe('Cas edge et valeurs par défaut', () => {
    it('devrait prioriser un prix personnalisé quand isPriceCustom est true', () => {
      const result = calculateBookingTotal('repas_domicile', {
        menuPrice: 50,
        guestsCount: 4,
        totalPrice: 180,
        isPriceCustom: true,
        extras: [{ name: 'Extra', price: 30 }],
      })
      expect(result).toBe(180)
    })

    it('devrait gérer un prix personnalisé en string', () => {
      const result = calculateBookingTotal('cours_cuisine', {
        totalPrice: '249.90',
        isPriceCustom: true,
      })
      expect(result).toBe(249.9)
    })

    it('devrait retourner seulement les extras si service_type est null', () => {
      const result = calculateBookingTotal(null, {
        menuPrice: 50,
        guestsCount: 4,
        extras: [{ name: 'Extra', price: 30 }],
      })
      expect(result).toBe(30) // Seulement extras, avec warning
    })

    it('devrait retourner seulement les extras si service_type est undefined', () => {
      const result = calculateBookingTotal(undefined, {
        menuPrice: 50,
        guestsCount: 4,
        extras: [{ name: 'Extra', price: 30 }],
      })
      expect(result).toBe(30) // Seulement extras, avec warning
    })

    it('devrait gérer un type de service inconnu', () => {
      const result = calculateBookingTotal('unknown_service' as any, {
        extras: [{ name: 'Extra', price: 30 }],
      })
      expect(result).toBe(30) // Seulement extras, avec warning
    })

    it('devrait retourner 0 si aucun extra et aucune valeur de base', () => {
      const result = calculateBookingTotal('repas_domicile', {
        menuPrice: 0,
        guestsCount: 0,
        extras: [],
      })
      expect(result).toBe(0)
    })

    it('devrait gérer un tableau d\'extras vide', () => {
      const result = calculateBookingTotal('repas_domicile', {
        menuPrice: 50,
        guestsCount: 2,
        extras: [],
      })
      expect(result).toBe(100) // 50 * 2 = 100
    })

    it('devrait gérer extras null', () => {
      const result = calculateBookingTotal('repas_domicile', {
        menuPrice: 50,
        guestsCount: 2,
        extras: null,
      })
      expect(result).toBe(100) // 50 * 2 = 100
    })
  })

  describe('Comparaison entre les types de service', () => {
    it('devrait donner des résultats différents selon le type de service avec les mêmes valeurs', () => {
      const repasResult = calculateBookingTotal('repas_domicile', {
        menuPrice: 50,
        guestsCount: 4,
        budget: 200,
        totalPrice: 200,
        extras: [{ name: 'Extra', price: 30 }],
      })

      const coursResult = calculateBookingTotal('cours_cuisine', {
        menuPrice: 50,
        guestsCount: 4,
        budget: 200,
        totalPrice: 200,
        extras: [{ name: 'Extra', price: 30 }],
      })

      const demeureResult = calculateBookingTotal('mise_en_demeure', {
        menuPrice: 50,
        guestsCount: 4,
        budget: 200,
        totalPrice: 200,
        extras: [{ name: 'Extra', price: 30 }],
      })

      // Repas: (50 * 4) + 30 = 230
      expect(repasResult).toBe(230)
      
      // Cours: 200 + 30 = 230
      expect(coursResult).toBe(230)
      
      // Demeure: 200 + 30 = 230
      expect(demeureResult).toBe(230)
      
      // Dans ce cas particulier, les résultats sont identiques, mais les calculs sont différents
    })

    it('devrait montrer la différence avec des valeurs différentes', () => {
      const repasResult = calculateBookingTotal('repas_domicile', {
        menuPrice: 50,
        guestsCount: 4,
        extras: [{ name: 'Extra', price: 30 }],
      })

      const coursResult = calculateBookingTotal('cours_cuisine', {
        budget: 300,
        extras: [{ name: 'Extra', price: 30 }],
      })

      const demeureResult = calculateBookingTotal('mise_en_demeure', {
        totalPrice: 400,
        extras: [{ name: 'Extra', price: 30 }],
      })

      expect(repasResult).toBe(230) // (50 * 4) + 30
      expect(coursResult).toBe(330) // 300 + 30
      expect(demeureResult).toBe(430) // 400 + 30
    })
  })
})
