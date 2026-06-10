'use client'

import Image from 'next/image'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function HomeContent() {
  const [mounted, setMounted] = useState(false)
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const message = searchParams.get('message')

  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  const externalUrl = isLocalhost ? '/explore' : 'https://guidemytable.fr/'

  useEffect(() => {
    setMounted(true)
    const timer = setTimeout(() => {
      window.location.href = externalUrl
    }, 4000)
    return () => clearTimeout(timer)
  }, [externalUrl])

  return (
    <div
      className={`flex flex-col items-center gap-8 transition-all duration-700 ${
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <Image
        src="/logo-cercle.png"
        alt="MyTable"
        width={72}
        height={72}
        className="h-16 w-16 object-contain"
        priority
      />

      <div className="text-center">
        <h1 className="text-[32px] font-semibold tracking-tight text-[#111111]">
          {status === 'refused' ? 'Demande traitée' : 'MyTable'}
        </h1>
        <p className="mt-2 text-[15px] text-[#7A7A7A]">
          {message || "L'art culinaire privé, sélectionné avec soin"}
        </p>
      </div>

      <a
        href={externalUrl}
        className="inline-flex items-center gap-2 rounded-full bg-[#FBCF03] px-8 py-3.5 text-[15px] font-semibold text-[#111111] shadow-[0_4px_14px_rgba(251,207,3,0.4)] transition hover:brightness-[1.04] active:scale-[0.98]"
      >
        Accéder à MyTable
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M3 8h10M9 4l4 4-4 4" stroke="#111111" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </a>

      <RedirectDots />
    </div>
  )
}

function RedirectDots() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => (t + 1) % 4), 500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full transition-colors duration-300"
          style={{ backgroundColor: i < tick ? '#FBCF03' : '#D4D4D4' }}
        />
      ))}
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="relative flex h-[100dvh] w-screen flex-col items-center justify-center overflow-hidden bg-white px-6">
      <Suspense>
        <HomeContent />
      </Suspense>
    </div>
  )
}
