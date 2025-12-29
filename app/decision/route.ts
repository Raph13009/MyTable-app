import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyToken, getBaseUrl } from '@/lib/utils'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'

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
 * 3. Magic links redirect to /auth/callback?next=/dashboard
 * 4. No duplicate users (shouldCreateUser: false for existing users)
 */

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

      // ============================================
      // PHASE 1: Send magic links to BOTH client and chef
      // ============================================
      // Responsibilities:
      // - Supabase Auth: Magic link generation and sending (authentication)
      // - Resend: Transactional notification email (informational only)
      
      const clientEmail = bookingRequest.email.toLowerCase().trim()
      const redirectUrlForClient = `${baseUrl}/auth/callback?next=${encodeURIComponent('/dashboard')}`
      const redirectUrlForChef = `${baseUrl}/auth/callback?next=${encodeURIComponent('/dashboard')}`

      console.log('[decision] ========== SENDING MAGIC LINKS ==========')
      console.log('[decision] Client email:', clientEmail)
      console.log('[decision] Client redirect URL:', redirectUrlForClient)
      
      // Send magic link to CLIENT via Supabase Auth
      // Security: Client already exists (created during booking submission)
      // Redirect URL: /auth/callback?next=/dashboard (secure, goes through callback handler)
      console.log('[decision] Sending magic link to CLIENT via Supabase Auth...')
      const { data: clientOtpData, error: clientOtpError } = await supabase.auth.signInWithOtp({
        email: clientEmail,
        options: {
          emailRedirectTo: redirectUrlForClient,
          shouldCreateUser: false, // Client already exists from booking submission - prevents duplicates
        },
      })

      if (clientOtpError) {
        console.error('[decision] ❌ ERROR sending magic link to client:', clientOtpError.message)
        console.error('[decision] Error details:', JSON.stringify(clientOtpError, null, 2))
        // If user doesn't exist, try with shouldCreateUser: true as fallback
        if (clientOtpError.message?.includes('not found') || clientOtpError.message?.includes('does not exist')) {
          console.log('[decision] ⚠️ Client user not found, trying with shouldCreateUser: true...')
          const { error: retryError } = await supabase.auth.signInWithOtp({
            email: clientEmail,
            options: {
              emailRedirectTo: redirectUrlForClient,
              shouldCreateUser: true, // Fallback: create if doesn't exist
            },
          })
          if (retryError) {
            console.error('[decision] ❌ Retry also failed:', retryError.message)
          } else {
            console.log('[decision] ✅ Magic link sent to client (user created)')
          }
        }
      } else {
        console.log('[decision] ✅ Magic link sent to client via Supabase Auth')
      }

      // Send informational email to CLIENT via Resend (transactional, no auth responsibility)
      // Extraire prénom et nom du chef
      const chefFullName = chef ? (chef as any).name : 'Chef'
      const chefNameParts = chefFullName.split(' ')
      const chefFirstName = chefNameParts[0] || chefFullName
      const chefLastName = chefNameParts.slice(1).join(' ') || ''
      
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

      // Send magic link to CHEF via Supabase Auth
      if (chef) {
        const chefEmail = (chef as any).email.toLowerCase().trim()
        
        console.log('[decision] Chef email:', chefEmail)
        console.log('[decision] Chef redirect URL:', redirectUrlForChef)
        console.log('[decision] Sending magic link to CHEF via Supabase Auth...')
        
        // Security: Chef already exists (created separately)
        // Redirect URL: /auth/callback?next=/dashboard (secure, goes through callback handler)
        const { data: chefOtpData, error: chefOtpError } = await supabase.auth.signInWithOtp({
          email: chefEmail,
          options: {
            emailRedirectTo: redirectUrlForChef,
            shouldCreateUser: false, // Chef already exists - prevents duplicates
          },
        })

        if (chefOtpError) {
          console.error('[decision] ❌❌❌ ERROR sending magic link to chef ❌❌❌')
          console.error('[decision] Error message:', chefOtpError.message)
          console.error('[decision] Error status:', chefOtpError.status)
          console.error('[decision] Error details:', JSON.stringify(chefOtpError, null, 2))
          // If user doesn't exist, try with shouldCreateUser: true as fallback
          if (chefOtpError.message?.includes('not found') || chefOtpError.message?.includes('does not exist')) {
            console.log('[decision] ⚠️ Chef user not found, trying with shouldCreateUser: true...')
            const { error: retryError } = await supabase.auth.signInWithOtp({
              email: chefEmail,
              options: {
                emailRedirectTo: redirectUrlForChef,
                shouldCreateUser: true, // Fallback: create if doesn't exist
              },
            })
            if (retryError) {
              console.error('[decision] ❌ Retry also failed:', retryError.message)
              return NextResponse.redirect(new URL('/?error=magic_link_failed', request.url))
            } else {
              console.log('[decision] ✅ Magic link sent to chef (user created)')
            }
          } else {
            return NextResponse.redirect(new URL('/?error=magic_link_failed', request.url))
          }
        }

        console.log('[decision] ✅✅✅ Magic link sent successfully to chef via Supabase ✅✅✅')
        console.log('[decision] ========== MAGIC LINKS SENT ==========')
        
        // Rediriger vers une page de confirmation
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

