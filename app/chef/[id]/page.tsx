import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'

interface PageProps {
  params: {
    id: string
  }
}

export default async function ChefByIdPage({ params }: PageProps) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('chefs')
    .select('slug')
    .eq('id', params.id)
    .single()

  if (error || !data?.slug) {
    notFound()
  }

  redirect(`/book/${data.slug}`)
}
