'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/hooks/useTranslation'

interface ReserveChefButtonProps {
  href: string
  className?: string
}

export function ReserveChefButton({ href, className }: ReserveChefButtonProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (isLoading) return
    setIsLoading(true)
    router.push(href)
  }

  return (
    <>
      <button type="button" onClick={handleClick} className={className}>
        {t('explore.reserve')}
      </button>

      {mounted && isLoading
        ? createPortal(
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-white/96 backdrop-blur-[2px]">
              <div className="relative h-24 w-24">
                <div className="absolute inset-0 rounded-full border border-[#F8E7A0] animate-ping [animation-duration:1400ms]" />
                <div className="absolute inset-[10px] rounded-full border-2 border-[#F1D56A]/60 border-t-[#D4A602] animate-spin [animation-duration:900ms]" />
                <div className="absolute inset-[22px] rounded-full bg-white shadow-[0_6px_20px_rgba(0,0,0,0.08)]" />
                <img
                  src="/logo-cercle.png"
                  alt="MyTable"
                  className="absolute inset-0 m-auto h-10 w-10 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.12)]"
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
