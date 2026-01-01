import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import { getBaseUrl } from '@/lib/utils'

/**
 * API Route pour finaliser une réservation (client uniquement)
 * Met à jour le statut à 'validated_by_client' et envoie les emails appropriés
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
      .select('*, chefs(*), menus(*)')
      .eq('id', bookingRequestId)
      .single()

    if (bookingError || !bookingRequest) {
      console.error('[booking-validate] Error fetching booking:', bookingError)
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
    }

    // Vérifier que l'utilisateur est le client
    const normalizedUserEmail = user.email?.toLowerCase().trim()
    const normalizedBookingEmail = (bookingRequest as any).email?.toLowerCase().trim()
    if (normalizedUserEmail !== normalizedBookingEmail) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Vérifier que le statut est 'accepted'
    if ((bookingRequest as any).status !== 'accepted') {
      return NextResponse.json({ 
        error: 'La réservation doit être acceptée par le chef avant d\'être validée' 
      }, { status: 400 })
    }

    // Mettre à jour le statut
    const { error: updateError } = await supabaseAdmin
      .from('booking_requests')
      // @ts-expect-error - Supabase type inference issue
      .update({ 
        status: 'validated_by_client',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', bookingRequestId)

    if (updateError) {
      console.error('[booking-validate] Error updating status:', updateError)
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
          content: 'La réservation a été validée par le client.',
        } as any)
    }

    // Calculer le montant total
    const menuPrice = (bookingRequest as any).menus?.price || 0
    const guestsCount = (bookingRequest as any).guests_count || 0
    const childrenCount = (bookingRequest as any).children_count || 0
    const menuTotal = menuPrice * guestsCount
    
    // Récupérer les extras
    let extras: Array<{ name: string; price: number }> = []
    if ((bookingRequest as any).extras) {
      try {
        const extrasData = (bookingRequest as any).extras
        if (Array.isArray(extrasData)) {
          extras = extrasData
        } else if (typeof extrasData === 'string') {
          const parsed = JSON.parse(extrasData)
          if (parsed.extras && Array.isArray(parsed.extras)) {
            extras = parsed.extras
          }
        }
      } catch (e) {
        console.error('[booking-validate] Error parsing extras:', e)
      }
    }
    
    const extrasTotal = extras.reduce((sum, extra) => sum + (extra.price || 0), 0)
    const totalAmount = menuTotal + extrasTotal

    // Formater la date
    const bookingDate = new Date((bookingRequest as any).booking_date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const baseUrl = getBaseUrl()

    // Envoyer les emails
    try {
      // Email au client
      const chef = (bookingRequest as any).chefs
      await sendEmail({
        to: (bookingRequest as any).email,
        subject: emailSubjects.bookingValidatedToClient,
        html: emailTemplates.bookingValidatedToClient(
          `${(bookingRequest as any).first_name} ${(bookingRequest as any).last_name}`,
          bookingDate,
          chef?.phone || null,
          baseUrl
        ),
      })

      // Email au chef
      if (chef && chef.email) {
        await sendEmail({
          to: chef.email,
          subject: emailSubjects.bookingValidatedToChef,
          html: emailTemplates.bookingValidatedToChef(
            chef.name || 'Chef',
            `${(bookingRequest as any).first_name} ${(bookingRequest as any).last_name}`,
            bookingDate,
            guestsCount,
            childrenCount,
            totalAmount,
            (bookingRequest as any).phone || null,
            baseUrl
          ),
        })
      }

      // Email à l'admin
      console.log('[booking-validate] Sending email to admin: contact@guidemytable.fr')
      try {
        await sendEmail({
          to: 'contact@guidemytable.fr',
          subject: emailSubjects.bookingValidatedToAdmin,
          html: emailTemplates.bookingValidatedToAdmin(
            `${(bookingRequest as any).first_name} ${(bookingRequest as any).last_name}`,
            (bookingRequest as any).email,
            chef?.name || 'Chef',
            chef?.email || '',
            bookingDate,
            guestsCount,
            childrenCount,
            totalAmount,
            (bookingRequest as any).menus?.name || null,
            extras,
            baseUrl
          ),
        })
        console.log('[booking-validate] ✅ Admin email sent successfully')
      } catch (adminEmailError) {
        console.error('[booking-validate] ❌ Error sending admin email:', adminEmailError)
        // Ne pas bloquer si l'envoi d'email admin échoue, mais logger l'erreur
      }
    } catch (emailError) {
      console.error('[booking-validate] Error sending emails:', emailError)
      // Ne pas bloquer si l'envoi d'email échoue
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[booking-validate] Error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

