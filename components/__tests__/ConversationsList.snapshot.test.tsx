/**
 * Tests snapshot pour components/ConversationsList.tsx
 * 
 * Ces tests vérifient que les badges de type de service utilisent i18n correctement.
 * 
 * Pour exécuter ces tests, vous devez installer un framework de test:
 * - Jest: npm install --save-dev jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom
 * - Vitest: npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom
 */

import React from 'react'
import { render } from '@testing-library/react'
import ConversationsList from '../ConversationsList'

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
        'dashboard.title': 'Messages',
        'dashboard.noConversations': 'Aucune conversation',
      }
      return translations[key] || key
    },
    locale: 'fr',
    changeLocale: jest.fn(),
  }),
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  }),
}))

describe('ConversationsList - Snapshot tests pour badges i18n', () => {
  const mockConversations = [
    {
      id: 'conv-1',
      bookingRequest: {
        service_type: 'mise_en_demeure',
      },
    },
    {
      id: 'conv-2',
      bookingRequest: {
        service_type: 'repas_domicile',
      },
    },
    {
      id: 'conv-3',
      bookingRequest: {
        service_type: 'cours_cuisine',
      },
    },
  ]

  it('devrait afficher les badges avec les libellés i18n corrects', () => {
    const { container } = render(
      <ConversationsList
        conversations={mockConversations as any}
        currentUserRole="chef"
        currentUserEmail="chef@test.com"
      />
    )

    // Snapshot test - vérifie que les badges utilisent i18n
    expect(container).toMatchSnapshot()
  })

  it('devrait utiliser "Chef à demeure" au lieu de "Mise en demeure"', () => {
    const conversationWithMiseEnDemeure = [
      {
        id: 'conv-1',
        bookingRequest: {
          service_type: 'mise_en_demeure',
        },
      },
    ]

    const { container } = render(
      <ConversationsList
        conversations={conversationWithMiseEnDemeure as any}
        currentUserRole="chef"
        currentUserEmail="chef@test.com"
      />
    )

    // Vérifier que le badge affiche "Chef à demeure" via i18n
    expect(container).toMatchSnapshot()
  })
})
