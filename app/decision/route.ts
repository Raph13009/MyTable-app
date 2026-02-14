import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken, getBaseUrl } from '@/lib/utils'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import { createNextFallbackBooking, expireOtherPendingInFallbackGroup } from '@/lib/fallbackBookings'

/**
 * ============================================
 * RESPONSIBILITY SEPARATION:
 * ============================================
 * - Supabase Auth: Magic link generation and sending (authentication only)
 * - Resend: Transactional emails (notifications, confirmations - NO auth)
 * 
 * When chef accepts a booking:
 * 1. Both client and chef receive magic links via Supabase Auth
 * 2. Client receives informational email via Resend (transactional)
 * 3. Magic links redirect to /auth/callback?next=/chat/{conversationId}
 * 4. No duplicate users (shouldCreateUser: false for existing users)
 */

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
        const fallbackResult = await createNextFallbackBooking(supabase as any, bookingRequest, 'refused')
        fallbackDispatched = Boolean(fallbackResult)
      }

      // Récupérer les infos du chef pour l'email
      const { data: chef } = await supabase
        .from('chefs')
        .select('name')
        .eq('id', bookingRequest.chef_id)
        .single()

      // Extraire le prénom du chef (premier mot du nom)
      const chefFirstName = chef ? ((chef as any).name?.split(' ')[0] || (chef as any).name) : 'Chef'
      const clientFirstName = bookingRequest.first_name || ''

      if (!fallbackDispatched) {
        // Envoyer email au client uniquement si aucun chef fallback n'a été contacté
        await sendEmail({
          to: bookingRequest.email,
          subject: emailSubjects.bookingRefusedToClient,
          html: emailTemplates.bookingRefusedToClient(
            clientFirstName,
            chefFirstName,
            baseUrl
          ),
        })
      }

      // Rediriger vers une page de confirmation explicite
      const refusedUrl = new URL('/booking-refused', request.url)
      return NextResponse.redirect(refusedUrl, 302)
    } else if (action === 'accept') {
      // Mettre à jour le statut
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

      const fallbackGroupId = bookingRequest.fallback_group_id || bookingRequest.id
      if (fallbackGroupId) {
        await expireOtherPendingInFallbackGroup(supabase as any, fallbackGroupId, bookingRequest.id)
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

      // ============================================
      // PHASE 1: Send magic links to BOTH client and chef
      // ============================================
      // Responsibilities:
      // - Supabase Auth: Magic link generation and sending (authentication)
      // - Resend: Transactional notification email (informational only)
      
      const clientEmail = bookingRequest.email.toLowerCase().trim()
      const redirectUrlForClient = `${baseUrl}/auth/callback?next=${encodeURIComponent(`/chat/${conversationId}`)}`
      const redirectUrlForChef = `${baseUrl}/auth/callback?next=${encodeURIComponent(`/chat/${conversationId}`)}`

      // ============================================
      // PHASE 1: Send informational email to CLIENT first
      // ============================================
      // Extraire prénom et nom du chef
      const chefFullName = chef ? (chef as any).name : 'Chef'
      const chefNameParts = chefFullName.split(' ')
      const chefFirstName = chefNameParts[0] || chefFullName
      const chefLastName = chefNameParts.slice(1).join(' ') || ''
      
      // ============================================
      // OPTIMIZATION: Envoyer les emails en parallèle et rediriger immédiatement
      // ============================================
      // On lance l'envoi des emails de manière asynchrone mais on ne bloque pas la réponse
      // pour une meilleure expérience utilisateur
      
      const sendEmailsAsync = async () => {
        try {
          // Envoyer l'email informatif au client
          console.log('[decision] Sending informational email to CLIENT via Resend...')
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
          console.log('[decision] ✅ Informational email sent to client via Resend')

          // Envoyer les magic links en parallèle
          console.log('[decision] ========== SENDING MAGIC LINKS ==========')
          console.log('[decision] Client email:', clientEmail)
          console.log('[decision] Client redirect URL:', redirectUrlForClient)
          
          // Envoyer les magic links en parallèle pour le client et le chef
          const emailPromises: Promise<any>[] = []
          
          // Magic link pour le client
          console.log('[decision] Sending magic link to CLIENT via Supabase Auth...')
          const clientMagicLinkPromise = supabase.auth.signInWithOtp({
            email: clientEmail,
            options: {
              emailRedirectTo: redirectUrlForClient,
              shouldCreateUser: false,
            },
          }).then(async ({ error: clientOtpError }) => {
            if (clientOtpError) {
              console.error('[decision] ❌ ERROR sending magic link to client:', clientOtpError.message)
              // If user doesn't exist, try with shouldCreateUser: true as fallback
              if (clientOtpError.message?.includes('not found') || clientOtpError.message?.includes('does not exist')) {
                console.log('[decision] ⚠️ Client user not found, trying with shouldCreateUser: true...')
                const retryResult = await supabase.auth.signInWithOtp({
                  email: clientEmail,
                  options: {
                    emailRedirectTo: redirectUrlForClient,
                    shouldCreateUser: true,
                  },
                })
                return retryResult
              }
              throw clientOtpError
            }
            console.log('[decision] ✅ Magic link sent to client via Supabase Auth')
            return { data: null, error: null }
          }).catch((error) => {
            console.error('[decision] ❌ Failed to send magic link to client:', error)
            return { data: null, error }
          })
          
          emailPromises.push(clientMagicLinkPromise)
          
          // Magic link pour le chef
          if (chef) {
            const chefEmail = (chef as any).email.toLowerCase().trim()
            console.log('[decision] Chef email:', chefEmail)
            console.log('[decision] Chef redirect URL:', redirectUrlForChef)
            console.log('[decision] Sending magic link to CHEF via Supabase Auth...')
            
            const chefMagicLinkPromise = supabase.auth.signInWithOtp({
              email: chefEmail,
              options: {
                emailRedirectTo: redirectUrlForChef,
                shouldCreateUser: false,
              },
            }).then(async ({ error: chefOtpError }) => {
              if (chefOtpError) {
                console.error('[decision] ❌ ERROR sending magic link to chef:', chefOtpError.message)
                // If user doesn't exist, try with shouldCreateUser: true as fallback
                if (chefOtpError.message?.includes('not found') || chefOtpError.message?.includes('does not exist')) {
                  console.log('[decision] ⚠️ Chef user not found, trying with shouldCreateUser: true...')
                  const retryResult = await supabase.auth.signInWithOtp({
                    email: chefEmail,
                    options: {
                      emailRedirectTo: redirectUrlForChef,
                      shouldCreateUser: true,
                    },
                  })
                  return retryResult
                }
                throw chefOtpError
              }
              console.log('[decision] ✅ Magic link sent to chef via Supabase Auth')
              return { data: null, error: null }
            }).catch((error) => {
              console.error('[decision] ❌ Failed to send magic link to chef:', error)
              return { data: null, error }
            })
            
            emailPromises.push(chefMagicLinkPromise)
          }
          
          // Attendre que tous les emails soient envoyés (mais ne pas bloquer la réponse HTTP)
          await Promise.allSettled(emailPromises)
          console.log('[decision] ✅✅✅ All emails sent ✅✅✅')
        } catch (error) {
          console.error('[decision] ❌ Error in async email sending:', error)
          // Ne pas bloquer si les emails échouent - ils seront loggés
        }
      }
      
      // Envoyer les emails avant de répondre pour éviter l'arrêt du runtime
      try {
        await sendEmailsAsync()
      } catch (error) {
        console.error('[decision] ❌ Unhandled error in email sending:', error)
      }
      
      // Rediriger immédiatement vers la page de confirmation (sans attendre les emails)
      if (chef) {
        return NextResponse.redirect(new URL('/booking-accepted?chef=true', request.url))
      }
      
      return NextResponse.redirect(new URL('/booking-accepted', request.url))

      // Fallback si pas de chef (ne devrait pas arriver)
      return NextResponse.redirect(new URL(`/chat/${updatedBooking.conversation_id}?accepted=true`, request.url))
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
