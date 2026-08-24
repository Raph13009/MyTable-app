'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'
import { trackEvent } from '@/lib/analytics/track'
import {
  ChefProfilePayload,
  fetchChefProfile,
  galleryUrls,
  resolvePortrait,
} from '@/lib/chefProfile'
import { getOptimizedSupabaseImageUrl } from '@/lib/image-utils'
import { ExploreChef } from './types'
import { FramedPhoto } from './FramedPhoto'

interface ChefProfilePanelProps {
  chef: ExploreChef
  variant: 'drawer' | 'sheet'
  onClose: () => void
  /** Extra top inset so the sheet sits below a floating search/lang overlay. Mobile sheet only. */
  sitBelowOverlay?: boolean
}

function formatPrice(price: number | null, locale: string): string | null {
  if (typeof price !== 'number' || !Number.isFinite(price)) return null
  return locale === 'en' ? `From ${Math.round(price)}€` : `À partir de ${Math.round(price)}€`
}

function formatGuests(minGuests: number | null, maxGuests: number | null, locale: string): string | null {
  const isFr = locale !== 'en'
  if (typeof minGuests === 'number' && typeof maxGuests === 'number') {
    return isFr ? `${minGuests}–${maxGuests} pers.` : `${minGuests}–${maxGuests} guests`
  }
  if (typeof minGuests === 'number') return isFr ? `Dès ${minGuests} pers.` : `From ${minGuests} guests`
  if (typeof maxGuests === 'number') return isFr ? `Jusqu’à ${maxGuests} pers.` : `Up to ${maxGuests} guests`
  return null
}

function formatRadius(km: number | null, locale: string): string | null {
  if (typeof km !== 'number' || !Number.isFinite(km)) return null
  return locale === 'en' ? `${km} km radius` : `Rayon ${km} km`
}

function formatChefName(name: string): string {
  const trimmed = (name || '').trim()
  return trimmed || 'Chef'
}

