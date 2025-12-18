import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken } from '@/lib/utils'
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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const siteUrl = baseUrl

    if (action === 'refuse') {
      // Mettre à jour le statut
      await (supabase
        .from('booking_requests') as any)
        .update({ status: 'refused' })
        .eq('id', bookingRequest.id)

      // Envoyer email au client
      await sendEmail({
        to: bookingRequest.email,
        subject: emailSubjects.bookingRefusedToClient,
        html: emailTemplates.bookingRefusedToClient(
          `${bookingRequest.first_name} ${bookingRequest.last_name}`,
          siteUrl,
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
      const chatLoginUrl = `${baseUrl}/chat/${conversationId}/login`

      // Envoyer emails au client et au chef
      const { data: chef } = await supabase
        .from('chefs')
        .select('email, name')
        .eq('id', bookingRequest.chef_id)
        .single()

      await sendEmail({
        to: bookingRequest.email,
        subject: emailSubjects.bookingAcceptedToClient,
        html: emailTemplates.bookingAcceptedToClient(
          `${bookingRequest.first_name} ${bookingRequest.last_name}`,
          chatUrl,
          baseUrl
        ),
      })

      if (chef) {
        // Envoyer un magic link Supabase directement au chef
        const redirectUrl = `${baseUrl}/auth/callback?next=/dashboard`
        
        console.log('[decision] Sending magic link to chef:', (chef as any).email)
        console.log('[decision] Redirect URL:', redirectUrl)
        
        const { data: otpData, error: otpError } = await supabase.auth.signInWithOtp({
          email: (chef as any).email.toLowerCase().trim(),
          options: {
            emailRedirectTo: redirectUrl,
            shouldCreateUser: true,
          },
        })
        
        if (otpError) {
          console.error('[decision] Error sending magic link to chef:', otpError)
          // En cas d'erreur, envoyer un email avec un lien vers la page de login
          const chefLoginUrl = `${chatLoginUrl}?email=${encodeURIComponent((chef as any).email)}`
          await sendEmail({
            to: (chef as any).email,
            subject: emailSubjects.bookingAcceptedToChef,
            html: emailTemplates.bookingAcceptedToChef((chef as any).name, chefLoginUrl, baseUrl),
          })
        } else {
          console.log('[decision] Magic link sent successfully to chef via Supabase')
          // Le magic link est envoyé par Supabase, pas besoin d'email supplémentaire
        }
      }

      // Rediriger vers la page de confirmation
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

