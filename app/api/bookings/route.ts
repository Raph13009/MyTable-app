import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDecisionToken, hashToken, getBaseUrl } from '@/lib/utils'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import { formatDateForDisplay, isValidDateString } from '@/lib/dateUtils'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    console.log(`[bookings:${requestId}] ========== STARTING BOOKING REQUEST ==========`)
    console.log(`[bookings:${requestId}] Timestamp:`, new Date().toISOString())
    
    const body = await request.json()
    const {
      chefId,
      firstName,
      lastName,
      email,
      phone,
      serviceType,
      bookingDate,
      mealTime,
      city,
      postalCode,
      guestsCount,
      childrenCount,
      periodDays,
      budget,
      courseTopic,
      selectedDates,
      mealOptions,
      totalPrice,
      hasAllergies,
      allergiesDetails,
      menuId,
      notes,
      idempotencyToken,
    } = body

    console.log(`[bookings:${requestId}] Request data:`, {
      chefId,
      serviceType,
      email: email?.substring(0, 3) + '***', // Masquer email pour logs
      hasIdempotencyToken: !!idempotencyToken,
      idempotencyToken: idempotencyToken?.substring(0, 20) + '...',
    })

    // Validation basique
    if (!chefId || !firstName || !lastName || !email || !phone || !serviceType || !city || !postalCode || !guestsCount) {
      return NextResponse.json(
        { error: 'Tous les champs requis doivent être remplis' },
        { status: 400 }
      )
    }

    // Validation spécifique selon le type de service
    if (serviceType === 'repas_domicile' && !bookingDate) {
      return NextResponse.json(
        { error: 'La date est requise pour un repas à domicile' },
        { status: 400 }
      )
    }
    if (serviceType === 'repas_domicile' && !mealTime) {
      return NextResponse.json(
        { error: 'Le moment du repas est requis pour un repas à domicile' },
        { status: 400 }
      )
    }

    if (serviceType === 'cours_cuisine') {
      if (!bookingDate) {
        return NextResponse.json(
          { error: 'La date est requise pour un cours de cuisine' },
          { status: 400 }
        )
      }
      if (!isValidDateString(bookingDate)) {
        return NextResponse.json(
          { error: 'La date fournie est invalide' },
          { status: 400 }
        )
      }
      if (!budget || parseFloat(budget) <= 0) {
        return NextResponse.json(
          { error: 'Le budget est requis pour un cours de cuisine' },
          { status: 400 }
        )
      }
      if (!courseTopic || !courseTopic.trim()) {
        return NextResponse.json(
          { error: 'Le sujet du cours est requis' },
          { status: 400 }
        )
      }
    }
    if (serviceType === 'mise_en_demeure') {
      if (!selectedDates || !Array.isArray(selectedDates) || selectedDates.length === 0) {
        return NextResponse.json(
          { error: 'Au moins une date doit être sélectionnée pour un événement sur plusieurs jours' },
          { status: 400 }
        )
      }
      // mealOptions peut être un objet { date: ['pdj', 'dejeuner'], ... } ou un array (ancien format)
      if (!mealOptions) {
        return NextResponse.json(
          { error: 'Les options de repas sont requises pour chaque jour' },
          { status: 400 }
        )
      }
      // Si c'est un objet (nouveau format), vérifier que chaque date a au moins une option
      if (typeof mealOptions === 'object' && !Array.isArray(mealOptions)) {
        const mealOptionsObj = mealOptions as Record<string, string[]>
        const datesWithoutMeals = selectedDates.filter((date: string) => 
          !mealOptionsObj[date] || mealOptionsObj[date].length === 0
        )
        if (datesWithoutMeals.length > 0) {
          return NextResponse.json(
            { error: 'Chaque date doit avoir au moins une option de repas sélectionnée' },
            { status: 400 }
          )
        }
      } else if (Array.isArray(mealOptions) && mealOptions.length === 0) {
        return NextResponse.json(
          { error: 'Au moins une option de repas doit être sélectionnée' },
          { status: 400 }
        )
      }
      if (!totalPrice || parseFloat(totalPrice) <= 0) {
        return NextResponse.json(
          { error: 'Le budget global est requis pour un chef à demeure' },
          { status: 400 }
        )
      }
    }

    // Utiliser le client admin pour bypass RLS dans les opérations serveur
    const supabase = createAdminClient()

    console.log(`[bookings:${requestId}] Fetching chef data...`)
    // Récupérer le chef
    const { data: chef, error: chefError } = await supabase
      .from('chefs')
      .select('*')
      .eq('id', chefId)
      .single()

    if (chefError || !chef) {
      console.error(`[bookings:${requestId}] Chef not found:`, chefError)
      return NextResponse.json(
        { error: 'Chef introuvable' },
        { status: 404 }
      )
    }

    console.log(`[bookings:${requestId}] Chef found:`, (chef as any).name)

    // Vérifier l'idempotence AVANT de créer la conversation
    // On utilise une combinaison email + chefId + bookingDate + serviceType comme clé unique
    if (idempotencyToken) {
      console.log(`[bookings:${requestId}] Checking idempotency for token:`, idempotencyToken.substring(0, 20) + '...')
      
      const normalizedEmail = email.toLowerCase().trim()
      let idempotencyQuery = supabase
        .from('booking_requests')
        .select('id, conversation_id, status, created_at, booking_date')
        .eq('chef_id', chefId)
        .eq('email', normalizedEmail)
        .eq('service_type', serviceType)
      
      // Pour repas_domicile, ajouter la condition sur booking_date
      if (serviceType === 'repas_domicile' && bookingDate) {
        idempotencyQuery = idempotencyQuery.eq('booking_date', bookingDate)
      }
      
      const { data: existingBooking, error: checkError } = await idempotencyQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (checkError) {
        console.error(`[bookings:${requestId}] Error checking idempotency:`, checkError)
      } else if (existingBooking) {
        // Vérifier si la réservation a été créée récemment (dans les 5 dernières minutes)
        const bookingAge = Date.now() - new Date(existingBooking.created_at).getTime()
        const fiveMinutes = 5 * 60 * 1000
        
        if (bookingAge < fiveMinutes) {
          console.log(`[bookings:${requestId}] Duplicate booking detected (idempotency)`, {
            existingBookingId: existingBooking.id,
            age: bookingAge,
            conversationId: existingBooking.conversation_id,
            serviceType,
            bookingDate: existingBooking.booking_date,
          })
          
          // Retourner le même résultat que si la création avait réussi
          return NextResponse.json({
            success: true,
            bookingRequestId: existingBooking.id,
            conversationId: existingBooking.conversation_id,
            isDuplicate: true,
          })
        }
      }
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

    console.log(`[bookings:${requestId}] Creating conversation...`)
    // Créer la conversation
    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .insert({} as any)
      .select()
      .single()

    if (conversationError || !conversation) {
      console.error(`[bookings:${requestId}] Error creating conversation:`, conversationError)
      return NextResponse.json(
        { error: `Erreur lors de la création de la conversation: ${conversationError?.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    console.log(`[bookings:${requestId}] Conversation created:`, (conversation as any).id)

    // Créer la demande de réservation
    const conversationId = (conversation as any).id
    
    // Préparer meal_options selon le format
    // Si c'est un objet (nouveau format), on doit utiliser une requête SQL brute
    // car la colonne peut être encore TEXT[] (migration non exécutée)
    let mealOptionsForDb: any = null
    let useRawSql = false
    
    if (mealOptions) {
      if (typeof mealOptions === 'object' && !Array.isArray(mealOptions)) {
        // Nouveau format: objet avec dates comme clés
        // On va utiliser une requête SQL brute pour insérer en JSONB
        mealOptionsForDb = mealOptions
        useRawSql = true
      } else if (Array.isArray(mealOptions)) {
        // Ancien format: array simple
        mealOptionsForDb = mealOptions
      }
    }
    
    console.log('[bookings] mealOptions received:', JSON.stringify(mealOptions, null, 2))
    console.log('[bookings] mealOptionsForDb:', JSON.stringify(mealOptionsForDb, null, 2))
    console.log('[bookings] useRawSql:', useRawSql)
    
    let bookingRequest: any = null
    let bookingError: any = null
    
    if (useRawSql && mealOptionsForDb) {
      // Utiliser la fonction PostgreSQL pour insérer meal_options en JSONB
      const mealOptionsJson = mealOptionsForDb
      const selectedDatesJson = selectedDates && Array.isArray(selectedDates) ? selectedDates : null
      
      const { data, error } = await (supabase as any).rpc('insert_booking_with_json_meal_options', {
        p_chef_id: chefId,
        p_conversation_id: conversationId,
        p_first_name: firstName,
        p_last_name: lastName,
        p_email: email,
        p_phone: phone,
        p_service_type: serviceType,
        p_booking_date: bookingDate || null,
        p_meal_time: mealTime || null,
        p_city: city,
        p_postal_code: postalCode,
        p_guests_count: parseInt(guestsCount),
        p_children_count: parseInt(childrenCount) || 0,
        p_period_days: periodDays || null,
        p_budget: budget ? parseFloat(budget) : null,
        p_course_topic: courseTopic || null,
        p_selected_dates: selectedDatesJson,
        p_meal_options: mealOptionsJson,
        p_total_price: totalPrice ? parseFloat(totalPrice) : null,
        p_has_allergies: hasAllergies || false,
        p_allergies_details: hasAllergies ? allergiesDetails : null,
        p_menu_id: menuId || null,
        p_notes: notes || null,
        p_status: 'pending'
      })
      bookingRequest = data
      bookingError = error
    } else {
      // Insertion normale
      const { data, error } = await supabase
        .from('booking_requests')
        .insert({
          chef_id: chefId,
          conversation_id: conversationId,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          service_type: serviceType,
          booking_date: bookingDate || null,
          meal_time: mealTime || null,
          city,
          postal_code: postalCode,
          guests_count: parseInt(guestsCount),
          children_count: parseInt(childrenCount) || 0,
          period_days: periodDays || null,
          budget: budget ? parseFloat(budget) : null,
          course_topic: courseTopic || null,
          selected_dates: selectedDates && Array.isArray(selectedDates) ? selectedDates : null,
          meal_options: mealOptionsForDb,
          total_price: totalPrice ? parseFloat(totalPrice) : null,
          has_allergies: hasAllergies || false,
          allergies_details: hasAllergies ? allergiesDetails : null,
          menu_id: menuId || null,
          notes: notes || null,
          status: 'pending',
        } as any)
        .select()
        .single()
      bookingRequest = data
      bookingError = error
    }

    if (bookingError || !bookingRequest) {
      console.error(`[bookings:${requestId}] Error creating booking request:`, bookingError)
      console.error(`[bookings:${requestId}] mealOptions value:`, mealOptions)
      console.error(`[bookings:${requestId}] mealOptions type:`, typeof mealOptions)
      console.error(`[bookings:${requestId}] mealOptions isArray:`, Array.isArray(mealOptions))
      const duration = Date.now() - startTime
      console.error(`[bookings:${requestId}] Request failed after ${duration}ms`)
      return NextResponse.json(
        { error: `Erreur lors de la création de la demande: ${bookingError?.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    console.log(`[bookings:${requestId}] Booking request created:`, (bookingRequest as any).id)

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
    const baseUrl = getBaseUrl()
    const acceptUrl = `${baseUrl}/decision?token=${acceptToken}&action=accept`
    const refuseUrl = `${baseUrl}/decision?token=${refuseToken}&action=refuse`

    // Préparer les détails de réservation selon le type de service
    // Utiliser i18n pour les libellés
    const { getServiceTypeLabel } = await import('@/lib/i18n/constants')
    const getServiceTypeLabelLocalized = (type: string) => {
      return getServiceTypeLabel(type, 'fr') // Utiliser 'fr' par défaut pour les emails
    }

    const bookingDetails: any = {
      firstName,
      lastName,
      phone,
      serviceType,
      serviceTypeLabel: getServiceTypeLabelLocalized(serviceType),
      city,
      postalCode,
      guestsCount,
      childrenCount: parseInt(childrenCount) || 0,
      hasAllergies,
      allergiesDetails: allergiesDetails || '',
      notes: notes || '',
    }

    // Ajouter les champs spécifiques selon le type de service
    if (serviceType === 'repas_domicile') {
      bookingDetails.bookingDate = bookingDate ? formatDateForDisplay(bookingDate, 'fr-FR') : null
      bookingDetails.mealTime = mealTime || null
      bookingDetails.mealTimeLabel = mealTime === 'dejeuner' ? 'Déjeuner' : mealTime === 'diner' ? 'Dîner' : null
      bookingDetails.menuName = menuName || null
    } else if (serviceType === 'cours_cuisine') {
      bookingDetails.bookingDate = bookingDate ? formatDateForDisplay(bookingDate, 'fr-FR') : null
      bookingDetails.budget = budget ? parseFloat(budget) : null
      bookingDetails.courseTopic = courseTopic || null
    } else if (serviceType === 'mise_en_demeure') {
      bookingDetails.selectedDates = selectedDates && Array.isArray(selectedDates) ? selectedDates : null
      // mealOptions peut être un objet (nouveau format) ou un array (ancien format)
      if (mealOptions && typeof mealOptions === 'object' && !Array.isArray(mealOptions)) {
        // Nouveau format: objet avec dates comme clés
        bookingDetails.mealOptions = mealOptions
        const allOptions = Object.values(mealOptions).flat() as string[]
        const uniqueOptions = [...new Set(allOptions)]
        bookingDetails.mealOptionsLabel = uniqueOptions.map(opt => 
          opt === 'pdj' ? 'Petit-déjeuner' : opt === 'dejeuner' ? 'Déjeuner' : 'Dîner'
        ).join(', ')
      } else {
        // Ancien format: array simple (rétrocompatibilité)
        bookingDetails.mealOptions = mealOptions && Array.isArray(mealOptions) ? mealOptions : null
        bookingDetails.mealOptionsLabel = mealOptions && Array.isArray(mealOptions) 
          ? mealOptions.map(opt => opt === 'pdj' ? 'Petit-déjeuner' : opt === 'dejeuner' ? 'Déjeuner' : 'Dîner').join(', ')
          : null
      }
      bookingDetails.totalPrice = totalPrice ? parseFloat(totalPrice) : null
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

    const duration = Date.now() - startTime
    console.log(`[bookings:${requestId}] ========== BOOKING REQUEST SUCCESS ==========`)
    console.log(`[bookings:${requestId}] Duration: ${duration}ms`)
    console.log(`[bookings:${requestId}] Booking ID:`, bookingRequestId)
    console.log(`[bookings:${requestId}] Conversation ID:`, conversationId)

    return NextResponse.json({
      success: true,
      bookingRequestId: bookingRequestId,
      conversationId: conversationId,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error(`[bookings:${requestId}] ========== BOOKING REQUEST ERROR ==========`)
    console.error(`[bookings:${requestId}] Error:`, error)
    console.error(`[bookings:${requestId}] Error message:`, error?.message)
    console.error(`[bookings:${requestId}] Error stack:`, error?.stack)
    console.error(`[bookings:${requestId}] Duration before error: ${duration}ms`)
    return NextResponse.json(
      { error: error?.message || 'Une erreur est survenue' },
      { status: 500 }
    )
  }
}

