'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/hooks/useTranslation'
import { type Locale } from '@/lib/i18n'

export default function BookingHeader() {
  const { t, locale, changeLocale } = useTranslation()
  const [showStepper, setShowStepper] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isLangOpen, setIsLangOpen] = useState(false)
  const langDropdownRef = useRef<HTMLDivElement>(null)
  const langButtonRef = useRef<HTMLButtonElement>(null)

  const languages: { code: Locale; label: string }[] = [
    { code: 'fr', label: 'FR' },
    { code: 'en', label: 'EN' },
  ]

  const currentLanguage = languages.find((lang) => lang.code === locale) || languages[0]

  // Close language dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        langDropdownRef.current &&
        langButtonRef.current &&
        !langDropdownRef.current.contains(event.target as Node) &&
        !langButtonRef.current.contains(event.target as Node)
      ) {
        setIsLangOpen(false)
      }
    }

    if (isLangOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isLangOpen])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Bloquer le scroll du body quand la popup est ouverte
  useEffect(() => {
    if (showStepper) {
      // Sauvegarder la position actuelle du scroll
      const scrollY = window.scrollY
      // Bloquer le scroll
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      document.body.style.overflow = 'hidden'
      
      return () => {
        // Restaurer le scroll quand la popup se ferme
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        document.body.style.overflow = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [showStepper])

  // Même logique que dans ChatInterface - pour le formulaire, on est à l'étape 1
  const isStep1Complete = true // Formulaire rempli
  const isStep2Complete = false // Pas encore validé
  const isStep3Complete = false // Pas encore payé
  const isStep4Complete = false // Pas encore confirmé

  return (
    <>
      {/* Header moderne premium - style 2025 */}
      <div className="absolute inset-x-4 sm:inset-x-6 top-1/2 -translate-y-1/2 flex items-center justify-between pointer-events-none gap-3">
        {/* Left: Bouton info moderne - glass effect */}
        <button
          onClick={() => setShowStepper(true)}
          className="pointer-events-auto w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 active:bg-black/15 border border-black/10 hover:border-black/20 transition-all duration-200 touch-manipulation group ml-2 sm:ml-3"
          aria-label={t('booking.howItWorks')}
          title={t('booking.howItWorks')}
        >
          <svg 
            className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-black/70 group-hover:text-black transition-colors" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        
        {/* Right: Language switcher moderne - pill style */}
        <div className="relative pointer-events-auto">
          <button
            ref={langButtonRef}
            onClick={() => setIsLangOpen(!isLangOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-black/5 hover:bg-black/10 active:bg-black/15 border border-black/10 hover:border-black/20 transition-all duration-200 touch-manipulation group min-h-[32px] sm:min-h-[36px]"
            aria-label="Select language"
            aria-expanded={isLangOpen}
            aria-haspopup="true"
          >
            {/* Globe icon */}
            <svg 
              className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-black/70 group-hover:text-black transition-colors flex-shrink-0" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            {/* Language code */}
            <span className="text-xs sm:text-sm font-medium text-black/80 group-hover:text-black transition-colors">
              {currentLanguage.label}
            </span>
            {/* Chevron */}
            <svg
              className={`w-2.5 h-2.5 sm:w-3 sm:h-3 text-black/60 group-hover:text-black/80 transition-all duration-200 flex-shrink-0 ${
                isLangOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown moderne */}
          {isLangOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40 sm:hidden"
                onClick={() => setIsLangOpen(false)}
                aria-hidden="true"
              />
              <div
                ref={langDropdownRef}
                className="absolute right-0 mt-2 bg-white/98 backdrop-blur-xl border border-black/10 rounded-xl shadow-xl overflow-hidden z-50 min-w-[120px] py-1.5"
                role="menu"
              >
                {languages.map((lang) => {
                  const isSelected = lang.code === locale
                  return (
                    <button
                      key={lang.code}
                      onClick={() => {
                        changeLocale(lang.code)
                        setIsLangOpen(false)
                      }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-all duration-150 touch-manipulation ${
                        isSelected
                          ? 'bg-black/5 text-black font-medium'
                          : 'text-black/70 hover:bg-black/5 active:bg-black/10'
                      }`}
                      role="menuitem"
                      aria-selected={isSelected}
                    >
                      <span className="flex-1">{lang.label}</span>
                      {isSelected && (
                        <svg
                          className="w-4 h-4 text-black flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Popup avec stepper - Rendu via Portal pour être au-dessus de tout */}
      {mounted && showStepper ? createPortal(
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowStepper(false)}
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
                <h2 className="text-xl sm:text-2xl font-bold text-black">Progression de la réservation</h2>
                <button
                  onClick={() => setShowStepper(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label={t('common.close')}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Stepper vertical avec lignes de connexion - Même structure que ChatInterface */}
              <div className="relative">
                {/* Ligne de progression verticale */}
                <div className="absolute left-5 top-0 bottom-0 w-0.5">
                  {/* Ligne complétée */}
                  <div 
                    className={`absolute top-0 left-0 w-full transition-all duration-500 ease-out ${
                      isStep4Complete
                        ? 'bg-[#FBCF03] h-full'
                        : isStep3Complete
                        ? 'bg-[#FBCF03] h-3/4'
                        : isStep2Complete 
                        ? 'bg-[#FBCF03] h-1/2' 
                        : isStep1Complete 
                        ? 'bg-[#FBCF03] h-1/4'
                        : 'bg-gray-200 h-0'
                    }`}
                    style={{ 
                      height: isStep4Complete ? '100%' : isStep3Complete ? '75%' : isStep2Complete ? '50%' : isStep1Complete ? '25%' : '0%' 
                    }}
                  />
                  {/* Ligne en attente */}
                  <div 
                    className={`absolute top-0 left-0 w-full bg-gray-200 transition-all duration-500 ${
                      isStep4Complete ? 'h-0' : isStep3Complete ? 'h-1/4' : isStep2Complete ? 'h-1/2' : isStep1Complete ? 'h-3/4' : 'h-full'
                    }`}
                    style={{ 
                      top: isStep4Complete ? '100%' : isStep3Complete ? '75%' : isStep2Complete ? '50%' : isStep1Complete ? '25%' : '0%',
                      height: isStep4Complete ? '0%' : isStep3Complete ? '25%' : isStep2Complete ? '50%' : isStep1Complete ? '75%' : '100%'
                    }}
                  />
                </div>

                <div className="relative space-y-6">
                  {/* Étape 1: Chef/Client trouvé (toujours complétée) */}
                  <div className="relative flex items-start gap-4">
                    {/* Icône de l'étape */}
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-[#FBCF03] flex items-center justify-center shadow-lg shadow-[#FBCF03]/30 ring-4 ring-[#FBCF03]/10 transition-all duration-300">
                        <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {/* Badge de complétion */}
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-[#FBCF03]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* Contenu de l'étape */}
                    <div className="flex-1 pt-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-black">
                          {t('booking.step1Title')}
                        </p>
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/20 text-[#FBCF03] rounded-full">
                          {t('booking.completed')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {t('booking.step1Description')}
                      </p>
                    </div>
                  </div>

                  {/* Étape 2: Prestation validée */}
                  <div className="relative flex items-start gap-4">
                    {/* Icône de l'étape */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isStep2Complete
                          ? 'bg-[#FBCF03] shadow-lg shadow-[#FBCF03]/30 ring-4 ring-[#FBCF03]/10 scale-105'
                          : 'bg-gray-100 border-2 border-gray-300'
                      }`}>
                        {isStep2Complete ? (
                          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-gray-400" />
                        )}
                      </div>
                      {isStep2Complete && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-[#FBCF03]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Contenu de l'étape */}
                    <div className="flex-1 pt-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-semibold transition-colors ${
                          isStep2Complete 
                            ? 'text-black' 
                            : 'text-gray-400'
                        }`}>
                          {t('booking.step2Title')}
                        </p>
                        {isStep2Complete ? (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/20 text-[#FBCF03] rounded-full">
                            {t('booking.completed')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-400 rounded-full">
                            {t('booking.pending')}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs leading-relaxed transition-colors ${
                        isStep2Complete ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        {isStep2Complete 
                          ? t('booking.step2DescriptionCompleted')
                          : t('booking.step2DescriptionPending')
                        }
                      </p>
                    </div>
                  </div>

                  {/* Étape 3: Paiement */}
                  <div className="relative flex items-start gap-4">
                    {/* Icône de l'étape */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isStep3Complete
                          ? 'bg-[#FBCF03] shadow-lg shadow-[#FBCF03]/30 ring-4 ring-[#FBCF03]/10 scale-105'
                          : 'bg-gray-100 border-2 border-gray-300'
                      }`}>
                        {isStep3Complete ? (
                          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-gray-400" />
                        )}
                      </div>
                      {isStep3Complete && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-[#FBCF03]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Contenu de l'étape */}
                    <div className="flex-1 pt-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-semibold transition-colors ${
                          isStep3Complete 
                            ? 'text-black' 
                            : 'text-gray-400'
                        }`}>
                          {t('booking.step3Title')}
                        </p>
                        {isStep3Complete ? (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/20 text-[#FBCF03] rounded-full">
                            {t('booking.completed')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-400 rounded-full">
                            {t('booking.pending')}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs leading-relaxed transition-colors ${
                        isStep3Complete ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        {isStep3Complete
                          ? t('booking.step3DescriptionCompleted')
                          : t('booking.step3DescriptionPending')
                        }
                      </p>
                    </div>
                  </div>

                  {/* Étape 4: Prestation confirmée */}
                  <div className="relative flex items-start gap-4">
                    {/* Icône de l'étape */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isStep4Complete
                          ? 'bg-[#FBCF03] shadow-lg shadow-[#FBCF03]/30 ring-4 ring-[#FBCF03]/10 scale-105'
                          : 'bg-gray-100 border-2 border-gray-300'
                      }`}>
                        {isStep4Complete ? (
                          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-gray-400" />
                        )}
                      </div>
                      {isStep4Complete && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-[#FBCF03]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Contenu de l'étape */}
                    <div className="flex-1 pt-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-semibold transition-colors ${
                          isStep4Complete ? 'text-black' : 'text-gray-400'
                        }`}>
                          {t('booking.step4Title')}
                        </p>
                        {isStep4Complete ? (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/20 text-[#FBCF03] rounded-full">
                            {t('booking.completed')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-400 rounded-full">
                            {t('booking.pending')}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs leading-relaxed transition-colors ${
                        isStep4Complete ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        {isStep4Complete 
                          ? t('booking.step4DescriptionCompleted')
                          : t('booking.step4DescriptionPending')
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        ,
        document.body
      ) : null}
    </>
  )
}

