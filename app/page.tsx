import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Suspense } from 'react'

function MessageBanner({ searchParams }: { searchParams: { error?: string; message?: string } }) {
  if (searchParams.error) {
    const errorMessages: Record<string, string> = {
      invalid_params: 'Paramètres invalides',
      token_not_found: 'Token introuvable ou expiré',
      invalid_token: 'Token invalide',
      action_mismatch: 'Action non correspondante',
      update_failed: 'Erreur lors de la mise à jour',
      server_error: 'Erreur serveur',
    }
    return (
      <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 mb-6 max-w-4xl mx-auto">
        <p className="text-red-700 font-medium">
          {errorMessages[searchParams.error] || 'Une erreur est survenue'}
        </p>
      </div>
    )
  }

  if (searchParams.message) {
    const successMessages: Record<string, string> = {
      booking_refused: 'La réservation a été refusée. Un email a été envoyé au client.',
    }
    return (
      <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4 mb-6 max-w-4xl mx-auto">
        <p className="text-green-700 font-medium">
          {successMessages[searchParams.message] || 'Opération réussie'}
        </p>
      </div>
    )
  }

  return null
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string }
}) {
  const supabase = await createClient()

  // Récupérer quelques chefs pour la démo
  const { data: chefs } = await supabase
    .from('chefs')
    .select('*')
    .limit(6)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-black">MyTable</h1>
            <nav className="hidden md:flex gap-6">
              <Link href="/" className="text-black hover:text-gray-600">
                Accueil
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Messages */}
      <Suspense fallback={null}>
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <MessageBanner searchParams={searchParams} />
        </div>
      </Suspense>

      {/* Hero Section */}
      <section className="bg-[#FBCF03] py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-5xl font-bold text-black mb-6">
            Réservez votre table avec les meilleurs chefs
          </h2>
          <p className="text-xl text-gray-800 mb-8 max-w-2xl mx-auto">
            Découvrez une expérience culinaire unique. Réservez directement avec nos chefs et échangez en temps réel.
          </p>
        </div>
      </section>

      {/* Chefs Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-3xl font-bold text-black mb-8 text-center">
            Nos Chefs
          </h3>
          
          {chefs && chefs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {chefs.map((chef: any) => (
                <div
                  key={chef.id}
                  className="border-2 border-gray-300 rounded-lg p-6 hover:border-black transition-colors"
                >
                  <h4 className="text-xl font-bold text-black mb-2">{chef.name}</h4>
                  {chef.city && (
                    <p className="text-gray-600 mb-4">{chef.city}</p>
                  )}
                  <Link href={`/book/${chef.slug}`}>
                    <Button className="w-full">Réserver</Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-600 py-12">
              <p>Aucun chef disponible pour le moment.</p>
              <p className="mt-2 text-sm">
                Ajoutez des chefs dans votre base de données Supabase pour commencer.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-gray-300 mt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-600">
          <p>&copy; 2024 MyTable. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  )
}

