'use client'

import { useEffect, useState } from 'react'
import { ExploreChef } from './types'
import { useTranslation } from '@/hooks/useTranslation'
import { useProfileNavigation } from '@/hooks/useProfileNavigation'

interface ChefCardProps {
  chef: ExploreChef
  onHover?: (chefId: string | null) => void
  isHighlighted?: boolean
  isOutOfRange?: boolean
  onMountRef?: (chefId: string, element: HTMLElement | null) => void
  onChefNameClick?: (chefId: string) => void
  forceMobileStyle?: boolean
  /** When true, profile links break out of iframe (window.top) for full-screen navigation */
  breakOutOfIframe?: boolean
}

function formatPrice(price: number | null): string {
  if (typeof price !== 'number' || !Number.isFinite(price)) return 'Prix sur demande'
  return `${Math.round(price)}€`
}

function formatGuestsRange(
  minGuests: number | null,
  maxGuests: number | null,
  locale: string
): string {
  const isFr = locale === 'fr'
  if (typeof minGuests === 'number' && typeof maxGuests === 'number') {
    return isFr ? `De ${minGuests} à ${maxGuests} personnes` : `From ${minGuests} to ${maxGuests} people`
  }
  if (typeof minGuests === 'number') {
    return isFr ? `À partir de ${minGuests} personnes` : `From ${minGuests} people`
  }
  if (typeof maxGuests === 'number') {
    return isFr ? `Jusqu'à ${maxGuests} personnes` : `Up to ${maxGuests} people`
  }
  return isFr ? 'Convives non précisés' : 'Guests not specified'
}

function formatChefNameWithPrefix(name: string): string {
  const firstName = (name || '').trim().split(/\s+/)[0] || ''
  return firstName ? `Chef ${firstName}` : 'Chef'
}

