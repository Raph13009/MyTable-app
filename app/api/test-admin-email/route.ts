import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import { getBaseUrl } from '@/lib/utils'
import { calculateBookingTotal } from '@/lib/bookingCalculations'

/**
 * Route de test pour envoyer l'email admin pour la dernière réservation validée
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = createAdminClient()
    const baseUrl = getBaseUrl()

    console.log('[test-admin-email] 🔍 Recherche de la dernière réservation validée...')

    // Récupérer la dernière réservation validée
    const { data: bookingRequests, error: bookingError } = await supabaseAdmin
      .from('booking_requests')
      .select('*, chefs(*), menus(*)')
      .eq('status', 'validated_by_client')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (bookingError) {
      console.error('[test-admin-email] ❌ Erreur lors de la récupération:', bookingError)
      return NextResponse.json({ error: 'Erreur lors de la récupération', details: bookingError }, { status: 500 })
    }

    if (!bookingRequests || bookingRequests.length === 0) {
      console.log('[test-admin-email] ⚠️  Aucune réservation validée trouvée')
      return NextResponse.json({ error: 'Aucune réservation validée trouvée' }, { status: 404 })
    }

    const bookingRequest = bookingRequests[0] as any
    console.log('[test-admin-email] ✅ Réservation trouvée:', {
      id: bookingRequest.id,
      client: `${bookingRequest.first_name} ${bookingRequest.last_name}`,
      email: bookingRequest.email,
      status: bookingRequest.status,
    })

    // Récupérer les extras
    let extras: Array<{ name: string; price: number }> = []
    if (bookingRequest.extras) {
      try {
        const extrasData = bookingRequest.extras
        if (Array.isArray(extrasData)) {
          extras = extrasData
        } else if (typeof extrasData === 'string') {
          const parsed = JSON.parse(extrasData)
          if (parsed.extras && Array.isArray(parsed.extras)) {
            extras = parsed.extras
          }
        }
      } catch (e) {
        console.error('[test-admin-email] Erreur parsing extras:', e)
      }
    }

    // Calculer le montant total selon le type de service
    const menuPrice = bookingRequest.menus?.price || 0
    const guestsCount = bookingRequest.guests_count || 0
    const childrenCount = bookingRequest.children_count || 0
    const totalAmount = calculateBookingTotal(bookingRequest.service_type, {
      menuPrice,
      guestsCount,
      budget: bookingRequest.budget,
      totalPrice: bookingRequest.total_price,
      isPriceCustom: bookingRequest.is_price_custom,
      extras,
    })

    // Formater la date
    const { formatDateForDisplay } = await import('@/lib/dateUtils')
    const bookingDate = formatDateForDisplay(bookingRequest.booking_date, 'fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const chef = bookingRequest.chefs

    console.log('[test-admin-email] 📧 Envoi de l\'email admin...')
    console.log('[test-admin-email] Destinataire: contact@guidemytable.fr')
    console.log('[test-admin-email] Détails:', {
      client: `${bookingRequest.first_name} ${bookingRequest.last_name}`,
      clientEmail: bookingRequest.email,
      chef: chef?.name || 'Chef',
      chefEmail: chef?.email || '',
      date: bookingDate,
      convives: guestsCount,
      total: totalAmount.toFixed(2) + ' €',
    })

    try {
      await sendEmail({
        to: 'contact@guidemytable.fr',
        subject: emailSubjects.bookingValidatedToAdmin,
        html: emailTemplates.bookingValidatedToAdmin(
          `${bookingRequest.first_name} ${bookingRequest.last_name}`,
          bookingRequest.email,
          chef?.name || 'Chef',
          chef?.email || '',
          bookingDate,
          guestsCount,
          childrenCount,
          totalAmount,
          bookingRequest.menus?.name || null,
          extras,
          baseUrl
        ),
      })

      console.log('[test-admin-email] ✅ Email admin envoyé avec succès !')

      return NextResponse.json({
        success: true,
        message: 'Email admin envoyé avec succès',
        details: {
          bookingId: bookingRequest.id,
          client: `${bookingRequest.first_name} ${bookingRequest.last_name}`,
          clientEmail: bookingRequest.email,
          chef: chef?.name || 'Chef',
          chefEmail: chef?.email || '',
          totalAmount: totalAmount.toFixed(2) + ' €',
        },
      })
    } catch (emailError: any) {
      console.error('[test-admin-email] ❌ Erreur lors de l\'envoi de l\'email:', emailError)
      return NextResponse.json({
        error: 'Erreur lors de l\'envoi de l\'email',
        details: emailError.message || emailError,
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('[test-admin-email] ❌ Erreur:', error)
    return NextResponse.json({
      error: 'Erreur interne',
      details: error.message || error,
    }, { status: 500 })
  }
}
