import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Enregistre une ouverture du chat par le client (pour la relance inactivité 48h).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const conversationId = body?.conversationId as string | undefined
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId requis' }, { status: 400 })
    }

    const userEmail = user.email.toLowerCase().trim()

    const { data: row, error: pError } = await supabaseAdmin
      .from('participants')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('email', userEmail)
      .maybeSingle()

    if (pError || !row || (row as { role: string }).role !== 'client') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const { error: uError } = await (supabaseAdmin.from('conversations') as any)
      .update({
        client_last_chat_open_at: now,
        updated_at: now,
      })
      .eq('id', conversationId)

    if (uError) {
      console.error('[client-visit] update error:', uError)
      return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[client-visit]', e)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
