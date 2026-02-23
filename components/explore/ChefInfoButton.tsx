'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/hooks/useTranslation'

interface ChefInfoButtonProps {
  chefName: string
  href: string | null
  className?: string
}

export function ChefInfoButton({ chefName, href, className = '' }: ChefInfoButtonProps) {
  const router = useRouter()
  const { locale } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const modalTitle = locale === 'en' ? 'Leave map view?' : 'Quitter la carte ?'
  const hasValidHref = typeof href === 'string' && href.trim().length > 0
  const modalText =
    !hasValidHref
      ? locale === 'en'
        ? 'Link not provided.'
        : 'Lien non renseigné.'
      : locale === 'en'
        ? `You are about to leave the map and open ${chefName}'s profile.`
        : `Vous allez quitter la page map pour aller sur la page profil de ${chefName}.`
  const okLabel = locale === 'en' ? 'Open profile' : 'Voir le profil'
  const cancelLabel = locale === 'en' ? 'Cancel' : 'Annuler'
  const ariaLabel = locale === 'en' ? `Info about ${chefName}` : `Infos sur ${chefName}`

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setIsOpen(true)
        }}
        aria-label={ariaLabel}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E4E4E4] bg-white/92 text-[#1A1A1A] backdrop-blur-sm transition hover:bg-white ${className}`}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
          <path d="M12 10.5V16" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="12" cy="7.6" r="1" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[220] flex items-center justify-center bg-black/55 p-4"
            onClick={() => setIsOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-sm rounded-2xl border border-[#E6E6E6] bg-white p-5 shadow-[0_24px_64px_rgba(0,0,0,0.30)]"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-[18px] font-semibold text-[#121212]">{modalTitle}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#2C2C2C]">{modalText}</p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-[#D9D9D9] bg-white px-4 text-sm font-medium text-[#2F2F2F] transition hover:bg-[#F7F7F7]"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  disabled={!hasValidHref}
                  onClick={() => {
                    if (!hasValidHref || !href) return
                    setIsOpen(false)
                    router.push(href)
                  }}
                  className={`inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-semibold ${
                    hasValidHref
                      ? 'bg-gradient-to-r from-[#FCD93A] via-[#FBCF03] to-[#EFB500] text-[#1B1B1B]'
                      : 'cursor-not-allowed bg-[#ECECEC] text-[#9A9A9A]'
                  }`}
                >
                  {okLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
