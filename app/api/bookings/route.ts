import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { generateDecisionToken, hashToken, getBaseUrl } from '@/lib/utils'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import { formatDateForDisplay, isValidDateString } from '@/lib/dateUtils'
import { calculateBookingTotal } from '@/lib/bookingCalculations'
import { BOOKING_FALLBACK_RADIUS_KM, haversineDistanceKm, parseClientCoord } from '@/lib/geo'
import { normalizeBookingAddressForDb } from '@/lib/bookingAddress'

const COURSE_BUDGET_MAP: Record<string, number> = {
  '50': 50,
  '60': 60,
  '70': 70,
  '80': 80,
  '90': 90,
}

const HOME_CHEF_BUDGET_MAP: Record<string, number> = {
  '250': 250,
  '300': 300,
  '350': 350,
  '400': 400,
  '450': 450,
  '500': 500,
}

function normalizeBudgetSelection(
  rawValue: unknown,
  serviceType: 'cours_cuisine' | 'mise_en_demeure'
): number | null {
  if (typeof rawValue === 'number') {
    return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : null
  }

  const value = String(rawValue ?? '').trim()
  if (!value) return null

  const mappedValue = serviceType === 'cours_cuisine'
    ? COURSE_BUDGET_MAP[value]
    : HOME_CHEF_BUDGET_MAP[value]

  if (mappedValue) return mappedValue

  const parsed = Number.parseFloat(value.replace(',', '.'))
  if (Number.isFinite(parsed) && parsed > 0) return parsed

  return null
}

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
      email: emailFromBody,
      phone,
      serviceType,
      bookingDate,
      mealTime,
      city: cityRaw,
      postalCode: postalCodeRaw,
      fullAddress: fullAddressRaw,
      eventAddress: eventAddressRaw,
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
      fallbackEnabled: fallbackEnabledRaw,
      fallbackChefIds: fallbackChefIdsRaw,
      clientLatitude: clientLatitudeRaw,
      clientLongitude: clientLongitudeRaw,
      idempotencyToken,
      password: passwordFromBody,
    } = body

    // Lire la session depuis les cookies (utilisateur déjà connecté)
    const serverClient = await createClient()
    const { data: { user: sessionUser } } = await serverClient.auth.getUser()

    // L'email utilisé pour la réservation : priorité à la session, sinon le body
    const email = (sessionUser?.email ?? emailFromBody ?? '').toLowerCase().trim()
    const addrNorm = normalizeBookingAddressForDb({
      city: cityRaw,
      postalCode: postalCodeRaw,
      fullAddress: fullAddressRaw,
      eventAddress: eventAddressRaw,
    })

    if (!addrNorm) {
      return NextResponse.json(
        {
          error:
            'Adresse invalide : vérifiez la ville et le code postal (5 chiffres), ou une adresse complète avec code postal.',
        },
        { status: 400 }
      )
    }

    const city = addrNorm.city
    const postalCode = addrNorm.postalCode
    const fullAddress = addrNorm.fullAddress

    const firstNameTrim = typeof firstName === 'string' ? firstName.trim() : ''
    const lastNameTrim = typeof lastName === 'string' ? lastName.trim() : ''
    const clientDisplayName = [firstNameTrim, lastNameTrim].filter(Boolean).join(' ').trim()

    const normalizedCoursePricePerPerson = serviceType === 'cours_cuisine'
      ? normalizeBudgetSelection(budget, 'cours_cuisine')
      : null
    const normalizedHomeChefPricePerPerson = serviceType === 'mise_en_demeure'
      ? normalizeBudgetSelection(totalPrice, 'mise_en_demeure')
      : null

    console.log(`[bookings:${requestId}] Request data:`, {
      chefId,
      serviceType,
      email: email?.substring(0, 3) + '***', // Masquer email pour logs
      hasIdempotencyToken: !!idempotencyToken,
      idempotencyToken: idempotencyToken?.substring(0, 20) + '...',
    })

    // Validation basique (nom : au moins prénom ou nom, après découpe côté client)
    if (
      !chefId ||
      (!firstNameTrim && !lastNameTrim) ||
      !email ||
      !phone ||
      !serviceType ||
      !city ||
      !postalCode ||
      !guestsCount
    ) {
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
      if (!normalizedCoursePricePerPerson) {
        return NextResponse.json(
          { error: 'Le prix par personne est requis pour un cours de cuisine' },
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

    const requestedFallbackChefIds = Array.isArray(fallbackChefIdsRaw)
      ? fallbackChefIdsRaw.filter((id: unknown): id is string => typeof id === 'string')
      : []
    const dedupedFallbackChefIds = [...new Set(requestedFallbackChefIds)]
      .filter((id) => id !== chefId)
      .slice(0, 3)
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
      if (!normalizedHomeChefPricePerPerson) {
        return NextResponse.json(
          { error: 'Le prix par jour est requis pour un chef à demeure' },
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

    const clientLatitude = parseClientCoord(clientLatitudeRaw)
    const clientLongitude = parseClientCoord(clientLongitudeRaw)
    let validFallbackChefIds: string[] = []

    if (dedupedFallbackChefIds.length > 0) {
      if (
        clientLatitude === null ||
        clientLongitude === null ||
        clientLatitude < -90 ||
        clientLatitude > 90 ||
        clientLongitude < -180 ||
        clientLongitude > 180
      ) {
        return NextResponse.json(
          {
            error:
              'Coordonnées du lieu de la prestation requises pour partager votre demande avec d’autres chefs à proximité',
          },
          { status: 400 }
        )
      }

      const { data: fallbackChefRows } = await supabase
        .from('chefs')
        .select('id, latitude, longitude')
        .in('id', dedupedFallbackChefIds)

      const allowedIds = new Set(
        (fallbackChefRows || [])
          .map((row: any) => {
            const lat = Number(row.latitude)
            const lon = Number(row.longitude)
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
            const km = haversineDistanceKm(clientLatitude, clientLongitude, lat, lon)
            return km <= BOOKING_FALLBACK_RADIUS_KM ? (row.id as string) : null
          })
          .filter((id: string | null): id is string => typeof id === 'string')
      )

      validFallbackChefIds = dedupedFallbackChefIds.filter((id) => allowedIds.has(id))
    }

    const fallbackEnabled = Boolean(fallbackEnabledRaw) && validFallbackChefIds.length > 0
    const fallbackTimeoutAt = fallbackEnabled
      ? new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
      : null

    // Vérifier l'idempotence AVANT de créer la conversation
    //
    // Deux passes :
    //  1. Strict : même chef_id (cas d'un double-clic sur "Envoyer" pour le même chef)
    //  2. Cross-chef : même client + même date + même service + même ville, INITIAL uniquement
    //     (fallback_previous_booking_id IS NULL) — détecte les doubles soumissions sur des chefs
    //     différents qui généreraient deux chaînes fallback parallèles pour le même évènement.
    //  Les bookings issus du fallback automatique (fallback_previous_booking_id NOT NULL) sont
    //  toujours exclus du dédoublonnage car ils sont créés légitimement par le système.
    if (idempotencyToken) {
      console.log(`[bookings:${requestId}] Checking idempotency for token:`, idempotencyToken.substring(0, 20) + '...')

      const normalizedEmail = email.toLowerCase().trim()
      const IDEMPOTENCY_WINDOW_MS = 30 * 60 * 1000 // 30 min
      const cutoffIso = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS).toISOString()

      type ExistingBooking = {
        id: string
        conversation_id: string | null
        status: string
        created_at: string
        booking_date: string | null
        chef_id: string | null
      } | null

      // ---------- Passe 1 : même chef ----------
      let strictQuery = supabase
        .from('booking_requests')
        .select('id, conversation_id, status, created_at, booking_date, chef_id')
        .eq('chef_id', chefId)
        .eq('email', normalizedEmail)
        .eq('service_type', serviceType)
        .gte('created_at', cutoffIso)
      if (serviceType === 'repas_domicile' && bookingDate) {
        strictQuery = strictQuery.eq('booking_date', bookingDate)
      }
      const { data: strictBooking, error: strictErr } = await strictQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (strictErr) {
        console.error(`[bookings:${requestId}] Idempotency strict check error:`, strictErr)
      } else if (strictBooking) {
        const existing = strictBooking as ExistingBooking
        console.log(`[bookings:${requestId}] Duplicate booking detected (same chef)`, {
          existingBookingId: existing!.id,
          age: Date.now() - new Date(existing!.created_at).getTime(),
        })
        return NextResponse.json({
          success: true,
          bookingRequestId: existing!.id,
          conversationId: existing!.conversation_id,
          isDuplicate: true,
        })
      }

      // ---------- Passe 2 : cross-chef (même client + date + service + ville) ----------
      // Un client ne devrait jamais déclencher deux chaînes fallback indépendantes pour le
      // même évènement à quelques minutes d'écart : on bloque silencieusement et on lui rend
      // la réservation existante.
      let crossQuery = supabase
        .from('booking_requests')
        .select('id, conversation_id, status, created_at, booking_date, chef_id')
        .eq('email', normalizedEmail)
        .eq('service_type', serviceType)
        .ilike('city', city)
        .is('fallback_previous_booking_id', null)
        .gte('created_at', cutoffIso)
      if (serviceType === 'repas_domicile' && bookingDate) {
        crossQuery = crossQuery.eq('booking_date', bookingDate)
      }
      const { data: crossBooking, error: crossErr } = await crossQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (crossErr) {
        console.error(`[bookings:${requestId}] Idempotency cross-chef check error:`, crossErr)
      } else if (crossBooking) {
        const existing = crossBooking as ExistingBooking
        console.warn(`[bookings:${requestId}] Duplicate booking detected (cross-chef, same client/date/service)`, {
          existingBookingId: existing!.id,
          existingChefId: existing!.chef_id,
          newChefId: chefId,
          age: Date.now() - new Date(existing!.created_at).getTime(),
        })
        return NextResponse.json({
          success: true,
          bookingRequestId: existing!.id,
          conversationId: existing!.conversation_id,
          isDuplicate: true,
          duplicateReason: 'cross_chef',
        })
      }
    }

    // Récupérer le menu si sélectionné (nom + prix pour l’email chef et le total)
    let menuName: string | null = null
    let menuPricePerPerson: number | null = null
    if (menuId) {
      const { data: menu, error: menuError } = await supabase
        .from('menus')
        .select('name, price')
        .eq('id', menuId)
        .single()
      if (!menuError && menu && typeof menu === 'object') {
        menuName = (menu as { name?: string }).name || null
        const raw = (menu as { price?: unknown }).price
        const parsed = typeof raw === 'number' ? raw : Number.parseFloat(String(raw ?? ''))
        if (Number.isFinite(parsed) && parsed >= 0) {
          menuPricePerPerson = parsed
        }
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
        p_first_name: firstNameTrim,
        p_last_name: lastNameTrim,
        p_email: email,
        p_phone: phone,
        p_service_type: serviceType,
        p_booking_date: bookingDate || null,
        p_meal_time: mealTime || null,
        p_city: city,
        p_postal_code: postalCode,
        p_full_address: fullAddress || null,
        p_guests_count: parseInt(guestsCount),
        p_children_count: parseInt(childrenCount) || 0,
        p_period_days: periodDays || null,
        p_budget: normalizedCoursePricePerPerson,
        p_course_topic: courseTopic || null,
        p_selected_dates: selectedDatesJson,
        p_meal_options: mealOptionsJson,
        p_total_price: normalizedHomeChefPricePerPerson,
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
          first_name: firstNameTrim,
          last_name: lastNameTrim,
          email,
          phone,
          service_type: serviceType,
          booking_date: bookingDate || null,
          meal_time: mealTime || null,
          city,
          postal_code: postalCode,
          full_address: fullAddress || null,
          guests_count: parseInt(guestsCount),
          children_count: parseInt(childrenCount) || 0,
          period_days: periodDays || null,
          budget: normalizedCoursePricePerPerson,
          course_topic: courseTopic || null,
          selected_dates: selectedDates && Array.isArray(selectedDates) ? selectedDates : null,
          meal_options: mealOptionsForDb,
          total_price: normalizedHomeChefPricePerPerson,
          has_allergies: hasAllergies || false,
          allergies_details: hasAllergies ? allergiesDetails : null,
          menu_id: menuId || null,
          notes: notes || null,
          request_sent_at: new Date().toISOString(),
          fallback_enabled: fallbackEnabled,
          fallback_next_chef_ids: validFallbackChefIds,
          fallback_timeout_at: fallbackTimeoutAt,
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

    await (supabase
      .from('booking_requests') as any)
      .update({
        request_sent_at: new Date().toISOString(),
        fallback_enabled: fallbackEnabled,
        fallback_next_chef_ids: validFallbackChefIds,
        fallback_group_id: fallbackEnabled ? bookingRequestId : null,
        fallback_timeout_at: fallbackTimeoutAt,
      })
      .eq('id', bookingRequestId)

    // Créer ou récupérer l'utilisateur auth pour le CLIENT
    let clientUserId: string | null = null
    try {
      if (sessionUser) {
        // Utilisateur déjà connecté : utiliser son ID existant
        clientUserId = sessionUser.id
      } else {
        // Créer un nouveau compte avec mot de passe si fourni
        const createPayload: any = {
          email,
          email_confirm: true, // pas d'email de confirmation
        }
        if (passwordFromBody && typeof passwordFromBody === 'string' && passwordFromBody.length >= 8) {
          createPayload.password = passwordFromBody
        }

        const { data: newClientUser, error: createClientError } = await supabase.auth.admin.createUser(createPayload)

        if (createClientError) {
          if (createClientError.message.includes('already registered') || createClientError.message.includes('already exists')) {
            // Email déjà utilisé → renvoyer une erreur explicite au client
            return NextResponse.json({ error: 'email_exists', message: 'Un compte existe déjà avec cet email.' }, { status: 409 })
          }
          console.error('Error creating client user:', createClientError)
        } else if (newClientUser?.user) {
          clientUserId = newClientUser.user.id
        }
      }
    } catch (error) {
      console.error('Error checking/creating client user:', error)
    }

    // Pour le chef, récupérer son user_id existant (les chefs sont créés séparément)
    let chefUserId: string | null = null
    try {
      const { data: users } = await supabase.auth.admin.listUsers()
      const lookupChefEmail = ((chef as any).email || '').toLowerCase().trim()
      const existingChefUser = users?.users.find(u => (u.email || '').toLowerCase().trim() === lookupChefEmail)
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
      firstName: firstNameTrim,
      lastName: lastNameTrim,
      phone,
      serviceType,
      serviceTypeLabel: getServiceTypeLabelLocalized(serviceType),
      city,
      postalCode,
      fullAddress: fullAddress || null,
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
      const safeGuestsRepas = Number.parseInt(String(guestsCount), 10) || 0
      if (menuPricePerPerson !== null) {
        bookingDetails.menuPricePerPerson = menuPricePerPerson
        bookingDetails.estimatedTotalPrice = calculateBookingTotal('repas_domicile', {
          menuPrice: menuPricePerPerson,
          guestsCount: safeGuestsRepas,
        })
      }
    } else if (serviceType === 'cours_cuisine') {
      bookingDetails.bookingDate = bookingDate ? formatDateForDisplay(bookingDate, 'fr-FR') : null
      const safeGuestsCount = Number.parseInt(String(guestsCount), 10) || 0
      bookingDetails.budgetPerPerson = normalizedCoursePricePerPerson
      bookingDetails.estimatedTotalPrice = (normalizedCoursePricePerPerson || 0) * safeGuestsCount
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
      const daysCount = Array.isArray(selectedDates) ? selectedDates.length : 0
      bookingDetails.pricePerDay = normalizedHomeChefPricePerPerson
      bookingDetails.estimatedTotalPrice = (normalizedHomeChefPricePerPerson || 0) * daysCount
    }

    // Envoyer l'email de confirmation au client
    await sendEmail({
      to: email,
      subject: emailSubjects.bookingConfirmationToClient,
      html: emailTemplates.bookingConfirmationToClient(
        clientDisplayName,
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
        baseUrl,
        { showFallbackPriority: fallbackEnabled }
      ),
    })

    // Email simple à l'admin (contact) pour chaque nouvelle réservation
    await sendEmail({
      to: 'contact@guidemytable.fr',
      subject: emailSubjects.bookingNewToAdmin,
      html: emailTemplates.bookingNewToAdmin(
        clientDisplayName,
        email,
        (chef as any).name,
        (chef as any).email || null,
        bookingDetails,
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
