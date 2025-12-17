import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyToken } from '@/lib/utils'
import { sendEmail, emailTemplates } from '@/lib/email'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')
    const action = searchParams.get('action')

    if (!token || !action || (action !== 'accept' && action !== 'refuse')) {
      return NextResponse.redirect(new URL('/?error=invalid_params', request.url))
    }

    const supabase = await createClient()

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
    let matchingToken = null
    for (const dbToken of tokens) {
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
    await supabase
      .from('decision_tokens')
      .update({ used: true })
      .eq('id', matchingToken.id)

    // Marquer l'autre token comme utilisé aussi (pour éviter les doubles clics)
    await supabase
      .from('decision_tokens')
      .update({ used: true })
      .eq('booking_request_id', bookingRequest.id)
      .neq('id', matchingToken.id)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const siteUrl = baseUrl

    if (action === 'refuse') {
      // Mettre à jour le statut
      await supabase
        .from('booking_requests')
        .update({ status: 'refused' })
        .eq('id', bookingRequest.id)

      // Envoyer email au client
      await sendEmail({
        to: bookingRequest.email,
        subject: 'Votre demande de réservation',
        html: emailTemplates.bookingRefusedToClient(
          `${bookingRequest.first_name} ${bookingRequest.last_name}`,
          siteUrl
        ),
      })

      return NextResponse.redirect(new URL('/?message=booking_refused', request.url))
    } else if (action === 'accept') {
      // Mettre à jour le statut
      const { data: updatedBooking } = await supabase
        .from('booking_requests')
        .update({ status: 'accepted' })
        .eq('id', bookingRequest.id)
        .select('conversation_id')
        .single()

      if (!updatedBooking) {
        return NextResponse.redirect(new URL('/?error=update_failed', request.url))
      }

      const chatUrl = `${baseUrl}/chat/${updatedBooking.conversation_id}`

      // Envoyer emails au client et au chef
      const { data: chef } = await supabase
        .from('chefs')
        .select('email, name')
        .eq('id', bookingRequest.chef_id)
        .single()

      await sendEmail({
        to: bookingRequest.email,
        subject: 'Votre réservation a été acceptée !',
        html: emailTemplates.bookingAcceptedToClient(
          `${bookingRequest.first_name} ${bookingRequest.last_name}`,
          chatUrl
        ),
      })

      if (chef) {
        await sendEmail({
          to: chef.email,
          subject: 'Réservation acceptée - Accès au chat',
          html: emailTemplates.bookingAcceptedToChef(chef.name, chatUrl),
        })
      }

      return NextResponse.redirect(new URL(`/chat/${updatedBooking.conversation_id}?accepted=true`, request.url))
    }

    return NextResponse.redirect(new URL('/?error=unknown', request.url))
  } catch (error) {
    console.error('Error processing decision:', error)
    return NextResponse.redirect(new URL('/?error=server_error', request.url))
  }
}

