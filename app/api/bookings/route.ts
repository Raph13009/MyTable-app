import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateDecisionToken, hashToken } from '@/lib/utils'
import { sendEmail, emailTemplates } from '@/lib/email'

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

    const supabase = await createClient()

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
      const { data: menu } = await supabase
        .from('menus')
        .select('name')
        .eq('id', menuId)
        .single()
      menuName = menu?.name || null
    }

    // Créer la conversation
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .insert({})
      .select()
      .single()

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: 'Erreur lors de la création de la conversation' },
        { status: 500 }
      )
    }

    // Créer la demande de réservation
    const { data: bookingRequest, error: bookingError } = await supabase
      .from('booking_requests')
      .insert({
        chef_id: chefId,
        conversation_id: conversation.id,
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
      })
      .select()
      .single()

    if (bookingError || !bookingRequest) {
      return NextResponse.json(
        { error: 'Erreur lors de la création de la demande' },
        { status: 500 }
      )
    }

    // Mettre à jour la conversation avec le booking_request_id
    await supabase
      .from('conversations')
      .update({ booking_request_id: bookingRequest.id })
      .eq('id', conversation.id)

    // Créer les participants
    await supabase.from('participants').insert([
      {
        conversation_id: conversation.id,
        email: email,
        role: 'client',
      },
      {
        conversation_id: conversation.id,
        email: chef.email,
        role: 'chef',
      },
    ])

    // Générer les tokens pour accept/refuse
    const acceptToken = generateDecisionToken()
    const refuseToken = generateDecisionToken()

    const acceptTokenHash = await hashToken(acceptToken)
    const refuseTokenHash = await hashToken(refuseToken)

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 jours de validité

    // Stocker les tokens hashés
    await supabase.from('decision_tokens').insert([
      {
        booking_request_id: bookingRequest.id,
        token_hash: acceptTokenHash,
        action: 'accept',
        expires_at: expiresAt.toISOString(),
      },
      {
        booking_request_id: bookingRequest.id,
        token_hash: refuseTokenHash,
        action: 'refuse',
        expires_at: expiresAt.toISOString(),
      },
    ])

    // Construire les URLs de décision
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const acceptUrl = `${baseUrl}/decision?token=${acceptToken}&action=accept`
    const refuseUrl = `${baseUrl}/decision?token=${refuseToken}&action=refuse`

    // Envoyer l'email au chef
    const bookingDetails = {
      firstName,
      lastName,
      email,
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

    await sendEmail({
      to: chef.email,
      subject: `Nouvelle demande de réservation de ${firstName} ${lastName}`,
      html: emailTemplates.bookingRequestToChef(
        chef.name,
        bookingDetails,
        acceptUrl,
        refuseUrl
      ),
    })

    return NextResponse.json({
      success: true,
      bookingRequestId: bookingRequest.id,
      conversationId: conversation.id,
    })
  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    )
  }
}