export function ChefProfilePanel({ chef, variant, onClose, sitBelowOverlay = false }: ChefProfilePanelProps) {
  const router = useRouter()
  const { t, locale } = useTranslation()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const [profile, setProfile] = useState<ChefProfilePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [menusExpanded, setMenusExpanded] = useState(false)
  const [contactLoading, setContactLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const swipeOrigin = useRef<{ x: number; y: number } | null>(null)
  const swipeAxis = useRef<'x' | 'y' | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    setActiveImage(0)
    setMenusExpanded(false)
    setProfile(null)
    fetchChefProfile(chef.slug)
      .then((data) => {
        if (cancelled) return
        setProfile(data)
        setLoading(false)
        trackEvent('chef_profile_opened', { chef_id: data.id, chef_slug: data.slug, source: variant })
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [chef.slug, variant])

  useEffect(() => {
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const cuisine =
    (locale === 'en' ? chef.cuisineTypeEn || chef.cuisineType : chef.cuisineType || chef.cuisineTypeEn) ||
    t('explore.signatureCuisine')
  const images = useMemo(() => {
    if (profile) {
      const urls = galleryUrls(profile)
      if (urls.length > 0) return urls
    }
    if (chef.heroImage) return [chef.heroImage]
    if (chef.image) return [chef.image]
    return []
  }, [profile, chef.heroImage, chef.image])
  const portrait = profile ? resolvePortrait(profile, locale) : null
  const priceLabel = formatPrice(profile?.minPrice ?? chef.minPrice, locale)
  const guestsLabel = formatGuests(profile?.minGuests ?? chef.minGuests, profile?.maxGuests ?? chef.maxGuests, locale)
  const radiusLabel = formatRadius(profile?.availabilityRadiusKm ?? chef.availabilityRadiusKm, locale)
  const city = profile?.city || chef.city
  const menus = profile?.menus ?? []
  const visibleMenus = menusExpanded || menus.length <= 3 ? menus : menus.slice(0, 2)
  const hero = images[activeImage] || chef.heroImage || chef.image
  const isSheet = variant === 'sheet'

  const handleContact = () => {
    if (contactLoading) return
    setContactLoading(true)
    trackEvent('chef_profile_contact_clicked', {
      chef_id: chef.id,
      chef_slug: chef.slug,
      source: variant,
    })
    router.push(`/book/${chef.slug}`)
  }

  const goToSwipeImage = (deltaX: number) => {
    if (images.length < 2 || Math.abs(deltaX) < 32) return
    setActiveImage((index) => (index + (deltaX < 0 ? 1 : -1) + images.length) % images.length)
  }

  const handleClose = () => {
    trackEvent('chef_profile_closed', { chef_id: chef.id, chef_slug: chef.slug, source: variant })
    onClose()
  }

  const shellClass = isSheet
    ? `pointer-events-auto absolute inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[24px] bg-transparent shadow-[0_-10px_28px_rgba(0,0,0,0.16)] ${
        sitBelowOverlay ? 'top-[4.25rem]' : 'top-4'
      }`
    : 'pointer-events-auto absolute inset-y-0 left-0 z-40 flex h-full w-[min(440px,100%)] flex-col overflow-hidden border-r border-[#EAEAEA] bg-white shadow-[18px_0_40px_rgba(0,0,0,0.08)] lg:w-[min(440px,42vw)]'

  const closeButtonClass =
    'absolute left-3.5 top-3.5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#111111] shadow-[0_4px_14px_rgba(0,0,0,0.16)]'

  const closeButton = (zClass: string) => (
    <button
      ref={closeButtonRef}
      type="button"
      onClick={handleClose}
      className={`${closeButtonClass} ${zClass}`}
      aria-label={t('common.close')}
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
      </svg>
    </button>
  )

  return (
    <aside
      className={shellClass}
      role="dialog"
      aria-modal="true"
      aria-labelledby="chef-profile-title"
    >
      <div
        className={
          isSheet
            ? 'relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-t-[24px] bg-white'
            : 'flex h-full min-h-0 flex-1 flex-col overflow-hidden'
        }
      >
        {isSheet && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-3"
            aria-hidden
          >
            <div className="h-1 w-12 rounded-full bg-white/85 shadow-[0_1px_3px_rgba(0,0,0,0.28)]" />
          </div>
        )}
        {isSheet && closeButton('z-20')}

        <div ref={scrollRef} className="explore-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          className={`relative w-full select-none touch-pan-y bg-white px-5 pt-5 ${isSheet ? 'pb-8' : 'pb-6'} ${
            images.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
          onDragStart={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            if (images.length < 2) return
            if ((event.target as HTMLElement).closest('button')) return
            swipeOrigin.current = { x: event.clientX, y: event.clientY }
            swipeAxis.current = null
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!swipeOrigin.current) return
            const dx = event.clientX - swipeOrigin.current.x
            const dy = event.clientY - swipeOrigin.current.y
            if (!swipeAxis.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
              swipeAxis.current = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
            }
          }}
          onPointerUp={(event) => {
            if (!swipeOrigin.current) return
            const dx = event.clientX - swipeOrigin.current.x
            const axis = swipeAxis.current
            swipeOrigin.current = null
            swipeAxis.current = null
            if (axis === 'y') return
            goToSwipeImage(dx)
          }}
          onPointerCancel={(event) => {
            if (!swipeOrigin.current) return
            const dx = event.clientX - swipeOrigin.current.x
            const axis = swipeAxis.current
            swipeOrigin.current = null
            swipeAxis.current = null
            if (axis === 'y') return
            goToSwipeImage(dx)
          }}
        >
          <div
            className={`relative mx-auto flex w-full items-center justify-center ${
              isSheet ? 'h-[min(52dvh,420px)]' : 'h-[min(48vh,400px)]'
            }`}
          >
            {hero ? (
              <FramedPhoto
                src={hero}
                alt={formatChefName(chef.name)}
                width={900}
                quality={75}
                variant="hero"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-[#8A8A8A]">
                {t('explore.photoUnavailable')}
              </div>
            )}
            {chef.avatarImage && (
              <img
                src={getOptimizedSupabaseImageUrl(chef.avatarImage, 160, 75, true) ?? chef.avatarImage}
                alt=""
                className="pointer-events-none absolute bottom-3 left-3 h-14 w-14 rounded-full border-2 border-white object-cover shadow-[0_6px_16px_rgba(0,0,0,0.16)]"
              />
            )}
          </div>
          {!isSheet && closeButton('z-10')}
          {images.length > 1 && (
            <div className="mt-3 flex justify-center gap-1.5">
              {images.map((url, index) => (
                <button
                  key={`${url}-dot`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`h-1.5 rounded-full transition ${
                    index === activeImage ? 'w-4 bg-[#111111]' : 'w-1.5 bg-[#D0D0D0]'
                  }`}
                  aria-label={`${t('explore.profile.gallery')} ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white px-5 pb-6 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8A8A8A]">
            {cuisine}
            {city ? ` · ${city}` : ''}
          </p>
          <h2 id="chef-profile-title" className="mt-1 text-[26px] font-semibold leading-tight text-[#111111]">
            {formatChefName(chef.name)}
          </h2>

          {(priceLabel || guestsLabel || radiusLabel) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {priceLabel && <Badge>{priceLabel}</Badge>}
              {guestsLabel && <Badge>{guestsLabel}</Badge>}
              {radiusLabel && <Badge>{radiusLabel}</Badge>}
            </div>
          )}

          {loading && (
            <p className="mt-6 text-sm text-[#6B7280]">{t('explore.profile.loading')}</p>
          )}
          {error && (
            <p className="mt-6 text-sm text-[#B42318]">{t('explore.profile.loadError')}</p>
          )}

          {!loading && images.length > 1 && (
            <section className="mt-7">
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                {t('explore.profile.gallery')}
              </h3>
              <div className="mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
                {images.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    className={`relative h-20 w-20 shrink-0 snap-start overflow-hidden rounded-2xl bg-white ${
                      index === activeImage ? 'ring-2 ring-[#FBCF03]' : ''
                    }`}
                    aria-label={`${t('explore.profile.gallery')} ${index + 1}`}
                    aria-current={index === activeImage}
                  >
                    <FramedPhoto src={url} alt="" width={240} quality={70} variant="thumb" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {portrait && (
            <section className="mt-7">
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                {t('explore.profile.portrait')}
              </h3>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-[#2B2B2B]">{portrait}</p>
            </section>
          )}

          {menus.length > 0 && (
            <section className="mt-7">
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                {t('explore.profile.menus')}
              </h3>
              <div className="mt-3 space-y-3">
                {visibleMenus.map((menu) => (
                  <article key={menu.id} className="rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-[15px] font-semibold text-[#111111]">{menu.name}</h4>
                      {typeof menu.price === 'number' && (
                        <p className="shrink-0 text-[15px] font-semibold text-[#111111]">{Math.round(menu.price)}€</p>
                      )}
                    </div>
                    {menu.description && (
                      <p className="mt-1 text-[13px] leading-relaxed text-[#5F5F5F]">{menu.description}</p>
                    )}
                  </article>
                ))}
              </div>
              {menus.length > 3 && (
                <button
                  type="button"
                  onClick={() => setMenusExpanded((value) => !value)}
                  className="mt-3 text-sm font-medium text-[#111111] underline underline-offset-2"
                >
                  {menusExpanded ? t('explore.profile.menusCollapse') : t('explore.profile.menusExpand', { count: menus.length })}
                </button>
              )}
            </section>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-[#EAEAEA] bg-white px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={handleContact}
          disabled={contactLoading}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-[#FCD93A] via-[#FBCF03] to-[#EFB500] text-[15px] font-semibold text-[#1C1C1C] shadow-[0_6px_16px_rgba(251,207,3,0.35)] transition hover:brightness-[1.03] disabled:opacity-70"
        >
          {contactLoading ? t('common.loading') : t('explore.profile.contact')}
        </button>
        <p className="mt-2 text-center text-[12px] leading-snug text-[#6B7280]">
          {t('explore.profile.reassurance')}
        </p>
      </div>
      </div>
    </aside>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#EAEAEA] bg-[#FAFAFA] px-3 py-1.5 text-[12px] font-medium text-[#222222]">
      {children}
    </span>
  )
}
