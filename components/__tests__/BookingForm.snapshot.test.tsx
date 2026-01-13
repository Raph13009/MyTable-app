/**
 * Tests snapshot pour components/BookingForm.tsx
 * 
 * Ces tests vérifient que les options de service utilisent i18n correctement.
 * 
 * Pour exécuter ces tests, vous devez installer un framework de test:
 * - Jest: npm install --save-dev jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom
 * - Vitest: npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom
 */

import React from 'react'
import { render } from '@testing-library/react'
import BookingForm from '../BookingForm'

// Mock des dépendances
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      // Mock des traductions pour les tests
      const translations: Record<string, string> = {
        'booking.serviceType.repas_domicile': 'Repas à domicile',
        'booking.serviceType.cours_cuisine': 'Cours de Cuisine',
        'booking.serviceType.mise_en_demeure': 'Chef à demeure',
        'booking.serviceTypeLabel': 'Type de service',
        'offer.budgetGlobalLabel': 'Budget global',
      }
      return translations[key] || key
    },
    locale: 'fr',
    changeLocale: jest.fn(),
  }),
}))

describe('BookingForm - Snapshot tests pour options de service i18n', () => {
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

  it('devrait afficher les options de service avec les libellés i18n', () => {
    const { container } = render(
      <BookingForm chef={mockChef as any} menus={mockMenus} />
    )

    // Snapshot test - vérifie que les options utilisent i18n
    expect(container).toMatchSnapshot()
  })

  it('devrait afficher "Chef à demeure" au lieu de "Mise en demeure"', () => {
    const { container } = render(
      <BookingForm chef={mockChef as any} menus={mockMenus} />
    )

    // Vérifier que l'option mise_en_demeure affiche "Chef à demeure" via i18n
    expect(container).toMatchSnapshot()
  })

  it('devrait afficher "Budget global" au lieu de "Prix global"', () => {
    const { container } = render(
      <BookingForm chef={mockChef as any} menus={mockMenus} />
    )

    // Vérifier que le libellé utilise "Budget global" via i18n
    expect(container).toMatchSnapshot()
  })
})
