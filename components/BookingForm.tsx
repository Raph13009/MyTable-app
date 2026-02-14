'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import Stepper, { Step } from '@/components/Stepper'
import { Database } from '@/types/database'
import { useTranslation } from '@/hooks/useTranslation'
import { 
  getLocalDateString, 
  formatDateForDisplay, 
  getMinBookingDate, 
  isValidBookingDate 
} from '@/lib/dateUtils'
import { fetchWithTimeout, generateIdempotencyToken } from '@/lib/utils'

type Chef = Database['public']['Tables']['chefs']['Row']
type Menu = Database['public']['Tables']['menus']['Row']
type NearbyChef = Pick<Chef, 'id' | 'name' | 'profile_picture' | 'slug' | 'cuisine_style' | 'dish_photos' | 'min_guests' | 'max_guests'>

type ServiceType = 'repas_domicile' | 'cours_cuisine' | 'mise_en_demeure'

interface BookingFormProps {
  chef: Chef
  chefName: string
  menus: Menu[]
  nearbyChefs?: NearbyChef[]
}

type DatePickerMultiProps = {
  selectedDates: string[]
  onDatesChange: (dates: string[]) => void
  minDate: string
  locale: string
}

// Définir le sélecteur multi-dates en dehors de BookingForm pour éviter de réinitialiser le mois affiché à chaque render
const DatePickerMulti = ({ selectedDates, onDatesChange, minDate, locale }: DatePickerMultiProps) => {
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

export default function BookingForm({ chef, chefName, menus, nearbyChefs = [] }: BookingFormProps) {
  const { t, locale } = useTranslation()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showTermsPopup, setShowTermsPopup] = useState(false)
  const [showNearbyChefPopup, setShowNearbyChefPopup] = useState(false)
  const [selectedNearbyChef, setSelectedNearbyChef] = useState<NearbyChef | null>(null)
  const [showDishLightbox, setShowDishLightbox] = useState(false)
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [submissionError, setSubmissionError] = useState<{ message: string; canRetry: boolean } | null>(null)
  const [idempotencyToken, setIdempotencyToken] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [showGlobalError, setShowGlobalError] = useState(false)
  const [globalErrorMessage, setGlobalErrorMessage] = useState<string>('')
  const [isStepVisible, setIsStepVisible] = useState(true)
  const [isGuestsTotalAnimating, setIsGuestsTotalAnimating] = useState(false)
  const globalErrorRef = useRef<HTMLDivElement>(null)
  const chefPostalPrefix = (chef.postal_code || '').replace(/\D/g, '').slice(0, 2)

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
    shareWithNearbyChefs: false,
    nearbyChefIds: [] as string[],
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
      shareWithNearbyChefs: false,
      nearbyChefIds: [],
    })
  }, [chef.id, menus])

  // Scroll en haut lors du changement d'étape
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentPage])

  useEffect(() => {
    setIsStepVisible(false)
    const timer = setTimeout(() => setIsStepVisible(true), 30)
    return () => clearTimeout(timer)
  }, [currentPage])

  useEffect(() => {
    setIsGuestsTotalAnimating(true)
    const timer = setTimeout(() => setIsGuestsTotalAnimating(false), 150)
    return () => clearTimeout(timer)
  }, [formData.guestsCount, formData.childrenCount])

  // Pour le portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Bloquer le scroll du body quand la popup est ouverte
  useEffect(() => {
    if (showTermsPopup || showNearbyChefPopup || showDishLightbox) {
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
  }, [showTermsPopup, showNearbyChefPopup, showDishLightbox])

  const openDishLightbox = (photos: string[], startIndex: number) => {
    setLightboxPhotos(photos)
    setLightboxIndex(startIndex)
    setShowDishLightbox(true)
  }

  const showPrevDishPhoto = () => {
    if (lightboxPhotos.length <= 1) return
    setLightboxIndex(prev => (prev - 1 + lightboxPhotos.length) % lightboxPhotos.length)
  }

  const showNextDishPhoto = () => {
    if (lightboxPhotos.length <= 1) return
    setLightboxIndex(prev => (prev + 1) % lightboxPhotos.length)
  }

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
    
    // Masquer l'erreur globale si l'utilisateur modifie un champ
    if (showGlobalError) {
      setShowGlobalError(false)
    }
  }

  // Calculer la date minimum (J+3)
  const getMinDate = () => {
    return getMinBookingDate()
  }

  const validatePage1 = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.serviceType) {
      newErrors.serviceType = t('booking.errors.serviceTypeRequired')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validatePage2 = () => {
    const newErrors: Record<string, string> = {}
    const missingFields: string[] = []

    if (!formData.city.trim()) {
      newErrors.city = 'La ville est requise'
      missingFields.push('Ville')
    }
    if (!formData.postalCode.trim()) {
      newErrors.postalCode = 'Le code postal est requis'
      missingFields.push('Code postal')
    }
    if (!formData.guestsCount || parseInt(formData.guestsCount) < 1) {
      newErrors.guestsCount = t('booking.errors.guestsCountMin')
      missingFields.push('Nombre de convives')
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
        missingFields.push('Date')
      } else if (!isValidBookingDate(formData.bookingDate)) {
        newErrors.bookingDate = 'Vous devez réserver au moins 3 jours avant la date de l&apos;évènement'
      }
      if (!formData.mealTime) {
        newErrors.mealTime = 'Le moment du repas est requis'
        missingFields.push('Moment du repas')
      }
    } else if (formData.serviceType === 'cours_cuisine') {
      if (!formData.bookingDate) {
        newErrors.bookingDate = 'La date est requise'
        missingFields.push('Date')
      } else if (!isValidBookingDate(formData.bookingDate)) {
        newErrors.bookingDate = 'Vous devez réserver au moins 3 jours avant la date de l&apos;évènement'
      }
      const isValidBudget = cookingClassBudgetOptions.some((option) => option.value === formData.budget)
      if (!formData.budget || !isValidBudget) {
        newErrors.budget = 'Veuillez sélectionner un budget'
        missingFields.push('Budget global')
      }
      if (!formData.courseTopic.trim()) {
        newErrors.courseTopic = t('booking.errors.courseTopicRequired')
        missingFields.push('Sujet du cours')
      }
    } else if (formData.serviceType === 'mise_en_demeure') {
      if (formData.selectedDates.length === 0) {
        newErrors.selectedDates = 'Veuillez sélectionner au moins une date'
        missingFields.push('Dates')
      }
      // Vérifier que chaque date a au moins une option de repas
      const datesWithoutMeals = formData.selectedDates.filter(date => 
        !formData.mealOptionsByDate[date] || formData.mealOptionsByDate[date].length === 0
      )
      if (datesWithoutMeals.length > 0) {
        newErrors.mealOptions = 'Veuillez sélectionner au moins une option de repas pour chaque date'
        missingFields.push('Options de repas')
      }
      const isValidBudget = homeChefBudgetOptions.some((option) => option.value === formData.budget)
      if (!formData.budget || !isValidBudget) {
        newErrors.budget = 'Veuillez sélectionner un budget'
        missingFields.push('Budget global')
      }
    }

    // Créer un message d'erreur détaillé
    if (missingFields.length > 0) {
      const errorMessage = `Attention : champs manquants. Veuillez remplir : ${missingFields.join(', ')}`
      setGlobalErrorMessage(errorMessage)
    } else {
      setGlobalErrorMessage('')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validatePage3 = () => {
    const newErrors: Record<string, string> = {}
    const missingFields: string[] = []

    if (formData.serviceType === 'repas_domicile' && formData.hasAllergies && !formData.allergiesDetails.trim()) {
      newErrors.allergiesDetails = t('booking.errors.allergiesDetailsRequired')
      missingFields.push('Détails des allergies')
    }

    if (formData.shareWithNearbyChefs) {
      if (formData.nearbyChefIds.length === 0) {
        newErrors.nearbyChefIds = 'Veuillez sélectionner au moins un chef qualifié à proximité'
        missingFields.push('Chefs qualifiés à proximité')
      } else if (formData.nearbyChefIds.length > 3) {
        newErrors.nearbyChefIds = 'Vous pouvez sélectionner 3 chefs maximum'
      }
    }

    if (missingFields.length > 0) {
      const errorMessage = `Attention : champs manquants. Veuillez remplir : ${missingFields.join(', ')}`
      setGlobalErrorMessage(errorMessage)
    } else {
      setGlobalErrorMessage('')
    }

    setErrors(prev => ({ ...prev, ...newErrors }))
    return Object.keys(newErrors).length === 0
  }

  const validatePage4 = () => {
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
    if (!acceptedTerms) newErrors.terms = t('booking.errors.termsRequired')

    setErrors(prev => ({ ...prev, ...newErrors }))
    return Object.keys(newErrors).length === 0
  }

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    if (currentPage === 1 && validatePage1()) {
      setCurrentPage(2)
      return
    }
    if (currentPage === 2 && validatePage2()) {
      setCurrentPage(3)
      return
    }
    if (currentPage === 3 && validatePage3()) {
      setShowGlobalError(false)
      setCurrentPage(4)
      return
    }

    if (currentPage === 3) {
      setShowGlobalError(true)
      setTimeout(() => {
        globalErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }

  const handleBack = () => {
    setCurrentPage(prev => Math.max(1, prev - 1))
  }

  const toggleNearbyChef = (chefId: string, checked: boolean) => {
    setFormData(prev => {
      const current = prev.nearbyChefIds
      if (checked) {
        if (current.includes(chefId) || current.length >= 3) {
          return prev
        }
        return { ...prev, nearbyChefIds: [...current, chefId] }
      }
      return { ...prev, nearbyChefIds: current.filter(id => id !== chefId) }
    })

    if (errors.nearbyChefIds) {
      setErrors(prev => {
        const nextErrors = { ...prev }
        delete nextErrors.nearbyChefIds
        return nextErrors
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent, isRetry: boolean = false) => {
    e.preventDefault()

    if (!validatePage1()) {
      setCurrentPage(1)
      return
    }

    if (!validatePage2()) {
      setCurrentPage(2)
      return
    }

    if (!validatePage3()) {
      setCurrentPage(3)
      return
    }

    if (!validatePage4()) {
      setCurrentPage(4)
      return
    }

    // Masquer l'erreur globale si la validation passe
    setShowGlobalError(false)

    // Générer un token d'idempotence si première soumission
    if (!isRetry && !idempotencyToken) {
      const token = generateIdempotencyToken()
      setIdempotencyToken(token)
      setRetryCount(0)
    }

    setLoading(true)
    setSubmissionError(null)

    try {
      console.log('[BookingForm] Starting booking submission', {
        serviceType: formData.serviceType,
        idempotencyToken: idempotencyToken,
        isRetry,
        retryCount,
        timestamp: new Date().toISOString(),
      })

      // Exclure emailConfirm du body (c'est juste pour validation)
      const {
        emailConfirm,
        periodStartDate,
        periodEndDate,
        shareWithNearbyChefs,
        nearbyChefIds,
        ...bookingData
      } = formData
      
      // Préparer les données selon le type de service
      let periodDays = null
      let budget = null
      let courseTopic = null
      let selectedDates = null
      let mealOptions = null
      let totalPrice = null

      if (formData.serviceType === 'cours_cuisine') {
        budget = formData.budget || null
        courseTopic = formData.courseTopic || null
      } else if (formData.serviceType === 'mise_en_demeure') {
        selectedDates = formData.selectedDates.length > 0 ? formData.selectedDates : null
        // Convertir mealOptionsByDate en format pour l'API
        // Structure: { date1: ['pdj', 'dejeuner'], date2: ['diner'], ... }
        mealOptions = Object.keys(formData.mealOptionsByDate).length > 0 ? formData.mealOptionsByDate : null
        totalPrice = formData.budget || null
        budget = null // Ne pas utiliser budget pour mise_en_demeure, utiliser totalPrice
      }

      const requestBody = {
        chefId: chef.id,
        ...bookingData,
        periodDays,
        budget,
        courseTopic,
        selectedDates,
        mealOptions,
        totalPrice,
        fallbackEnabled: shareWithNearbyChefs,
        fallbackChefIds: shareWithNearbyChefs ? nearbyChefIds : [],
        idempotencyToken, // Token pour éviter les doublons
      }

      console.log('[BookingForm] Sending booking request', {
        hasIdempotencyToken: !!idempotencyToken,
        bodyKeys: Object.keys(requestBody),
      })
      
      // Utiliser fetchWithTimeout avec timeout de 30 secondes
      const response = await fetchWithTimeout(
        '/api/bookings',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
        30000 // 30 secondes timeout
      )

      console.log('[BookingForm] Response received', {
        status: response.status,
        ok: response.ok,
        timestamp: new Date().toISOString(),
      })

      const data = await response.json()

      if (!response.ok) {
        // Vérifier si c'est une erreur de doublon (idempotence)
        if (response.status === 409 || data.error?.includes('déjà') || data.error?.includes('already')) {
          console.log('[BookingForm] Duplicate booking detected, redirecting to confirmation')
          // Si c'est un doublon, considérer comme succès et rediriger
          router.push('/booking-confirmation')
          return
        }
        throw new Error(data.error || 'Une erreur est survenue')
      }

      console.log('[BookingForm] Booking created successfully', {
        bookingRequestId: data.bookingRequestId,
        conversationId: data.conversationId,
      })

      // Rediriger vers une page de confirmation
      router.push('/booking-confirmation')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue'
      const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('Timeout')
      const isNetworkError = errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')
      
      console.error('[BookingForm] Error submitting booking:', {
        error: errorMessage,
        isTimeout,
        isNetworkError,
        retryCount,
        timestamp: new Date().toISOString(),
      })

      // Déterminer si on peut retry (timeout ou erreur réseau, max 2 retries)
      const canRetry = (isTimeout || isNetworkError) && retryCount < 2

      setSubmissionError({
        message: isTimeout 
          ? 'La requête a pris trop de temps. Veuillez réessayer.'
          : isNetworkError
          ? 'Erreur de connexion. Vérifiez votre connexion internet et réessayez.'
          : errorMessage,
        canRetry,
      })

      setErrors({ submit: errorMessage })
      
      if (canRetry) {
        setRetryCount(prev => prev + 1)
      } else {
        // Après 2 retries, réinitialiser pour permettre un nouveau submit
        setIdempotencyToken(null)
        setRetryCount(0)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = (e: React.FormEvent) => {
    e.preventDefault()
    handleSubmit(e, true)
  }

  const menuOptions = menus.map(menu => ({
    value: menu.id,
    label: `${menu.name}${menu.price ? ` - ${menu.price}€` : ''}`,
  }))
  const cookingClassBudgetOptions = [
    { value: 'lt_40', label: '-40€/participant' },
    { value: '40', label: '40€/participant' },
    { value: '50', label: '50€/participant' },
    { value: '60', label: '60€/participant' },
    { value: '70', label: '70€/participant' },
    { value: 'gt_70', label: '+70€/participant' },
  ]
  const homeChefBudgetOptions = [
    { value: 'lt_200', label: '-200€/jour' },
    { value: '200', label: '200€/jour' },
    { value: '250', label: '250€/jour' },
    { value: '300', label: '300€/jour' },
    { value: '350', label: '350€/jour' },
    { value: '400', label: '400€/jour' },
    { value: 'gt_400', label: '+400€/jour' },
  ]

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

  const serviceTypeOptions = [
    { value: 'repas_domicile', label: t('booking.serviceType.repas_domicile') },
    { value: 'cours_cuisine', label: t('booking.serviceType.cours_cuisine') },
    { value: 'mise_en_demeure', label: t('booking.serviceType.mise_en_demeure') },
  ]

  const stepLabels = [
    t('booking.formStepper.serviceType'),
    t('booking.formStepper.serviceDetails'),
    t('booking.formStepper.additionalInfo'),
    t('booking.formStepper.personalInfo'),
  ]
  const totalSteps = stepLabels.length

  const goToStep = (targetStep: number) => {
    if (targetStep < 1 || targetStep > totalSteps) return
    if (targetStep > currentPage) return
    setCurrentPage(targetStep)
  }

  const renderStepper = () => (
    <div className="px-4 sm:px-6">
      <Stepper
        initialStep={currentPage}
        onStepChange={(step) => goToStep(step)}
        disableStepIndicators
        hideContent
        hideFooter
        containerClassName="!min-h-0 !p-0 !justify-start !items-stretch !aspect-auto -mt-2 sm:-mt-2"
        cardClassName="!max-w-4xl !w-full !rounded-none !shadow-none !border-0 !bg-transparent"
        stepCircleContainerClassName="!border-0 !shadow-none !bg-transparent"
        stepContainerClassName="!w-full !px-0 !pt-2 sm:!pt-4 !pb-0 !items-center"
        renderStepIndicator={({ step, currentStep: stepperStep, onStepClick }: { step: number; currentStep: number; onStepClick: (clicked: number) => void }) => {
          const label = stepLabels[step - 1]
          const isCompleted = step < stepperStep
          const isActive = step === stepperStep
          const isClickable = step <= currentPage

          return (
            <button
              type="button"
              onClick={() => {
                if (isClickable) onStepClick(step)
              }}
              disabled={!isClickable}
              aria-label={`${t('booking.formStepper.stepLabel')} ${step}: ${label}`}
              aria-current={isActive ? 'step' : undefined}
              className={`relative flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#E8BC00] ${
                isCompleted
                  ? 'bg-[#E8BC00] text-white'
                  : isActive
                  ? 'scale-105 border-2 border-[#E8BC00] bg-white text-[#C99D00] shadow-[0_0_0_3px_rgba(232,188,0,0.12)]'
                  : 'border border-neutral-300 bg-white text-neutral-400'
              } ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
            >
              {isCompleted ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
            </button>
          )
        }}
      >
        <Step />
        <Step />
        <Step />
        <Step />
      </Stepper>
    </div>
  )

  const renderGuestsModule = () => {
    const MAX_TOTAL_GUESTS = 60
    const totalGuestsRaw = parseInt(formData.guestsCount, 10)
    const childrenRaw = parseInt(formData.childrenCount, 10)
    const totalGuests = Number.isFinite(totalGuestsRaw) ? Math.max(1, totalGuestsRaw) : 1
    const children = Number.isFinite(childrenRaw) ? Math.max(0, childrenRaw) : 0
    const adults = Math.max(1, totalGuests - children)

    const updateComposition = (nextAdults: number, nextChildren: number) => {
      const safeAdults = Math.max(1, nextAdults)
      const safeChildren = Math.max(0, nextChildren)
      const nextTotal = safeAdults + safeChildren
      if (nextTotal > MAX_TOTAL_GUESTS) return
      setFormData((prev) => ({
        ...prev,
        guestsCount: String(nextTotal),
        childrenCount: String(safeChildren),
      }))
    }

    return (
      <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5 sm:p-5.5 space-y-5">
        <p className="text-sm font-semibold text-black">{t('booking.guests')} *</p>

        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[15px] text-[#111111]">{t('booking.adults')}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateComposition(adults - 1, children)}
                className="h-9 w-9 rounded-full border border-[#EAEAEA] bg-white text-[#111111] hover:bg-gray-50 active:scale-95 transition-all duration-150"
                aria-label="Réduire adultes"
              >
                -
              </button>
              <span className="min-w-[20px] text-center text-base font-medium text-black">{adults}</span>
              <button
                type="button"
                onClick={() => updateComposition(adults + 1, children)}
                className="h-9 w-9 rounded-full border border-[#EAEAEA] bg-white text-[#111111] hover:bg-gray-50 active:scale-95 transition-all duration-150"
                aria-label="Augmenter adultes"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[15px] text-[#111111]">{t('booking.children')}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateComposition(adults, children - 1)}
                className="h-9 w-9 rounded-full border border-[#EAEAEA] bg-white text-[#111111] hover:bg-gray-50 active:scale-95 transition-all duration-150"
                aria-label="Réduire enfants"
              >
                -
              </button>
              <span className="min-w-[20px] text-center text-base font-medium text-black">{children}</span>
              <button
                type="button"
                onClick={() => updateComposition(adults, children + 1)}
                className="h-9 w-9 rounded-full border border-[#EAEAEA] bg-white text-[#111111] hover:bg-gray-50 active:scale-95 transition-all duration-150"
                aria-label="Augmenter enfants"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div
          className={`flex items-center justify-between border-t border-[#EAEAEA] pt-3 leading-none transition-all duration-150 ease-out ${
            isGuestsTotalAnimating ? 'scale-[1.01] opacity-90' : 'scale-100 opacity-100'
          }`}
        >
          <p className="text-sm text-[#6B7280]">{t('booking.totalGuestsCompactLabel')}</p>
          <p className="text-base font-semibold text-black">{totalGuests}</p>
        </div>

        {(errors.guestsCount || errors.childrenCount) && (
          <div className="space-y-1">
            {errors.guestsCount && <p className="text-sm text-red-500">{errors.guestsCount}</p>}
            {errors.childrenCount && <p className="text-sm text-red-500">{errors.childrenCount}</p>}
          </div>
        )}
      </div>
    )
  }

  // Page 1: Type de service
  if (currentPage === 1) {
    return (
      <form onSubmit={handleNext} className="space-y-6 md:space-y-5 min-h-[70vh] flex flex-col">
        {renderStepper()}

        <div className="pt-1 md:pt-0 md:pb-1">
          <h1 className="text-2xl sm:text-3xl font-semibold mb-2" suppressHydrationWarning>
            {t('booking.title')}{' '}
            <span className="text-black underline decoration-[#FBCF03] decoration-2 underline-offset-4">
              {chefName}
            </span>
          </h1>
          <p className="text-sm sm:text-base text-neutral-600 md:mt-1.5" suppressHydrationWarning>
            {t('booking.subtitle')}
          </p>
        </div>

        <div className="p-1 md:px-0 md:py-1 space-y-6 md:space-y-6 flex-1">
          <h2 className="text-lg sm:text-xl md:text-[19px] font-semibold md:font-medium tracking-[0.02em] text-neutral-900 pt-1 md:pt-0">
            {t('booking.serviceTypeLabel')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-4">
            {serviceTypeOptions.map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-4 p-5 md:p-6 border rounded-xl md:rounded-2xl cursor-pointer transition-all duration-200 ${
                  formData.serviceType === option.value
                    ? 'border-yellow-500 bg-yellow-50/50 shadow-md'
                    : 'bg-white border-neutral-200 hover:border-neutral-300 hover:shadow-sm'
                }`}
              >
                <input
                  type="radio"
                  name="serviceType"
                  value={option.value}
                  checked={formData.serviceType === option.value}
                  onChange={handleChange}
                  className="w-4.5 h-4.5 text-[#FBCF03] focus:ring-[#FBCF03]"
                />
                <span className="text-[17px] sm:text-lg md:text-lg font-medium text-neutral-900">{option.label}</span>
              </label>
            ))}
          </div>
          {errors.serviceType && (
            <p className="text-red-500 text-sm -mt-2">{errors.serviceType}</p>
          )}
        </div>

        <div className="flex justify-end mt-auto pt-2 md:pt-1">
          <Button 
            type="submit" 
            className="w-full sm:w-auto min-w-[220px] rounded-full bg-[#FBCF03] text-black hover:brightness-105 font-semibold py-3.5 px-8 text-base transition-all duration-200 shadow-sm hover:shadow-md"
          >
            {t('booking.next')}
          </Button>
        </div>
      </form>
    )
  }

  // Pages 2, 3, 4
  return (
    <form onSubmit={currentPage === 4 ? handleSubmit : handleNext} className="space-y-4 min-h-[70vh] flex flex-col">
      {renderStepper()}

      {currentPage === 2 && (
      <div className={`px-1 sm:px-2 space-y-3 sm:space-y-4 ${formData.serviceType === 'repas_domicile' ? 'md:space-y-2' : ''} flex-1 transition-all duration-200 ease-out ${isStepVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
        <h2 className={`text-xl sm:text-2xl font-semibold text-black ${formData.serviceType === 'repas_domicile' ? 'mb-0 md:text-[22px]' : 'mb-1'}`}>{t('booking.reservationDetails')}</h2>
        
        {formData.serviceType === 'repas_domicile' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-2.5">
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
                  className="w-full min-w-0 max-w-full py-2.5 sm:py-3 md:py-2"
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
                className="py-2.5 sm:py-3 md:py-2"
              />
            </div>

            {renderGuestsModule()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-2.5">
              <Input
                label={`${t('booking.city')} *`}
                name="city"
                value={formData.city}
                onChange={handleChange}
                error={errors.city}
                required
                autoComplete="address-level2"
                inputMode="text"
                className="py-2.5 sm:py-3 md:py-2"
              />
              <Input
                label="Code postal *"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                error={errors.postalCode}
                required
                autoComplete="postal-code"
                inputMode="numeric"
                className="py-2.5 sm:py-3 md:py-2"
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
                  className="py-2.5 sm:py-3 md:py-2 focus:border-[#FBCF03] focus:ring-[#FBCF03]/40"
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
                  autoComplete="off"
                />
              </div>
            </div>
            {renderGuestsModule()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={`${t('booking.city')} *`}
                name="city"
                value={formData.city}
                onChange={handleChange}
                error={errors.city}
                required
                autoComplete="address-level2"
                inputMode="text"
              />
              <Input
                label="Code postal *"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                error={errors.postalCode}
                required
                autoComplete="postal-code"
                inputMode="numeric"
              />
            </div>

            <div className="w-full">
              <Select
                label={`${t('booking.budgetGlobal')} *`}
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                error={errors.budget}
                options={cookingClassBudgetOptions}
                placeholder="Sélectionner un budget"
                dropdownDirection="up"
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
            {renderGuestsModule()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={`${t('booking.city')} *`}
                name="city"
                value={formData.city}
                onChange={handleChange}
                error={errors.city}
                required
                autoComplete="address-level2"
                inputMode="text"
              />
              <Input
                label="Code postal *"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                error={errors.postalCode}
                required
                autoComplete="postal-code"
                inputMode="numeric"
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
                locale={locale}
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
              <Select
                label="Budget global pour la période (€) *"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                error={errors.budget}
                options={homeChefBudgetOptions}
                placeholder="Sélectionner un budget"
                dropdownDirection="up"
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('booking.budgetGlobalPeriodHint')}
              </p>
            </div>
          </>
        )}
      </div>
      )}

      {currentPage === 3 && (
      <div className={`px-1 sm:px-2 space-y-5 sm:space-y-6 flex-1 transition-all duration-200 ease-out ${isStepVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-[0.01em] text-neutral-900">{t('booking.additionalInfo')}</h2>
        
        {formData.serviceType === 'repas_domicile' && (
          <div className="pt-1">
            <label className="inline-flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="hasAllergies"
                checked={formData.hasAllergies}
                onChange={handleChange}
                className="h-5 w-5 rounded-md border border-neutral-300 accent-[#FBCF03] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBCF03]/40 focus-visible:ring-offset-1"
              />
              <span className="text-sm font-medium text-neutral-800">{t('booking.hasAllergies')}</span>
            </label>
          </div>
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
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3.5 focus:border-[#FBCF03] focus:ring-2 focus:ring-[#FBCF03]/20"
          />
        )}

        {nearbyChefs.length > 0 && chefPostalPrefix.length === 2 && (
          <div className="space-y-4">
            <label
              htmlFor="share-nearby-chefs"
              className={`group block cursor-pointer rounded-xl border px-5 py-4 shadow-sm transition-all duration-200 ${
                formData.shareWithNearbyChefs
                  ? 'border-[#FBCF03]/70 bg-[#FBCF03]/10 shadow-md'
                  : 'border-[#FBCF03]/30 bg-white hover:-translate-y-0.5 hover:border-[#FBCF03]/50 hover:shadow-md'
              }`}
            >
              <div className="flex items-start gap-4">
                <input
                  id="share-nearby-chefs"
                  type="checkbox"
                  checked={formData.shareWithNearbyChefs}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      shareWithNearbyChefs: e.target.checked,
                      nearbyChefIds: e.target.checked ? prev.nearbyChefIds : [],
                    }))
                  }
                  className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-md border border-neutral-300 accent-[#FBCF03] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBCF03]/40 focus-visible:ring-offset-1"
                  aria-describedby="share-nearby-chefs-description"
                />
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-tight text-neutral-900">
                    {t('booking.recommendedNearbyChefsTitle')}
                  </p>
                  <p id="share-nearby-chefs-description" className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
                    {t('booking.recommendedNearbyChefsDescription')}
                  </p>
                  <p className="mt-2 text-xs font-medium text-neutral-500">
                    {t('booking.recommendedNearbyChefsMicrocopy')}
                  </p>
                </div>
              </div>
            </label>

            {formData.shareWithNearbyChefs && (
              <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 transition-all duration-200">
                <p className="text-sm text-neutral-700 font-medium">
                  Sélection max: 3 chefs
                </p>
                <div className="space-y-2">
                  {nearbyChefs.map((nearbyChef) => {
                    const selected = formData.nearbyChefIds.includes(nearbyChef.id)
                    const disabled = !selected && formData.nearbyChefIds.length >= 3
                    return (
                      <div key={nearbyChef.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-all ${
                        selected ? 'border-[#FBCF03] bg-[#FBCF03]/5' : 'border-neutral-200 bg-white hover:border-[#FBCF03]/50'
                      }`}>
                        <label className="flex items-center gap-3 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={disabled}
                            onChange={(e) => toggleNearbyChef(nearbyChef.id, e.target.checked)}
                            className="h-4.5 w-4.5 rounded-md border border-neutral-300 accent-[#FBCF03] transition-colors focus:ring-[#FBCF03]/40 disabled:opacity-40"
                          />
                          <span className="text-sm text-black font-medium">{nearbyChef.name}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedNearbyChef(nearbyChef)
                            setShowNearbyChefPopup(true)
                          }}
                          className="text-sm font-semibold text-black underline hover:text-gray-700"
                        >
                          Voir le profil
                        </button>
                      </div>
                    )
                  })}
                </div>
                {errors.nearbyChefIds && (
                  <p className="text-sm text-red-500">{errors.nearbyChefIds}</p>
                )}
              </div>
            )}
          </div>
        )}

        <Textarea
          label={t('booking.notes')}
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={4}
          placeholder={t('booking.notesPlaceholder')}
          className="rounded-xl border border-neutral-300 bg-white px-4 py-3 md:py-2.5 text-[15px] placeholder:text-neutral-400 focus:border-[#FBCF03] focus:ring-2 focus:ring-[#FBCF03]/20"
        />
      </div>
      )}

      {currentPage === 4 && (
        <div className={`px-1 sm:px-2 space-y-4 flex-1 transition-all duration-200 ease-out ${isStepVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
          <h2 className="text-2xl font-bold text-black mb-2">{t('booking.personalInfo')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={`${t('booking.firstName')} *`}
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              error={errors.firstName}
              required
              autoComplete="given-name"
              inputMode="text"
            />
            <Input
              label="Nom *"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              error={errors.lastName}
              required
              autoComplete="family-name"
              inputMode="text"
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
              autoComplete="email"
              inputMode="email"
            />
            <Input
              label={`${t('booking.confirmEmail')} *`}
              type="email"
              name="emailConfirm"
              value={formData.emailConfirm}
              onChange={handleChange}
              error={errors.emailConfirm}
              required
              autoComplete="email"
              inputMode="email"
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
              autoComplete="tel"
              inputMode="tel"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                name="acceptedTerms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded-md border border-neutral-300 accent-[#FBCF03] transition-colors focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/40 focus:ring-offset-1"
              />
              <span className="flex-1 pt-0.5 text-sm sm:text-[15px] leading-relaxed text-neutral-600">
                <span className="whitespace-normal">
                  {t('booking.acceptTerms')}{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      setShowTermsPopup(true)
                    }}
                    className="inline text-neutral-800 underline decoration-neutral-400 underline-offset-2 transition-colors hover:text-black hover:decoration-neutral-700"
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
        </div>
      )}

      {currentPage === 4 && errors.submit && (
        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
          <p className="text-red-500 font-medium mb-2">{errors.submit}</p>
          {submissionError?.canRetry && (
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleRetry}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Réessayer
              </button>
              <span className="text-sm text-red-600">
                ({retryCount}/2 tentatives)
              </span>
            </div>
          )}
        </div>
      )}

      {currentPage === 4 && submissionError && !errors.submit && (
        <div className="bg-amber-50 border-2 border-amber-500 rounded-lg p-4">
          <p className="text-amber-800 font-medium mb-2">{submissionError.message}</p>
          {submissionError.canRetry && (
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={handleRetry}
                disabled={loading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Réessayer
              </button>
              <span className="text-sm text-amber-700">
                ({retryCount}/2 tentatives)
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col items-center gap-4 mt-auto">
        {currentPage === 3 && showGlobalError && (
          <div ref={globalErrorRef} className="w-full sm:w-auto bg-red-50 border-2 border-red-500 rounded-lg p-4 -mt-2 mb-2">
            <p className="text-red-500 text-center font-medium text-sm">
              {globalErrorMessage || t('booking.errors.missingRequiredFields')}
            </p>
          </div>
        )}
        <div className="w-full flex flex-col items-center gap-2">
          <Button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto min-w-[220px] rounded-full bg-[#FBCF03] text-black hover:bg-[#E6BA00] font-semibold py-3.5 px-8 text-base transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentPage === 4 ? (
              loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('common.loading')}
                </span>
              ) : (
                t('booking.submit')
              )
            ) : (
              t('booking.next')
            )}
          </Button>

          <button
            type="button"
            onClick={handleBack}
            className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBCF03]/60 focus-visible:ring-offset-2 rounded"
          >
            {t('booking.back')}
          </button>
        </div>
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

                <div className="space-y-4">
                  <h3 className="font-semibold text-black text-lg">5. Annulation et conditions de remboursement</h3>
                  <p className="text-base">
                    Les présentes conditions s&apos;appliquent à toutes les prestations réservées via la plateforme Guide My Table, incluant :
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Les cours de cuisine (quel que soit le nombre de participants)</li>
                    <li>Les prestations de chef à domicile</li>
                    <li>Les prestations de chef à demeure (présence du Chef sur plusieurs jours au sein du logement du Client)</li>
                  </ul>
                  <p className="text-base">
                    Toute annulation doit être formulée par écrit (email ou messagerie de la plateforme). Les délais mentionnés ci-dessous s&apos;entendent en jours calendaires avant la date de la prestation (ou avant la date de début pour un chef à demeure).
                  </p>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-black">5.1 Modalités de paiement</h4>
                    <p className="text-base">Le Client règle la totalité du montant de la prestation au moment de la réservation.</p>
                    <p className="text-base">Les sommes versées sont conservées par Guide My Table jusqu&apos;à la réalisation effective de la prestation. Elles sont ensuite reversées au Chef après exécution.</p>
                    <p className="text-base">En cas d&apos;annulation, les conditions de remboursement ci-dessous s&apos;appliquent.</p>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-black">5.2 Conditions d&apos;annulation selon le type de prestation</h4>
                    <div className="space-y-2">
                      <p className="font-medium text-black">A. Cours de cuisine (quel que soit le nombre de participants)</p>
                      <p className="text-base">Les conditions suivantes s&apos;appliquent indépendamment du nombre de participants inscrits.</p>
                      <p className="text-base">Annulation avant J-5 : remboursement intégral (100%).</p>
                      <p className="text-base">Annulation à partir de J-5 inclus : 30% retenus, 70% remboursés.</p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-black">B. Chef à domicile – de 1 à 8 personnes</p>
                      <p className="text-base">Annulation avant J-5 : remboursement intégral (100%).</p>
                      <p className="text-base">Annulation à partir de J-5 inclus : 30% retenus, 70% remboursés.</p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-black">C. Chef à domicile – de 9 à 18 personnes</p>
                      <p className="text-base">Annulation avant J-7 : remboursement intégral (100%).</p>
                      <p className="text-base">Annulation à partir de J-7 inclus : 30% retenus, 70% remboursés.</p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-black">D. Chef à domicile – 19 personnes et plus</p>
                      <p className="text-base">Annulation avant J-14 : remboursement intégral (100%).</p>
                      <p className="text-base">Annulation à partir de J-14 inclus : 30% retenus, 70% remboursés.</p>
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-black">E. Chef à demeure (présence sur plusieurs jours)</p>
                      <p className="text-base">Annulation avant J-14 (avant la date de début) : remboursement intégral (100%).</p>
                      <p className="text-base">Annulation à partir de J-14 inclus : 30% retenus, 70% remboursés.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-black">5.3 Répartition des 30% retenus en cas d&apos;annulation tardive</h4>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>25% du montant total sont reversés au Chef, en compensation de la perte de disponibilité et de la préparation engagée.</li>
                      <li>5% du montant total sont conservés par Guide My Table, au titre des frais de réservation, de gestion et d&apos;organisation.</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-black">5.4 Force majeure</h4>
                    <p className="text-base">En cas de force majeure au sens de l&apos;article 1218 du Code civil (événement imprévisible, irrésistible et extérieur), les parties pourront convenir d&apos;un report de la prestation, ou d&apos;un remboursement adapté à la situation.</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-black">5.5 Précision relative au nombre de convives</h4>
                    <p className="text-base">Les conditions d&apos;annulation et de remboursement prévues aux présentes s&apos;appliquent sur la base du nombre de convives, du type de prestation et du montant total, tels qu&apos;ils ont été validés par le Client au moment de la finalisation de la réservation sur la plateforme.</p>
                    <p className="text-base">Le nombre de convives retenu lors de la confirmation constitue la base contractuelle de référence pour le calcul de toute retenue ou remboursement.</p>
                    <p className="text-base">Toute modification ultérieure du nombre de participants, notamment à la baisse, ne pourra entraîner une diminution du montant dû ni modifier les conditions d&apos;annulation applicables, sauf accord exprès et écrit de Guide My Table.</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-black">6. Modalités de remboursement</h4>
                    <p className="text-base">Le remboursement du solde restant est effectué via le même moyen de paiement utilisé lors de la réservation.</p>
                    <p className="text-base">Le délai de traitement peut varier selon les banques et prestataires de paiement, mais ne dépasse pas 10 jours ouvrés à compter de la confirmation de l&apos;annulation.</p>
                    <p className="text-base">Aucun remboursement en espèces ne sera effectué.</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-black">7. Responsabilités</h4>
                    <p className="text-base">Guide MyTable agit en tant qu&apos;intermédiaire et n&apos;est pas responsable des prestations réalisées par les Chefs privés.</p>
                    <p className="text-base">En cas de litige, le Client et le Chef devront trouver un accord entre eux.</p>
                  </div>
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

      {mounted && showNearbyChefPopup && selectedNearbyChef && createPortal(
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm p-4 z-50"
          onClick={() => setShowNearbyChefPopup(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-black">Profil du Chef</h3>
              <button
                onClick={() => setShowNearbyChefPopup(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={t('common.close')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col items-center text-center">
              {(() => {
                const nameParts = selectedNearbyChef.name.trim().split(' ')
                const firstName = nameParts[0] || selectedNearbyChef.name
                const dishPhotos = Array.isArray(selectedNearbyChef.dish_photos)
                  ? selectedNearbyChef.dish_photos.filter((url): url is string => typeof url === 'string' && url.length > 0).slice(0, 3)
                  : []
                return (
                  <>
              {selectedNearbyChef.profile_picture ? (
                <img
                  src={selectedNearbyChef.profile_picture}
                  alt={selectedNearbyChef.name}
                  className="w-24 h-24 rounded-full object-cover border-2 border-gray-200 mb-4"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-200 mb-4">
                  <span className="text-2xl font-bold text-gray-700">
                    {selectedNearbyChef.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <p className="text-lg font-semibold text-black">{firstName}</p>
              <p className="mt-2 text-sm text-gray-700">
                {selectedNearbyChef.cuisine_style || 'Style de cuisine non renseigné'}
              </p>
              {selectedNearbyChef.min_guests !== null && selectedNearbyChef.max_guests !== null && (
                <p className="mt-1 text-sm text-gray-600">
                  {selectedNearbyChef.min_guests} à {selectedNearbyChef.max_guests} convives
                </p>
              )}
              {dishPhotos.length > 0 && (
                <div className="mt-4 w-full">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                    Photos de plats
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {dishPhotos.map((photoUrl, index) => (
                      <button
                        key={`${photoUrl}-${index}`}
                        type="button"
                        onClick={() => openDishLightbox(dishPhotos, index)}
                        className="group relative overflow-hidden rounded-lg border border-gray-200"
                        aria-label={`Voir la photo ${index + 1}`}
                      >
                        <img
                          src={photoUrl}
                          alt={`Plat ${index + 1}`}
                          className="h-20 w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                        <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/20" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
                  </>
                )
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && showDishLightbox && lightboxPhotos.length > 0 && createPortal(
        <div
          className="fixed inset-0 bg-black/85 p-4 z-[10000]"
          onClick={() => setShowDishLightbox(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div className="relative flex w-full max-w-4xl items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowDishLightbox(false)}
              className="absolute right-2 top-2 z-20 rounded-md bg-white/10 p-2 text-white hover:bg-white/20"
              aria-label={t('common.close')}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {lightboxPhotos.length > 1 && (
              <button
                type="button"
                onClick={showPrevDishPhoto}
                className="absolute left-0 sm:-left-12 z-20 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Photo précédente"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            <img
              src={lightboxPhotos[lightboxIndex]}
              alt={`Photo plat ${lightboxIndex + 1}`}
              className="max-h-[85vh] w-auto max-w-full rounded-xl object-contain"
            />

            {lightboxPhotos.length > 1 && (
              <button
                type="button"
                onClick={showNextDishPhoto}
                className="absolute right-0 sm:-right-12 z-20 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="Photo suivante"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </form>
  )
}
