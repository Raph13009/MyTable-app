import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BookingForm from '@/components/BookingForm'

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
      {/* Bannière jaune avec logo - Fixe */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#FBCF03] border-b-2 border-black shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-center">
            <img 
              src="/logo-banner.jpeg" 
              alt="MyTable" 
              className="h-12 sm:h-14 w-auto object-contain"
            />
          </div>
        </div>
      </div>

      {/* Contenu avec padding pour compenser la bannière fixe */}
      <div className="pt-20 sm:pt-24">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-black mb-2">
              Réserver avec {(chef as any).name}
            </h1>
            <p className="text-gray-600">
              Remplissez le formulaire ci-dessous pour faire une demande de réservation
            </p>
          </div>

          <BookingForm chef={chef} menus={menus || []} />
        </div>
      </div>
    </div>
  )
}

