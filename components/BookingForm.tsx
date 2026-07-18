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
import { trackEvent } from '@/lib/analytics/track'
import { BOOKING_FALLBACK_RADIUS_KM } from '@/lib/geo'
import { resolveBookingAddress } from '@/lib/bookingAddress'
import { splitFullNameForBooking } from '@/lib/splitFullName'
import { EventAddressAutocomplete } from '@/components/booking/EventAddressAutocomplete'
import { createClient } from '@/lib/supabase/client'

type Chef = Database['public']['Tables']['chefs']['Row']
type Menu = Database['public']['Tables']['menus']['Row']
type NearbyChef = Pick<Chef, 'id' | 'name' | 'profile_picture' | 'slug' | 'cuisine_style' | 'dish_photos' | 'min_guests' | 'max_guests'>

type ServiceType = 'repas_domicile' | 'cours_cuisine' | 'mise_en_demeure'

interface BookingFormProps {
  chef: Chef
  chefName: string
  menus: Menu[]
}

type DatePickerMultiProps = {
  selectedDates: string[]
  onDatesChange: (dates: string[]) => void
  minDate: string
  locale: string
  maxDates?: number
  disabledDates?: string[]
}

// Définir le sélecteur multi-dates en dehors de BookingForm pour éviter de réinitialiser le mois affiché à chaque render
const DatePickerMulti = ({ selectedDates, onDatesChange, minDate, locale, maxDates, disabledDates = [] }: DatePickerMultiProps) => {
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())

  const toggleDate = (date: Date) => {
    const dateStr = getLocalDateString(date)
    if (selectedDates.includes(dateStr)) {
      onDatesChange(selectedDates.filter(d => d !== dateStr))
    } else {
      // Respecter la limite éventuelle de dates sélectionnables
      if (typeof maxDates === 'number' && selectedDates.length >= maxDates) {
        return
      }
      onDatesChange([...selectedDates, dateStr].sort())
    }
  }

  const isDateSelected = (date: Date) => {
    const dateStr = getLocalDateString(date)
    return selectedDates.includes(dateStr)
  }

  const isDateDisabled = (date: Date) => {
    const dateStr = getLocalDateString(date)
    // Dates explicitement bloquées (ex: la date principale déjà choisie)
    if (disabledDates.includes(dateStr)) return true
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

export default function BookingForm({ chef, chefName, menus }: BookingFormProps) {
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
  const [activePriceInfo, setActivePriceInfo] = useState<'cours' | 'demeure' | null>(null)
  const globalErrorRef = useRef<HTMLDivElement>(null)
  const nearbyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nearbyFetchAbortRef = useRef<AbortController | null>(null)
  const step1AdvanceTimeoutRef = useRef<number | null>(null)
  const step1AdvanceGenRef = useRef(0)
  const [resolvedNearbyChefs, setResolvedNearbyChefs] = useState<NearbyChef[]>([])
  const [nearbyChefsLoading, setNearbyChefsLoading] = useState(false)
  const [clientMapCoords, setClientMapCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [currentUser, setCurrentUser] = useState<any | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [isLoginMode, setIsLoginMode] = useState(false)
  const [accountEmail, setAccountEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [loginError, setLoginError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    serviceType: '' as ServiceType | '',
    bookingDate: '',
    isDateFlexible: false,
    alternativeDates: [] as string[],
    eventAddress: '',
    fullAddress: '',
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
    manualAddressMode: false,
  })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user)
      setUserLoading(false)
    })
  }, [])

    // Réinitialiser le formulaire à chaque montage du composant
  useEffect(() => {
    setCurrentPage(1)
    setAcceptedTerms(false)
    setErrors({})
    setLoading(false)
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      serviceType: '' as ServiceType | '',
      bookingDate: '',
      isDateFlexible: false,
      alternativeDates: [],
      eventAddress: '',
      fullAddress: '',
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
      manualAddressMode: false,
    })
    setResolvedNearbyChefs([])
    setClientMapCoords(null)
    setNearbyChefsLoading(false)
  }, [chef.id, menus])

  useEffect(() => {
    const resolved = resolveBookingAddress(formData)
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

    const clearList = () => {
      setResolvedNearbyChefs([])
      setNearbyChefsLoading(false)
    }

    if (!resolved || !mapboxToken) {
      clearList()
      if (!resolved) setClientMapCoords(null)
      return
    }

    if (nearbyDebounceRef.current) clearTimeout(nearbyDebounceRef.current)

    nearbyDebounceRef.current = setTimeout(async () => {
      if (nearbyFetchAbortRef.current) nearbyFetchAbortRef.current.abort()
      const controller = new AbortController()
      nearbyFetchAbortRef.current = controller
      setNearbyChefsLoading(true)

      try {
        let lat: number
        let lng: number
        if (clientMapCoords) {
          lat = clientMapCoords.lat
          lng = clientMapCoords.lng
        } else {
          const geoPath = `${encodeURIComponent(resolved.postalCode)} ${encodeURIComponent(resolved.city)}, France`
          const geoRes = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${geoPath}.json?autocomplete=false&limit=1&language=fr&country=fr&types=place,postcode,address,locality,neighborhood&access_token=${mapboxToken}`,
            { signal: controller.signal }
          )
          if (!geoRes.ok) throw new Error('geocode')
          const geoJson = await geoRes.json()
          const feature = geoJson?.features?.[0]
          const center = feature?.center
          if (!Array.isArray(center) || center.length < 2) {
            setResolvedNearbyChefs([])
            setClientMapCoords(null)
            setNearbyChefsLoading(false)
            return
          }
          lng = Number(center[0])
          lat = Number(center[1])
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            setResolvedNearbyChefs([])
            setClientMapCoords(null)
            setNearbyChefsLoading(false)
            return
          }
          setClientMapCoords({ lat, lng })
        }

        const nearbyRes = await fetch('/api/booking/nearby-chefs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientLatitude: lat,
            clientLongitude: lng,
            excludeChefId: chef.id,
            radiusKm: BOOKING_FALLBACK_RADIUS_KM,
          }),
          signal: controller.signal,
        })

        if (!nearbyRes.ok) {
          setResolvedNearbyChefs([])
          setNearbyChefsLoading(false)
          return
        }
        const payload = await nearbyRes.json()
        const list = Array.isArray(payload?.chefs) ? (payload.chefs as NearbyChef[]) : []
        setResolvedNearbyChefs(list)
      } catch (e: unknown) {
        const err = e as { name?: string }
        if (err?.name === 'AbortError') return
        setResolvedNearbyChefs([])
        setClientMapCoords(null)
      } finally {
        setNearbyChefsLoading(false)
      }
    }, 400)

    return () => {
      if (nearbyDebounceRef.current) clearTimeout(nearbyDebounceRef.current)
      if (nearbyFetchAbortRef.current) nearbyFetchAbortRef.current.abort()
    }
  }, [formData.eventAddress, formData.city, formData.postalCode, formData.fullAddress, chef.id, clientMapCoords])

  useEffect(() => {
    return () => {
      if (step1AdvanceTimeoutRef.current) {
        clearTimeout(step1AdvanceTimeoutRef.current)
        step1AdvanceTimeoutRef.current = null
      }
    }
  }, [])

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

      if (name === 'eventAddress') {
        newData.nearbyChefIds = []
        newData.shareWithNearbyChefs = false
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

  // Section "Êtes-vous flexible sur la date ?" — utilisée pour repas_domicile et cours_cuisine.
  // Si flexible, le client peut proposer jusqu'à 3 dates alternatives via le même calendrier.
  const renderDateFlexibility = () => (
    <div className="w-full space-y-3">
      <label
        htmlFor="date-flexible"
        className={`group block cursor-pointer rounded-xl border px-5 py-4 shadow-sm transition-all duration-200 ${
          formData.isDateFlexible
            ? 'border-[#FBCF03]/70 bg-[#FBCF03]/10 shadow-md'
            : 'border-[#FBCF03]/30 bg-white hover:-translate-y-0.5 hover:border-[#FBCF03]/50 hover:shadow-md'
        }`}
      >
        <div className="flex items-start gap-4">
          <input
            id="date-flexible"
            type="checkbox"
            checked={formData.isDateFlexible}
            onChange={(e) => {
              const checked = e.target.checked
              setFormData(prev => ({
                ...prev,
                isDateFlexible: checked,
                // Réinitialiser les dates alternatives si on décoche
                alternativeDates: checked ? prev.alternativeDates : [],
              }))
            }}
            className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-md border border-neutral-300 accent-[#FBCF03] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBCF03]/40 focus-visible:ring-offset-1"
            aria-describedby="date-flexible-description"
          />
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight text-neutral-900">
              {t('booking.dateFlexibleQuestion')}
            </p>
            <p id="date-flexible-description" className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
              {t('booking.dateFlexibleHint')}
            </p>
          </div>
        </div>
      </label>

      {formData.isDateFlexible && (
        <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
          {!formData.bookingDate && (
            <p className="text-sm text-amber-600">
              {t('booking.dateFlexibleSelectMainFirst')}
            </p>
          )}
          <DatePickerMulti
            selectedDates={formData.alternativeDates}
            onDatesChange={(dates) =>
              setFormData(prev => ({ ...prev, alternativeDates: dates }))
            }
            minDate={getMinDate()}
            locale={locale}
            maxDates={3}
            disabledDates={formData.bookingDate ? [formData.bookingDate] : []}
          />
          {errors.alternativeDates && (
            <p className="text-red-500 text-sm mt-2">{errors.alternativeDates}</p>
          )}
        </div>
      )}
    </div>
  )

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

    const resolvedAddress = resolveBookingAddress(formData)
    if (!resolvedAddress) {
      newErrors.eventAddress = t('booking.errors.eventAddressInvalid')
      missingFields.push(t('booking.eventAddress'))
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
        missingFields.push('Prix par participant')
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
        missingFields.push('Prix par jour')
      }
    }

    // Si le client se déclare flexible, il doit proposer au moins une date alternative
    if (
      (formData.serviceType === 'repas_domicile' || formData.serviceType === 'cours_cuisine') &&
      formData.isDateFlexible &&
      formData.alternativeDates.length === 0
    ) {
      newErrors.alternativeDates = 'Veuillez proposer au moins une date alternative ou décocher la flexibilité'
      missingFields.push('Dates alternatives')
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
      if (!clientMapCoords) {
        newErrors.nearbyChefIds =
          'Impossible de localiser votre adresse pour proposer des chefs à proximité. Vérifiez le code postal et la ville.'
        missingFields.push('Localisation')
      } else if (formData.nearbyChefIds.length === 0) {
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

    if (!formData.fullName.trim()) newErrors.fullName = t('booking.errors.fullNameRequired')
    if (!formData.phone.trim()) newErrors.phone = t('booking.errors.phoneRequired')
    if (!acceptedTerms) newErrors.terms = t('booking.errors.termsRequired')

    setErrors(prev => ({ ...prev, ...newErrors }))
    return Object.keys(newErrors).length === 0
  }

  const validatePage5 = () => {
    if (currentUser) return true
    const newErrors: Record<string, string> = {}
    if (isLoginMode) {
      if (!loginEmail.trim()) newErrors.loginEmail = t('booking.errors.emailRequired')
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) newErrors.loginEmail = t('booking.errors.emailInvalid')
      if (!loginPassword) newErrors.loginPassword = t('booking.errors.passwordRequired')
    } else {
      if (!accountEmail.trim()) newErrors.accountEmail = t('booking.errors.emailRequired')
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail.trim())) newErrors.accountEmail = t('booking.errors.emailInvalid')
      if (!password) newErrors.password = t('booking.errors.passwordRequired')
      else if (password.length < 8) newErrors.password = t('booking.errors.passwordMinLength')
      if (!confirmPassword) newErrors.confirmPassword = t('booking.errors.confirmRequired')
      else if (password !== confirmPassword) newErrors.confirmPassword = t('booking.errors.passwordsDontMatch')
    }
    setErrors(prev => ({ ...prev, ...newErrors }))
    return Object.keys(newErrors).length === 0
  }

  const handleServiceTypeSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value as ServiceType
    setFormData((prev) => ({ ...prev, serviceType: value }))
    setErrors((prev) => {
      if (!prev.serviceType) return prev
      const next = { ...prev }
      delete next.serviceType
      return next
    })
    setShowGlobalError(false)

    if (step1AdvanceTimeoutRef.current) {
      clearTimeout(step1AdvanceTimeoutRef.current)
      step1AdvanceTimeoutRef.current = null
    }
    step1AdvanceGenRef.current += 1
    const generation = step1AdvanceGenRef.current

    step1AdvanceTimeoutRef.current = window.setTimeout(() => {
      step1AdvanceTimeoutRef.current = null
      if (step1AdvanceGenRef.current !== generation) return
      setCurrentPage((prev) => (prev === 1 ? 2 : prev))
    }, 200)
  }

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    if (currentPage === 1 && validatePage1()) {
      if (step1AdvanceTimeoutRef.current) {
        clearTimeout(step1AdvanceTimeoutRef.current)
        step1AdvanceTimeoutRef.current = null
      }
      step1AdvanceGenRef.current += 1
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
    if (currentPage === 4 && validatePage4()) {
      if (needsAccountStep) {
        setCurrentPage(5)
        return
      }
      // Logged in (or still loading): submit directly
      handleSubmit(e)
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

  const handleSubmit = async (e: React.FormEvent, isRetry: boolean = false, loggedInUser?: any) => {
    e.preventDefault()

    const effectiveUser = loggedInUser ?? currentUser

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

    if (!effectiveUser && !validatePage5()) {
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

    const emailForBooking = effectiveUser?.email ?? accountEmail.trim().toLowerCase()
    const passwordForBooking = (!effectiveUser && !isLoginMode) ? password : undefined

    try {
      console.log('[BookingForm] Starting booking submission', {
        serviceType: formData.serviceType,
        idempotencyToken: idempotencyToken,
        isRetry,
        retryCount,
        timestamp: new Date().toISOString(),
      })

      const {
        periodStartDate,
        periodEndDate,
        shareWithNearbyChefs,
        nearbyChefIds,
        eventAddress,
        fullAddress: _fullAddressForm,
        fullName,
        email: _emailFromForm,
        ...bookingRest
      } = formData

      const { firstName, lastName } = splitFullNameForBooking(fullName)
      const resolvedSubmit = resolveBookingAddress(formData)
      const bookingData = {
        ...bookingRest,
        email: emailForBooking,
        firstName,
        lastName,
        city: resolvedSubmit?.city ?? '',
        postalCode: resolvedSubmit?.postalCode ?? '',
        fullAddress: resolvedSubmit?.fullAddress ?? '',
      }
      
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

      // La flexibilité de date ne concerne que repas à domicile et cours de cuisine
      const supportsDateFlexibility =
        formData.serviceType === 'repas_domicile' || formData.serviceType === 'cours_cuisine'
      const isDateFlexible = supportsDateFlexibility && formData.isDateFlexible
      const alternativeDates = isDateFlexible ? formData.alternativeDates : []

      const requestBody: Record<string, any> = {
        chefId: chef.id,
        ...bookingData,
        eventAddress: formData.eventAddress,
        periodDays,
        budget,
        courseTopic,
        selectedDates,
        mealOptions,
        totalPrice,
        isDateFlexible,
        alternativeDates,
        fallbackEnabled: shareWithNearbyChefs,
        fallbackChefIds: shareWithNearbyChefs ? nearbyChefIds : [],
        clientLatitude: clientMapCoords?.lat ?? null,
        clientLongitude: clientMapCoords?.lng ?? null,
        idempotencyToken,
      }
      if (passwordForBooking) {
        requestBody.password = passwordForBooking
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
        // Email déjà existant : basculer vers le mode connexion
        if (data.error === 'email_exists') {
          setAccountError(t('booking.errors.emailExists'))
          setIsLoginMode(true)
          setLoginEmail(accountEmail.trim().toLowerCase())
          setLoading(false)
          return
        }
        // Vérifier si c'est une erreur de doublon (idempotence)
        if (data.isDuplicate) {
          console.log('[BookingForm] Duplicate booking detected, redirecting to confirmation')
          router.push('/booking-confirmation')
          return
        }
        throw new Error(data.error || t('booking.errors.genericError'))
      }

      console.log('[BookingForm] Booking created successfully', {
        bookingRequestId: data.bookingRequestId,
        conversationId: data.conversationId,
      })

      trackEvent('booking_request', {
        chef_id: chef.id,
        booking_request_id: data.bookingRequestId,
        conversation_id: data.conversationId,
        service_type: formData.serviceType,
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

  const handleLogin = async () => {
    setLoginError('')
    const loginErrors: Record<string, string> = {}
    if (!loginEmail.trim()) loginErrors.loginEmail = t('booking.errors.emailRequired')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) loginErrors.loginEmail = t('booking.errors.emailInvalid')
    if (!loginPassword) loginErrors.loginPassword = t('booking.errors.passwordRequired')
    if (Object.keys(loginErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...loginErrors }))
      return
    }
    setLoginLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      })
      if (error) {
        setLoginError(t('booking.errors.invalidLoginCredentials'))
        return
      }
      setCurrentUser(data.user)
      // Passer l'user directement pour éviter le délai de mise à jour du state React
      const syntheticEvent = { preventDefault: () => {} } as React.FormEvent
      await handleSubmit(syntheticEvent, false, data.user)
    } finally {
      setLoginLoading(false)
    }
  }

  const menuOptions = menus.map(menu => ({
    value: menu.id,
    label: `${menu.name}${menu.price ? ` - ${menu.price}€` : ''}`,
  }))
  const cookingClassBudgetOptions = [
    { value: '50', label: '50€/participant' },
    { value: '60', label: '60€/participant' },
    { value: '70', label: '70€/participant' },
    { value: '80', label: '80€/participant' },
    { value: '90', label: '90€/participant' },
  ]
  const homeChefBudgetOptions = [
    { value: '250', label: '250€/jour' },
    { value: '300', label: '300€/jour' },
    { value: '350', label: '350€/jour' },
    { value: '400', label: '400€/jour' },
    { value: '450', label: '450€/jour' },
    { value: '500', label: '500€/jour' },
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

  // Prénom du chef pour les phrases explicatives (ex: "Camille cuisine chez vous, sur place")
  const chefFirstName = splitFullNameForBooking(chefName).firstName || chefName

  const serviceTypeOptions = [
    {
      value: 'repas_domicile',
      label: t('booking.serviceType.repas_domicile'),
      description: t('booking.serviceType.repas_domicile_desc', { chefName: chefFirstName }),
    },
    {
      value: 'cours_cuisine',
      label: t('booking.serviceType.cours_cuisine'),
      description: t('booking.serviceType.cours_cuisine_desc', { chefName: chefFirstName }),
    },
    {
      value: 'mise_en_demeure',
      label: t('booking.serviceType.mise_en_demeure'),
      description: t('booking.serviceType.mise_en_demeure_desc', { chefName: chefFirstName }),
    },
  ]

  // Récapitulatif affiché à la dernière étape du formulaire (chef, date(s), convives, menu, total)
  const renderRecap = () => {
    const dateLocale = locale === 'en' ? 'en-US' : 'fr-FR'
    const totalGuests = Math.max(1, parseInt(formData.guestsCount, 10) || 1)
    const children = Math.max(0, parseInt(formData.childrenCount, 10) || 0)
    const adults = Math.max(0, totalGuests - children)

    // Convives : "4 adultes, 1 enfant"
    const guestsParts: string[] = []
    if (adults > 0) {
      guestsParts.push(`${adults} ${adults > 1 ? t('booking.recap.adults') : t('booking.recap.adult')}`)
    }
    if (children > 0) {
      guestsParts.push(`${children} ${children > 1 ? t('booking.recap.children') : t('booking.recap.child')}`)
    }
    const guestsLabel = guestsParts.join(', ') || '—'

    // Date(s) selon le type de service
    const toBeChosen = t('booking.recap.toBeChosen')
    let dateLabel = toBeChosen
    if (formData.serviceType === 'mise_en_demeure') {
      if (formData.selectedDates.length > 0) {
        dateLabel = formData.selectedDates
          .map((d) => formatDateForDisplay(d, dateLocale, { day: 'numeric', month: 'short' }))
          .join(', ')
      }
    } else if (formData.bookingDate) {
      dateLabel = formatDateForDisplay(formData.bookingDate, dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })
      if (formData.isDateFlexible && formData.alternativeDates.length > 0) {
        const alts = formData.alternativeDates
          .map((d) => formatDateForDisplay(d, dateLocale, { day: 'numeric', month: 'short' }))
          .join(', ')
        dateLabel = `${dateLabel} (${t('booking.recap.orFlexible')} ${alts})`
      }
    }

    // Ligne contextuelle (menu / cours / formule) + total
    const selectedMenu = menus.find((m) => m.id === formData.menuId) || null
    let detailLabel: string | null = null
    let detailValue = '—'
    let total = 0

    if (formData.serviceType === 'repas_domicile') {
      detailLabel = t('booking.recap.menu')
      detailValue = selectedMenu?.name || '—'
      const menuPrice = selectedMenu?.price ? Number(selectedMenu.price) : 0
      total = menuPrice * totalGuests
    } else if (formData.serviceType === 'cours_cuisine') {
      detailLabel = t('booking.recap.course')
      detailValue = formData.courseTopic.trim() || '—'
      const perPerson = Number(formData.budget) || 0
      total = perPerson * totalGuests
    } else if (formData.serviceType === 'mise_en_demeure') {
      detailLabel = t('booking.recap.days')
      const daysCount = formData.selectedDates.length
      detailValue = daysCount > 0 ? `${daysCount} ${daysCount > 1 ? t('booking.recap.daysUnit') : t('booking.recap.dayUnit')}` : '—'
      const perDay = Number(formData.budget) || 0
      total = perDay * daysCount
    }

    return (
      <div className="rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="bg-neutral-50 px-4 py-2.5 border-b border-neutral-200">
          <h3 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            {t('booking.recap.title')}
          </h3>
        </div>
        <div className="divide-y divide-neutral-100">
          <div className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-neutral-500">{t('booking.recap.chef')}</span>
            <span className="font-medium text-neutral-900 text-right">{chefFirstName}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 text-sm gap-4">
            <span className="text-neutral-500 shrink-0">{t('booking.date')}</span>
            <span className="font-medium text-neutral-900 text-right">{dateLabel}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="text-neutral-500">{t('booking.recap.guests')}</span>
            <span className="font-medium text-neutral-900 text-right">{guestsLabel}</span>
          </div>
          {detailLabel && (
            <div className="flex items-center justify-between px-4 py-2.5 text-sm gap-4">
              <span className="text-neutral-500 shrink-0">{detailLabel}</span>
              <span className="font-medium text-neutral-900 text-right">{detailValue}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-t border-neutral-200">
          <span className="text-sm font-semibold text-neutral-900">{t('booking.recap.total')}</span>
          <span className="text-base font-bold text-neutral-900">{total.toFixed(0)}€</span>
        </div>
      </div>
    )
  }

  const needsAccountStep = !currentUser && !userLoading
  const stepLabels = [
    t('booking.formStepper.serviceType'),
    t('booking.formStepper.serviceDetails'),
    t('booking.formStepper.additionalInfo'),
    t('booking.formStepper.personalInfo'),
    ...(needsAccountStep ? [t('booking.formStepper.account')] : []),
  ]
  const totalSteps = stepLabels.length
  const lastPage = totalSteps

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

  const handleManualAddressToggle = (enabled: boolean) => {
    setFormData((prev) => ({
      ...prev,
      manualAddressMode: enabled,
      eventAddress: '',
      fullAddress: '',
      city: '',
      postalCode: '',
      nearbyChefIds: [],
      shareWithNearbyChefs: false,
    }))
    setClientMapCoords(null)
    setErrors((prev) => {
      if (!prev.eventAddress && !prev.city && !prev.postalCode) return prev
      const next = { ...prev }
      delete next.eventAddress
      delete next.city
      delete next.postalCode
      return next
    })
  }

  const renderEventAddressField = (inputClassName?: string) => (
    <div className="w-full space-y-3">
      {!formData.manualAddressMode ? (
        <>
          <EventAddressAutocomplete
            label={`${t('booking.eventAddress')} *`}
            placeholder={t('booking.eventAddressPlaceholder')}
            value={formData.eventAddress}
            error={errors.eventAddress}
            locale={locale}
            inputClassName={inputClassName}
            onChange={(v) => {
              setFormData((prev) => ({
                ...prev,
                eventAddress: v,
                city: '',
                postalCode: '',
                fullAddress: '',
                nearbyChefIds: [],
                shareWithNearbyChefs: false,
              }))
              setClientMapCoords(null)
              setErrors((prev) => {
                if (!prev.eventAddress) return prev
                const next = { ...prev }
                delete next.eventAddress
                return next
              })
              if (showGlobalError) setShowGlobalError(false)
            }}
            onPick={(payload) => {
              setFormData((prev) => ({
                ...prev,
                eventAddress: payload.fullAddress,
                fullAddress: payload.fullAddress,
                city: payload.city,
                postalCode: payload.postalCode,
              }))
              setClientMapCoords({ lat: payload.latitude, lng: payload.longitude })
              setErrors((prev) => {
                if (!prev.eventAddress) return prev
                const next = { ...prev }
                delete next.eventAddress
                return next
              })
            }}
          />
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-3">
          <Input
            label={`${t('booking.cityLabel')} *`}
            name="city"
            value={formData.city}
            placeholder={t('booking.cityPlaceholder')}
            onChange={(e) => {
              const v = e.target.value
              setFormData((prev) => ({
                ...prev,
                city: v,
                fullAddress: [v, prev.postalCode].filter(Boolean).join(' ').trim(),
                eventAddress: [v, prev.postalCode].filter(Boolean).join(' ').trim(),
                nearbyChefIds: [],
                shareWithNearbyChefs: false,
              }))
              setClientMapCoords(null)
              setErrors((prev) => {
                if (!prev.city && !prev.eventAddress) return prev
                const next = { ...prev }
                delete next.city
                delete next.eventAddress
                return next
              })
            }}
            error={errors.city}
            className={inputClassName}
            required
          />
          <Input
            label={`${t('booking.postalCodeLabel')} *`}
            name="postalCode"
            value={formData.postalCode}
            placeholder={t('booking.postalCodePlaceholder')}
            inputMode="numeric"
            maxLength={5}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 5)
              setFormData((prev) => ({
                ...prev,
                postalCode: v,
                fullAddress: [prev.city, v].filter(Boolean).join(' ').trim(),
                eventAddress: [prev.city, v].filter(Boolean).join(' ').trim(),
                nearbyChefIds: [],
                shareWithNearbyChefs: false,
              }))
              setClientMapCoords(null)
              setErrors((prev) => {
                if (!prev.postalCode && !prev.eventAddress) return prev
                const next = { ...prev }
                delete next.postalCode
                delete next.eventAddress
                return next
              })
            }}
            error={errors.postalCode}
            className={inputClassName}
            required
          />
        </div>
      )}
      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={formData.manualAddressMode}
          onChange={(e) => handleManualAddressToggle(e.target.checked)}
          className="h-4 w-4 rounded border border-neutral-300 accent-[#FBCF03]"
        />
        <span className="text-xs text-neutral-600">
          {t('booking.addressCityOnlyToggle')}
        </span>
      </label>
    </div>
  )

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
                  onChange={handleServiceTypeSelect}
                  className="w-4.5 h-4.5 text-[#FBCF03] focus:ring-[#FBCF03] shrink-0"
                />
                <span className="flex flex-col">
                  <span className="text-[17px] sm:text-lg md:text-lg font-medium text-neutral-900">{option.label}</span>
                  <span className="text-sm text-neutral-500">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.serviceType && (
            <p className="text-red-500 text-sm -mt-2">{errors.serviceType}</p>
          )}
        </div>
      </form>
    )
  }

  // Pages 2, 3, 4, 5
  return (
    <form onSubmit={currentPage === lastPage ? handleSubmit : handleNext} className="space-y-4 min-h-[70vh] flex flex-col">
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

            {renderDateFlexibility()}

            {renderGuestsModule()}

            {renderEventAddressField('py-2.5 sm:py-3 md:py-2')}

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

            {renderDateFlexibility()}

            {renderGuestsModule()}

            {renderEventAddressField()}

            <div className="w-full">
              <Select
                label="Prix par participant (€) *"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                error={errors.budget}
                options={cookingClassBudgetOptions}
                placeholder={t('booking.selectPricePlaceholder')}
                dropdownDirection="up"
              />
              <div className="mt-1 flex items-start gap-2">
                <p className="text-xs text-gray-500">{t('booking.budgetHint')}</p>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActivePriceInfo(prev => (prev === 'cours' ? null : 'cours'))}
                    aria-label={t('booking.priceInfoButtonAria')}
                    className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    i
                  </button>
                  {activePriceInfo === 'cours' && (
                    <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                      <p className="text-xs font-semibold text-gray-900">{t('booking.priceInfoTitle')}</p>
                      <p className="mt-1 text-xs text-gray-600">{t('booking.priceInfoDescription')}</p>
                    </div>
                  )}
                </div>
              </div>
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

            {renderEventAddressField()}

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
                label="Prix par jour (€) *"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                error={errors.budget}
                options={homeChefBudgetOptions}
                placeholder={t('booking.selectPricePlaceholder')}
                dropdownDirection="up"
              />
              <div className="mt-1 flex items-start gap-2">
                <p className="text-xs text-gray-500">{t('booking.budgetGlobalPeriodHint')}</p>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setActivePriceInfo(prev => (prev === 'demeure' ? null : 'demeure'))}
                    aria-label={t('booking.priceInfoButtonAria')}
                    className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    i
                  </button>
                  {activePriceInfo === 'demeure' && (
                    <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                      <p className="text-xs font-semibold text-gray-900">{t('booking.priceInfoTitle')}</p>
                      <p className="mt-1 text-xs text-gray-600">{t('booking.priceInfoDescription')}</p>
                    </div>
                  )}
                </div>
              </div>
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

        {(resolvedNearbyChefs.length > 0 || nearbyChefsLoading) && (
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
                  disabled={nearbyChefsLoading || resolvedNearbyChefs.length === 0}
                  onChange={(e) =>
                    setFormData(prev => ({
                      ...prev,
                      shareWithNearbyChefs: e.target.checked,
                      nearbyChefIds: e.target.checked ? prev.nearbyChefIds : [],
                    }))
                  }
                  className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-md border border-neutral-300 accent-[#FBCF03] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBCF03]/40 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-describedby="share-nearby-chefs-description"
                />
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-tight text-neutral-900">
                    {t('booking.recommendedNearbyChefsTitle')}
                  </p>
                  <p id="share-nearby-chefs-description" className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
                    {t('booking.recommendedNearbyChefsDescriptionPart1')}
                    <span className="underline decoration-black/60 underline-offset-2">
                      {t('booking.recommendedNearbyChefsDescriptionPart2')}
                    </span>
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
                {nearbyChefsLoading && resolvedNearbyChefs.length === 0 && (
                  <p className="text-sm text-neutral-500">Chargement des suggestions à proximité de votre adresse…</p>
                )}
                <div className="space-y-2">
                  {resolvedNearbyChefs.map((nearbyChef) => {
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
          <div className="grid grid-cols-1 gap-4">
            <Input
              label={`${t('booking.fullName')} *`}
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              error={errors.fullName}
              placeholder={t('booking.fullNamePlaceholder')}
              required
              autoComplete="name"
              inputMode="text"
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

      {currentPage === 5 && needsAccountStep && (
        <div className={`px-1 sm:px-2 space-y-4 flex-1 transition-all duration-200 ease-out ${isStepVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
          {isLoginMode ? (
            <>
              <h2 className="text-2xl font-bold text-black mb-1">{t('booking.account.loginTitle')}</h2>
              <p className="text-sm text-neutral-500 mb-2">{t('booking.account.loginSubtitle')}</p>
              {accountError && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-sm text-amber-800">
                  {accountError}
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('booking.email')} *</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => { setLoginEmail(e.target.value); setLoginError(''); setErrors(prev => { const n = { ...prev }; delete n.loginEmail; return n }) }}
                    autoComplete="email"
                    inputMode="email"
                    placeholder={t('auth.emailPlaceholder')}
                    className={`w-full rounded-xl border px-4 py-3 text-[15px] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/20 focus:border-[#FBCF03] ${errors.loginEmail ? 'border-red-400' : 'border-neutral-300'}`}
                  />
                  {errors.loginEmail && <p className="text-red-500 text-sm mt-1">{errors.loginEmail}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('auth.password')} *</label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={e => { setLoginPassword(e.target.value); setLoginError(''); setErrors(prev => { const n = { ...prev }; delete n.loginPassword; return n }) }}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className={`w-full rounded-xl border px-4 py-3 pr-11 text-[15px] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/20 focus:border-[#FBCF03] ${errors.loginPassword ? 'border-red-400' : 'border-neutral-300'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                      aria-label={showLoginPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    >
                      {showLoginPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      )}
                    </button>
                  </div>
                  {errors.loginPassword && <p className="text-red-500 text-sm mt-1">{errors.loginPassword}</p>}
                </div>
                {loginError && (
                  <p className="text-red-500 text-sm">{loginError}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setIsLoginMode(false); setAccountError(''); setLoginError(''); setErrors(prev => { const n = { ...prev }; delete n.loginEmail; delete n.loginPassword; return n }) }}
                className="text-sm text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
              >
                {t('booking.account.switchToSignup')}
              </button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-black mb-1">{t('booking.account.createTitle')}</h2>
              <p className="text-sm text-neutral-500 mb-2">{t('booking.account.createSubtitle')}</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('booking.email')} *</label>
                  <input
                    type="email"
                    value={accountEmail}
                    onChange={e => { setAccountEmail(e.target.value); setAccountError(''); setErrors(prev => { const n = { ...prev }; delete n.accountEmail; return n }) }}
                    autoComplete="email"
                    inputMode="email"
                    placeholder={t('auth.emailPlaceholder')}
                    className={`w-full rounded-xl border px-4 py-3 text-[15px] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/20 focus:border-[#FBCF03] ${errors.accountEmail ? 'border-red-400' : 'border-neutral-300'}`}
                  />
                  {errors.accountEmail && <p className="text-red-500 text-sm mt-1">{errors.accountEmail}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('auth.password')} * <span className="font-normal text-neutral-400">{t('booking.account.passwordMinHint')}</span></label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => { setPassword(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.password; return n }) }}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className={`w-full rounded-xl border px-4 py-3 pr-11 text-[15px] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/20 focus:border-[#FBCF03] ${errors.password ? 'border-red-400' : 'border-neutral-300'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                      aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      )}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('booking.account.confirmPasswordLabel')}</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.confirmPassword; return n }) }}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className={`w-full rounded-xl border px-4 py-3 pr-11 text-[15px] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/20 focus:border-[#FBCF03] ${errors.confirmPassword ? 'border-red-400' : 'border-neutral-300'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                      aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    >
                      {showConfirmPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
                </div>
                {accountError && (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-sm text-amber-800">
                    {accountError}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setIsLoginMode(true); setAccountError(''); setErrors(prev => { const n = { ...prev }; delete n.accountEmail; delete n.password; delete n.confirmPassword; return n }) }}
                className="text-sm text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
              >
                {t('booking.account.switchToLogin')}
              </button>
            </>
          )}
        </div>
      )}

      {currentPage === lastPage && (
        <div className="px-1 sm:px-2 pt-1">
          {renderRecap()}
        </div>
      )}

      {currentPage === lastPage && errors.submit && (
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
                {t('booking.retry')}
              </button>
              <span className="text-sm text-red-600">
                {t('booking.retryAttempts', { count: retryCount })}
              </span>
            </div>
          )}
        </div>
      )}

      {currentPage === lastPage && submissionError && !errors.submit && (
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
                {t('booking.retry')}
              </button>
              <span className="text-sm text-amber-700">
                {t('booking.retryAttempts', { count: retryCount })}
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
          {/* En mode login (step 5), on utilise un bouton dédié qui login puis soumet */}
          {currentPage === 5 && isLoginMode && needsAccountStep ? (
            <button
              type="button"
              onClick={handleLogin}
              disabled={loginLoading || loading}
              className="w-full sm:w-auto min-w-[220px] rounded-full bg-[#FBCF03] text-black hover:bg-[#E6BA00] font-semibold py-3.5 px-8 text-base transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loginLoading || loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('booking.account.connecting')}
                </span>
              ) : (
                t('booking.account.connectAndSubmit')
              )}
            </button>
          ) : (
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto min-w-[220px] rounded-full bg-[#FBCF03] text-black hover:bg-[#E6BA00] font-semibold py-3.5 px-8 text-base transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentPage === lastPage ? (
                loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('common.loading')}
                  </span>
                ) : (
                  t('booking.submit', { chefName: chefFirstName })
                )
              ) : (
                t('booking.next')
              )}
            </Button>
          )}

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
              <div className="space-y-5 text-gray-700 leading-relaxed">
                <p className="text-[15px]">
                  {t('booking.termsIntro')}
                </p>
                
                <div className="space-y-3 rounded-xl border border-[#EAEAEA] bg-white p-4 sm:p-5">
                  <h3 className="font-semibold text-black text-lg">1. {t('booking.dataUsage')}</h3>
                  <p className="text-base">
                    {t('booking.dataUsageText')}
                  </p>
                </div>

                <div className="space-y-3 rounded-xl border border-[#EAEAEA] bg-white p-4 sm:p-5">
                  <h3 className="font-semibold text-black text-lg">2. {t('booking.dataProtection')}</h3>
                  <p className="text-base">
                    {t('booking.dataProtectionText')}
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>{t('booking.dataUsageList1')}</li>
                    <li>{t('booking.dataUsageList2')}</li>
                    <li>{t('booking.dataUsageList3')}</li>
                  </ul>
                </div>

                <div className="space-y-3 rounded-xl border border-[#EAEAEA] bg-white p-4 sm:p-5">
                  <h3 className="font-semibold text-black text-lg">3. {t('booking.yourRights')}</h3>
                  <p className="text-base">
                    {t('booking.yourRightsText')}
                  </p>
                </div>

                <div className="rounded-xl border border-[#EAEAEA] bg-[#FBCF03]/10 p-4 sm:p-5">
                  <p className="text-sm font-semibold text-black mb-1">4. Acceptation</p>
                  <p className="text-sm font-medium text-black">
                    {t('booking.termsAcceptance')}
                  </p>
                </div>

                <div className="space-y-4 rounded-xl border border-[#EAEAEA] bg-white p-4 sm:p-5">
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
                        className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200"
                        aria-label={`Voir la photo ${index + 1}`}
                      >
                        <img
                          src={photoUrl}
                          alt={`Plat ${index + 1}`}
                          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.03]"
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
