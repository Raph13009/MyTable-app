'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Menu {
  id: string
  chef_id: string
  name: string
  description: string | null
  price: number | null
}

interface MapboxFeature {
  id: string
  place_name?: string
  text?: string
  center?: [number, number]
  context?: Array<{ id?: string; text?: string }>
  properties?: { postcode?: string }
}

interface LocationSuggestion {
  id: string
  label: string
  address: string
  city: string
  postalCode: string
  latitude: number
  longitude: number
}

interface FrenchCitySuggestion {
  code: string
  name: string
  postalCodes: string[]
}

interface PostalSuggestion {
  cityCode: string
  cityName: string
  postalCode: string
  cityPostalCodes: string[]
}

const extractContextValue = (feature: MapboxFeature, prefixes: string[]): string => {
  const match = feature.context?.find((item) => {
    const id = item.id || ''
    return prefixes.some((prefix) => id.startsWith(prefix))
  })
  return match?.text || ''
}

const toLocationSuggestion = (feature: MapboxFeature): LocationSuggestion | null => {
  if (!feature.center || feature.center.length !== 2) return null
  const [longitude, latitude] = feature.center
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const city =
    extractContextValue(feature, ['place', 'locality', 'district']) ||
    feature.text ||
    ''
  const postalCode =
    feature.properties?.postcode ||
    extractContextValue(feature, ['postcode']) ||
    ''

  return {
    id: feature.id,
    label: feature.place_name || feature.text || '',
    address: feature.place_name || '',
    city,
    postalCode,
    latitude,
    longitude,
  }
}

type AdminSection = 'informations' | 'localisation' | 'menus' | 'photos'

