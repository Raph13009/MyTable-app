'use client'

import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function BookingConfirmationPage() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email')

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-[#FBCF03] rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-black"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-black mb-4">
          Demande envoyée !
        </h1>
        <p className="text-gray-600 mb-6">
          Votre demande de réservation a été envoyée avec succès.
          {email && (
            <>
              <br />
              Un email de confirmation a été envoyé à <strong>{email}</strong>
            </>
          )}
        </p>
        <p className="text-gray-600 mb-8">
          Le chef va examiner votre demande et vous recevrez une réponse par email sous peu.
        </p>
        <Button onClick={() => window.location.href = '/'}>
          Retour à l'accueil
        </Button>
      </div>
    </div>
  )
}

