'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export default function BookingAcceptedPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isChef = searchParams.get('chef') === 'true'

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
          {isChef ? 'Réservation acceptée !' : 'Réservation acceptée !'}
        </h1>
        <p className="text-gray-600 mb-8">
          {isChef 
            ? 'Un lien de connexion a été envoyé à votre adresse email. Vérifiez votre boîte de réception et cliquez sur le lien pour accéder au chat.'
            : 'Vous avez bien accepté la réservation. Vous pouvez maintenant vous connecter pour accéder au chat.'
          }
        </p>
        {!isChef && (
        <Button
          onClick={() => router.push('/login')}
          className="min-w-[200px]"
        >
          Aller à la page de connexion
        </Button>
        )}
      </div>
    </div>
  )
}

