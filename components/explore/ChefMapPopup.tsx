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
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

function formatPrice(price: number | null): string {
  if (typeof price !== 'number' || !Number.isFinite(price)) return 'Prix sur demande'
  return `${Math.round(price)}€`
}

export function ChefMapPopup({ chef, left, top, onMouseEnter, onMouseLeave }: ChefMapPopupProps) {
  const [isDarkBackground, setIsDarkBackground] = useState(false)
  const { t, locale } = useTranslation()
  const displayedCuisine =
    (locale === 'en' ? chef.cuisineTypeEn || chef.cuisineType : chef.cuisineType || chef.cuisineTypeEn) ||
    t('explore.signatureCuisine')
  const infoHref = chef.infoLinkXx

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
  }, [chef.image])

  return (
    <article
      className="pointer-events-auto absolute z-30 h-[276px] w-[272px] overflow-hidden rounded-[24px] border border-white/65 bg-[#EDEDED] shadow-[0_18px_40px_rgba(0,0,0,0.20)] animate-map-popup-enter"
      style={{ left, top }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="relative h-full w-full overflow-hidden">
        {chef.image ? (
          <img src={chef.image} alt={chef.name} className="h-full w-full object-cover" />
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
        <div className="absolute right-2.5 top-2.5 z-20">
          <ChefInfoButton chefName={chef.name} href={infoHref} />
        </div>
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
              {chef.name}
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
