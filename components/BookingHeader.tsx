'use client'

import { useState } from 'react'

export default function BookingHeader() {
  const [showStepper, setShowStepper] = useState(false)

  const steps = [
    {
      number: 1,
      title: 'Remplissez le formulaire',
      description: 'Complétez toutes les informations demandées pour votre réservation.',
    },
    {
      number: 2,
      title: 'Le chef examine votre demande',
      description: 'Le chef reçoit votre demande et décide de l\'accepter ou de la refuser.',
    },
    {
      number: 3,
      title: 'Réponse du chef',
      description: 'Vous recevrez un email avec la décision du chef dans les prochaines heures.',
    },
    {
      number: 4,
      title: 'Échange via chat',
      description: 'Si accepté, vous pourrez échanger avec le chef pour finaliser les détails.',
    },
    {
      number: 5,
      title: 'Validation et paiement',
      description: 'Une fois tout validé, vous recevrez un lien de paiement pour confirmer votre réservation.',
    },
  ]

  return (
    <>
      {/* Bouton info discret dans le header */}
      <button
        onClick={() => setShowStepper(true)}
        className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 p-2 text-black/70 hover:text-black hover:bg-black/10 rounded-full transition-all"
        aria-label="Comment ça marche ?"
        title="Comment ça marche ?"
      >
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Popup avec stepper */}
      {showStepper && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowStepper(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-black">Comment ça marche ?</h2>
                <button
                  onClick={() => setShowStepper(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Fermer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Stepper */}
              <div className="space-y-6">
                {steps.map((step, index) => (
                  <div key={step.number} className="flex gap-4">
                    {/* Numéro de l'étape */}
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                        index === 0 
                          ? 'bg-[#FBCF03] text-black border-2 border-black' 
                          : 'bg-gray-100 text-gray-600 border-2 border-gray-300'
                      }`}>
                        {step.number}
                      </div>
                      {index < steps.length - 1 && (
                        <div className="w-0.5 h-12 bg-gray-200 mx-auto mt-2"></div>
                      )}
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 pb-6">
                      <h3 className="text-lg font-semibold text-black mb-2">{step.title}</h3>
                      <p className="text-gray-600 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowStepper(false)}
                  className="w-full px-6 py-3 bg-[#FBCF03] text-black font-semibold rounded-xl hover:bg-[#E6BA00] transition-colors"
                >
                  Compris, merci !
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
