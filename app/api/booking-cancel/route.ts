import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import { getBaseUrl } from '@/lib/utils'

/**
 * API Route pour annuler une réservation (client ou chef selon le statut)
 * Met à jour le statut à 'cancelled' et envoie les emails appropriés
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

    const { bookingRequestId } = await request.json()
    if (!bookingRequestId) {
      return NextResponse.json({ error: 'bookingRequestId requis' }, { status: 400 })
    }

    // Récupérer la réservation
    const { data: bookingRequest, error: bookingError } = await supabaseAdmin
      .from('booking_requests')
      .select('*, chefs(*)')
      .eq('id', bookingRequestId)
      .single()

    if (bookingError || !bookingRequest) {
      console.error('[booking-cancel] Error fetching booking:', bookingError)
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
    }

    const normalizedUserEmail = user.email?.toLowerCase().trim()
    const normalizedBookingEmail = (bookingRequest as any).email?.toLowerCase().trim()
    const chef = (bookingRequest as any).chefs
    const normalizedChefEmail = chef?.email?.toLowerCase().trim()

    // Vérifier que l'utilisateur est soit le client soit le chef
    const isClient = normalizedUserEmail === normalizedBookingEmail
    const isChef = normalizedUserEmail === normalizedChefEmail

    if (!isClient && !isChef) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Vérifier que la réservation n'est pas déjà annulée ou validée
    const currentStatus = (bookingRequest as any).status
    if (currentStatus === 'cancelled') {
      return NextResponse.json({ error: 'La réservation est déjà annulée' }, { status: 400 })
    }
    if (currentStatus === 'validated_by_client') {
      return NextResponse.json({ 
        error: 'La réservation est déjà validée et ne peut pas être annulée' 
      }, { status: 400 })
    }

    // Mettre à jour le statut
    const { error: updateError } = await supabaseAdmin
      .from('booking_requests')
      // @ts-expect-error - Supabase type inference issue
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', bookingRequestId)

    if (updateError) {
      console.error('[booking-cancel] Error updating status:', updateError)
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    // Ajouter un message système dans le chat
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('booking_request_id', bookingRequestId)
      .single()

    if (conversation) {
      await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: (conversation as any).id,
          sender_email: user.email!,
          content: 'La réservation a été annulée.',
        } as any)
    }

    // Formater la date
    const { formatDateForDisplay } = await import('@/lib/dateUtils')
    const bookingDate = formatDateForDisplay((bookingRequest as any).booking_date, 'fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const baseUrl = getBaseUrl()

    // Envoyer les emails
    try {
      // Email au client
      await sendEmail({
        to: (bookingRequest as any).email,
        subject: emailSubjects.bookingCancelledToClient,
        html: emailTemplates.bookingCancelledToClient(
          `${(bookingRequest as any).first_name} ${(bookingRequest as any).last_name}`,
          bookingDate,
          baseUrl
        ),
      })

      // Email au chef
      if (chef && chef.email) {
        await sendEmail({
          to: chef.email,
          subject: emailSubjects.bookingCancelledToChef,
          html: emailTemplates.bookingCancelledToChef(
            chef.name || 'Chef',
            `${(bookingRequest as any).first_name} ${(bookingRequest as any).last_name}`,
            bookingDate,
            baseUrl
          ),
        })
      }
    } catch (emailError) {
      console.error('[booking-cancel] Error sending emails:', emailError)
      // Ne pas bloquer si l'envoi d'email échoue
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[booking-cancel] Error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

