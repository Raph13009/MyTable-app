import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken, getBaseUrl } from '@/lib/utils'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')
    const action = searchParams.get('action')

    if (!token || !action || (action !== 'accept' && action !== 'refuse')) {
      return NextResponse.redirect(new URL('/?error=invalid_params', request.url))
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
      return NextResponse.redirect(new URL('/?error=token_not_found', request.url))
    }

    // Trouver le token correspondant
    let matchingToken: any = null
    for (const dbToken of tokens as any[]) {
      const isValid = await verifyToken(token, dbToken.token_hash)
      if (isValid && dbToken.action === action) {
        matchingToken = dbToken
        break
      }
    }

    if (!matchingToken) {
      return NextResponse.redirect(new URL('/?error=invalid_token', request.url))
    }

    const bookingRequest = matchingToken.booking_requests as any

    // Vérifier que le token correspond à l'action demandée
    if (matchingToken.action !== action) {
      return NextResponse.redirect(new URL('/?error=action_mismatch', request.url))
    }

    // Marquer le token comme utilisé
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
    const siteUrl = baseUrl

    if (action === 'refuse') {
      // Mettre à jour le statut
      await (supabase
        .from('booking_requests') as any)
        .update({ status: 'refused' })
        .eq('id', bookingRequest.id)

      // Récupérer les infos du chef pour l'email
      const { data: chef } = await supabase
        .from('chefs')
        .select('name')
        .eq('id', bookingRequest.chef_id)
        .single()

      // Extraire le prénom du chef (premier mot du nom)
      const chefFirstName = chef ? ((chef as any).name?.split(' ')[0] || (chef as any).name) : 'Chef'
      const clientFirstName = bookingRequest.first_name || ''

      // Envoyer email au client
      await sendEmail({
        to: bookingRequest.email,
        subject: emailSubjects.bookingRefusedToClient,
        html: emailTemplates.bookingRefusedToClient(
          clientFirstName,
          chefFirstName,
          baseUrl
        ),
      })

      return NextResponse.redirect(new URL('/?message=booking_refused', request.url))
    } else if (action === 'accept') {
      // Mettre à jour le statut
      const { data: updatedBooking } = await (supabase
        .from('booking_requests') as any)
        .update({ status: 'accepted' })
        .eq('id', bookingRequest.id)
        .select('conversation_id')
        .single()

      if (!updatedBooking) {
        return NextResponse.redirect(new URL('/?error=update_failed', request.url))
      }

      const conversationId = (updatedBooking as any).conversation_id
      if (!conversationId) {
        return NextResponse.redirect(new URL('/?error=no_conversation_id', request.url))
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

      // Envoyer email uniquement au client (pas au chef)
      console.log('[decision] Sending email to CLIENT only:', bookingRequest.email)
      // Extraire prénom et nom du chef
      const chefFullName = chef ? (chef as any).name : 'Chef'
      const chefNameParts = chefFullName.split(' ')
      const chefFirstName = chefNameParts[0] || chefFullName
      const chefLastName = chefNameParts.slice(1).join(' ') || ''
      
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

      // ⚠️ IMPORTANT: NE PAS ENVOYER D'EMAIL bookingAcceptedToChef AU CHEF
      // Le chef recevra UNIQUEMENT le magic link via Supabase Auth
      console.log('[decision] ⚠️ NOT sending bookingAcceptedToChef email to chef')
      console.log('[decision] ⚠️ Chef will ONLY receive magic link from Supabase')

      // IMPORTANT: Envoyer UNIQUEMENT le magic link au chef via Supabase
      // AUCUN email bookingAcceptedToChef ne doit être envoyé
      if (chef) {
        const chefEmail = (chef as any).email.toLowerCase().trim()
        // Rediriger directement vers le dashboard (liste de toutes les conversations)
        const redirectUrl = `${baseUrl}/auth/callback?next=${encodeURIComponent('/dashboard')}`
        
        console.log('[decision] ========== SENDING MAGIC LINK TO CHEF ==========')
        console.log('[decision] Chef email:', chefEmail)
        console.log('[decision] Chef name:', (chef as any).name)
        console.log('[decision] Redirect URL:', redirectUrl)
        console.log('[decision] Conversation ID:', conversationId)
        console.log('[decision] Base URL:', baseUrl)
        
        // IMPORTANT: Ne PAS envoyer d'email bookingAcceptedToChef
        // Seul le magic link Supabase doit être envoyé
        
        // Envoyer le magic link via Supabase Auth (c'est Supabase qui envoie l'email automatiquement)
        console.log('[decision] Calling supabase.auth.signInWithOtp...')
        const { data: otpData, error: otpError } = await supabase.auth.signInWithOtp({
          email: chefEmail,
          options: {
            emailRedirectTo: redirectUrl,
            shouldCreateUser: true,
          },
        })

        if (otpError) {
          console.error('[decision] ❌❌❌ ERROR sending magic link to chef ❌❌❌')
          console.error('[decision] Error message:', otpError.message)
          console.error('[decision] Error status:', otpError.status)
          console.error('[decision] Error details:', JSON.stringify(otpError, null, 2))
          // En cas d'erreur, rediriger vers une page d'erreur
          return NextResponse.redirect(new URL('/?error=magic_link_failed', request.url))
        }

        console.log('[decision] ✅✅✅ Magic link sent successfully to chef via Supabase ✅✅✅')
        console.log('[decision] OTP data:', JSON.stringify(otpData, null, 2))
        console.log('[decision] Magic link email should be sent by Supabase to:', chefEmail)
        console.log('[decision] ========== MAGIC LINK SENT ==========')
        
        // Rediriger vers une page de confirmation simple qui dit que le magic link a été envoyé
        // Le chef n'a pas besoin de redirection, il reste sur ses mails
        return NextResponse.redirect(new URL('/booking-accepted?chef=true', request.url))
      }

      // Rediriger vers la page de confirmation si pas de chef (ne devrait pas arriver)
      return NextResponse.redirect(new URL('/booking-accepted', request.url))

      // Fallback si pas de chef (ne devrait pas arriver)
      return NextResponse.redirect(new URL(`/chat/${updatedBooking.conversation_id}?accepted=true`, request.url))
    }

    return NextResponse.redirect(new URL('/?error=unknown', request.url))
  } catch (error) {
    console.error('Error processing decision:', error)
    return NextResponse.redirect(new URL('/?error=server_error', request.url))
  }
}

