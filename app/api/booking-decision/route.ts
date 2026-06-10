import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processBookingDecision } from '@/lib/bookingDecision'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { bookingRequestId, action } = body

    if (!bookingRequestId || (action !== 'accept' && action !== 'refuse')) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
    }

    const { data: bookingRequest, error: bookingError } = await supabaseAdmin
      .from('booking_requests')
      .select('chef_id, status')
      .eq('id', bookingRequestId)
      .maybeSingle()

    if (bookingError || !bookingRequest) {
      return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
    }

    const { data: chef, error: chefError } = await supabaseAdmin
      .from('chefs')
      .select('email')
      .eq('id', (bookingRequest as any).chef_id)
      .maybeSingle()

    if (chefError || !chef) {
      return NextResponse.json({ error: 'Chef introuvable' }, { status: 404 })
    }

    const normalizedChefEmail = ((chef as any).email || '').toLowerCase().trim()
    const normalizedUserEmail = user.email.toLowerCase().trim()

    if (normalizedChefEmail !== normalizedUserEmail) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const result = await processBookingDecision(supabaseAdmin, bookingRequestId, action)

    if (!result.ok) {
      const status =
        result.code === 'not_found' ? 404 : result.code === 'not_pending' ? 409 : 409
      return NextResponse.json({ error: result.message }, { status })
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      conversationId: result.conversationId,
    })
  } catch (error: any) {
    console.error('[booking-decision] Error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
