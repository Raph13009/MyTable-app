'use client'

import { useState } from 'react'

export default function BookingHeader() {
  const [showStepper, setShowStepper] = useState(false)

  // Même logique que dans ChatInterface - pour le formulaire, on est à l'étape 1
  const isStep1Complete = true // Formulaire rempli
  const isStep2Complete = false // Pas encore validé
  const isStep3Complete = false // Pas encore payé
  const isStep4Complete = false // Pas encore confirmé

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

      {/* Popup avec stepper - Même structure que ChatInterface */}
      {showStepper && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowStepper(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-black">Progression de la réservation</h2>
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

              {/* Stepper vertical avec lignes de connexion - Même structure que ChatInterface */}
              <div className="relative">
                {/* Ligne de progression verticale */}
                <div className="absolute left-5 top-0 bottom-0 w-0.5">
                  {/* Ligne complétée */}
                  <div 
                    className={`absolute top-0 left-0 w-full transition-all duration-500 ease-out ${
                      isStep4Complete
                        ? 'bg-[#FBCF03] h-full'
                        : isStep3Complete
                        ? 'bg-[#FBCF03] h-3/4'
                        : isStep2Complete 
                        ? 'bg-[#FBCF03] h-1/2' 
                        : isStep1Complete 
                        ? 'bg-[#FBCF03] h-1/4'
                        : 'bg-gray-200 h-0'
                    }`}
                    style={{ 
                      height: isStep4Complete ? '100%' : isStep3Complete ? '75%' : isStep2Complete ? '50%' : isStep1Complete ? '25%' : '0%' 
                    }}
                  />
                  {/* Ligne en attente */}
                  <div 
                    className={`absolute top-0 left-0 w-full bg-gray-200 transition-all duration-500 ${
                      isStep4Complete ? 'h-0' : isStep3Complete ? 'h-1/4' : isStep2Complete ? 'h-1/2' : isStep1Complete ? 'h-3/4' : 'h-full'
                    }`}
                    style={{ 
                      top: isStep4Complete ? '100%' : isStep3Complete ? '75%' : isStep2Complete ? '50%' : isStep1Complete ? '25%' : '0%',
                      height: isStep4Complete ? '0%' : isStep3Complete ? '25%' : isStep2Complete ? '50%' : isStep1Complete ? '75%' : '100%'
                    }}
                  />
                </div>

                <div className="relative space-y-6">
                  {/* Étape 1: Chef/Client trouvé (toujours complétée) */}
                  <div className="relative flex items-start gap-4">
                    {/* Icône de l'étape */}
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-[#FBCF03] flex items-center justify-center shadow-lg shadow-[#FBCF03]/30 ring-4 ring-[#FBCF03]/10 transition-all duration-300">
                        <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {/* Badge de complétion */}
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-[#FBCF03]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* Contenu de l'étape */}
                    <div className="flex-1 pt-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-black">
                          Chef sélectionné
                        </p>
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/20 text-[#FBCF03] rounded-full">
                          Complété
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        Votre demande a été acceptée par le chef
                      </p>
                    </div>
                  </div>

                  {/* Étape 2: Prestation validée */}
                  <div className="relative flex items-start gap-4">
                    {/* Icône de l'étape */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isStep2Complete
                          ? 'bg-[#FBCF03] shadow-lg shadow-[#FBCF03]/30 ring-4 ring-[#FBCF03]/10 scale-105'
                          : 'bg-gray-100 border-2 border-gray-300'
                      }`}>
                        {isStep2Complete ? (
                          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-gray-400" />
                        )}
                      </div>
                      {isStep2Complete && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-[#FBCF03]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Contenu de l'étape */}
                    <div className="flex-1 pt-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-semibold transition-colors ${
                          isStep2Complete 
                            ? 'text-black' 
                            : 'text-gray-400'
                        }`}>
                          Prestation validée
                        </p>
                        {isStep2Complete ? (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/20 text-[#FBCF03] rounded-full">
                            Complété
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-400 rounded-full">
                            En attente
                          </span>
                        )}
                      </div>
                      <p className={`text-xs leading-relaxed transition-colors ${
                        isStep2Complete ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        {isStep2Complete 
                          ? 'La réservation a été confirmée'
                          : 'En attente de validation'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Étape 3: Paiement */}
                  <div className="relative flex items-start gap-4">
                    {/* Icône de l'étape */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isStep3Complete
                          ? 'bg-[#FBCF03] shadow-lg shadow-[#FBCF03]/30 ring-4 ring-[#FBCF03]/10 scale-105'
                          : 'bg-gray-100 border-2 border-gray-300'
                      }`}>
                        {isStep3Complete ? (
                          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-gray-400" />
                        )}
                      </div>
                      {isStep3Complete && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-[#FBCF03]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Contenu de l'étape */}
                    <div className="flex-1 pt-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-semibold transition-colors ${
                          isStep3Complete 
                            ? 'text-black' 
                            : 'text-gray-400'
                        }`}>
                          Paiement en attente
                        </p>
                        {isStep3Complete ? (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/20 text-[#FBCF03] rounded-full">
                            Complété
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-400 rounded-full">
                            En attente
                          </span>
                        )}
                      </div>
                      <p className={`text-xs leading-relaxed transition-colors ${
                        isStep3Complete ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        {isStep3Complete
                          ? 'Le paiement a été effectué'
                          : 'En attente de validation de la réservation'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Étape 4: Prestation confirmée */}
                  <div className="relative flex items-start gap-4">
                    {/* Icône de l'étape */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                        isStep4Complete
                          ? 'bg-[#FBCF03] shadow-lg shadow-[#FBCF03]/30 ring-4 ring-[#FBCF03]/10 scale-105'
                          : 'bg-gray-100 border-2 border-gray-300'
                      }`}>
                        {isStep4Complete ? (
                          <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-gray-400" />
                        )}
                      </div>
                      {isStep4Complete && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-[#FBCF03]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    {/* Contenu de l'étape */}
                    <div className="flex-1 pt-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-semibold transition-colors ${
                          isStep4Complete ? 'text-black' : 'text-gray-400'
                        }`}>
                          Prestation confirmée
                        </p>
                        {isStep4Complete ? (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/20 text-[#FBCF03] rounded-full">
                            Complété
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-400 rounded-full">
                            En attente
                          </span>
                        )}
                      </div>
                      <p className={`text-xs leading-relaxed transition-colors ${
                        isStep4Complete ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        {isStep4Complete 
                          ? 'La prestation a été livrée avec succès'
                          : 'En attente du paiement'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
