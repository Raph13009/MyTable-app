import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailLayout } from '@/lib/email'
import { getBaseUrl } from '@/lib/utils'
import { calculateBookingTotal } from '@/lib/bookingCalculations'

/**
 * API Route pour enregistrer l'event "finalize_clicked" pour chef à demeure
 * Ne change pas le statut de la réservation, mais notifie l'admin pour l'envoi manuel du lien de paiement
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('[booking-finalize-clicked] 📨 Event finalize_clicked received')
  
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[booking-finalize-clicked] ❌ Authentication error:', authError)
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { bookingRequestId } = await request.json()
    if (!bookingRequestId) {
      console.error('[booking-finalize-clicked] ❌ Missing bookingRequestId')
      return NextResponse.json({ error: 'bookingRequestId requis' }, { status: 400 })
    }

    console.log('[booking-finalize-clicked] Processing event for booking:', bookingRequestId)

    // Récupérer la réservation
    const { data: bookingRequest, error: bookingError } = await supabaseAdmin
      .from('booking_requests')
      .select('*, chefs(*), menus(*)')
      .eq('id', bookingRequestId)
      .single()

    if (bookingError || !bookingRequest) {
      console.error('[booking-finalize-clicked] ❌ Error fetching booking:', bookingError)
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
    }

    // Vérifier que l'utilisateur est le client
    const normalizedUserEmail = user.email?.toLowerCase().trim()
    const normalizedBookingEmail = (bookingRequest as any).email?.toLowerCase().trim()
    if (normalizedUserEmail !== normalizedBookingEmail) {
      console.error('[booking-finalize-clicked] ❌ Unauthorized:', {
        userEmail: normalizedUserEmail,
        bookingEmail: normalizedBookingEmail,
      })
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Vérifier que c'est bien un chef à demeure
    const serviceType = (bookingRequest as any).service_type
    if (serviceType !== 'mise_en_demeure') {
      console.error('[booking-finalize-clicked] ❌ Invalid service type:', serviceType)
      return NextResponse.json({ 
        error: 'Cet endpoint est uniquement pour les réservations "chef à demeure"' 
      }, { status: 400 })
    }

    // Vérifier que le statut est 'accepted'
    if ((bookingRequest as any).status !== 'accepted') {
      console.error('[booking-finalize-clicked] ❌ Invalid status:', (bookingRequest as any).status)
      return NextResponse.json({ 
        error: 'La réservation doit être acceptée par le chef avant d\'être finalisée' 
      }, { status: 400 })
    }

    // Log l'event (pour l'instant, on log juste dans la console)
    // TODO: Si besoin, créer une table booking_events pour stocker les events
    console.log('[booking-finalize-clicked] ✅ Event logged:', {
      bookingRequestId,
      clientEmail: normalizedUserEmail,
      serviceType,
      timestamp: new Date().toISOString(),
    })

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
        console.error('[booking-finalize-clicked] Error parsing extras:', e)
      }
    }
    
    // Calculer le montant total
    const menuPrice = (bookingRequest as any).menus?.price || 0
    const guestsCount = (bookingRequest as any).guests_count || 0
    const childrenCount = (bookingRequest as any).children_count || 0
    const totalAmount = calculateBookingTotal(serviceType, {
      menuPrice,
      guestsCount,
      budget: (bookingRequest as any).budget,
      totalPrice: (bookingRequest as any).total_price,
      isPriceCustom: (bookingRequest as any).is_price_custom,
      extras,
    })

    // Formater les dates
    const { formatDateForDisplay } = await import('@/lib/dateUtils')
    const selectedDates = (bookingRequest as any).selected_dates
    let datesFormatted = 'N/A'
    if (selectedDates && Array.isArray(selectedDates) && selectedDates.length > 0) {
      datesFormatted = selectedDates.map((date: string) => 
        formatDateForDisplay(date, 'fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      ).join(', ')
    }

    const baseUrl = getBaseUrl()
    const chef = (bookingRequest as any).chefs
    const clientName = `${(bookingRequest as any).first_name} ${(bookingRequest as any).last_name}`
    const clientEmail = (bookingRequest as any).email
    const clientPhone = (bookingRequest as any).phone || 'N/A'

    // Créer le contenu de l'email pour l'admin
    const emailContent = `
      <p>Bonjour,</p>
      <p>Un client a cliqué sur le bouton "Finaliser" pour une réservation <strong>Chef à demeure</strong>.</p>
      <p><strong>Action requise :</strong> Envoyer manuellement le lien de paiement au client.</p>
      
      <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #FBCF03;">
        <h3 style="margin-top: 0; color: #000;">Détails de la réservation</h3>
        <p><strong>Client :</strong> ${clientName}</p>
        <p><strong>Email :</strong> ${clientEmail}</p>
        <p><strong>Téléphone :</strong> ${clientPhone}</p>
        <p><strong>Chef :</strong> ${chef?.name || 'N/A'}</p>
        <p><strong>Email du chef :</strong> ${chef?.email || 'N/A'}</p>
        <p><strong>Dates :</strong> ${datesFormatted}</p>
        <p><strong>Nombre de convives :</strong> ${guestsCount}${childrenCount > 0 ? ` (dont ${childrenCount} ${childrenCount === 1 ? 'enfant' : 'enfants'})` : ''}</p>
        <p><strong>Montant total :</strong> ${totalAmount.toFixed(2)} €</p>
        <p><strong>ID de réservation :</strong> ${bookingRequestId}</p>
      </div>
      
      <p style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e8e8e8;">
        <strong>⚠️ Important :</strong> Le statut de la réservation n'a pas été modifié. 
        Le client attend le lien de paiement pour finaliser sa réservation.
      </p>
    `

    const emailHtml = emailLayout({
      title: 'Action requise : Envoi du lien de paiement',
      content: emailContent,
      baseUrl,
    })

    // Envoyer l'email à l'admin
    try {
      console.log('[booking-finalize-clicked] Sending email to admin: contact@guidemytable.fr')
      await sendEmail({
        to: 'contact@guidemytable.fr',
        subject: `[Action requise] Lien de paiement à envoyer - ${clientName}`,
        html: emailHtml,
      })
      console.log('[booking-finalize-clicked] ✅ Admin email sent successfully')
    } catch (adminEmailError) {
      console.error('[booking-finalize-clicked] ❌ Error sending admin email:', adminEmailError)
      // Ne pas bloquer si l'envoi d'email échoue, mais logger l'erreur
    }

    const duration = Date.now() - startTime
    console.log('[booking-finalize-clicked] ✅ Event processed successfully:', {
      bookingRequestId,
      duration: `${duration}ms`,
    })

    return NextResponse.json({ 
      success: true,
      message: 'Event enregistré et admin notifié',
    })
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error('[booking-finalize-clicked] ❌ Error:', {
      error: error?.message || error,
      stack: error?.stack,
      duration: `${duration}ms`,
    })
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
