'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  error?: string
  options: SelectOption[]
  name?: string
  value: string
  placeholder?: string
  onChange?: (event: { target: { name?: string; value: string } }) => void
  className?: string
}

/**
 * Custom dropdown (accessible & mobile-first)
 * - Options align perfectly below the trigger
 * - Large touch targets, smooth focus/hover states
 */
export function Select({
  label,
  error,
  options,
  name,
  value,
  placeholder = 'Choisir...',
  onChange,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  const handleSelect = (val: string) => {
    onChange?.({ target: { name, value: val } })
    setOpen(false)
  }

  // Fermer quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        listRef.current &&
        !listRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Gestion clavier basique
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen((prev) => !prev)
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-black mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          ref={buttonRef}
          onClick={() => setOpen((prev) => !prev)}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full px-3 py-2.5 sm:px-4 sm:py-3',
            'text-base text-left',
            'border-2 border-gray-300 rounded-lg',
            'bg-white',
            'focus:outline-none focus:ring-2 focus:ring-black focus:border-black',
            'transition-all duration-200',
            'hover:border-gray-400 active:border-black',
            'min-h-[44px]',
            'flex items-center justify-between gap-2',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-200',
            className
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className={cn('truncate', !selectedOption && 'text-gray-500')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <svg
            className={cn(
              'w-4 h-4 shrink-0 transition-transform duration-200',
              open ? 'rotate-180' : 'rotate-0'
            )}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        {open && (
          <ul
            ref={listRef}
            role="listbox"
            className={cn(
              'absolute z-30 mt-2 w-full',
              'bg-white border-2 border-gray-200 rounded-lg shadow-xl',
              'max-h-64 overflow-auto',
              'focus:outline-none'
            )}
          >
            {options.map((option) => {
              const isSelected = option.value === value
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'px-4 py-3 cursor-pointer',
                    'text-sm sm:text-base',
                    'hover:bg-gray-50 active:bg-gray-100',
                    isSelected && 'bg-black text-white hover:bg-black'
                  )}
                >
                  {option.label}
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}

