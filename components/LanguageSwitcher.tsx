'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { type Locale } from '@/lib/i18n'

/**
 * Premium language switcher component
 * Clean, modern design inspired by Apple, Airbnb, Stripe, Notion
 * Mobile-first with smooth animations
 */
export default function LanguageSwitcher() {
  const { locale, changeLocale } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const languages: { code: Locale; label: string; flag: string }[] = [
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
  ]

  const currentLanguage = languages.find((lang) => lang.code === locale) || languages[0]

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Prevent body scroll when dropdown is open on mobile
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  const handleLanguageSelect = (code: Locale) => {
    changeLocale(code)
    setIsOpen(false)
    // Small delay to ensure smooth transition
    setTimeout(() => {
      buttonRef.current?.blur()
    }, 150)
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 backdrop-blur-sm border border-gray-200/60 hover:border-gray-300/80 hover:bg-white transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/20 focus:border-[#FBCF03]/40 active:scale-[0.98] min-h-[40px] touch-manipulation"
        aria-label="Select language"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="text-base leading-none" aria-hidden="true">
          {currentLanguage.flag}
        </span>
        <span className="text-sm font-medium text-gray-700 hidden sm:inline-block">
          {currentLanguage.label}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      <div
        ref={dropdownRef}
        className={`absolute right-0 mt-2 w-48 bg-white rounded-xl border border-gray-200/80 shadow-lg backdrop-blur-sm overflow-hidden z-50 transition-all duration-200 origin-top-right ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
        }`}
        role="menu"
        aria-orientation="vertical"
      >
        <div className="py-1.5">
          {languages.map((lang) => {
            const isSelected = lang.code === locale
            return (
              <button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 touch-manipulation ${
                  isSelected
                    ? 'bg-[#FBCF03]/10 text-gray-900 font-medium'
                    : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                }`}
                role="menuitem"
                aria-selected={isSelected}
              >
                <span className="text-lg leading-none flex-shrink-0" aria-hidden="true">
                  {lang.flag}
                </span>
                <span className="text-sm flex-1">{lang.label}</span>
                {isSelected && (
                  <svg
                    className="w-4 h-4 text-[#FBCF03] flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/5 backdrop-blur-[2px] z-40 sm:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
