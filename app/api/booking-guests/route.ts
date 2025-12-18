import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * API Route pour mettre à jour le nombre de convives d'une réservation
 * Client uniquement, réservation modifiable uniquement
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { bookingRequestId, guestsCount } = await request.json()
    if (!bookingRequestId || !guestsCount) {
      return NextResponse.json({ error: 'bookingRequestId et guestsCount requis' }, { status: 400 })
    }

    // Vérifier que guestsCount est valide (minimum 1)
    if (guestsCount < 1) {
      return NextResponse.json({ error: 'Le nombre de convives doit être au moins 1' }, { status: 400 })
    }

    // Récupérer la réservation
    const { data: bookingRequest, error: bookingError } = await supabaseAdmin
      .from('booking_requests')
      .select('*')
      .eq('id', bookingRequestId)
      .single()

    if (bookingError || !bookingRequest) {
      console.error('[booking-guests] Error fetching booking:', bookingError)
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
    }

    // Vérifier que l'utilisateur est le client
    const normalizedUserEmail = user.email?.toLowerCase().trim()
    const normalizedBookingEmail = (bookingRequest as any).email?.toLowerCase().trim()
    if (normalizedUserEmail !== normalizedBookingEmail) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Vérifier que la réservation peut être modifiée
    const currentStatus = (bookingRequest as any).status
    if (currentStatus === 'validated_by_client' || currentStatus === 'cancelled') {
      return NextResponse.json({ 
        error: 'La réservation ne peut plus être modifiée' 
      }, { status: 400 })
    }

    // Mettre à jour le nombre de convives
    const { error: updateError } = await supabaseAdmin
      .from('booking_requests')
      .update({ 
        guests_count: guestsCount,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', bookingRequestId)

    if (updateError) {
      console.error('[booking-guests] Error updating guests count:', updateError)
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ success: true, guestsCount })
  } catch (error: any) {
    console.error('[booking-guests] Error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

