import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDecisionToken, hashToken } from '@/lib/utils'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      chefId,
      firstName,
      lastName,
      email,
      phone,
      bookingDate,
      city,
      postalCode,
      guestsCount,
      hasAllergies,
      allergiesDetails,
      menuId,
      notes,
    } = body

    // Validation basique
    if (!chefId || !firstName || !lastName || !email || !phone || !bookingDate || !city || !postalCode || !guestsCount) {
      return NextResponse.json(
        { error: 'Tous les champs requis doivent être remplis' },
        { status: 400 }
      )
    }

    // Utiliser le client admin pour bypass RLS dans les opérations serveur
    const supabase = createAdminClient()

    // Récupérer le chef
    const { data: chef, error: chefError } = await supabase
      .from('chefs')
      .select('*')
      .eq('id', chefId)
      .single()

    if (chefError || !chef) {
      return NextResponse.json(
        { error: 'Chef introuvable' },
        { status: 404 }
      )
    }

    // Récupérer le menu si sélectionné
    let menuName = null
    if (menuId) {
      const { data: menu, error: menuError } = await supabase
        .from('menus')
        .select('name')
        .eq('id', menuId)
        .single()
      if (!menuError && menu && 'name' in menu) {
        menuName = (menu as { name: string }).name || null
      }
    }

    // Créer la conversation
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .insert({} as any)
      .select()
      .single()

    if (conversationError || !conversation) {
      console.error('Error creating conversation:', conversationError)
      return NextResponse.json(
        { error: `Erreur lors de la création de la conversation: ${conversationError?.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    // Créer la demande de réservation
    const conversationId = (conversation as any).id
    const { data: bookingRequest, error: bookingError } = await supabase
      .from('booking_requests')
      .insert({
        chef_id: chefId,
        conversation_id: conversationId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        booking_date: bookingDate,
        city,
        postal_code: postalCode,
        guests_count: parseInt(guestsCount),
        has_allergies: hasAllergies || false,
        allergies_details: hasAllergies ? allergiesDetails : null,
        menu_id: menuId || null,
        notes: notes || null,
        status: 'pending',
      } as any)
      .select()
      .single()

    if (bookingError || !bookingRequest) {
      return NextResponse.json(
        { error: 'Erreur lors de la création de la demande' },
        { status: 500 }
      )
    }

    // Mettre à jour la conversation avec le booking_request_id
    const bookingRequestId = (bookingRequest as any).id
    await supabase
      .from('conversations')
      // @ts-expect-error - Supabase type inference issue
      .update({ booking_request_id: bookingRequestId } as any)
      .eq('id', conversationId)

    // Créer l'utilisateur auth pour le CLIENT uniquement (chaque client est différent)
    let clientUserId: string | null = null
    try {
      // Essayer de créer l'utilisateur (créera une erreur si existe déjà)
      const { data: newClientUser, error: createClientError } = await supabase.auth.admin.createUser({
        email: email,
        email_confirm: true,
      })

      if (createClientError) {
        // Si l'utilisateur existe déjà, on le récupère
        if (createClientError.message.includes('already registered') || createClientError.message.includes('already exists')) {
          const { data: users } = await supabase.auth.admin.listUsers()
          const existingUser = users?.users.find(u => u.email === email)
          if (existingUser) {
            clientUserId = existingUser.id
          }
        } else {
          console.error('Error creating client user:', createClientError)
        }
      } else if (newClientUser?.user) {
        clientUserId = newClientUser.user.id
      }
    } catch (error) {
      console.error('Error checking/creating client user:', error)
    }

    // Pour le chef, récupérer son user_id existant (les chefs sont créés séparément)
    let chefUserId: string | null = null
    try {
      const { data: users } = await supabase.auth.admin.listUsers()
      const existingChefUser = users?.users.find(u => u.email === (chef as any).email)
      if (existingChefUser) {
        chefUserId = existingChefUser.id
      }
      // Si le chef n'a pas d'utilisateur auth, on continue sans (il faudra le créer manuellement)
    } catch (error) {
      console.error('Error getting chef user:', error)
    }

    // Créer les participants (normaliser les emails en lowercase)
    const normalizedClientEmail = email.toLowerCase().trim()
    const normalizedChefEmail = (chef as any).email.toLowerCase().trim()
    
    console.log('[bookings] ========== CREATING PARTICIPANTS ==========')
    console.log('[bookings] Original client email from form:', email)
    console.log('[bookings] Normalized client email:', normalizedClientEmail)
    console.log('[bookings] Original chef email from DB:', (chef as any).email)
    console.log('[bookings] Normalized chef email:', normalizedChefEmail)
    console.log('[bookings] Conversation ID:', conversationId)
    console.log('[bookings] Client user_id:', clientUserId)
    console.log('[bookings] Chef user_id:', chefUserId)
    console.log('[bookings] Email comparison:', {
      originalClient: email,
      normalizedClient: normalizedClientEmail,
      originalChef: (chef as any).email,
      normalizedChef: normalizedChefEmail,
      clientLength: normalizedClientEmail.length,
      chefLength: normalizedChefEmail.length,
    })
    
    const participantsToInsert = [
      {
        conversation_id: conversationId,
        email: normalizedClientEmail,
        role: 'client',
        user_id: clientUserId || null,
      },
      {
        conversation_id: conversationId,
        email: normalizedChefEmail,
        role: 'chef',
        user_id: chefUserId || null,
      },
    ]
    
    console.log('[bookings] Participants to insert:', JSON.stringify(participantsToInsert, null, 2))
    console.log('[bookings] Participants to insert (detailed):', participantsToInsert.map(p => ({
      ...p,
      emailLength: p.email.length,
      emailChars: p.email.split('').map((c: string) => `${c}(${c.charCodeAt(0)})`).join(''),
    })))
    
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .insert(participantsToInsert as any)
      .select()
    
    console.log('[bookings] ========== PARTICIPANTS INSERT RESULT ==========')
    console.log('[bookings] Insert result - data:', participants)
    console.log('[bookings] Insert result - data count:', participants?.length || 0)
    console.log('[bookings] Insert result - error:', participantsError)
    if (participantsError) {
      console.error('[bookings] ❌❌❌ ERROR INSERTING PARTICIPANTS ❌❌❌')
      console.error('[bookings] Error message:', participantsError.message)
      console.error('[bookings] Error code:', participantsError.code)
      console.error('[bookings] Error details:', participantsError.details)
      console.error('[bookings] Error hint:', participantsError.hint)
    }
    if (participants && participants.length > 0) {
      console.log('[bookings] ✅ Participants created successfully:')
      participants.forEach((p: any, i: number) => {
        console.log(`[bookings]   ${i + 1}. Email: "${p.email}" (normalized: "${(p.email || '').toLowerCase().trim()}")`)
        console.log(`[bookings]      Role: ${p.role}`)
        console.log(`[bookings]      User ID: ${p.user_id || 'null'}`)
        console.log(`[bookings]      Conversation ID: ${p.conversation_id}`)
      })
    }
    
    if (participantsError) {
      console.error('[bookings] ❌ ERROR creating participants:', participantsError)
      console.error('[bookings] Error details:', JSON.stringify(participantsError, null, 2))
      return NextResponse.json(
        { error: `Erreur lors de la création des participants: ${participantsError.message}` },
        { status: 500 }
      )
    }
    
    if (!participants || participants.length === 0) {
      console.error('[bookings] ❌ WARNING: No participants returned after insert')
      return NextResponse.json(
        { error: 'Aucun participant créé' },
        { status: 500 }
      )
    }
    
    console.log('[bookings] ✅ Participants created successfully:', participants)
    console.log('[bookings] Number of participants created:', participants.length)
    
    // Vérifier que les participants sont bien dans la DB
    const { data: verifyParticipants, error: verifyError } = await supabase
      .from('participants')
      .select('*')
      .eq('conversation_id', conversationId)
    
    console.log('[bookings] Verification query - participants in DB:', verifyParticipants)
    console.log('[bookings] Verification query - error:', verifyError)
    console.log('[bookings] ========== PARTICIPANTS CREATION DONE ==========')

    // Générer les tokens pour accept/refuse
    const acceptToken = generateDecisionToken()
    const refuseToken = generateDecisionToken()

    const acceptTokenHash = await hashToken(acceptToken)
    const refuseTokenHash = await hashToken(refuseToken)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 jours de validité

    // Stocker les tokens hashés
    // @ts-expect-error - Supabase type inference issue
    await supabase.from('decision_tokens').insert([
      {
        booking_request_id: bookingRequestId,
        token_hash: acceptTokenHash,
        action: 'accept',
        expires_at: expiresAt.toISOString(),
      },
      {
        booking_request_id: bookingRequestId,
        token_hash: refuseTokenHash,
        action: 'refuse',
        expires_at: expiresAt.toISOString(),
      },
    ])

    // Construire les URLs de décision
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const acceptUrl = `${baseUrl}/decision?token=${acceptToken}&action=accept`
    const refuseUrl = `${baseUrl}/decision?token=${refuseToken}&action=refuse`

    // Préparer les détails de réservation
    const bookingDetails = {
      firstName,
      lastName,
      phone,
      bookingDate: new Date(bookingDate).toLocaleDateString('fr-FR'),
      city,
      postalCode,
      guestsCount,
      hasAllergies,
      allergiesDetails: allergiesDetails || '',
      menuName,
      notes: notes || '',
    }

    // Envoyer l'email de confirmation au client
    await sendEmail({
      to: email,
      subject: emailSubjects.bookingConfirmationToClient,
      html: emailTemplates.bookingConfirmationToClient(
        `${firstName} ${lastName}`,
        (chef as any).name,
        baseUrl
      ),
    })

    // Envoyer l'email au chef
    await sendEmail({
      to: (chef as any).email,
      subject: emailSubjects.bookingRequestToChef,
      html: emailTemplates.bookingRequestToChef(
        (chef as any).name,
        bookingDetails,
        acceptUrl,
        refuseUrl,
        baseUrl
      ),
    })

    return NextResponse.json({
      success: true,
      bookingRequestId: bookingRequestId,
      conversationId: conversationId,
    })
  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    )
  }
}

