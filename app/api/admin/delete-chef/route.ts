import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ADMIN_UID = '8d154623-1aba-475c-9a7b-9ab39f3f84d2'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user || user.id !== ADMIN_UID) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { chefId } = body

    if (!chefId) {
      return NextResponse.json(
        { error: 'chefId manquant' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()

    const { error: deleteError } = await supabaseAdmin
      .from('chefs')
      .delete()
      .eq('id', chefId)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting chef:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression du chef' },
      { status: 500 }
    )
  }
}
