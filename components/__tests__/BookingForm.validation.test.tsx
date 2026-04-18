/**
 * Tests de validation pour components/BookingForm.tsx
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BookingForm from '../BookingForm'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'booking.fullName': 'Nom',
        'booking.fullNamePlaceholder': 'Ex: Jean Dupont',
        'booking.email': 'Email',
        'booking.emailHelper':
          'Cette adresse mail vous permettra d’échanger directement avec le Chef, assurez-vous qu’elle soit correcte',
        'booking.phone': 'Téléphone',
        'booking.serviceTypeLabel': 'Type de service',
        'booking.serviceType.repas_domicile': 'Repas à domicile',
        'booking.serviceType.cours_cuisine': 'Cours de Cuisine',
        'booking.serviceType.mise_en_demeure': 'Chef à demeure',
        'booking.errors.fullNameRequired': 'Le nom est requis',
        'booking.errors.emailRequired': "L'email est requis",
        'booking.errors.emailInvalid': 'Email invalide',
        'booking.errors.phoneRequired': 'Le téléphone est requis',
        'booking.errors.serviceTypeRequired': 'Veuillez sélectionner un type de service',
        'booking.errors.missingRequiredFields': 'Certains champs obligatoires sont manquants.',
        'booking.next': 'Suivant',
        'booking.submit': 'Envoyer',
        'booking.back': 'Retour',
        'common.loading': 'Chargement...',
        'booking.title': 'Réserver',
        'booking.subtitle': 'Sous-titre',
      }
      return translations[key] || key
    },
    locale: 'fr',
    changeLocale: jest.fn(),
  }),
}))

jest.mock('@/lib/utils', () => ({
  fetchWithTimeout: jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    })
  ),
  generateIdempotencyToken: jest.fn(() => 'test-token'),
}))

describe('BookingForm - Validation', () => {
  const mockChef = {
    id: 'test-chef-id',
    slug: 'test-chef',
    name: 'Test Chef',
    email: 'chef@test.com',
    phone: '0123456789',
    city: 'Paris',
    postal_code: '75001',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }

  const mockMenus: any[] = []

  describe('Page 1 - Type de service', () => {
    it("affiche une erreur si aucun type de service n'est sélectionné", async () => {
      const { container } = render(<BookingForm chef={mockChef as any} chefName="Test Chef" menus={mockMenus} />)

      const form = container.querySelector('form')
      expect(form).toBeTruthy()
      fireEvent.submit(form!)

      await waitFor(() => {
        expect(screen.getByText('Veuillez sélectionner un type de service')).toBeInTheDocument()
      })
    })
  })

})
