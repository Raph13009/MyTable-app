/**
 * Tests snapshot pour components/ChatInterface.tsx
 * 
 * Ces tests vérifient que l'affichage du type de service utilise i18n correctement.
 * 
 * Pour exécuter ces tests, vous devez installer un framework de test:
 * - Jest: npm install --save-dev jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom
 * - Vitest: npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom
 */

import React from 'react'
import { render } from '@testing-library/react'
import ChatInterface from '../ChatInterface'

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
      }
      return translations[key] || key
    },
    locale: 'fr',
    changeLocale: jest.fn(),
  }),
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: jest.fn(() => ({
      on: jest.fn(() => ({
        subscribe: jest.fn(),
      })),
    })),
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  }),
}))

describe('ChatInterface - Snapshot tests pour i18n', () => {
  const mockBookingRequest = {
    id: 'test-booking-id',
    service_type: 'mise_en_demeure',
    status: 'accepted',
  }

  const mockParticipants: any[] = []
  const mockInitialMessages: any[] = []
  const mockCurrentUser: any = null

  it('devrait afficher "Chef à demeure" pour mise_en_demeure via i18n', () => {
    const { container } = render(
      <ChatInterface
        conversationId="test-conversation"
        initialMessages={mockInitialMessages}
        participants={mockParticipants}
        currentUser={mockCurrentUser}
        bookingRequest={mockBookingRequest}
      />
    )

    // Snapshot test - vérifie que le rendu est cohérent
    expect(container).toMatchSnapshot()
  })

  it('devrait utiliser les clés i18n pour tous les types de service', () => {
    const serviceTypes = ['repas_domicile', 'cours_cuisine', 'mise_en_demeure']

    serviceTypes.forEach((serviceType) => {
      const bookingRequest = {
        ...mockBookingRequest,
        service_type: serviceType,
      }

      const { container } = render(
        <ChatInterface
          conversationId="test-conversation"
          initialMessages={mockInitialMessages}
          participants={mockParticipants}
          currentUser={mockCurrentUser}
          bookingRequest={bookingRequest}
        />
      )

      // Vérifier que le composant utilise bien i18n
      expect(container).toMatchSnapshot()
    })
  })
})