export function ChefCard({
  chef,
  onHover,
  isHighlighted = false,
  isOutOfRange = false,
  onMountRef,
  onChefNameClick,
  forceMobileStyle = false,
  breakOutOfIframe = false,
}: ChefCardProps) {
  const navigateToProfile = useProfileNavigation(breakOutOfIframe)
  const [isDarkBackground, setIsDarkBackground] = useState(false)
  const { t, locale } = useTranslation()
  const displayedCuisine =
    (locale === 'en' ? chef.cuisineTypeEn || chef.cuisineType : chef.cuisineType || chef.cuisineTypeEn) ||
    t('explore.signatureCuisine')
  const priceLabel =
    typeof chef.minPrice === 'number' && Number.isFinite(chef.minPrice)
      ? `${t('explore.from')} ${formatPrice(chef.minPrice)}${locale === 'en' ? '/guest' : '/pers'}`
      : formatPrice(chef.minPrice)
  const guestsLabel = formatGuestsRange(chef.minGuests, chef.maxGuests, locale)
  const infoHref = chef.infoLinkXx
  const mobileHeroImage = chef.heroImage || chef.image
  const mobileAvatarImage = chef.avatarImage || chef.image || chef.heroImage
  const displayChefName = formatChefNameWithPrefix(chef.name)

  useEffect(() => {
    let cancelled = false

    if (!chef.image) {
      setIsDarkBackground(false)
      return
    }

    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.referrerPolicy = 'no-referrer'
    image.src = chef.image

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
        const sampleHeight = Math.floor(height * 0.42)
        const sampleY = height - sampleHeight
        const pixels = ctx.getImageData(0, sampleY, width, sampleHeight).data
        let luminanceSum = 0
        let count = 0
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i] / 255
          const g = pixels[i + 1] / 255
          const b = pixels[i + 2] / 255
          luminanceSum += 0.2126 * r + 0.7152 * g + 0.0722 * b
          count += 1
        }
        const avgLuminance = count > 0 ? luminanceSum / count : 1
        setIsDarkBackground(avgLuminance < 0.36)
      } catch {
        setIsDarkBackground(false)
      }
    }

    image.onerror = () => {
      if (!cancelled) setIsDarkBackground(false)
    }

    return () => {
      cancelled = true
    }
  }, [chef.image])

  return (
    <article
      ref={(element) => onMountRef?.(chef.id, element)}
      className={
        forceMobileStyle
          ? `group relative overflow-hidden rounded-xl border bg-white shadow-sm transition ${
              isOutOfRange ? 'opacity-[0.72] saturate-[0.65]' : ''
            } ${
              isHighlighted
                ? 'border-[#D4D4D4] ring-1 ring-[#DADADA] shadow-[0_10px_24px_rgba(0,0,0,0.14)]'
                : 'border-[#ECECEC] shadow-[0_1px_6px_rgba(0,0,0,0.06)]'
            }`
          : `group relative overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm ${
              isOutOfRange ? 'opacity-[0.72] saturate-[0.65]' : ''
            } ${
              isHighlighted
                ? 'ring-1 ring-[#DADADA] md:border-[#D4D4D4] md:shadow-[0_10px_24px_rgba(0,0,0,0.14)]'
                : 'md:border-[#ECECEC] md:shadow-[0_1px_6px_rgba(0,0,0,0.06)]'
            } md:aspect-square md:rounded-[24px] md:bg-[#EDEDED] md:transition md:hover:-translate-y-0.5 md:hover:shadow-[0_6px_18px_rgba(0,0,0,0.10)]`
      }
      onMouseEnter={() => onHover?.(chef.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <div className={forceMobileStyle ? '' : 'md:hidden'}>
        <div className="relative w-full">
          <div className="h-[130px] w-full overflow-hidden rounded-t-xl bg-[#EFEFEF]">
            {mobileHeroImage ? (
              <img src={mobileHeroImage} alt={displayChefName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-[#8A8A8A]">
                {t('explore.photoUnavailable')}
              </div>
            )}
          </div>
          <div className="absolute bottom-[-16px] left-3 z-10 h-11 w-11 overflow-hidden rounded-full border border-white/90 bg-[#F3F3F3] shadow-[0_3px_8px_rgba(0,0,0,0.12)]">
            {mobileAvatarImage ? (
              <img src={mobileAvatarImage} alt={displayChefName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-[#727272]">
                {displayChefName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>
        <div className="rounded-b-xl bg-white px-3.5 pb-3 pt-6">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onChefNameClick?.(chef.id)
              }}
              className="truncate pr-2 text-left text-base font-semibold leading-tight text-[#111111] hover:underline"
            >
              {displayChefName}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="inline-flex max-w-full truncate rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-[#4E4E4E]">
              {displayedCuisine}
            </span>
            {isOutOfRange && (
              <span className="ml-1.5 inline-flex rounded-full border border-[#E0E0E0] bg-[#F3F3F3] px-2 py-0.5 text-[10px] font-semibold text-[#6A6A6A]">
                {t('explore.outOfRange')}
              </span>
            )}
          </div>
          <p className="mt-1.5 truncate text-sm font-semibold text-[#1F1F1F]">{priceLabel}</p>
          <div className="mt-1.5 flex items-end justify-between gap-2">
            <p className="text-sm text-gray-500">{guestsLabel}</p>
            {infoHref ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  navigateToProfile(infoHref)
                }}
                className="shrink-0 rounded-full bg-[#FBCF03] px-3 py-1.5 text-xs font-semibold text-[#1C1C1C]"
              >
                {t('explore.viewProfile')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className={forceMobileStyle ? 'hidden' : 'relative hidden h-full w-full overflow-hidden md:block'}>
        {chef.image ? (
          <img src={chef.image} alt={displayChefName} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px] font-medium text-[#8A8A8A]">
            {t('explore.photoUnavailable')}
          </div>
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
        {isOutOfRange && (
          <div className="pointer-events-none absolute left-2.5 top-2.5 rounded-full border border-white/80 bg-black/55 px-2.5 py-1 text-[10px] font-semibold tracking-[0.03em] text-white backdrop-blur">
            {t('explore.outOfRange')}
          </div>
        )}
        <div
          className={`absolute inset-x-2.5 bottom-2.5 rounded-[18px] border px-3.5 pb-2.5 pt-2.5 backdrop-blur-[22px] ${
            isDarkBackground
              ? 'border-white/78 bg-white/55 [filter:brightness(1.1)_contrast(1.05)_saturate(1.02)]'
              : 'border-white/70 bg-white/35'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <h3
              className={`truncate text-[15px] leading-tight text-[#0F0F0F] ${
                isDarkBackground ? 'font-bold [text-shadow:0_1px_2px_rgba(255,255,255,0.25)]' : 'font-semibold [text-shadow:0_1px_0_rgba(255,255,255,0.35)]'
              }`}
            >
              {displayChefName}
            </h3>
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
              <p className="mt-0.5 text-[11px] text-[#555555]">{guestsLabel}</p>
            </div>
            {infoHref ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  navigateToProfile(infoHref)
                }}
                className="inline-flex items-center rounded-full bg-gradient-to-r from-[#FCD93A] via-[#FBCF03] to-[#EFB500] px-4 py-2 text-xs font-semibold text-[#1C1C1C] shadow-[0_6px_14px_rgba(251,207,3,0.35)] transition hover:brightness-[1.02]"
              >
                {t('explore.viewProfile')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
