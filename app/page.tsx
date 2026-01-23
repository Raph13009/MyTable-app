'use client'

import Image from 'next/image'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useEffect, useState } from 'react'

export default function HomePage() {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    // Redirection automatique après 5 secondes
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.location.href = 'https://guidemytable.fr/'
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header avec logo intégré */}
      <header className="bg-[#FBCF03] border-b-2 border-black">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 relative">
          <div className="flex items-center justify-center">
            <Image
              src="/logo-banner.jpeg"
              alt="MyTable"
              width={200}
              height={80}
              className="h-16 sm:h-20 md:h-24 w-auto object-contain"
              priority
            />
          </div>
          {/* Sélecteur de langue discret */}
          <div className="absolute top-4 sm:top-6 right-4 sm:right-6">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Zone centrale - Focus absolu */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="max-w-md w-full text-center space-y-8">
          {/* Message principal */}
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-gray-900 tracking-tight">
              Bienvenue sur MyTable
            </h1>
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed">
              Vous allez être redirigé vers la page principale.
            </p>
          </div>

          {/* Call-to-action principal */}
          <div className="space-y-4">
            <a
              href="https://guidemytable.fr/"
              className="inline-block w-full sm:w-auto px-8 sm:px-12 py-4 sm:py-5 bg-[#FBCF03] hover:bg-[#E6BA00] text-black font-semibold text-lg sm:text-xl rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              Accéder à MyTable
            </a>
            
            {/* Option secondaire - Redirection automatique */}
            <p className="text-sm text-gray-500">
              Redirection automatique dans {countdown} seconde{countdown > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

