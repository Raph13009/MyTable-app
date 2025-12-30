import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailTemplates, emailLayout } from '@/lib/email'
import { sanitizeMessage, getBaseUrl } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, senderEmail, messageContent } = body

    if (!conversationId || !senderEmail || !messageContent) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createAdminClient()
    const baseUrl = getBaseUrl()

    // 1. Récupérer les participants de la conversation
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('participants')
      .select('email, role')
      .eq('conversation_id', conversationId)

    if (participantsError || !participants) {
      console.error('[send-message-notification] Error fetching participants:', participantsError)
      return NextResponse.json(
        { error: 'Failed to fetch participants' },
        { status: 500 }
      )
    }

    // 2. Trouver le destinataire (celui qui n'a pas envoyé le message)
    const normalizedSenderEmail = senderEmail.toLowerCase().trim()
    const recipient = participants.find(
      (p: any) => p.email.toLowerCase().trim() !== normalizedSenderEmail
    )

    if (!recipient) {
      console.error('[send-message-notification] No recipient found')
      return NextResponse.json(
        { error: 'No recipient found' },
        { status: 404 }
      )
    }

    // 3. Récupérer les infos du booking_request pour avoir le nom du client/chef
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('booking_request_id')
      .eq('id', conversationId)
      .single()

    let senderName = 'Quelqu\'un'
    let recipientName = 'vous'

    if ((conversation as any)?.booking_request_id) {
      const { data: bookingRequest } = await supabaseAdmin
        .from('booking_requests')
        .select('first_name, last_name, chef_id, email')
        .eq('id', (conversation as any).booking_request_id)
        .single()

      if (bookingRequest) {
        const br = bookingRequest as any
        // Si l'expéditeur est le client
        if (normalizedSenderEmail === br.email?.toLowerCase().trim()) {
          senderName = `${br.first_name} ${br.last_name}`
          
          // Récupérer le nom du chef
          if (br.chef_id) {
            const { data: chef } = await supabaseAdmin
              .from('chefs')
              .select('name')
              .eq('id', br.chef_id)
              .single()
            
            if (chef) {
              recipientName = (chef as any).name
            }
          }
        } else {
          // Si l'expéditeur est le chef
          if (br.chef_id) {
            const { data: chef } = await supabaseAdmin
              .from('chefs')
              .select('name')
              .eq('id', br.chef_id)
              .single()
            
            if (chef) {
              senderName = (chef as any).name
            }
          }
          recipientName = `${br.first_name} ${br.last_name}`
        }
      }
    }

    // 4. Créer le magic link pour le destinataire
    const redirectUrl = `${baseUrl}/auth/callback?next=/chat/${conversationId}`
    const recipientEmail = (recipient as any).email.toLowerCase().trim()
    
    // Envoyer un magic link Supabase au destinataire
    let magicLinkSent = false
    const { data: otpData, error: otpError } = await supabaseAdmin.auth.signInWithOtp({
      email: recipientEmail,
      options: {
        emailRedirectTo: redirectUrl,
        shouldCreateUser: false, // User should already exist
      },
    })

    if (!otpError) {
      magicLinkSent = true
      console.log('[send-message-notification] ✅ Magic link sent to:', recipientEmail)
    } else {
      console.error('[send-message-notification] ⚠️ Failed to send magic link:', otpError.message)
      // Continue anyway - we'll provide a fallback CTA
    }

    // 5. Sanitize message content before including in email (mask emails and phone numbers)
    const sanitizedMessageContent = sanitizeMessage(messageContent)
    
    // 6. Créer le contenu de l'email avec CTA professionnel
    const loginUrl = `${baseUrl}/login?next=/chat/${conversationId}`
    const ctaUrl = magicLinkSent ? redirectUrl : loginUrl
    const ctaText = magicLinkSent 
      ? 'Accéder au chat' 
      : 'Se connecter pour répondre'
    
    const emailContent = `
      <p>Bonjour ${recipientName},</p>
      <p><strong>${senderName}</strong> vous a envoyé un nouveau message :</p>
      <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #FBCF03;">
        <p style="margin: 0; font-style: italic;">"${sanitizedMessageContent}"</p>
      </div>
      ${magicLinkSent ? `
        <p>Un lien de connexion sécurisé vous a été envoyé par email séparé pour accéder directement au chat.</p>
      ` : `
        <p>Cliquez sur le bouton ci-dessous pour accéder à votre espace de conversation et répondre.</p>
      `}
    `

    const emailHtml = emailLayout({
      title: 'Nouveau message reçu',
      content: emailContent,
      cta: {
        text: ctaText,
        url: ctaUrl,
        variant: 'yellow',
      },
      baseUrl,
    })

    // 7. Envoyer l'email
    await sendEmail({
      to: (recipient as any).email,
      subject: `Nouveau message de ${senderName}`,
      html: emailHtml,
    })

    console.log('[send-message-notification] ✅ Email sent to:', (recipient as any).email)
    console.log('[send-message-notification] Magic link sent:', !otpError)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[send-message-notification] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

