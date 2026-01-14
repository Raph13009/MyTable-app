/**
 * Tests de validation pour components/BookingForm.tsx
 * 
 * Ces tests vérifient la validation des champs du formulaire de réservation.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
      const translations: Record<string, string> = {
        'booking.firstName': 'Prénom',
        'booking.lastName': 'Nom',
        'booking.email': 'Email',
        'booking.confirmEmail': 'Confirmer l\'email',
        'booking.phone': 'Téléphone',
        'booking.serviceTypeLabel': 'Type de service',
        'booking.serviceType.repas_domicile': 'Repas à domicile',
        'booking.serviceType.cours_cuisine': 'Cours de Cuisine',
        'booking.serviceType.mise_en_demeure': 'Chef à demeure',
        'booking.errors.firstNameRequired': 'Le prénom est requis',
        'booking.errors.lastNameRequired': 'Le nom est requis',
        'booking.errors.emailRequired': 'L\'email est requis',
        'booking.errors.emailInvalid': 'Email invalide',
        'booking.errors.emailConfirmRequired': 'La confirmation de l\'email est requise',
        'booking.errors.emailsDontMatch': 'Les emails ne correspondent pas',
        'booking.errors.phoneRequired': 'Le téléphone est requis',
        'booking.errors.serviceTypeRequired': 'Veuillez sélectionner un type de service',
        'booking.errors.missingRequiredFields': 'Certains champs obligatoires sont manquants.',
        'booking.next': 'Suivant',
        'booking.submit': 'Envoyer',
        'booking.back': 'Retour',
        'common.loading': 'Chargement...',
      }
      return translations[key] || key
    },
    locale: 'fr',
    changeLocale: jest.fn(),
  }),
}))

jest.mock('@/lib/utils', () => ({
  fetchWithTimeout: jest.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
  })),
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

  describe('Page 1 - Validation des champs requis', () => {
    it('devrait afficher une erreur si le prénom est manquant', async () => {
      render(<BookingForm chef={mockChef as any} menus={mockMenus} />)
      
      const submitButton = screen.getByText('Suivant')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Le prénom est requis')).toBeInTheDocument()
      })
    })

    it('devrait afficher une erreur si le nom est manquant', async () => {
      render(<BookingForm chef={mockChef as any} menus={mockMenus} />)
      
      const firstNameInput = screen.getByLabelText(/Prénom/i)
      fireEvent.change(firstNameInput, { target: { value: 'John' } })
      
      const submitButton = screen.getByText('Suivant')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Le nom est requis')).toBeInTheDocument()
      })
    })

    it('devrait afficher une erreur si l\'email est invalide', async () => {
      render(<BookingForm chef={mockChef as any} menus={mockMenus} />)
      
      const firstNameInput = screen.getByLabelText(/Prénom/i)
      const lastNameInput = screen.getByLabelText(/Nom/i)
      const emailInput = screen.getByLabelText(/Email/i)
      
      fireEvent.change(firstNameInput, { target: { value: 'John' } })
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } })
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
      
      const submitButton = screen.getByText('Suivant')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Email invalide')).toBeInTheDocument()
      })
    })

    it('devrait afficher une erreur si les emails ne correspondent pas', async () => {
      render(<BookingForm chef={mockChef as any} menus={mockMenus} />)
      
      const firstNameInput = screen.getByLabelText(/Prénom/i)
      const lastNameInput = screen.getByLabelText(/Nom/i)
      const emailInput = screen.getByLabelText(/Email/i)
      const emailConfirmInput = screen.getByLabelText(/Confirmer l'email/i)
      
      fireEvent.change(firstNameInput, { target: { value: 'John' } })
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(emailConfirmInput, { target: { value: 'john2@example.com' } })
      
      const submitButton = screen.getByText('Suivant')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Les emails ne correspondent pas')).toBeInTheDocument()
      })
    })

    it('devrait afficher une erreur si le type de service n\'est pas sélectionné', async () => {
      render(<BookingForm chef={mockChef as any} menus={mockMenus} />)
      
      const firstNameInput = screen.getByLabelText(/Prénom/i)
      const lastNameInput = screen.getByLabelText(/Nom/i)
      const emailInput = screen.getByLabelText(/Email/i)
      const emailConfirmInput = screen.getByLabelText(/Confirmer l'email/i)
      const phoneInput = screen.getByLabelText(/Téléphone/i)
      
      fireEvent.change(firstNameInput, { target: { value: 'John' } })
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(emailConfirmInput, { target: { value: 'john@example.com' } })
      fireEvent.change(phoneInput, { target: { value: '0123456789' } })
      
      const submitButton = screen.getByText('Suivant')
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Veuillez sélectionner un type de service')).toBeInTheDocument()
      })
    })
  })

  describe('Page 2 - Validation des champs requis', () => {
    it('devrait afficher le message d\'erreur global si des champs sont manquants', async () => {
      render(<BookingForm chef={mockChef as any} menus={mockMenus} />)
      
      // Remplir la page 1
      const firstNameInput = screen.getByLabelText(/Prénom/i)
      const lastNameInput = screen.getByLabelText(/Nom/i)
      const emailInput = screen.getByLabelText(/Email/i)
      const emailConfirmInput = screen.getByLabelText(/Confirmer l'email/i)
      const phoneInput = screen.getByLabelText(/Téléphone/i)
      
      fireEvent.change(firstNameInput, { target: { value: 'John' } })
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(emailConfirmInput, { target: { value: 'john@example.com' } })
      fireEvent.change(phoneInput, { target: { value: '0123456789' } })
      
      // Sélectionner un type de service
      const serviceTypeRadio = screen.getByLabelText(/Repas à domicile/i)
      fireEvent.click(serviceTypeRadio)
      
      // Aller à la page 2
      const nextButton = screen.getByText('Suivant')
      fireEvent.click(nextButton)
      
      await waitFor(() => {
        // Essayer de soumettre sans remplir les champs requis
        const submitButton = screen.getByText('Envoyer')
        fireEvent.click(submitButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Certains champs obligatoires sont manquants.')).toBeInTheDocument()
      })
    })
  })

  describe('Attributs autofill iOS', () => {
    it('devrait avoir les attributs autocomplete corrects pour les champs', () => {
      render(<BookingForm chef={mockChef as any} menus={mockMenus} />)
      
      const firstNameInput = screen.getByLabelText(/Prénom/i) as HTMLInputElement
      const lastNameInput = screen.getByLabelText(/Nom/i) as HTMLInputElement
      const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement
      const phoneInput = screen.getByLabelText(/Téléphone/i) as HTMLInputElement
      
      expect(firstNameInput.getAttribute('autocomplete')).toBe('given-name')
      expect(lastNameInput.getAttribute('autocomplete')).toBe('family-name')
      expect(emailInput.getAttribute('autocomplete')).toBe('email')
      expect(phoneInput.getAttribute('autocomplete')).toBe('tel')
    })

    it('devrait avoir les attributs inputmode corrects', () => {
      render(<BookingForm chef={mockChef as any} menus={mockMenus} />)
      
      const firstNameInput = screen.getByLabelText(/Prénom/i) as HTMLInputElement
      const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement
      const phoneInput = screen.getByLabelText(/Téléphone/i) as HTMLInputElement
      
      expect(firstNameInput.getAttribute('inputmode')).toBe('text')
      expect(emailInput.getAttribute('inputmode')).toBe('email')
      expect(phoneInput.getAttribute('inputmode')).toBe('tel')
    })
  })

  describe('Champ Enfants - Validation numérique', () => {
    it('devrait avoir inputmode="numeric" et pattern="[0-9]*" pour le champ enfants', async () => {
      render(<BookingForm chef={mockChef as any} menus={mockMenus} />)
      
      // Remplir la page 1 et aller à la page 2
      const firstNameInput = screen.getByLabelText(/Prénom/i)
      const lastNameInput = screen.getByLabelText(/Nom/i)
      const emailInput = screen.getByLabelText(/Email/i)
      const emailConfirmInput = screen.getByLabelText(/Confirmer l'email/i)
      const phoneInput = screen.getByLabelText(/Téléphone/i)
      
      fireEvent.change(firstNameInput, { target: { value: 'John' } })
      fireEvent.change(lastNameInput, { target: { value: 'Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(emailConfirmInput, { target: { value: 'john@example.com' } })
      fireEvent.change(phoneInput, { target: { value: '0123456789' } })
      
      const serviceTypeRadio = screen.getByLabelText(/Repas à domicile/i)
      fireEvent.click(serviceTypeRadio)
      
      const nextButton = screen.getByText('Suivant')
      fireEvent.click(nextButton)
      
      await waitFor(() => {
        const childrenInput = screen.getByLabelText(/Enfants/i) as HTMLInputElement
        expect(childrenInput.getAttribute('inputmode')).toBe('numeric')
        expect(childrenInput.getAttribute('pattern')).toBe('[0-9]*')
        expect(childrenInput.getAttribute('type')).toBe('number')
      })
    })
  })
})