export default function ChefFormPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const chefId = searchParams.get('id')
  const isEditing = !!chefId
  const supabase = createClient()

  const [isPageLoading, setIsPageLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeSection, setActiveSection] = useState<AdminSection>('informations')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    emailConfirm: '',
    phone: '',
    address: '',
    latitude: null as number | null,
    longitude: null as number | null,
    city: '',
    postal_code: '',
    cuisine_style: '',
    min_guests: '',
    max_guests: '',
    profile_picture: null as File | null,
  })
  const [menus, setMenus] = useState<Menu[]>([])
  const [newMenu, setNewMenu] = useState({ name: '', description: '', price: '' })
  const [currentProfilePicture, setCurrentProfilePicture] = useState<string | null>(null)
  const [pendingProfilePreview, setPendingProfilePreview] = useState<string | null>(null)
  const [dishPhotoFiles, setDishPhotoFiles] = useState<File[]>([])
  const [dishPhotoPreviews, setDishPhotoPreviews] = useState<string[]>([])
  const [currentDishPhotos, setCurrentDishPhotos] = useState<string[]>([])
  const [primaryDishIndex, setPrimaryDishIndex] = useState(0)
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  })
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([])
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false)
  const [isLoadingLocationSuggestions, setIsLoadingLocationSuggestions] = useState(false)
  const [manualLocationMode, setManualLocationMode] = useState(false)
  const [citySuggestions, setCitySuggestions] = useState<FrenchCitySuggestion[]>([])
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false)
  const [isLoadingCitySuggestions, setIsLoadingCitySuggestions] = useState(false)
  const [selectedCitySuggestion, setSelectedCitySuggestion] = useState<FrenchCitySuggestion | null>(null)
  const [postalSuggestions, setPostalSuggestions] = useState<PostalSuggestion[]>([])
  const [isPostalDropdownOpen, setIsPostalDropdownOpen] = useState(false)
  const [isLoadingPostalSuggestions, setIsLoadingPostalSuggestions] = useState(false)

  const profileFileInputRef = useRef<HTMLInputElement | null>(null)
  const dishFileInputRef = useRef<HTMLInputElement | null>(null)
  const isSubmittingRef = useRef(false)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const locationAbortRef = useRef<AbortController | null>(null)
  const locationContainerRef = useRef<HTMLDivElement | null>(null)
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cityContainerRef = useRef<HTMLDivElement | null>(null)
  const postalDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const postalContainerRef = useRef<HTMLDivElement | null>(null)
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => reject(new Error('Impossible de lire le fichier'))
      reader.readAsDataURL(file)
    })

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    setToast({ visible: true, message, type })
    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }))
    }, 2500)
  }

  useEffect(() => {
    if (isEditing && chefId) {
      fetchChefData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chefId, isEditing])

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current)
      }
      if (locationDebounceRef.current) {
        clearTimeout(locationDebounceRef.current)
      }
      if (locationAbortRef.current) {
        locationAbortRef.current.abort()
      }
      if (cityDebounceRef.current) {
        clearTimeout(cityDebounceRef.current)
      }
      if (postalDebounceRef.current) {
        clearTimeout(postalDebounceRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!locationContainerRef.current) return
      const target = event.target as Node
      if (
        locationContainerRef.current.contains(target) ||
        cityContainerRef.current?.contains(target) ||
        postalContainerRef.current?.contains(target)
      ) return
      setIsLocationDropdownOpen(false)
      setIsCityDropdownOpen(false)
      setIsPostalDropdownOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
    }
  }, [])

  useEffect(() => {
    const query = formData.address.trim()
    if (!isLocationDropdownOpen || query.length < 3 || !mapboxToken) {
      setLocationSuggestions([])
      setIsLoadingLocationSuggestions(false)
      return
    }

    if (locationDebounceRef.current) {
      clearTimeout(locationDebounceRef.current)
    }

    locationDebounceRef.current = setTimeout(async () => {
      if (locationAbortRef.current) {
        locationAbortRef.current.abort()
      }

      const controller = new AbortController()
      locationAbortRef.current = controller
      setIsLoadingLocationSuggestions(true)

      try {
        const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?autocomplete=true&limit=5&language=fr&country=fr&types=address,place,postcode,locality&access_token=${mapboxToken}`
        const response = await fetch(endpoint, { signal: controller.signal })
        if (!response.ok) {
          throw new Error('Erreur Mapbox')
        }
        const payload = await response.json()
        const features = Array.isArray(payload?.features) ? payload.features : []
        const suggestions = features
          .map((feature: MapboxFeature) => toLocationSuggestion(feature))
          .filter((suggestion: LocationSuggestion | null): suggestion is LocationSuggestion => !!suggestion)
        setLocationSuggestions(suggestions)
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          console.error('Mapbox autocomplete error:', error)
        }
      } finally {
        setIsLoadingLocationSuggestions(false)
      }
    }, 250)

    return () => {
      if (locationDebounceRef.current) {
        clearTimeout(locationDebounceRef.current)
      }
    }
  }, [formData.address, isLocationDropdownOpen, mapboxToken])

  useEffect(() => {
    const query = formData.city.trim()
    if (!manualLocationMode || !isCityDropdownOpen || query.length < 2) {
      setCitySuggestions([])
      setIsLoadingCitySuggestions(false)
      return
    }

    if (cityDebounceRef.current) {
      clearTimeout(cityDebounceRef.current)
    }

    cityDebounceRef.current = setTimeout(async () => {
      setIsLoadingCitySuggestions(true)

      try {
        const endpoint = `/api/location/fr-communes?nom=${encodeURIComponent(query)}&limit=8`
        const response = await fetch(endpoint)
        if (!response.ok) {
          throw new Error('Erreur autocomplete communes')
        }
        const payload = await response.json()
        const suggestions = Array.isArray(payload)
          ? payload.map((item: any) => ({
              code: String(item?.code || ''),
              name: String(item?.nom || ''),
              postalCodes: Array.isArray(item?.codesPostaux)
                ? item.codesPostaux.map((postal: unknown) => String(postal)).filter(Boolean)
                : [],
            })).filter((item: FrenchCitySuggestion) => item.code && item.name)
          : []
        setCitySuggestions(suggestions)
      } catch (error: any) {
        console.error('City autocomplete error:', error)
      } finally {
        setIsLoadingCitySuggestions(false)
      }
    }, 220)

    return () => {
      if (cityDebounceRef.current) {
        clearTimeout(cityDebounceRef.current)
      }
    }
  }, [formData.city, manualLocationMode, isCityDropdownOpen])

  useEffect(() => {
    const query = formData.postal_code.trim()
    if (!manualLocationMode || !isPostalDropdownOpen || query.length < 2) {
      setPostalSuggestions([])
      setIsLoadingPostalSuggestions(false)
      return
    }

    if (postalDebounceRef.current) {
      clearTimeout(postalDebounceRef.current)
    }

    postalDebounceRef.current = setTimeout(async () => {
      setIsLoadingPostalSuggestions(true)

      try {
        const endpoint = `/api/location/fr-communes?codePostal=${encodeURIComponent(query)}&limit=20`
        const response = await fetch(endpoint)
        if (!response.ok) {
          throw new Error('Erreur autocomplete code postal')
        }
        const payload = await response.json()
        const flattenedSuggestions: PostalSuggestion[] = Array.isArray(payload)
          ? payload.flatMap((item: any) => {
              const cityName = String(item?.nom || '')
              const cityCode = String(item?.code || '')
              const allPostalCodes = Array.isArray(item?.codesPostaux)
                ? item.codesPostaux.map((postal: unknown) => String(postal)).filter(Boolean)
                : []
              return allPostalCodes
                .filter((postalCode: string) => postalCode.startsWith(query))
                .map((postalCode: string) => ({
                  cityCode,
                  cityName,
                  postalCode,
                  cityPostalCodes: allPostalCodes,
                }))
            })
          : []
        const deduped = flattenedSuggestions.filter(
          (item, index, arr) =>
            arr.findIndex((other) => other.postalCode === item.postalCode && other.cityCode === item.cityCode) === index
        )
        setPostalSuggestions(deduped.slice(0, 12))
      } catch (error) {
        console.error('Postal autocomplete error:', error)
      } finally {
        setIsLoadingPostalSuggestions(false)
      }
    }, 220)

    return () => {
      if (postalDebounceRef.current) {
        clearTimeout(postalDebounceRef.current)
      }
    }
  }, [formData.postal_code, manualLocationMode, isPostalDropdownOpen])

  const fetchChefData = async () => {
    if (!chefId) return
    try {
      setIsPageLoading(true)
      const { data: chef, error } = await supabase
        .from('chefs')
        .select('*')
        .eq('id', chefId)
        .single()

      if (error) throw error

      const chefData = chef as any
      setFormData({
        name: chefData.name || '',
        email: chefData.email || '',
        emailConfirm: chefData.email || '',
        phone: chefData.phone || '',
        address: chefData.address || '',
        latitude: typeof chefData.latitude === 'number' ? chefData.latitude : null,
        longitude: typeof chefData.longitude === 'number' ? chefData.longitude : null,
        city: chefData.city || '',
        postal_code: chefData.postal_code || '',
        cuisine_style: chefData.cuisine_style || '',
        min_guests: chefData.min_guests ? String(chefData.min_guests) : '',
        max_guests: chefData.max_guests ? String(chefData.max_guests) : '',
        profile_picture: null,
      })
      setManualLocationMode(!chefData.address && !!chefData.city)
      setCurrentProfilePicture(chefData.profile_picture)
      setCurrentDishPhotos(Array.isArray(chefData.dish_photos) ? chefData.dish_photos : [])
      setPrimaryDishIndex(0)

      const { data: menusData } = await supabase
        .from('menus')
        .select('*')
        .eq('chef_id', chefId)

      setMenus(menusData || [])
    } catch (error) {
      console.error('Error fetching chef:', error)
      showToast('Erreur lors du chargement du chef', 'error')
      router.push('/admin?section=chefs')
    } finally {
      setIsPageLoading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const preview = await fileToDataUrl(file)
      setPendingProfilePreview(preview)
      setFormData((prev) => ({ ...prev, profile_picture: file }))
    }
  }

  const removeProfilePicture = () => {
    setFormData(prev => ({ ...prev, profile_picture: null }))
    setCurrentProfilePicture(null)
    if (profileFileInputRef.current) {
      profileFileInputRef.current.value = ''
    }
  }

  const appendDishFiles = async (files: File[]) => {
    if (!files.length) return
    const remainingSlots = Math.max(0, 3 - (currentDishPhotos.length + dishPhotoFiles.length))
    const selected = files.slice(0, remainingSlots)
    if (!selected.length) return
    const previews = await Promise.all(selected.map((file) => fileToDataUrl(file)))
    setDishPhotoFiles(prev => [...prev, ...selected])
    setDishPhotoPreviews(prev => [...prev, ...previews])
  }

  const handleDishPhotosChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    await appendDishFiles(Array.from(e.target.files))
  }

  const removeCurrentDishPhoto = (index: number) => {
    setCurrentDishPhotos(prev => prev.filter((_, i) => i !== index))
    setPrimaryDishIndex((prev) => Math.max(0, prev === index ? 0 : prev > index ? prev - 1 : prev))
  }

  const removePendingDishPhoto = (index: number) => {
    setDishPhotoFiles(prev => prev.filter((_, i) => i !== index))
    setDishPhotoPreviews(prev => prev.filter((_, i) => i !== index))
    const offsetIndex = currentDishPhotos.length + index
    setPrimaryDishIndex((prev) => Math.max(0, prev === offsetIndex ? 0 : prev > offsetIndex ? prev - 1 : prev))
  }

  const uploadProfilePicture = async (file: File, uploadChefId: string): Promise<string | null> => {
    try {
      setUploading(true)
      const fileExt = file.name.split('.').pop()
      const fileName = `${uploadChefId}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `chef-profiles/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('chef-profiles')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('chef-profiles').getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading profile picture:', error)
      showToast('Erreur lors de l\'upload de la photo', 'error')
      return null
    } finally {
      setUploading(false)
    }
  }

  const uploadDishPhotos = async (files: File[], uploadChefId: string): Promise<string[]> => {
    if (!files.length) return []
    try {
      setUploading(true)
      const uploads = files.map(async (file) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${uploadChefId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `chef-dishes/${uploadChefId}/${fileName}`
        const { error: uploadError } = await supabase.storage
          .from('chef-profiles')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          throw uploadError
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('chef-profiles').getPublicUrl(filePath)

        return publicUrl
      })

      return await Promise.all(uploads)
    } catch (error) {
      console.error('Error uploading dish photos:', error)
      showToast('Erreur lors de l\'upload des photos de plats', 'error')
      return []
    } finally {
      setUploading(false)
    }
  }

  const handleAddressInputChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      address: value,
      latitude: null,
      longitude: null,
      city: '',
      postal_code: '',
    }))
    setIsLocationDropdownOpen(true)
  }

  const handleManualLocationToggle = (checked: boolean) => {
    setManualLocationMode(checked)
    setIsLocationDropdownOpen(false)
    setIsCityDropdownOpen(false)
    setIsPostalDropdownOpen(false)
    setLocationSuggestions([])
    setCitySuggestions([])
    setPostalSuggestions([])
    setSelectedCitySuggestion(null)

    if (checked) {
      setFormData((prev) => ({
        ...prev,
        address: '',
        latitude: null,
        longitude: null,
      }))
      return
    }

    setFormData((prev) => ({
      ...prev,
      city: '',
      postal_code: '',
      latitude: null,
      longitude: null,
    }))
  }

  const handleManualCityInputChange = (value: string) => {
    setFormData((prev) => ({ ...prev, city: value, postal_code: '' }))
    setSelectedCitySuggestion(null)
    setIsCityDropdownOpen(true)
    setIsPostalDropdownOpen(false)
  }

  const handleSelectManualCity = (suggestion: FrenchCitySuggestion) => {
    const defaultPostal = suggestion.postalCodes[0] || ''
    setSelectedCitySuggestion(suggestion)
    setFormData((prev) => ({
      ...prev,
      city: suggestion.name,
      postal_code: defaultPostal,
      latitude: null,
      longitude: null,
    }))
    setIsCityDropdownOpen(false)
    setCitySuggestions([])
  }

  const handleManualPostalCodeChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 5)
    setFormData((prev) => ({ ...prev, postal_code: digitsOnly, latitude: null, longitude: null }))
    setSelectedCitySuggestion(null)
    setIsPostalDropdownOpen(true)
    setIsCityDropdownOpen(false)
  }

  const handleSelectManualPostalSuggestion = (suggestion: PostalSuggestion) => {
    const citySuggestion: FrenchCitySuggestion = {
      code: suggestion.cityCode,
      name: suggestion.cityName,
      postalCodes: suggestion.cityPostalCodes,
    }
    setSelectedCitySuggestion(citySuggestion)
    setFormData((prev) => ({
      ...prev,
      city: suggestion.cityName,
      postal_code: suggestion.postalCode,
      latitude: null,
      longitude: null,
    }))
    setIsPostalDropdownOpen(false)
    setPostalSuggestions([])
  }

  const geocodeManualLocation = async (city: string, postalCode: string) => {
    if (!mapboxToken) {
      throw new Error('Mapbox non configuré')
    }
    const query = `${city} ${postalCode} France`
    const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&language=fr&country=fr&types=address,place,postcode,locality&access_token=${mapboxToken}`
    const response = await fetch(endpoint)
    if (!response.ok) {
      throw new Error('Erreur géocodage Mapbox')
    }
    const payload = await response.json()
    const firstFeature = Array.isArray(payload?.features) ? payload.features[0] : null
    const suggestion = firstFeature ? toLocationSuggestion(firstFeature as MapboxFeature) : null
    if (!suggestion) {
      throw new Error('Impossible de générer les coordonnées pour cette ville et ce code postal')
    }
    return suggestion
  }

  const handleSelectLocation = (suggestion: LocationSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      address: suggestion.address,
      city: suggestion.city,
      postal_code: suggestion.postalCode,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    }))
    setLocationSuggestions([])
    setIsLocationDropdownOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    if (formData.email !== formData.emailConfirm) {
      showToast('Les emails ne correspondent pas', 'error')
      isSubmittingRef.current = false
      return
    }

    const minGuestsValue = formData.min_guests.trim() ? Number.parseInt(formData.min_guests, 10) : null
    const maxGuestsValue = formData.max_guests.trim() ? Number.parseInt(formData.max_guests, 10) : null
    if (minGuestsValue !== null && (!Number.isFinite(minGuestsValue) || minGuestsValue < 1)) {
      showToast('Le minimum de convives doit être supérieur ou égal à 1', 'error')
      isSubmittingRef.current = false
      return
    }
    if (maxGuestsValue !== null && (!Number.isFinite(maxGuestsValue) || maxGuestsValue < 1)) {
      showToast('Le maximum de convives doit être supérieur ou égal à 1', 'error')
      isSubmittingRef.current = false
      return
    }
    if (minGuestsValue !== null && maxGuestsValue !== null && minGuestsValue > maxGuestsValue) {
      showToast('Le minimum de convives doit être inférieur ou égal au maximum', 'error')
      isSubmittingRef.current = false
      return
    }
    if (!manualLocationMode && formData.address.trim() && (formData.latitude === null || formData.longitude === null)) {
      showToast('Sélectionnez une adresse dans les suggestions pour enregistrer les coordonnées', 'error')
      isSubmittingRef.current = false
      return
    }

    try {
      setIsSaving(true)
      const slug = formData.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

      let profilePictureUrl = currentProfilePicture
      const tempId = chefId || crypto.randomUUID()

      if (formData.profile_picture) {
        const uploadedUrl = await uploadProfilePicture(formData.profile_picture, tempId)
        if (uploadedUrl) {
          profilePictureUrl = uploadedUrl
        }
      }

      const uploadedDishPhotos = await uploadDishPhotos(dishPhotoFiles, tempId)
      const mergedDishPhotos = [...currentDishPhotos, ...uploadedDishPhotos].slice(0, 3)
      const dishPhotos = [...mergedDishPhotos]
      if (dishPhotos.length > 1 && primaryDishIndex >= 0 && primaryDishIndex < dishPhotos.length) {
        const [primaryPhoto] = dishPhotos.splice(primaryDishIndex, 1)
        dishPhotos.unshift(primaryPhoto)
      }

      let resolvedAddress = formData.address.trim() || null
      let resolvedCity = formData.city.trim() || null
      let resolvedPostalCode = formData.postal_code.trim() || null
      let resolvedLatitude = formData.address.trim() ? formData.latitude : null
      let resolvedLongitude = formData.address.trim() ? formData.longitude : null

      if (manualLocationMode) {
        if (!resolvedCity) {
          showToast('Sélectionnez une ville dans les suggestions', 'error')
          isSubmittingRef.current = false
          setIsSaving(false)
          return
        }
        if (!resolvedPostalCode || !/^\d{5}$/.test(resolvedPostalCode)) {
          showToast('Le code postal doit contenir exactement 5 chiffres', 'error')
          isSubmittingRef.current = false
          setIsSaving(false)
          return
        }
        if (selectedCitySuggestion && !selectedCitySuggestion.postalCodes.includes(resolvedPostalCode)) {
          showToast('Code postal invalide pour la ville sélectionnée', 'error')
          isSubmittingRef.current = false
          setIsSaving(false)
          return
        }

        const cityValidationRes = await fetch(
          `/api/location/fr-communes?nom=${encodeURIComponent(resolvedCity)}&codePostal=${encodeURIComponent(resolvedPostalCode)}&limit=1`
        )
        const cityValidationData = cityValidationRes.ok ? await cityValidationRes.json() : []
        if (!Array.isArray(cityValidationData) || cityValidationData.length === 0) {
          showToast('Ville/code postal non reconnus', 'error')
          isSubmittingRef.current = false
          setIsSaving(false)
          return
        }

        const geocoded = await geocodeManualLocation(resolvedCity, resolvedPostalCode)
        resolvedAddress = geocoded.address || `${resolvedCity} ${resolvedPostalCode}, France`
        resolvedLatitude = geocoded.latitude
        resolvedLongitude = geocoded.longitude
      }

      const payload = {
        slug,
        name: formData.name,
        email: formData.email.toLowerCase().trim(),
        phone: formData.phone || null,
        address: resolvedAddress,
        latitude: resolvedLatitude,
        longitude: resolvedLongitude,
        city: resolvedCity,
        postal_code: resolvedPostalCode,
        cuisine_style: formData.cuisine_style || null,
        min_guests: minGuestsValue,
        max_guests: maxGuestsValue,
        dish_photos: dishPhotos,
        profile_picture: profilePictureUrl,
        menus,
      }

      if (isEditing && chefId) {
        const response = await fetch('/api/admin/update-chef', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chefId, ...payload }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Erreur lors de la mise à jour')
        }
      } else {
        const response = await fetch('/api/admin/create-chef', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Erreur lors de la création')
        }
      }
      setCurrentProfilePicture(profilePictureUrl)
      setCurrentDishPhotos(dishPhotos)
      setPrimaryDishIndex(0)
      setFormData((prev) => ({ ...prev, profile_picture: null }))
      if (profileFileInputRef.current) {
        profileFileInputRef.current.value = ''
      }
      if (dishFileInputRef.current) {
        dishFileInputRef.current.value = ''
      }
      showToast(isEditing ? 'Modifications enregistrées' : 'Chef créé avec succès', 'success')
    } catch (error: any) {
      console.error('Error saving chef:', error)
      showToast(error.message || 'Erreur lors de la sauvegarde', 'error')
    } finally {
      setIsSaving(false)
      setDishPhotoFiles([])
      setDishPhotoPreviews([])
      isSubmittingRef.current = false
    }
  }

  const addMenu = () => {
    if (!newMenu.name.trim()) return
    setMenus((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        chef_id: chefId || 'temp',
        name: newMenu.name,
        description: newMenu.description || null,
        price: newMenu.price ? parseFloat(newMenu.price) : null,
      },
    ])
    setNewMenu({ name: '', description: '', price: '' })
  }

  const removeMenu = (menuId: string) => {
    setMenus((prev) => prev.filter((menu) => menu.id !== menuId))
  }

  const publicSlug = formData.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  const profilePreviewUrl = pendingProfilePreview || currentProfilePicture
  const allDishPhotos = [
    ...currentDishPhotos.map((url) => ({ kind: 'current' as const, url })),
    ...dishPhotoPreviews.map((url) => ({ kind: 'pending' as const, url })),
  ]

  if (isPageLoading && isEditing) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-500">Chargement du profil...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-[#111111]">
      <header className="sticky top-0 z-10 border-b border-[#EAEAEA] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin?section=chefs')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#EAEAEA] bg-white text-[#111111] transition hover:bg-gray-50"
              aria-label="Retour"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-semibold">{isEditing ? 'Modifier le chef' : 'Ajouter un chef'}</h1>
              <p className="text-sm text-[#6B7280]">Interface de configuration du profil</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-0 px-4 py-6 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
        <aside className="h-fit border-b border-[#EAEAEA] bg-white pb-6 lg:sticky lg:top-24 lg:border-b-0 lg:border-r lg:pr-6">
          <div className="flex flex-col items-center lg:items-start">
            <div className="relative mb-4">
              {profilePreviewUrl ? (
                <img src={profilePreviewUrl} alt="Avatar chef" className="h-[120px] w-[120px] rounded-full object-cover ring-1 ring-[#EAEAEA]" />
              ) : (
                <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-gray-100 text-3xl">👨‍🍳</div>
              )}
            </div>
            <p className="text-base font-semibold">{formData.name || 'Chef'}</p>
            <p className="mb-4 text-sm text-[#6B7280]">{formData.email || 'email@exemple.com'}</p>
            <a
              href={publicSlug ? `/book/${publicSlug}` : '#'}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex h-10 items-center rounded-[10px] border px-4 text-sm ${publicSlug ? 'border-[#EAEAEA] hover:bg-gray-50' : 'cursor-not-allowed border-[#F0F0F0] text-[#9CA3AF]'}`}
            >
              Voir le formulaire
            </a>
          </div>

          <nav className="mt-8 space-y-1">
            {[
              { key: 'informations', label: 'Informations' },
              { key: 'localisation', label: 'Localisation' },
              { key: 'menus', label: 'Menus' },
              { key: 'photos', label: 'Photos' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveSection(item.key as AdminSection)}
                className={`w-full rounded-[10px] px-3 py-2 text-left text-sm transition ${
                  activeSection === item.key ? 'bg-gray-100 text-[#111111]' : 'text-[#6B7280] hover:bg-gray-50 hover:text-[#111111]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="pt-6 lg:pl-8 lg:pt-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            {activeSection === 'informations' && (
              <section className="rounded-[12px] border border-[#EAEAEA] bg-white p-5 sm:p-6">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#6B7280]">Informations</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Nom du chef</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Jean Dupont"
                      className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-white px-3 text-sm outline-none transition focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="chef@example.com"
                      className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-white px-3 text-sm outline-none transition focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Confirmer email</label>
                    <input
                      type="email"
                      required
                      value={formData.emailConfirm}
                      onChange={(e) => setFormData({ ...formData, emailConfirm: e.target.value })}
                      placeholder="chef@example.com"
                      className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-white px-3 text-sm outline-none transition focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Téléphone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+33 6 12 34 56 78"
                      className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-white px-3 text-sm outline-none transition focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Style de cuisine</label>
                    <input
                      type="text"
                      value={formData.cuisine_style}
                      onChange={(e) => setFormData({ ...formData, cuisine_style: e.target.value })}
                      placeholder="Cuisine française moderne"
                      className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-white px-3 text-sm outline-none transition focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Convives min</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.min_guests}
                      onChange={(e) => setFormData({ ...formData, min_guests: e.target.value })}
                      placeholder="2"
                      className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-white px-3 text-sm outline-none transition focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Convives max</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.max_guests}
                      onChange={(e) => setFormData({ ...formData, max_guests: e.target.value })}
                      placeholder="12"
                      className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-white px-3 text-sm outline-none transition focus:border-black"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => router.push('/admin?section=chefs')} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#EAEAEA] bg-white px-5 text-sm font-medium text-[#111111] hover:bg-gray-50">
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || uploading}
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-5 text-sm font-semibold transition disabled:cursor-not-allowed ${
                      isSaving || uploading
                        ? 'bg-black text-white opacity-80'
                        : 'bg-gradient-to-r from-[#FBCF03] to-[#E8BC00] text-black shadow-sm hover:from-[#f4c800] hover:to-[#d9ad00]'
                    }`}
                  >
                    {(isSaving || uploading) && (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                      </svg>
                    )}
                    {isSaving || uploading ? 'Enregistrement...' : isEditing ? 'Enregistrer les modifications' : 'Créer le chef'}
                  </button>
                </div>
              </section>
            )}

            {activeSection === 'localisation' && (
              <section className="rounded-[12px] border border-[#EAEAEA] bg-white p-5 sm:p-6">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#6B7280]">Localisation</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Adresse complète</label>
                    <div ref={locationContainerRef} className="relative">
                      <input
                        type="text"
                        name="chef_address_input"
                        autoComplete="new-password"
                        value={formData.address}
                        onChange={(e) => handleAddressInputChange(e.target.value)}
                        onFocus={() => setIsLocationDropdownOpen(true)}
                        placeholder="Adresse complète"
                        disabled={manualLocationMode}
                        className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-white px-3 text-sm outline-none transition focus:border-black"
                      />
                      {isLocationDropdownOpen && !manualLocationMode && (isLoadingLocationSuggestions || locationSuggestions.length > 0) && (
                        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[10px] border border-[#EAEAEA] bg-white shadow-sm">
                          {isLoadingLocationSuggestions ? (
                            <p className="px-3 py-2 text-sm text-[#6B7280]">Recherche...</p>
                          ) : (
                            locationSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.id}
                                type="button"
                                onClick={() => handleSelectLocation(suggestion)}
                                className="block w-full border-b border-[#F5F5F5] px-3 py-2 text-left text-sm last:border-b-0 hover:bg-gray-50"
                              >
                                {suggestion.label}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <label className="mt-3 inline-flex items-center gap-2 text-sm text-[#374151]">
                      <input
                        type="checkbox"
                        checked={manualLocationMode}
                        onChange={(e) => handleManualLocationToggle(e.target.checked)}
                        className="h-4 w-4 rounded border-[#D1D5DB] text-black focus:ring-0"
                      />
                      Je ne trouve pas l&apos;adresse
                    </label>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      {manualLocationMode ? 'Ville' : 'Ville (auto)'}
                    </label>
                    {manualLocationMode ? (
                      <div ref={cityContainerRef} className="relative">
                        <input
                          type="text"
                          name="chef_city_input"
                          autoComplete="new-password"
                          value={formData.city}
                          onChange={(e) => handleManualCityInputChange(e.target.value)}
                          onFocus={() => setIsCityDropdownOpen(true)}
                          placeholder="Sélectionner une commune"
                          className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-white px-3 text-sm outline-none transition focus:border-black"
                        />
                        {isCityDropdownOpen && (isLoadingCitySuggestions || citySuggestions.length > 0) && (
                          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[10px] border border-[#EAEAEA] bg-white shadow-sm">
                            {isLoadingCitySuggestions ? (
                              <p className="px-3 py-2 text-sm text-[#6B7280]">Recherche...</p>
                            ) : (
                              citySuggestions.map((suggestion) => (
                                <button
                                  key={suggestion.code}
                                  type="button"
                                  onClick={() => handleSelectManualCity(suggestion)}
                                  className="block w-full border-b border-[#F5F5F5] px-3 py-2 text-left text-sm last:border-b-0 hover:bg-gray-50"
                                >
                                  {suggestion.name}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        name="chef_city_input"
                        autoComplete="new-password"
                        readOnly
                        value={formData.city}
                        placeholder="Extrait de l'adresse"
                        className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-[#FAFAFA] px-3 text-sm text-[#374151] outline-none"
                      />
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                      {manualLocationMode ? 'Code postal' : 'Code postal (auto)'}
                    </label>
                    {manualLocationMode ? (
                      <div ref={postalContainerRef} className="relative">
                        <input
                          type="text"
                          name="chef_postal_code_input"
                          autoComplete="new-password"
                          inputMode="numeric"
                          pattern="[0-9]{5}"
                          maxLength={5}
                          value={formData.postal_code}
                          onFocus={() => setIsPostalDropdownOpen(true)}
                          onChange={(e) => handleManualPostalCodeChange(e.target.value)}
                          placeholder="Ex: 13009"
                          className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-white px-3 text-sm outline-none transition focus:border-black"
                        />
                        {isPostalDropdownOpen && (isLoadingPostalSuggestions || postalSuggestions.length > 0) && (
                          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-[10px] border border-[#EAEAEA] bg-white shadow-sm">
                            {isLoadingPostalSuggestions ? (
                              <p className="px-3 py-2 text-sm text-[#6B7280]">Recherche...</p>
                            ) : (
                              postalSuggestions.map((suggestion) => (
                                <button
                                  key={`${suggestion.cityCode}-${suggestion.postalCode}`}
                                  type="button"
                                  onClick={() => handleSelectManualPostalSuggestion(suggestion)}
                                  className="block w-full border-b border-[#F5F5F5] px-3 py-2 text-left text-sm last:border-b-0 hover:bg-gray-50"
                                >
                                  {suggestion.postalCode} - {suggestion.cityName}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        name="chef_postal_code_input"
                        autoComplete="new-password"
                        readOnly
                        inputMode="numeric"
                        pattern="[0-9]{5}"
                        maxLength={5}
                        value={formData.postal_code}
                        placeholder="Extrait de l'adresse"
                        className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-[#FAFAFA] px-3 text-sm text-[#374151] outline-none"
                      />
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Latitude</label>
                    <input
                      type="text"
                      name="chef_latitude_input"
                      autoComplete="new-password"
                      readOnly
                      value={formData.latitude ?? ''}
                      placeholder="Auto"
                      className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-[#FAFAFA] px-3 text-sm text-[#374151] outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Longitude</label>
                    <input
                      type="text"
                      name="chef_longitude_input"
                      autoComplete="new-password"
                      readOnly
                      value={formData.longitude ?? ''}
                      placeholder="Auto"
                      className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-[#FAFAFA] px-3 text-sm text-[#374151] outline-none"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => router.push('/admin?section=chefs')} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#EAEAEA] bg-white px-5 text-sm font-medium text-[#111111] hover:bg-gray-50">
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || uploading}
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-5 text-sm font-semibold transition disabled:cursor-not-allowed ${
                      isSaving || uploading
                        ? 'bg-black text-white opacity-80'
                        : 'bg-gradient-to-r from-[#FBCF03] to-[#E8BC00] text-black shadow-sm hover:from-[#f4c800] hover:to-[#d9ad00]'
                    }`}
                  >
                    {(isSaving || uploading) && (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                      </svg>
                    )}
                    {isSaving || uploading ? 'Enregistrement...' : isEditing ? 'Enregistrer les modifications' : 'Créer le chef'}
                  </button>
                </div>
              </section>
            )}

            {activeSection === 'menus' && (
              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#6B7280]">Menus</h2>

                {menus.length > 0 && (
                  <div className="space-y-4">
                    {menus.map((menu) => (
                      <div key={menu.id} className="rounded-[12px] border border-[#EAEAEA] p-4 transition hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-black">{menu.name}</h3>
                            {menu.description && <p className="mt-1 text-sm text-[#6B7280]">{menu.description}</p>}
                            {menu.price && <p className="mt-2 text-sm font-semibold text-black">{menu.price.toFixed(2)} €</p>}
                          </div>
                          <details className="relative">
                            <summary className="cursor-pointer list-none rounded px-2 py-1 text-[#6B7280] hover:bg-gray-100">⋯</summary>
                            <div className="absolute right-0 mt-2 w-32 rounded-[10px] border border-[#EAEAEA] bg-white p-1 shadow-sm">
                              <button type="button" className="w-full rounded px-2 py-1 text-left text-sm text-[#6B7280] hover:bg-gray-50">
                                Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() => removeMenu(menu.id)}
                                className="w-full rounded px-2 py-1 text-left text-sm text-red-600 hover:bg-red-50"
                              >
                                Supprimer
                              </button>
                            </div>
                          </details>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 rounded-[12px] border border-[#EAEAEA] bg-white p-4">
                  <p className="mb-3 text-sm font-semibold">Ajouter un menu</p>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Nom du menu</label>
                      <input
                        type="text"
                        placeholder="Ex: Menu Découverte"
                        value={newMenu.name}
                        onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })}
                        className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-white px-3 text-sm outline-none transition focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Description</label>
                      <textarea
                        placeholder="Description du menu"
                        value={newMenu.description}
                        onChange={(e) => setNewMenu({ ...newMenu, description: e.target.value })}
                        rows={3}
                        className="w-full rounded-[10px] border border-[#EAEAEA] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-black"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Prix (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={newMenu.price}
                          onChange={(e) => setNewMenu({ ...newMenu, price: e.target.value })}
                          className="h-11 w-full rounded-[10px] border border-[#EAEAEA] bg-white px-3 text-sm outline-none transition focus:border-black"
                        />
                      </div>
                      <div className="flex items-end">
                        <button type="button" onClick={addMenu} disabled={!newMenu.name.trim()} className="inline-flex h-11 items-center rounded-[10px] bg-black px-5 text-sm font-medium text-white disabled:opacity-50">
                          Ajouter le menu
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => router.push('/admin?section=chefs')} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#EAEAEA] bg-white px-5 text-sm font-medium text-[#111111] hover:bg-gray-50">
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || uploading}
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-5 text-sm font-semibold transition disabled:cursor-not-allowed ${
                      isSaving || uploading
                        ? 'bg-black text-white opacity-80'
                        : 'bg-gradient-to-r from-[#FBCF03] to-[#E8BC00] text-black shadow-sm hover:from-[#f4c800] hover:to-[#d9ad00]'
                    }`}
                  >
                    {(isSaving || uploading) && (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                      </svg>
                    )}
                    {isSaving || uploading ? 'Enregistrement...' : isEditing ? 'Enregistrer les modifications' : 'Créer le chef'}
                  </button>
                </div>
              </section>
            )}

            {activeSection === 'photos' && (
              <section className="rounded-[12px] border border-[#EAEAEA] bg-white p-5 sm:p-6">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#6B7280]">Photos</h2>
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Photo de profil</p>
                    <div className="flex items-center gap-4">
                      <div className="group relative">
                        {profilePreviewUrl ? (
                          <img src={profilePreviewUrl} alt="Avatar chef" className="h-[120px] w-[120px] rounded-full object-cover ring-1 ring-[#EAEAEA]" />
                        ) : (
                          <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-gray-100 text-3xl">👨‍🍳</div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-black/45 opacity-0 transition group-hover:opacity-100">
                          <button type="button" onClick={() => profileFileInputRef.current?.click()} className="rounded bg-white/90 px-2 py-1 text-xs">
                            Changer
                          </button>
                          <button type="button" onClick={removeProfilePicture} className="rounded bg-white/90 px-2 py-1 text-xs text-red-600">
                            Supprimer
                          </button>
                        </div>
                      </div>
                      <input ref={profileFileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                      <button
                        type="button"
                        onClick={() => profileFileInputRef.current?.click()}
                        className="inline-flex h-10 items-center rounded-[10px] border border-[#EAEAEA] px-4 text-sm hover:bg-gray-50"
                      >
                        Choisir une image
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Photos des plats (max 3)</p>
                    <div
                      className={`rounded-[12px] border border-dashed p-5 text-center ${allDishPhotos.length >= 3 ? 'border-gray-200 bg-gray-50' : 'border-[#EAEAEA] bg-white'}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (allDishPhotos.length >= 3) return
                        const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith('image/'))
                        void appendDishFiles(files)
                      }}
                    >
                      <input
                        ref={dishFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleDishPhotosChange}
                        className="hidden"
                        disabled={allDishPhotos.length >= 3}
                      />
                      <button
                        type="button"
                        onClick={() => dishFileInputRef.current?.click()}
                        disabled={allDishPhotos.length >= 3}
                        className="mx-auto mb-2 inline-flex h-10 items-center rounded-[10px] border border-[#EAEAEA] px-4 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Glissez vos photos ici ou cliquez pour ajouter
                      </button>
                      <p className="text-xs text-[#6B7280]">JPG, PNG - 5MB max</p>
                      {allDishPhotos.length >= 3 && <p className="mt-1 text-xs text-[#6B7280]">Maximum atteint</p>}
                    </div>
                  </div>

                  {allDishPhotos.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {allDishPhotos.map((photo, index) => (
                        <div key={`${photo.url}-${index}`} className="group relative overflow-hidden rounded-[12px] border border-[#EAEAEA]">
                          <img src={photo.url} alt={`Plat ${index + 1}`} className="aspect-square w-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/35" />
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 transition group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => setPrimaryDishIndex(index)}
                              className={`rounded px-2 py-1 text-xs ${primaryDishIndex === index ? 'bg-yellow-200 text-black' : 'bg-white/90 text-black'}`}
                            >
                              ★ Principale
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (photo.kind === 'current') {
                                  removeCurrentDishPhoto(index)
                                } else {
                                  removePendingDishPhoto(index - currentDishPhotos.length)
                                }
                              }}
                              className="rounded bg-white/90 px-2 py-1 text-xs text-red-600"
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => router.push('/admin?section=chefs')} className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[#EAEAEA] bg-white px-5 text-sm font-medium text-[#111111] hover:bg-gray-50">
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || uploading}
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-5 text-sm font-semibold transition disabled:cursor-not-allowed ${
                      isSaving || uploading
                        ? 'bg-black text-white opacity-80'
                        : 'bg-gradient-to-r from-[#FBCF03] to-[#E8BC00] text-black shadow-sm hover:from-[#f4c800] hover:to-[#d9ad00]'
                    }`}
                  >
                    {(isSaving || uploading) && (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
                      </svg>
                    )}
                    {isSaving || uploading ? 'Enregistrement...' : isEditing ? 'Enregistrer les modifications' : 'Créer le chef'}
                  </button>
                </div>
              </section>
            )}
          </form>
        </main>
      </div>
      <div className={`pointer-events-none fixed bottom-5 right-5 z-50 transition-all duration-300 ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
        <div className={`rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${toast.type === 'error' ? 'bg-[#1f1f1f]' : 'bg-black'}`}>
          {toast.type === 'success' ? '✔ ' : '✖ '}
          {toast.message}
        </div>
      </div>
    </div>
  )
}
