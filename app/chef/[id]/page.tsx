import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'

interface PageProps {
  params: {
    id: string
  }
}

export default async function ChefByIdPage({ params }: PageProps) {
  const supabase = createAdminClient()

  const { data, error } = await (supabase.from('chefs') as any)
    .select('slug')
    .eq('id', params.id)
    .single()

  const slug = typeof data?.slug === 'string' ? data.slug : null

  if (error || !slug) {
    notFound()
  }

  redirect(`/book/${slug}`)
}
