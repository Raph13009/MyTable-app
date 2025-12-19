import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import { getBaseUrl } from '@/lib/utils'

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

    // Calculer le montant total
    const menuPrice = bookingRequest.menus?.price || 0
    const guestsCount = bookingRequest.guests_count || 0
    const menuTotal = menuPrice * guestsCount

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

    const extrasTotal = extras.reduce((sum, extra) => sum + (extra.price || 0), 0)
    const totalAmount = menuTotal + extrasTotal

    // Formater la date
    const bookingDate = new Date(bookingRequest.booking_date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const chef = bookingRequest.chefs

    console.log('[test-admin-email] 📧 Envoi de l\'email admin...')
    console.log('[test-admin-email] Destinataire: contact.avenirea@gmail.com')
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
        to: 'contact.avenirea@gmail.com',
        subject: emailSubjects.bookingValidatedToAdmin,
        html: emailTemplates.bookingValidatedToAdmin(
          `${bookingRequest.first_name} ${bookingRequest.last_name}`,
          bookingRequest.email,
          chef?.name || 'Chef',
          chef?.email || '',
          bookingDate,
          guestsCount,
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

