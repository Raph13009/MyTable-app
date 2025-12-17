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
    .eq('chef_id', chef.id)
    .order('name')

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-black mb-2">
            Réserver avec {chef.name}
          </h1>
          <p className="text-gray-600">
            Remplissez le formulaire ci-dessous pour faire une demande de réservation
          </p>
        </div>

        <BookingForm chef={chef} menus={menus || []} />
      </div>
    </div>
  )
}

