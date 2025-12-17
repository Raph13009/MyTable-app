'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { Database } from '@/types/database'

type Chef = Database['public']['Tables']['chefs']['Row']
type Menu = Database['public']['Tables']['menus']['Row']

interface BookingFormProps {
  chef: Chef
  menus: Menu[]
}

export default function BookingForm({ chef, menus }: BookingFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bookingDate: '',
    city: '',
    postalCode: '',
    guestsCount: '2',
    hasAllergies: false,
    allergiesDetails: '',
    menuId: menus.length > 0 ? menus[0].id : '',
    notes: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  // Calculer la date minimum (J+3)
  const getMinDate = () => {
    const today = new Date()
    const minDate = new Date(today)
    minDate.setDate(today.getDate() + 3)
    return minDate.toISOString().split('T')[0]
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.firstName.trim()) newErrors.firstName = 'Le prénom est requis'
    if (!formData.lastName.trim()) newErrors.lastName = 'Le nom est requis'
    if (!formData.email.trim()) newErrors.email = 'L&apos;email est requis'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide'
    }
    if (!formData.phone.trim()) newErrors.phone = 'Le téléphone est requis'
    if (!formData.bookingDate) {
      newErrors.bookingDate = 'La date est requise'
    } else {
      const selectedDate = new Date(formData.bookingDate)
      const minDate = new Date()
      minDate.setDate(minDate.getDate() + 3)
      minDate.setHours(0, 0, 0, 0)
      selectedDate.setHours(0, 0, 0, 0)
      
      if (selectedDate < minDate) {
        newErrors.bookingDate = 'Vous devez réserver au moins 3 jours avant la date de l&apos;évènement'
      }
    }
    if (!formData.city.trim()) newErrors.city = 'La ville est requise'
    if (!formData.postalCode.trim()) newErrors.postalCode = 'Le code postal est requis'
    if (!formData.guestsCount || parseInt(formData.guestsCount) < 1) {
      newErrors.guestsCount = 'Le nombre de convives doit être au moins 1'
    }
    if (formData.hasAllergies && !formData.allergiesDetails.trim()) {
      newErrors.allergiesDetails = 'Veuillez préciser les allergies'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chefId: chef.id,
          ...formData,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue')
      }

      // Rediriger vers une page de confirmation
      router.push('/booking-confirmation')
    } catch (error) {
      console.error('Error submitting booking:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Une erreur est survenue' })
    } finally {
      setLoading(false)
    }
  }

  const guestsOptions = Array.from({ length: 20 }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1} ${i === 0 ? 'convive' : 'convives'}`,
  }))

  const menuOptions = menus.map(menu => ({
    value: menu.id,
    label: `${menu.name}${menu.price ? ` - ${menu.price}€` : ''}`,
  }))

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6 space-y-6">
        <h2 className="text-2xl font-bold text-black mb-4">Informations personnelles</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Prénom *"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            error={errors.firstName}
            required
          />
          <Input
            label="Nom *"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            error={errors.lastName}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Email *"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            required
          />
          <Input
            label="Téléphone *"
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            error={errors.phone}
            required
          />
        </div>
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-lg p-6 space-y-6">
        <h2 className="text-2xl font-bold text-black mb-4">Détails de la réservation</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="w-full">
            <Input
              label="Date *"
              type="date"
              name="bookingDate"
              value={formData.bookingDate}
              onChange={handleChange}
              error={errors.bookingDate}
              min={getMinDate()}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Vous devez réserver au moins 3 jours avant la date de l&apos;évènement
            </p>
          </div>
          <Select
            label="Nombre de convives *"
            name="guestsCount"
            value={formData.guestsCount}
            onChange={handleChange}
            options={guestsOptions}
            error={errors.guestsCount}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Ville *"
            name="city"
            value={formData.city}
            onChange={handleChange}
            error={errors.city}
            required
          />
          <Input
            label="Code postal *"
            name="postalCode"
            value={formData.postalCode}
            onChange={handleChange}
            error={errors.postalCode}
            required
          />
        </div>

        {menus.length > 0 && (
          <div className="w-full">
            <Select
              label="Menu choisi"
              name="menuId"
              value={formData.menuId}
              onChange={handleChange}
              options={menuOptions}
            />
          </div>
        )}
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-lg p-6 space-y-6">
        <h2 className="text-2xl font-bold text-black mb-4">Informations complémentaires</h2>
        
        <Checkbox
          label="Avez-vous des allergies alimentaires ?"
          name="hasAllergies"
          checked={formData.hasAllergies}
          onChange={handleChange}
        />

        {formData.hasAllergies && (
          <Textarea
            label="Précisez vos allergies *"
            name="allergiesDetails"
            value={formData.allergiesDetails}
            onChange={handleChange}
            error={errors.allergiesDetails}
            rows={3}
            required={formData.hasAllergies}
          />
        )}

        <Textarea
          label="Notes ou demandes spéciales"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={4}
          placeholder="Toute information supplémentaire que vous souhaitez partager..."
        />
      </div>

      {errors.submit && (
        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
          <p className="text-red-500">{errors.submit}</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={loading} className="min-w-[200px]">
          {loading ? 'Envoi en cours...' : 'Envoyer la demande'}
        </Button>
      </div>
    </form>
  )
}

