'use client'

import { useEffect, useState } from 'react'
import { ExploreChef } from './types'
import { useTranslation } from '@/hooks/useTranslation'
import { ReserveChefButton } from './ReserveChefButton'
import { ChefInfoButton } from './ChefInfoButton'

interface ChefMapPopupProps {
  chef: ExploreChef
  left: number
  top: number
  onRequestClose?: () => void
  onCardClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

function formatPrice(price: number | null): string {
  if (typeof price !== 'number' || !Number.isFinite(price)) return 'Prix sur demande'
  return `${Math.round(price)}€`
}

function formatChefNameWithPrefix(name: string): string {
  const firstName = (name || '').trim().split(/\s+/)[0] || ''
  return firstName ? `Chef ${firstName}` : 'Chef'
}

export function ChefMapPopup({ chef, left, top, onRequestClose, onCardClick, onMouseEnter, onMouseLeave }: ChefMapPopupProps) {
  const [isDarkBackground, setIsDarkBackground] = useState(false)
  const { t, locale } = useTranslation()
  const displayedCuisine =
    (locale === 'en' ? chef.cuisineTypeEn || chef.cuisineType : chef.cuisineType || chef.cuisineTypeEn) ||
    t('explore.signatureCuisine')
  const infoHref = chef.infoLinkXx
  const displayChefName = formatChefNameWithPrefix(chef.name)
  const backgroundImage = chef.heroImage || chef.image
  const avatarImage = chef.avatarImage || chef.image || chef.heroImage

  useEffect(() => {
    let cancelled = false

    if (!backgroundImage) {
      setIsDarkBackground(false)
      return
    }

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.referrerPolicy = 'no-referrer'
    image.src = backgroundImage

    image.onload = () => {
      if (cancelled) return
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return

        const width = 96
        const height = 96
        canvas.width = width
        canvas.height = height
        ctx.drawImage(image, 0, 0, width, height)

        // Analyze the lower zone where the glass bubble sits.
        const sampleHeight = Math.floor(height * 0.42)
        const sampleY = height - sampleHeight
        const pixels = ctx.getImageData(0, sampleY, width, sampleHeight).data

        let luminanceSum = 0
        let count = 0
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i] / 255
          const g = pixels[i + 1] / 255
          const b = pixels[i + 2] / 255
          // Relative luminance, perceptual weighting.
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
          luminanceSum += lum
          count += 1
        }

        const avgLuminance = count > 0 ? luminanceSum / count : 1
        setIsDarkBackground(avgLuminance < 0.36)
      } catch {
        // Cross-origin protected images can fail canvas reads; keep default mode.
        setIsDarkBackground(false)
      }
    }

    image.onerror = () => {
      if (!cancelled) setIsDarkBackground(false)
    }

    return () => {
      cancelled = true
    }
  }, [backgroundImage])

  return (
    <article
      className="pointer-events-auto absolute z-30 h-[236px] w-[234px] overflow-hidden rounded-[20px] border border-white/65 bg-[#EDEDED] shadow-[0_16px_34px_rgba(0,0,0,0.20)] animate-map-popup-enter"
      style={{ left, top }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(event) => {
        event.stopPropagation()
        onCardClick?.()
      }}
    >
      <div className="relative h-full w-full overflow-hidden">
        {backgroundImage ? (
          <img src={backgroundImage} alt={displayChefName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] font-medium text-[#8A8A8A]">{t('explore.photoUnavailable')}</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-[42%] ${
            isDarkBackground ? 'bg-gradient-to-t from-white/34 via-white/16 to-transparent' : 'bg-gradient-to-t from-white/26 via-white/12 to-transparent'
          }`}
        />
        {isDarkBackground && (
          <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 h-[33%] rounded-[18px] bg-[radial-gradient(circle_at_50%_60%,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0)_72%)]" />
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onRequestClose?.()
          }}
          className="absolute left-2.5 top-2.5 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/85 bg-white/80 text-[#121212] ring-1 ring-black/20 shadow-[0_2px_10px_rgba(0,0,0,0.28)] backdrop-blur-md"
          aria-label={locale === 'en' ? 'Close card' : 'Fermer la fiche'}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
        <div className="absolute right-2.5 top-2.5 z-20">
          <ChefInfoButton
            chefName={chef.name}
            href={infoHref}
            className="border-white/85 bg-white/80 text-[#121212] ring-1 ring-black/20 shadow-[0_2px_10px_rgba(0,0,0,0.28)] backdrop-blur-md hover:bg-white/92"
          />
        </div>
        <div
          className={`absolute inset-x-2.5 bottom-2.5 rounded-[16px] border px-3 pb-2 pt-2 backdrop-blur-[22px] ${
            isDarkBackground
              ? 'border-white/78 bg-white/55 [filter:brightness(1.1)_contrast(1.05)_saturate(1.02)]'
              : 'border-white/70 bg-white/35'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="h-6 w-6 overflow-hidden rounded-full border border-white/80 bg-white/70">
                {avatarImage ? <img src={avatarImage} alt={displayChefName} className="h-full w-full object-cover" /> : null}
              </div>
              <h3
                className={`truncate text-[13px] leading-tight text-[#0F0F0F] ${
                isDarkBackground ? 'font-bold [text-shadow:0_1px_2px_rgba(255,255,255,0.25)]' : 'font-semibold [text-shadow:0_1px_0_rgba(255,255,255,0.35)]'
                }`}
              >
                {displayChefName}
              </h3>
            </div>
            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#34C759] text-[10px] font-bold text-white">
              ✓
            </span>
          </div>
          <p
            className={`mt-0.5 truncate text-[11px] leading-tight text-[#2F2F2F] ${
              isDarkBackground ? '[text-shadow:0_1px_2px_rgba(255,255,255,0.22)]' : '[text-shadow:0_1px_0_rgba(255,255,255,0.28)]'
            }`}
          >
            {displayedCuisine}
          </p>

          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.07em] text-[#555555]">{t('explore.from')}</p>
              <p className="text-[16px] font-semibold leading-tight text-[#111111]">{formatPrice(chef.minPrice)}</p>
            </div>
            <ReserveChefButton
              href={`/book/${chef.slug}`}
              className="inline-flex items-center rounded-full bg-gradient-to-r from-[#FCD93A] via-[#FBCF03] to-[#EFB500] px-4 py-2 text-xs font-semibold text-[#1C1C1C] shadow-[0_6px_14px_rgba(251,207,3,0.35)] transition hover:brightness-[1.02]"
            />
          </div>
        </div>
      </div>
    </article>
  )
}
