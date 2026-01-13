/**
 * Tests unitaires pour lib/dateUtils.ts
 * 
 * Pour exécuter ces tests, vous devez installer un framework de test:
 * - Jest: npm install --save-dev jest @types/jest ts-jest
 * - Vitest: npm install --save-dev vitest @vitest/ui
 * 
 * Ces tests vérifient que les conversions de dates ne causent pas de décalage de timezone.
 */

import {
  getLocalDateString,
  formatDateForInput,
  parseDateFromDB,
  formatDateForDisplay,
  isValidDateString,
  getMinBookingDate,
  isValidBookingDate,
} from '../dateUtils'

describe('dateUtils', () => {
  describe('getLocalDateString', () => {
    it('devrait convertir une date locale en YYYY-MM-DD sans décalage timezone', () => {
      // Créer une date locale (ex: 15 mars 2024 à 00:00:00)
      const date = new Date(2024, 2, 15) // mois 2 = mars (0-indexed)
      const result = getLocalDateString(date)
      expect(result).toBe('2024-03-15')
    })

    it('devrait gérer correctement les dates en fin de mois', () => {
      const date = new Date(2024, 0, 31) // 31 janvier 2024
      const result = getLocalDateString(date)
      expect(result).toBe('2024-01-31')
    })

    it('devrait gérer correctement les années bissextiles', () => {
      const date = new Date(2024, 1, 29) // 29 février 2024
      const result = getLocalDateString(date)
      expect(result).toBe('2024-02-29')
    })

    it('ne devrait pas avoir de décalage même si la date est créée avec une heure spécifique', () => {
      // Créer une date à 23:00:00 - ne devrait pas décaler au jour suivant
      const date = new Date(2024, 2, 15, 23, 0, 0)
      const result = getLocalDateString(date)
      expect(result).toBe('2024-03-15')
    })
  })

  describe('formatDateForInput', () => {
    it('devrait être un alias de getLocalDateString', () => {
      const date = new Date(2024, 2, 15)
      expect(formatDateForInput(date)).toBe(getLocalDateString(date))
    })
  })

  describe('parseDateFromDB', () => {
    it('devrait parser une date YYYY-MM-DD en Date locale', () => {
      const dateString = '2024-03-15'
      const result = parseDateFromDB(dateString)
      
      expect(result).not.toBeNull()
      expect(result?.getFullYear()).toBe(2024)
      expect(result?.getMonth()).toBe(2) // mars = mois 2 (0-indexed)
      expect(result?.getDate()).toBe(15)
    })

    it('devrait retourner null pour une string invalide', () => {
      expect(parseDateFromDB('invalid')).toBeNull()
      expect(parseDateFromDB('2024-13-45')).toBeNull()
      expect(parseDateFromDB('')).toBeNull()
    })

    it('devrait retourner null pour null', () => {
      expect(parseDateFromDB(null)).toBeNull()
    })

    it('ne devrait pas avoir de décalage timezone', () => {
      // Parser une date et vérifier qu'elle reste la même date locale
      const dateString = '2024-03-15'
      const parsed = parseDateFromDB(dateString)
      
      // Vérifier que la date parsée correspond à la date locale attendue
      expect(parsed?.getFullYear()).toBe(2024)
      expect(parsed?.getMonth()).toBe(2)
      expect(parsed?.getDate()).toBe(15)
      
      // Vérifier que getLocalDateString retourne la même string
      if (parsed) {
        expect(getLocalDateString(parsed)).toBe(dateString)
      }
    })
  })

  describe('formatDateForDisplay', () => {
    it('devrait formater une Date en string localisée', () => {
      const date = new Date(2024, 2, 15) // 15 mars 2024
      const result = formatDateForDisplay(date, 'fr-FR')
      
      // Le format exact peut varier selon la locale, mais devrait contenir les informations
      expect(result).toContain('15')
      expect(result).toContain('mars')
      expect(result).toContain('2024')
    })

    it('devrait formater une string YYYY-MM-DD en string localisée', () => {
      const dateString = '2024-03-15'
      const result = formatDateForDisplay(dateString, 'fr-FR')
      
      expect(result).toContain('15')
      expect(result).toContain('mars')
      expect(result).toContain('2024')
    })

    it('devrait utiliser les options de formatage personnalisées', () => {
      const date = new Date(2024, 2, 15)
      const result = formatDateForDisplay(date, 'fr-FR', {
        day: 'numeric',
        month: 'short',
      })
      
      expect(result).toContain('15')
      expect(result).toContain('mars')
    })

    it('devrait retourner une string vide pour null', () => {
      expect(formatDateForDisplay(null, 'fr-FR')).toBe('')
    })

    it('devrait gérer les locales différentes', () => {
      const date = new Date(2024, 2, 15)
      const frResult = formatDateForDisplay(date, 'fr-FR')
      const enResult = formatDateForDisplay(date, 'en-US')
      
      // Les deux devraient contenir les informations de date
      expect(frResult.length).toBeGreaterThan(0)
      expect(enResult.length).toBeGreaterThan(0)
    })
  })

  describe('isValidDateString', () => {
    it('devrait valider une date YYYY-MM-DD valide', () => {
      expect(isValidDateString('2024-03-15')).toBe(true)
      expect(isValidDateString('2024-01-01')).toBe(true)
      expect(isValidDateString('2024-12-31')).toBe(true)
    })

    it('devrait rejeter une date invalide', () => {
      expect(isValidDateString('invalid')).toBe(false)
      expect(isValidDateString('2024-13-45')).toBe(false)
      expect(isValidDateString('2024-02-30')).toBe(false) // 30 février n'existe pas
      expect(isValidDateString('')).toBe(false)
    })

    it('devrait rejeter un format incorrect', () => {
      expect(isValidDateString('15/03/2024')).toBe(false)
      expect(isValidDateString('2024-3-15')).toBe(false) // pas de padding
      expect(isValidDateString('24-03-15')).toBe(false) // année incomplète
    })
  })

  describe('getMinBookingDate', () => {
    it('devrait retourner une date au format YYYY-MM-DD', () => {
      const result = getMinBookingDate()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('devrait retourner une date valide (J+3)', () => {
      const result = getMinBookingDate()
      const parsed = parseDateFromDB(result)
      expect(parsed).not.toBeNull()
      
      // Vérifier que c'est bien J+3
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const expectedDate = new Date(today)
      expectedDate.setDate(today.getDate() + 3)
      expectedDate.setHours(0, 0, 0, 0)
      
      if (parsed) {
        parsed.setHours(0, 0, 0, 0)
        expect(parsed.getTime()).toBe(expectedDate.getTime())
      }
    })
  })

  describe('isValidBookingDate', () => {
    it('devrait valider une date valide (J+3 ou plus)', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 5)
      const dateString = getLocalDateString(futureDate)
      
      expect(isValidBookingDate(dateString)).toBe(true)
    })

    it('devrait rejeter une date trop proche (moins de J+3)', () => {
      const today = new Date()
      const dateString = getLocalDateString(today)
      
      expect(isValidBookingDate(dateString)).toBe(false)
    })

    it('devrait rejeter une date invalide', () => {
      expect(isValidBookingDate('invalid')).toBe(false)
      expect(isValidBookingDate('2024-13-45')).toBe(false)
    })
  })

  describe('Conversion round-trip (pas de décalage)', () => {
    it('devrait pouvoir convertir une date locale en string et la parser sans décalage', () => {
      const originalDate = new Date(2024, 2, 15, 14, 30, 0) // 15 mars 2024 à 14:30
      const dateString = getLocalDateString(originalDate)
      const parsedDate = parseDateFromDB(dateString)
      
      expect(parsedDate).not.toBeNull()
      if (parsedDate) {
        // Vérifier que la date parsée correspond à la date originale (jour/mois/année)
        expect(parsedDate.getFullYear()).toBe(originalDate.getFullYear())
        expect(parsedDate.getMonth()).toBe(originalDate.getMonth())
        expect(parsedDate.getDate()).toBe(originalDate.getDate())
        
        // Vérifier le round-trip
        const roundTripString = getLocalDateString(parsedDate)
        expect(roundTripString).toBe(dateString)
      }
    })

    it('devrait gérer correctement les dates à minuit (pas de décalage UTC)', () => {
      // Créer une date à minuit local
      const date = new Date(2024, 2, 15, 0, 0, 0)
      const dateString = getLocalDateString(date)
      
      // Ne devrait pas être décalé au jour précédent
      expect(dateString).toBe('2024-03-15')
      
      // Parser et vérifier
      const parsed = parseDateFromDB(dateString)
      expect(parsed).not.toBeNull()
      if (parsed) {
        expect(parsed.getDate()).toBe(15)
        expect(parsed.getMonth()).toBe(2)
      }
    })

    it('devrait gérer correctement les dates en fin de journée (pas de décalage UTC)', () => {
      // Créer une date à 23:59:59 local
      const date = new Date(2024, 2, 15, 23, 59, 59)
      const dateString = getLocalDateString(date)
      
      // Ne devrait pas être décalé au jour suivant
      expect(dateString).toBe('2024-03-15')
    })
  })
})
