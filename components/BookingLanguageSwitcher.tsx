'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/hooks/useTranslation'
import { type Locale } from '@/lib/i18n'

export default function BookingLanguageSwitcher() {
  const { locale, changeLocale } = useTranslation()
  const [isLangOpen, setIsLangOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(null)
  const langDropdownRef = useRef<HTMLDivElement>(null)
  const langButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!isLangOpen || !isMobile || !langButtonRef.current) {
      setDropdownPosition(null)
      return
    }
    const update = () => {
      const el = langButtonRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setDropdownPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
    }
    update()
    window.visualViewport?.addEventListener('resize', update)
    return () => window.visualViewport?.removeEventListener('resize', update)
  }, [isLangOpen, isMobile])

  const languages: { code: Locale; label: string }[] = [
    { code: 'fr', label: 'FR' },
    { code: 'en', label: 'EN' },
  ]

  const currentLanguage = languages.find((lang) => lang.code === locale) || languages[0]

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

  return (
    <div className="relative pointer-events-auto">
      <button
        ref={langButtonRef}
        onClick={() => setIsLangOpen(!isLangOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-black/5 hover:bg-black/10 active:bg-black/15 border border-black/10 hover:border-black/20 transition-all duration-200 touch-manipulation group min-h-[32px] sm:min-h-[36px]"
        aria-label="Select language"
        aria-expanded={isLangOpen}
        aria-haspopup="true"
      >
        <svg
          className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-black/70 group-hover:text-black transition-colors flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
        <span className="text-xs sm:text-sm font-medium text-black/80 group-hover:text-black transition-colors">
          {currentLanguage.label}
        </span>
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

      {isLangOpen && (
        <>
          <div
            className="fixed inset-0 z-[105] sm:z-40 sm:hidden"
            onClick={() => setIsLangOpen(false)}
            aria-hidden="true"
          />
          {isMobile && dropdownPosition
            ? createPortal(
                <div
                  ref={langDropdownRef}
                  className="fixed z-[110] min-w-[120px] rounded-xl border border-black/10 bg-white py-1.5 shadow-xl overflow-hidden"
                  style={{ top: dropdownPosition.top, right: dropdownPosition.right }}
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
                </div>,
                document.body
              )
            : !isMobile && (
                <div
                  ref={langDropdownRef}
                  className="absolute right-0 mt-2 bg-white border border-black/10 rounded-xl shadow-xl overflow-hidden z-50 min-w-[120px] py-1.5"
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
            )}
        </>
      )}
    </div>
  )
}
