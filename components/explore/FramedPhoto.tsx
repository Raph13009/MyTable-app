'use client'

import { getOptimizedSupabaseImageUrl } from '@/lib/image-utils'

type FramedPhotoVariant = 'hero' | 'thumb'

interface FramedPhotoProps {
  src: string
  alt: string
  width: number
  quality?: number
  variant?: FramedPhotoVariant
  className?: string
}

/** Hero sizes to the photo itself. Thumbs fill their tile. */
export function FramedPhoto({
  src,
  alt,
  width,
  quality = 75,
  variant = 'hero',
  className = '',
}: FramedPhotoProps) {
  const optimized = getOptimizedSupabaseImageUrl(src, width, quality) ?? src

  if (variant === 'thumb') {
    return (
      <img
        src={optimized}
        alt={alt}
        draggable={false}
        className={`h-full w-full object-cover object-center ${className}`}
      />
    )
  }

  return (
    <img
      src={optimized}
      alt={alt}
      draggable={false}
      className={`max-h-full max-w-full object-contain object-center rounded-[18px] shadow-[0_10px_32px_rgba(17,17,17,0.10)] ${className}`}
    />
  )
}
