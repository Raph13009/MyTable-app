import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBaseUrl, sanitizeMessage } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { conversationId, messageContent } = body

    if (!conversationId || !messageContent) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    const senderEmail = user.email.toLowerCase().trim()

    // Vérifier que l'utilisateur fait partie de la conversation
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('participants')
      .select('email, role')
      .eq('conversation_id', conversationId)

    if (participantsError || !participants) {
      return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 })
    }

    const isParticipant = participants.some(
      (p: any) => (p.email || '').toLowerCase().trim() === senderEmail
    )
    if (!isParticipant) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Bloquer l'envoi pour les missions refusées
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('booking_request_id')
      .eq('id', conversationId)
      .maybeSingle()

    const bookingRequestId = (conversation as any)?.booking_request_id
    if (bookingRequestId) {
      const { data: bookingRequest } = await supabaseAdmin
        .from('booking_requests')
        .select('status')
        .eq('id', bookingRequestId)
        .maybeSingle()

      const bookingStatus = (bookingRequest as any)?.status
      if (bookingStatus === 'refused') {
        return NextResponse.json({ error: 'Mission refusée: envoi de message désactivé' }, { status: 403 })
      }

      const senderParticipant = participants.find(
        (p: any) => (p.email || '').toLowerCase().trim() === senderEmail
      )
      if ((senderParticipant as any)?.role === 'chef' && bookingStatus === 'pending') {
        return NextResponse.json(
          { error: 'Acceptez ou refusez la demande avant d\'écrire au client' },
          { status: 403 }
        )
      }
    }

    const sanitizedContent = sanitizeMessage(messageContent)

    // Insérer le message (admin pour fiabilité, déjà autorisé via vérification ci-dessus)
    const { data: insertedMessage, error: insertError } = await supabaseAdmin
      .from('messages')
      // @ts-expect-error - Supabase type inference issue
      .insert({
        conversation_id: conversationId,
        sender_email: senderEmail,
        content: sanitizedContent,
      })
      .select()
      .single()

    if (insertError || !insertedMessage) {
      return NextResponse.json({ error: 'Erreur lors de l\'envoi' }, { status: 500 })
    }

    // Déclencher la notification email côté serveur (évite dépendance client)
    const baseUrl = getBaseUrl()
    try {
      await fetch(`${baseUrl}/api/send-message-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          senderEmail,
          messageContent,
        }),
      })
    } catch (emailError) {
      console.error('[messages/send] Error sending notification email:', emailError)
      // Ne pas bloquer l'envoi du message si l'email échoue
    }

    return NextResponse.json({ success: true, message: insertedMessage })
  } catch (error: any) {
    console.error('[messages/send] Error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
