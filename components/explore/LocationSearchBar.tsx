'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { ExploreLocationSuggestion } from '@/lib/exploreLocationSearch'
import { geocodeExploreLocationQuery } from '@/lib/exploreLocationSearch'
import { useExploreLocationSearch } from '@/hooks/useExploreLocationSearch'

interface LocationSearchBarProps {
  query: string
  onQueryChange: (query: string) => void
  onSelect: (suggestion: ExploreLocationSuggestion) => void
  locale: string
  placeholder: string
  loadingLabel: string
  clearLabel?: string
  showClear?: boolean
  onClear?: () => void
  variant?: 'header' | 'overlay' | 'embed'
  autoFocus?: boolean
}

export function LocationSearchBar({
  query,
  onQueryChange,
  onSelect,
  locale,
  placeholder,
  loadingLabel,
  clearLabel,
  showClear = false,
  onClear,
  variant = 'header',
  autoFocus = false,
}: LocationSearchBarProps) {
  const { suggestions, isLoading, token } = useExploreLocationSearch(query, locale)
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownBounds, setDropdownBounds] = useState<{ top: number; left: number; width: number } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const usePortal = variant === 'overlay'
  const inFlowDropdown = variant === 'embed'
  const showDropdown = isOpen && (isLoading || suggestions.length > 0)

  useEffect(() => {
    if (!showDropdown || !usePortal) {
      setDropdownBounds(null)
      return
    }
    const updateBounds = () => {
      const el = inputRef.current
      if (el) {
        const rect = el.getBoundingClientRect()
        setDropdownBounds({
          top: rect.bottom + 8,
          left: rect.left,
          width: rect.width,
        })
      } else {
        setDropdownBounds({ top: 56, left: 16, width: Math.max(0, window.innerWidth - 32) })
      }
    }
    updateBounds()
    const raf = requestAnimationFrame(updateBounds)
    window.visualViewport?.addEventListener('resize', updateBounds)
    window.visualViewport?.addEventListener('scroll', updateBounds)
    return () => {
      cancelAnimationFrame(raf)
      window.visualViewport?.removeEventListener('resize', updateBounds)
      window.visualViewport?.removeEventListener('scroll', updateBounds)
    }
  }, [showDropdown, usePortal])

  useEffect(() => {
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (containerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [])

  const handleSelect = (suggestion: ExploreLocationSuggestion) => {
    setIsOpen(false)
    onSelect(suggestion)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || !token) return
    if (suggestions.length > 0) {
      handleSelect(suggestions[0])
      return
    }
    try {
      const suggestion = await geocodeExploreLocationQuery(trimmed, locale, token)
      if (suggestion) handleSelect(suggestion)
    } catch (error) {
      console.error('[explore] search submit error:', error)
    }
  }

  const dropdown = showDropdown ? (
    <div
      ref={dropdownRef}
      className={
        usePortal
          ? 'fixed z-[100] max-h-[min(50vh,320px)] overflow-y-auto rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.12)]'
          : inFlowDropdown
            ? 'relative mt-2 max-h-[240px] overflow-y-auto rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.12)]'
            : 'absolute left-0 right-0 top-[50px] z-20 max-h-[min(50vh,320px)] overflow-y-auto rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.12)]'
      }
      style={
        usePortal && dropdownBounds
          ? { top: dropdownBounds.top, left: dropdownBounds.left, width: dropdownBounds.width }
          : undefined
      }
    >
      {isLoading ? (
        <p className={`text-sm text-[#6B7280] ${variant === 'overlay' ? 'px-4 py-4' : 'px-4 py-3'}`}>{loadingLabel}</p>
      ) : (
        suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            type="button"
            onClick={() => handleSelect(suggestion)}
            className={
              variant === 'overlay'
                ? 'flex min-h-[44px] w-full touch-manipulation items-center border-b border-[#F3F3F3] px-4 py-3 text-left text-sm text-[#222222] last:border-b-0 hover:bg-[#FAFAFA] active:bg-[#F0F0F0]'
                : 'block w-full border-b border-[#F3F3F3] px-4 py-3 text-left text-sm text-[#222222] last:border-b-0 hover:bg-[#FAFAFA]'
            }
          >
            {suggestion.label}
          </button>
        ))
      )}
    </div>
  ) : null

  return (
    <div ref={containerRef} className={`relative min-w-0 ${variant === 'embed' ? 'w-full' : 'flex-1'}`}>
      <form
        onSubmit={handleSubmit}
        className="relative flex h-11 w-full min-w-0 items-center rounded-full border border-[#EAEAEA] bg-white px-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          autoFocus={autoFocus}
          onChange={(event) => {
            onQueryChange(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onTouchStart={() => setIsOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={`w-full min-w-0 flex-1 bg-transparent text-sm text-[#2A2A2A] outline-none placeholder:text-[#9A9A9A] ${
            showClear ? (variant === 'overlay' ? 'pr-12' : 'pr-8') : ''
          }`}
        />
        {showClear && onClear && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault()
              setIsOpen(false)
              onClear()
            }}
            className={
              variant === 'overlay'
                ? 'absolute right-1 flex h-9 min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#F0F0F0] hover:text-[#374151] active:bg-[#E5E7EB]'
                : 'absolute right-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#6B7280] transition hover:bg-[#F0F0F0] hover:text-[#374151]'
            }
            aria-label={clearLabel}
          >
            <X className="h-4 w-4 shrink-0" strokeWidth={2} />
          </button>
        )}
      </form>
      {usePortal
        ? showDropdown && dropdownBounds && typeof document !== 'undefined'
          ? createPortal(dropdown, document.body)
          : null
        : dropdown}
    </div>
  )
}
