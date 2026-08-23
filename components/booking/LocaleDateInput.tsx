'use client'

import { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateNumeric, numericDatePlaceholder } from '@/lib/dateUtils'
import type { Locale } from '@/lib/i18n'

interface LocaleDateInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  label?: ReactNode
  error?: string
  value: string
  locale: Locale
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
}

/**
 * Shows an app-locale numeric date (FR: DD/MM/YYYY) while keeping a native
 * date picker and YYYY-MM-DD value for validation/submit.
 */
export function LocaleDateInput({
  label,
  error,
  value,
  locale,
  onChange,
  className,
  name,
  min,
  required,
  ...props
}: LocaleDateInputProps) {
  const display = formatDateNumeric(value, locale)
  const placeholder = numericDatePlaceholder(locale)

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-black mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <div
          aria-hidden="true"
          className={cn(
            'w-full min-w-0 px-4 py-3 pr-11 border-2 border-gray-300 rounded-lg bg-white pointer-events-none',
            error && 'border-red-500',
            !display && 'text-gray-400',
            className
          )}
        >
          {display || placeholder}
        </div>
        <input
          {...props}
          type="date"
          name={name}
          value={value}
          min={min}
          required={required}
          onChange={onChange}
          className="absolute inset-0 w-full h-full cursor-pointer opacity-[0.01]"
          aria-label={typeof label === 'string' ? label : placeholder}
        />
        <Calendar
          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
          aria-hidden="true"
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
