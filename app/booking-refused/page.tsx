'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

export default function BookingRefusedPage() {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
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
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-[#FBCF03] rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-black mb-4">Demande refusée</h1>
        <p className="text-gray-600 mb-2">Votre demande de refus a bien été prise en compte.</p>
        <p className="text-sm text-gray-500 mb-8">
          Redirection automatique dans {countdown} seconde{countdown > 1 ? 's' : ''}.
        </p>

        <Button onClick={() => (window.location.href = 'https://guidemytable.fr/')} className="min-w-[220px]">
          Retour à Guide My Table
        </Button>
      </div>
    </div>
  )
}
