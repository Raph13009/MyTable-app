'use client'

import { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export function Select({ label, error, options, className, ...props }: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-black mb-2">
          {label}
        </label>
      )}
      <select
        className={cn(
          // Base styles - mobile first
          'w-full',
          'px-3 py-2.5 sm:px-4 sm:py-3',
          'text-base', // Ensure readable text size on mobile (prevents iOS zoom)
          'border-2 border-gray-300 rounded-lg',
          'focus:outline-none focus:ring-2 focus:ring-black focus:border-black',
          'transition-all duration-200',
          'bg-white',
          'cursor-pointer',
          // Mobile optimizations
          'touch-manipulation', // Better touch handling
          'min-h-[44px]', // Minimum touch target size (iOS recommendation)
          // Hover and focus states
          'hover:border-gray-400 active:border-black',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-200',
          className
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}

