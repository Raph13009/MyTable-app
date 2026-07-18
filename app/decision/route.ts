import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken, getBaseUrl } from '@/lib/utils'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import {
  dispatchFallbackToAllBackupChefs,
  resolveFallbackAcceptClaim,
  shouldNotifyClientOfFallbackExhaustion,
} from '@/lib/fallbackBookings'
import { sendBookingRefusedClientEmail } from '@/lib/sendBookingRefusedClientEmail'


export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')
    const action = searchParams.get('action')

    if (!token || !action || (action !== 'accept' && action !== 'refuse')) {
      const errorUrl = new URL('/?error=invalid_params', request.url)
      errorUrl.searchParams.set('message', 'Paramètres invalides dans le lien')
      return NextResponse.redirect(errorUrl)
    }

    // Utiliser le client admin pour bypass RLS dans les opérations serveur
    const supabase = createAdminClient()

    // Récupérer tous les tokens non utilisés et non expirés
    const { data: tokens, error: tokensError } = await supabase
      .from('decision_tokens')
      .select('*, booking_requests(*)')
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())

    if (tokensError || !tokens) {
      const errorUrl = new URL('/?error=token_not_found', request.url)
      errorUrl.searchParams.set('message', 'Aucun token valide trouvé. Le lien a peut-être expiré.')
      return NextResponse.redirect(errorUrl)
    }

    // Trouver le token correspondant
    let matchingToken: any = null
    for (const dbToken of tokens as any[]) {
      const isValid = await verifyToken(token, dbToken.token_hash)
      if (isValid && dbToken.action === action) {
        // Vérifier que le token n'a pas déjà été utilisé
        if (dbToken.used) {
          const errorUrl = new URL('/?error=invalid_token', request.url)
          errorUrl.searchParams.set('message', 'Ce lien a déjà été utilisé. La réservation a déjà été traitée.')
          return NextResponse.redirect(errorUrl)
        }
        matchingToken = dbToken
        break
      }
    }

    if (!matchingToken) {
      const errorUrl = new URL('/?error=invalid_token', request.url)
      errorUrl.searchParams.set('message', 'Token invalide ou expiré. Le lien a peut-être déjà été utilisé ou a expiré.')
      return NextResponse.redirect(errorUrl)
    }

    const bookingRequest = matchingToken.booking_requests as any

    // Vérifier que le token correspond à l'action demandée
    if (matchingToken.action !== action) {
      const errorUrl = new URL('/?error=action_mismatch', request.url)
      errorUrl.searchParams.set('message', 'L\'action demandée ne correspond pas au token.')
      return NextResponse.redirect(errorUrl)
    }

    // Marquer le token comme utilisé AVANT de traiter la demande (pour éviter les doubles clics)
    await (supabase
      .from('decision_tokens') as any)
      .update({ used: true })
      .eq('id', matchingToken.id)

    // Marquer l'autre token comme utilisé aussi (pour éviter les doubles clics)
    await (supabase
      .from('decision_tokens') as any)
      .update({ used: true })
      .eq('booking_request_id', bookingRequest.id)
      .neq('id', matchingToken.id)

    const baseUrl = getBaseUrl()

    if (action === 'refuse') {
      // Mettre à jour le statut
      const { data: refusedBooking } = await (supabase
        .from('booking_requests') as any)
        .update({ status: 'refused' })
        .eq('status', 'pending')
        .eq('id', bookingRequest.id)
        .select('id')
        .maybeSingle()

      if (!refusedBooking?.id) {
        const alreadyHandledUrl = new URL('/?error=already_handled', request.url)
        alreadyHandledUrl.searchParams.set(
          'message',
          'Cette demande a déjà été traitée ou attribuée à un autre chef.'
        )
        return NextResponse.redirect(alreadyHandledUrl)
      }

      let fallbackDispatched = false
      if (bookingRequest.fallback_enabled) {
        const fallbackResults = await dispatchFallbackToAllBackupChefs(
          supabase as any,
          bookingRequest,
          'refused'
        )
        fallbackDispatched = fallbackResults.length > 0
      }

      // Récupérer les infos du chef pour l'email
      const { data: chef } = await supabase
        .from('chefs')
        .select('name')
        .eq('id', bookingRequest.chef_id)
        .single()

      // Extraire le prénom du chef (premier mot du nom)
      const chefFirstName = chef ? ((chef as any).name?.split(' ')[0] || (chef as any).name) : 'Chef'

      if (!fallbackDispatched) {
        const shouldNotify = await shouldNotifyClientOfFallbackExhaustion(
          supabase as any,
          bookingRequest
        )
        if (shouldNotify) {
          await sendBookingRefusedClientEmail(
            supabase as any,
            bookingRequest,
            chefFirstName,
            baseUrl
          )
        }
      }

      // Rediriger vers une page de confirmation explicite
      const refusedUrl = new URL('/booking-refused', request.url)
      return NextResponse.redirect(refusedUrl, 302)
    } else if (action === 'accept') {
      const fallbackGroupId = bookingRequest.fallback_group_id || bookingRequest.id

      // Accept first (conditional on pending), then enforce max candidates for backup races.
      const { data: updatedBooking } = await (supabase
        .from('booking_requests') as any)
        .update({ status: 'accepted' })
        .eq('status', 'pending')
        .eq('id', bookingRequest.id)
        .select('conversation_id')
        .maybeSingle()

      if (!updatedBooking) {
        const alreadyAssignedUrl = new URL('/?error=already_assigned', request.url)
        alreadyAssignedUrl.searchParams.set(
          'message',
          'La mission a déjà été attribuée à un autre chef.'
        )
        return NextResponse.redirect(alreadyAssignedUrl)
      }

      if (fallbackGroupId) {
        const claim = await resolveFallbackAcceptClaim(
          supabase as any,
          bookingRequest,
          bookingRequest.id
        )
        if (!claim.ok) {
          const alreadyAssignedUrl = new URL('/?error=already_assigned', request.url)
          alreadyAssignedUrl.searchParams.set(
            'message',
            'La mission a déjà été attribuée à un autre chef.'
          )
          return NextResponse.redirect(alreadyAssignedUrl)
        }
      }

      const conversationId = (updatedBooking as any).conversation_id
      if (!conversationId) {
        const errorUrl = new URL('/?error=no_conversation_id', request.url)
        errorUrl.searchParams.set('message', 'Erreur: aucune conversation trouvée pour cette réservation.')
        return NextResponse.redirect(errorUrl)
      }
      const chatUrl = `${baseUrl}/chat/${conversationId}`

      // Récupérer les infos du chef
      const { data: chef } = await supabase
        .from('chefs')
        .select('email, name')
        .eq('id', bookingRequest.chef_id)
        .single()

      console.log('[decision] ========== ACCEPT ACTION ==========')
      console.log('[decision] Booking request ID:', bookingRequest.id)
      console.log('[decision] Chef found:', chef ? 'YES' : 'NO')
      if (chef) {
        console.log('[decision] Chef email:', (chef as any).email)
        console.log('[decision] Chef name:', (chef as any).name)
      }

      // Extraire prénom et nom du chef
      const chefFullName = chef ? (chef as any).name : 'Chef'
      const chefNameParts = chefFullName.split(' ')
      const chefFirstName = chefNameParts[0] || chefFullName
      const chefLastName = chefNameParts.slice(1).join(' ') || ''

      // Envoyer l'email informatif au client avec lien direct vers le chat
      // (le lien redirige vers /login?next=/chat/[id] si non connecté)
      try {
        await sendEmail({
          to: bookingRequest.email,
          subject: emailSubjects.bookingAcceptedToClient,
          html: emailTemplates.bookingAcceptedToClient(
            `${bookingRequest.first_name} ${bookingRequest.last_name}`,
            chefFirstName,
            chefLastName,
            chatUrl,
            baseUrl
          ),
        })
        console.log('[decision] ✅ Email sent to client')
      } catch (error) {
        console.error('[decision] ❌ Error sending email to client:', error)
      }

      // Rediriger le chef vers la page de confirmation
      if (chef) {
        return NextResponse.redirect(new URL('/booking-accepted?chef=true', request.url))
      }

      return NextResponse.redirect(new URL('/booking-accepted', request.url))
    }

    const errorUrl = new URL('/?error=unknown', request.url)
    errorUrl.searchParams.set('message', 'Erreur inconnue lors du traitement de la demande.')
    return NextResponse.redirect(errorUrl)
  } catch (error: any) {
    console.error('Error processing decision:', error)
    const errorUrl = new URL('/?error=server_error', request.url)
    errorUrl.searchParams.set('message', error?.message || 'Une erreur serveur est survenue. Veuillez réessayer.')
    return NextResponse.redirect(errorUrl)
  }
}
