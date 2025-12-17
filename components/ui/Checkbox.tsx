'use client'

import { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Checkbox({ label, error, className, ...props }: CheckboxProps) {
  return (
    <div className="w-full">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          className={cn(
            'w-5 h-5 border-2 border-gray-300 rounded focus:outline-none focus:border-black transition-colors cursor-pointer',
            error && 'border-red-500',
            className
          )}
          {...props}
        />
        {label && (
          <span className="text-sm font-medium text-black">{label}</span>
        )}
      </label>
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}

