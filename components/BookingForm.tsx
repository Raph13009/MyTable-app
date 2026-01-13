'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { Database } from '@/types/database'
import { useTranslation } from '@/hooks/useTranslation'
import { 
  getLocalDateString, 
  formatDateForDisplay, 
  getMinBookingDate, 
  isValidBookingDate 
} from '@/lib/dateUtils'

type Chef = Database['public']['Tables']['chefs']['Row']
type Menu = Database['public']['Tables']['menus']['Row']

type ServiceType = 'repas_domicile' | 'cours_cuisine' | 'mise_en_demeure'

interface BookingFormProps {
  chef: Chef
  menus: Menu[]
}

export default function BookingForm({ chef, menus }: BookingFormProps) {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showTermsPopup, setShowTermsPopup] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    emailConfirm: '',
    phone: '',
    serviceType: '' as ServiceType | '',
    bookingDate: '',
    city: '',
    postalCode: '',
    guestsCount: '2',
    childrenCount: '0',
    mealTime: '' as 'dejeuner' | 'diner' | '',
    periodStartDate: '',
    periodEndDate: '',
    budget: '',
    courseTopic: '',
    selectedDates: [] as string[],
    mealOptionsByDate: {} as Record<string, ('pdj' | 'dejeuner' | 'diner')[]>,
    hasAllergies: false,
    allergiesDetails: '',
    menuId: menus.length > 0 ? menus[0].id : '',
    notes: '',
  })

    // Réinitialiser le formulaire à chaque montage du composant
  useEffect(() => {
    setCurrentPage(1)
    setAcceptedTerms(false)
    setErrors({})
    setLoading(false)
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      emailConfirm: '',
      phone: '',
      serviceType: '' as ServiceType | '',
      bookingDate: '',
      city: '',
      postalCode: '',
      guestsCount: '2',
      childrenCount: '0',
      mealTime: '' as 'dejeuner' | 'diner' | '',
      periodStartDate: '',
      periodEndDate: '',
      budget: '',
      courseTopic: '',
      selectedDates: [],
      mealOptionsByDate: {},
      hasAllergies: false,
      allergiesDetails: '',
      menuId: menus.length > 0 ? menus[0].id : '',
      notes: '',
    })
  }, [chef.id, menus])

  // Scroll en haut lors du passage à la page 2
  useEffect(() => {
    if (currentPage === 2) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [currentPage])

  // Pour le portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Bloquer le scroll du body quand la popup est ouverte
  useEffect(() => {
    if (showTermsPopup) {
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.body.style.overflow = 'hidden'
      
      return () => {
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        document.body.style.overflow = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [showTermsPopup])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | { target: { name?: string; value: string } }) => {
    const { name, value } = e.target
    const type = 'target' in e && 'type' in e.target ? (e.target as HTMLInputElement).type : undefined
    const checked = 'target' in e && 'checked' in e.target ? (e.target as HTMLInputElement).checked : false

    setFormData(prev => {
      const newData = {
        ...prev,
        [name || '']: type === 'checkbox' ? checked : value,
      }
      
      // Si la date de début change et que la date de fin est avant, réinitialiser la date de fin
      if (name === 'periodStartDate' && prev.periodEndDate && value && prev.periodEndDate < value) {
        newData.periodEndDate = ''
      }
      
      return newData
    })

    // Clear error when user starts typing
    if (name && errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  // Calculer la date minimum (J+3)
  const getMinDate = () => {
    return getMinBookingDate()
  }

  const validatePage1 = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.firstName.trim()) newErrors.firstName = t('booking.errors.firstNameRequired')
    if (!formData.lastName.trim()) newErrors.lastName = t('booking.errors.lastNameRequired')
    if (!formData.email.trim()) newErrors.email = t('booking.errors.emailRequired')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('booking.errors.emailInvalid')
    }
    if (!formData.emailConfirm.trim()) newErrors.emailConfirm = t('booking.errors.emailConfirmRequired')
    else if (formData.email !== formData.emailConfirm) {
      newErrors.emailConfirm = t('booking.errors.emailsDontMatch')
    }
    if (!formData.phone.trim()) newErrors.phone = t('booking.errors.phoneRequired')
    if (!formData.serviceType) {
      newErrors.serviceType = t('booking.errors.serviceTypeRequired')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validatePage2 = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.city.trim()) newErrors.city = 'La ville est requise'
    if (!formData.postalCode.trim()) newErrors.postalCode = 'Le code postal est requis'
    if (!formData.guestsCount || parseInt(formData.guestsCount) < 1) {
      newErrors.guestsCount = t('booking.errors.guestsCountMin')
    }
    
    // Validation du nombre d'enfants
    const guestsCount = parseInt(formData.guestsCount) || 0
    const childrenCount = parseInt(formData.childrenCount) || 0
    if (childrenCount < 0) {
      newErrors.childrenCount = 'Le nombre d\'enfants ne peut pas être négatif'
    }
    if (childrenCount > guestsCount) {
      newErrors.childrenCount = t('booking.errors.childrenCountMax')
    }

    if (formData.serviceType === 'repas_domicile') {
      if (!formData.bookingDate) {
        newErrors.bookingDate = 'La date est requise'
      } else if (!isValidBookingDate(formData.bookingDate)) {
        newErrors.bookingDate = 'Vous devez réserver au moins 3 jours avant la date de l&apos;évènement'
      }
      if (!formData.mealTime) {
        newErrors.mealTime = 'Le moment du repas est requis'
      }
    } else if (formData.serviceType === 'cours_cuisine') {
      if (!formData.bookingDate) {
        newErrors.bookingDate = 'La date est requise'
      } else if (!isValidBookingDate(formData.bookingDate)) {
        newErrors.bookingDate = 'Vous devez réserver au moins 3 jours avant la date de l&apos;évènement'
      }
      if (!formData.budget || parseFloat(formData.budget) <= 0) {
        newErrors.budget = 'Le budget est requis et doit être supérieur à 0'
      }
      if (!formData.courseTopic.trim()) {
        newErrors.courseTopic = t('booking.errors.courseTopicRequired')
      }
    } else if (formData.serviceType === 'mise_en_demeure') {
      if (formData.selectedDates.length === 0) {
        newErrors.selectedDates = 'Veuillez sélectionner au moins une date'
      }
      // Vérifier que chaque date a au moins une option de repas
      const datesWithoutMeals = formData.selectedDates.filter(date => 
        !formData.mealOptionsByDate[date] || formData.mealOptionsByDate[date].length === 0
      )
      if (datesWithoutMeals.length > 0) {
        newErrors.mealOptions = 'Veuillez sélectionner au moins une option de repas pour chaque date'
      }
      if (!formData.budget || parseFloat(formData.budget) <= 0) {
        newErrors.budget = 'Le budget global est requis et doit être supérieur à 0'
      }
    }

    if (formData.hasAllergies && !formData.allergiesDetails.trim()) {
      newErrors.allergiesDetails = t('booking.errors.allergiesDetailsRequired')
    }

    if (!acceptedTerms) {
      newErrors.terms = t('booking.errors.termsRequired')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    if (validatePage1()) {
      setCurrentPage(2)
    }
  }

  const handleBack = () => {
    setCurrentPage(1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validatePage2()) {
      return
    }

    setLoading(true)

    try {
      // Exclure emailConfirm du body (c'est juste pour validation)
      const { emailConfirm, periodStartDate, periodEndDate, ...bookingData } = formData
      
      // Préparer les données selon le type de service
      let periodDays = null
      let budget = null
      let courseTopic = null
      let selectedDates = null
      let mealOptions = null
      let totalPrice = null

      if (formData.serviceType === 'cours_cuisine') {
        budget = parseFloat(formData.budget) || null
        courseTopic = formData.courseTopic || null
      } else if (formData.serviceType === 'mise_en_demeure') {
        selectedDates = formData.selectedDates.length > 0 ? formData.selectedDates : null
        // Convertir mealOptionsByDate en format pour l'API
        // Structure: { date1: ['pdj', 'dejeuner'], date2: ['diner'], ... }
        mealOptions = Object.keys(formData.mealOptionsByDate).length > 0 ? formData.mealOptionsByDate : null
        totalPrice = parseFloat(formData.budget) || null
        budget = null // Ne pas utiliser budget pour mise_en_demeure, utiliser totalPrice
      }
      
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chefId: chef.id,
          ...bookingData,
          periodDays,
          budget,
          courseTopic,
          selectedDates,
          mealOptions,
          totalPrice,
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

  const guestsOptions = Array.from({ length: 60 }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1} ${i === 0 ? t('booking.guest') : t('booking.guests_plural')}`,
  }))

  const menuOptions = menus.map(menu => ({
    value: menu.id,
    label: `${menu.name}${menu.price ? ` - ${menu.price}€` : ''}`,
  }))

  // Calculer la période à partir des dates
  const calculatePeriodDays = (startDate: string, endDate: string): string => {
    if (!startDate || !endDate) return ''
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // +1 pour inclure le jour de début
    if (diffDays <= 2) return '1-2'
    if (diffDays === 3) return '3'
    return '4+'
  }

  // Composant DatePickerMulti pour sélectionner plusieurs dates
  const DatePickerMulti = ({ 
    selectedDates, 
    onDatesChange, 
    minDate 
  }: { 
    selectedDates: string[]
    onDatesChange: (dates: string[]) => void
    minDate: string
  }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [viewYear, setViewYear] = useState(new Date().getFullYear())
    const [viewMonth, setViewMonth] = useState(new Date().getMonth())

    const toggleDate = (date: Date) => {
      const dateStr = getLocalDateString(date)
      if (selectedDates.includes(dateStr)) {
        onDatesChange(selectedDates.filter(d => d !== dateStr))
      } else {
        onDatesChange([...selectedDates, dateStr].sort())
      }
    }

    const isDateSelected = (date: Date) => {
      const dateStr = getLocalDateString(date)
      return selectedDates.includes(dateStr)
    }

    const isDateDisabled = (date: Date) => {
      const min = new Date(minDate)
      min.setHours(0, 0, 0, 0)
      const checkDate = new Date(date)
      checkDate.setHours(0, 0, 0, 0)
      return checkDate < min
    }

    const getDaysInMonth = (year: number, month: number) => {
      return new Date(year, month + 1, 0).getDate()
    }

    const getFirstDayOfMonth = (year: number, month: number) => {
      return new Date(year, month, 1).getDay()
    }

    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
    const days = []

    // Jours du mois précédent (pour remplir la première semaine)
    const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1)
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push(null)
    }

    // Jours du mois actuel
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewYear, viewMonth, day)
      days.push(date)
    }

    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

    const goToPreviousMonth = () => {
      if (viewMonth === 0) {
        setViewMonth(11)
        setViewYear(viewYear - 1)
      } else {
        setViewMonth(viewMonth - 1)
      }
    }

    const goToNextMonth = () => {
      if (viewMonth === 11) {
        setViewMonth(0)
        setViewYear(viewYear + 1)
      } else {
        setViewMonth(viewMonth + 1)
      }
    }

    return (
      <div className="border-2 border-gray-200 rounded-lg p-4 bg-white">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-lg font-semibold text-black">
            {monthNames[viewMonth]} {viewYear}
          </h3>
          <button
            type="button"
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="aspect-square" />
            }
            const isSelected = isDateSelected(date)
            const isDisabled = isDateDisabled(date)
            return (
              <button
                key={getLocalDateString(date)}
                type="button"
                onClick={() => !isDisabled && toggleDate(date)}
                disabled={isDisabled}
                className={`
                  aspect-square rounded-lg text-sm font-medium transition-all
                  ${isSelected 
                    ? 'bg-[#FBCF03] text-black font-semibold' 
                    : isDisabled
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-black hover:bg-gray-100'
                  }
                `}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>
        {selectedDates.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-600 mb-2">Dates sélectionnées ({selectedDates.length}) :</p>
            <div className="flex flex-wrap gap-2">
              {selectedDates.map(date => (
                <span
                  key={date}
                  className="px-2 py-1 bg-[#FBCF03] text-black text-xs rounded-full font-medium"
                >
                  {formatDateForDisplay(date, locale === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const serviceTypeOptions = [
    { value: 'repas_domicile', label: t('booking.serviceType.repas_domicile') },
    { value: 'cours_cuisine', label: t('booking.serviceType.cours_cuisine') },
    { value: 'mise_en_demeure', label: t('booking.serviceType.mise_en_demeure') },
  ]

  // Page 1: Informations personnelles + Sélection du type de service
  if (currentPage === 1) {
    return (
      <form onSubmit={handleNext} className="space-y-6">
        <div className="bg-white border-2 border-gray-200 rounded-lg p-6 space-y-6">
          <h2 className="text-2xl font-bold text-black mb-4">{t('booking.personalInfo')}</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={`${t('booking.firstName')} *`}
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
              label={`${t('booking.email')} *`}
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              required
            />
            <Input
              label={`${t('booking.confirmEmail')} *`}
              type="email"
              name="emailConfirm"
              value={formData.emailConfirm}
              onChange={handleChange}
              error={errors.emailConfirm}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <h2 className="text-2xl font-bold text-black mb-4">{t('booking.serviceTypeLabel')}</h2>
          
          <div className="space-y-3">
            {serviceTypeOptions.map((option) => (
              <label
                key={option.value}
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  formData.serviceType === option.value
                    ? 'border-[#FBCF03] bg-yellow-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="serviceType"
                  value={option.value}
                  checked={formData.serviceType === option.value}
                  onChange={handleChange}
                  className="mr-3 w-4 h-4 text-[#FBCF03] focus:ring-[#FBCF03]"
                />
                <span className="text-lg font-medium">{option.label}</span>
              </label>
            ))}
          </div>
          {errors.serviceType && (
            <p className="text-red-500 text-sm">{errors.serviceType}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button 
            type="submit" 
            className="min-w-[200px] md:min-w-[200px] w-full md:w-auto rounded-full bg-[#FBCF03] text-black hover:bg-[#E6BA00] font-semibold py-4 px-8 text-lg transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {t('booking.next')}
          </Button>
        </div>
      </form>
    )
  }

  // Page 2: Détails selon le type de service
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white border-2 border-gray-200 rounded-lg p-6 space-y-6">
        <h2 className="text-2xl font-bold text-black mb-4">{t('booking.reservationDetails')}</h2>
        
        {formData.serviceType === 'repas_domicile' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="w-full min-w-0 overflow-hidden">
                <Input
                  label={`${t('booking.date')} *`}
                  type="date"
                  name="bookingDate"
                  value={formData.bookingDate}
                  onChange={handleChange}
                  error={errors.bookingDate}
                  min={getMinDate()}
                  required
                  className="w-full min-w-0 max-w-full"
                />
              </div>
              <Select
                label={`${t('booking.mealTime')} *`}
                name="mealTime"
                value={formData.mealTime}
                onChange={handleChange}
                options={[
                  { value: 'dejeuner', label: t('booking.mealTimeLunch') },
                  { value: 'diner', label: t('booking.mealTimeDinner') }
                ]}
                error={errors.mealTime}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label={`${t('booking.guests')} *`}
                name="guestsCount"
                value={formData.guestsCount}
                onChange={handleChange}
                options={guestsOptions}
                error={errors.guestsCount}
              />
            </div>

            <div className="w-full">
              <Input
                label={t('booking.children')}
                type="number"
                name="childrenCount"
                value={formData.childrenCount}
                onChange={handleChange}
                error={errors.childrenCount}
                min="0"
                max={formData.guestsCount}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500">
                Indiquez le nombre d'enfants parmi les convives. Par défaut, tous les convives sont considérés comme adultes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={`${t('booking.city')} *`}
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
                  label={t('booking.menu')}
                  name="menuId"
                  value={formData.menuId}
                  onChange={handleChange}
                  options={menuOptions}
                />
              </div>
            )}
          </>
        )}

        {formData.serviceType === 'cours_cuisine' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="w-full min-w-0 overflow-hidden">
                <Input
                  label={`${t('booking.date')} *`}
                  type="date"
                  name="bookingDate"
                  value={formData.bookingDate}
                  onChange={handleChange}
                  error={errors.bookingDate}
                  min={getMinDate()}
                  required
                  className="w-full min-w-0 max-w-full"
                />
              </div>
              <Select
                label={`${t('booking.guests')} *`}
                name="guestsCount"
                value={formData.guestsCount}
                onChange={handleChange}
                options={guestsOptions}
                error={errors.guestsCount}
              />
            </div>

            <div className="w-full">
              <Input
                label={t('booking.children')}
                type="number"
                name="childrenCount"
                value={formData.childrenCount}
                onChange={handleChange}
                error={errors.childrenCount}
                min="0"
                max={formData.guestsCount}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500">
                Indiquez le nombre d'enfants parmi les convives. Par défaut, tous les convives sont considérés comme adultes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={`${t('booking.city')} *`}
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

            <div className="w-full">
              <Input
                label={`${t('booking.budgetGlobal')} *`}
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                error={errors.budget}
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('booking.budgetHint')}
              </p>
            </div>

            <div className="w-full">
              <Textarea
                label={`${t('booking.courseTopic')} *`}
                name="courseTopic"
                value={formData.courseTopic}
                onChange={handleChange}
                error={errors.courseTopic}
                placeholder="Ex: Techniques de base, Cuisine italienne, Pâtisserie..."
                rows={4}
                required
              />
            </div>
          </>
        )}

        {formData.serviceType === 'mise_en_demeure' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label={`${t('booking.guests')} *`}
                name="guestsCount"
                value={formData.guestsCount}
                onChange={handleChange}
                options={guestsOptions}
                error={errors.guestsCount}
              />
            </div>

            <div className="w-full">
              <Input
                label={t('booking.children')}
                type="number"
                name="childrenCount"
                value={formData.childrenCount}
                onChange={handleChange}
                error={errors.childrenCount}
                min="0"
                max={formData.guestsCount}
                placeholder="0"
              />
              <p className="mt-1 text-xs text-gray-500">
                Indiquez le nombre d'enfants parmi les convives. Par défaut, tous les convives sont considérés comme adultes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={`${t('booking.city')} *`}
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

            {/* Calendrier multi-dates */}
            <div className="w-full">
              <label className="block text-sm font-medium text-black mb-2">
                {t('booking.selectedDates')} *
              </label>
              <DatePickerMulti
                selectedDates={formData.selectedDates}
                onDatesChange={(dates) => {
                  setFormData(prev => {
                    // Nettoyer les options de repas pour les dates désélectionnées
                    const newMealOptionsByDate: Record<string, ('pdj' | 'dejeuner' | 'diner')[]> = {}
                    dates.forEach(date => {
                      if (prev.mealOptionsByDate[date]) {
                        newMealOptionsByDate[date] = prev.mealOptionsByDate[date]
                      }
                    })
                    return { ...prev, selectedDates: dates, mealOptionsByDate: newMealOptionsByDate }
                  })
                }}
                minDate={getMinDate()}
              />
              {errors.selectedDates && (
                <p className="mt-1 text-sm text-red-500">{errors.selectedDates}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Sélectionnez les dates pour votre chef à demeure.
              </p>
            </div>

            {/* Options de repas par date */}
            {formData.selectedDates.length > 0 && (
              <div className="w-full">
                <label className="block text-sm font-medium text-black mb-3">
                  {t('booking.mealOptionsPerDay')} *
                </label>
                <div className="space-y-4">
                  {formData.selectedDates.map((date) => {
                    const dateLabel = formatDateForDisplay(date, locale === 'en' ? 'en-US' : 'fr-FR', { 
                      weekday: 'long', 
                      day: 'numeric', 
                      month: 'long',
                      year: 'numeric'
                    })
                    const currentMealOptions = formData.mealOptionsByDate[date] || []
                    
                    return (
                      <div key={date} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h4 className="text-sm font-semibold text-black mb-3 capitalize">
                          {dateLabel}
                        </h4>
                        <div className="space-y-2">
                          {(['pdj', 'dejeuner', 'diner'] as const).map((option) => (
                            <label key={option} className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={currentMealOptions.includes(option)}
                                onChange={(e) => {
                                  setFormData(prev => {
                                    const currentOptions = prev.mealOptionsByDate[date] || []
                                    let newOptions: ('pdj' | 'dejeuner' | 'diner')[]
                                    
                                    if (e.target.checked) {
                                      newOptions = [...currentOptions, option]
                                    } else {
                                      newOptions = currentOptions.filter(o => o !== option)
                                    }
                                    
                                    return {
                                      ...prev,
                                      mealOptionsByDate: {
                                        ...prev.mealOptionsByDate,
                                        [date]: newOptions
                                      }
                                    }
                                  })
                                }}
                                className="w-4 h-4 text-[#FBCF03] border-gray-300 rounded focus:ring-[#FBCF03]"
                              />
                              <span className="text-sm text-black">
                                {option === 'pdj' ? t('mealDetails.breakfast') : option === 'dejeuner' ? t('mealDetails.lunch') : t('mealDetails.dinner')}
                              </span>
                            </label>
                          ))}
                        </div>
                        {currentMealOptions.length === 0 && (
                          <p className="mt-2 text-xs text-amber-600">
                            ⚠️ Sélectionnez au moins un repas pour ce jour
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
                {errors.mealOptions && (
                  <p className="mt-2 text-sm text-red-500">{errors.mealOptions}</p>
                )}
                <p className="mt-3 text-xs text-gray-500">
                  Sélectionnez les repas souhaités pour chaque jour sélectionné.
                </p>
              </div>
            )}

            <div className="w-full">
              <Input
                label="Budget global pour la période (€) *"
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                error={errors.budget}
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('booking.budgetGlobalPeriodHint')}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-lg p-6 space-y-6">
        <h2 className="text-2xl font-bold text-black mb-4">{t('booking.additionalInfo')}</h2>
        
        {formData.serviceType === 'repas_domicile' && (
          <Checkbox
            label={t('booking.hasAllergies')}
            name="hasAllergies"
            checked={formData.hasAllergies}
            onChange={handleChange}
          />
        )}

        {formData.serviceType === 'repas_domicile' && formData.hasAllergies && (
          <Textarea
            label={`${t('booking.allergiesDetails')} *`}
            name="allergiesDetails"
            value={formData.allergiesDetails}
            onChange={handleChange}
            error={errors.allergiesDetails}
            rows={3}
            required={formData.hasAllergies}
          />
        )}

        <Textarea
          label={t('booking.notes')}
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={4}
          placeholder={t('booking.notesPlaceholder')}
        />
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-lg p-4 sm:p-6">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            name="acceptedTerms"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="w-5 h-5 sm:w-6 sm:h-6 mt-0.5 border-2 border-gray-300 rounded focus:outline-none focus:border-[#FBCF03] transition-colors cursor-pointer flex-shrink-0"
          />
          <span className="text-sm sm:text-base text-gray-700 leading-relaxed flex-1 pt-0.5">
            <span className="whitespace-normal">
              {t('booking.acceptTerms')}{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  setShowTermsPopup(true)
                }}
                className="text-[#FBCF03] underline hover:text-[#E6BA00] font-semibold transition-colors inline"
              >
                {t('booking.termsAndConditions')}
              </button>
              {' '}*
            </span>
          </span>
        </label>
        {errors.terms && (
          <p className="text-red-500 text-sm mt-3 ml-8 sm:ml-9">{errors.terms}</p>
        )}
      </div>

      {errors.submit && (
        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
          <p className="text-red-500">{errors.submit}</p>
        </div>
      )}

      <div className="flex flex-col items-center gap-4">
        <Button 
          type="submit" 
          disabled={loading} 
          className="w-full sm:w-auto min-w-[200px] rounded-full bg-[#FBCF03] text-black hover:bg-[#E6BA00] font-semibold py-4 px-8 text-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? t('common.loading') : t('booking.submit')}
        </Button>
        <button
          type="button"
          onClick={handleBack}
          className="text-gray-600 hover:text-black underline text-sm transition-colors"
        >
          {t('booking.back')}
        </button>
      </div>

      {/* Popup des termes et conditions */}
      {mounted && showTermsPopup && createPortal(
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm p-4 z-50"
          onClick={() => setShowTermsPopup(false)}
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'auto',
            zIndex: 9999
          }}
        >
          <div 
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              margin: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div className="p-6 sm:p-8 flex-1">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-black">{t('booking.termsTitle')}</h2>
                <button
                  onClick={() => setShowTermsPopup(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label={t('common.close')}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Contenu */}
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p className="text-base">
                  {t('booking.termsIntro')}
                </p>
                
                <div className="space-y-3">
                  <h3 className="font-semibold text-black text-lg">{t('booking.dataUsage')}</h3>
                  <p className="text-base">
                    {t('booking.dataUsageText')}
                  </p>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-black text-lg">{t('booking.dataProtection')}</h3>
                  <p className="text-base">
                    {t('booking.dataProtectionText')}
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>{t('booking.dataUsageList1')}</li>
                    <li>{t('booking.dataUsageList2')}</li>
                    <li>{t('booking.dataUsageList3')}</li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h3 className="font-semibold text-black text-lg">{t('booking.yourRights')}</h3>
                  <p className="text-base">
                    {t('booking.yourRightsText')}
                  </p>
                </div>

                <div className="bg-[#FBCF03]/10 border-l-4 border-[#FBCF03] p-4 rounded-lg mt-6">
                  <p className="text-sm font-medium text-black">
                    {t('booking.termsAcceptance')}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer avec CTA */}
            <div className="p-6 sm:p-8 border-t border-gray-200">
              <Button
                onClick={() => setShowTermsPopup(false)}
                className="w-full rounded-full bg-[#FBCF03] text-black hover:bg-[#E6BA00] font-semibold py-4 px-8 text-lg transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {t('booking.understood')}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </form>
  )
}

