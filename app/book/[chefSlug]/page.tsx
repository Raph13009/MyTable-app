import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BookingForm from '@/components/BookingForm'
import BookingHeader from '@/components/BookingHeader'
import { Database } from '@/types/database'

interface PageProps {
  params: {
    chefSlug: string
  }
}

type Chef = Database['public']['Tables']['chefs']['Row']

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

  const typedChef = chef as Chef
  const postalPrefix = (typedChef.postal_code || '').replace(/\D/g, '').slice(0, 2)

  const { data: menus } = await supabase
    .from('menus')
    .select('*')
    .eq('chef_id', typedChef.id)
    .order('name')

  let nearbyChefs: Chef[] = []
  if (postalPrefix.length === 2) {
    const { data } = await supabase
      .from('chefs')
      .select('*')
      .like('postal_code', `${postalPrefix}%`)
      .neq('id', typedChef.id)
      .limit(6)
    nearbyChefs = (data || []) as Chef[]
  }

  return (
    <div className="min-h-screen bg-[#FCFCFA]">
      {/* Bannière jaune avec logo - Fixe (ne se replie jamais) */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#FBCF03] border-b border-black/20 shadow-md will-change-transform">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3.5 relative">
          <div className="flex items-center justify-center">
            <img 
              src="/logo-banner.jpeg" 
              alt="MyTable" 
              className="h-10 sm:h-12 md:h-14 w-auto object-contain"
            />
          </div>
          <BookingHeader />
        </div>
      </div>

      {/* Contenu avec padding pour compenser la bannière fixe */}
      <div className="pt-20 sm:pt-24 md:pt-24">
        <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
          <BookingForm key={chefSlug} chef={typedChef} chefName={typedChef.name} menus={menus || []} nearbyChefs={nearbyChefs} />
        </div>
      </div>
    </div>
  )
}
