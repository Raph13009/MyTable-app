import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BookingForm from '@/components/BookingForm'
import BookingHeader from '@/components/BookingHeader'

interface PageProps {
  params: {
    chefSlug: string
  }
}

export default async function BookPage({ params }: PageProps) {
  const supabase = await createClient()
  const { chefSlug } = params

  // Récupérer le chef et ses menus
  const { data: chef, error: chefError } = await supabase
    .from('chefs')
    .select('*')
    .eq('slug', chefSlug)
    .single()

  if (chefError || !chef) {
    redirect('/')
  }

  const { data: menus } = await supabase
    .from('menus')
    .select('*')
    .eq('chef_id', (chef as any).id)
    .order('name')

  return (
    <div className="min-h-screen bg-white">
      {/* Bannière jaune avec logo - Fixe (ne se replie jamais) */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#FBCF03] border-b-2 border-black shadow-lg will-change-transform">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 relative">
          <div className="flex items-center justify-center">
            <img 
              src="/logo-banner.jpeg" 
              alt="MyTable" 
              className="h-16 sm:h-20 md:h-24 w-auto object-contain"
            />
          </div>
          <BookingHeader />
        </div>
      </div>

      {/* Contenu avec padding pour compenser la bannière fixe */}
      <div className="pt-24 sm:pt-28 md:pt-32">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">
              Réserver avec{' '}
              <span className="text-black">Chef</span>{' '}
              <span 
                className="bg-gradient-to-r from-[#FBCF03] via-[#FFD700] to-[#FBCF03] bg-clip-text text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #FBCF03 0%, #FFD700 50%, #FBCF03 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {(chef as any).name}
              </span>
            </h1>
            <p className="text-gray-600">
              Remplissez le formulaire ci-dessous pour faire une demande de réservation
            </p>
          </div>

          <BookingForm key={chefSlug} chef={chef} menus={menus || []} />
        </div>
      </div>
    </div>
  )
}

