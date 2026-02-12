'use client'

import { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  error?: string
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-black mb-2">
          {label}
        </label>
      )}
      <input
        className={cn(
          'w-full min-w-0 px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-black transition-colors',
          props.type === 'date' && 'max-w-full',
          error && 'border-red-500',
          className
        )}
        style={props.type === 'date' ? { 
          maxWidth: '100%',
          boxSizing: 'border-box'
        } : undefined}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
