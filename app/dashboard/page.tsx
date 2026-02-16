import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ConversationsList from '@/components/ConversationsList'
import AuthTokenHandler from '@/components/AuthTokenHandler'
import { calculateBookingTotal } from '@/lib/bookingCalculations'

export default async function DashboardPage() {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()
  
  // Vérifier l'authentification
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  // BYPASS AUTH EN LOCALHOST POUR TEST (à retirer en production)
  const isLocalhost = process.env.NODE_ENV === 'development' || 
                      (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  
  if (!user && !isLocalhost) {
    redirect('/login')
  }
  
  // Si pas d'utilisateur en localhost, créer un utilisateur mock
  const currentUser = user || {
    id: 'test-user-localhost',
    email: 'test@localhost.com',
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    confirmation_sent_at: null,
    recovery_sent_at: null,
    email_confirmed_at: new Date().toISOString(),
    invited_at: null,
    action_link: null,
    last_sign_in_at: new Date().toISOString(),
    phone: null,
    phone_confirmed_at: null,
    confirmed_at: new Date().toISOString(),
    is_anonymous: false,
  } as any

  console.log('[Dashboard] ========== START ==========')
  console.log('[Dashboard] User authenticated:', {
    email: currentUser.email,
    id: currentUser.id,
    isMock: !user,
  })

  // Récupérer toutes les conversations où l'utilisateur est participant
  const normalizedUserEmail = currentUser.email?.toLowerCase().trim() || ''
  
  console.log('[Dashboard] ========== FETCHING CONVERSATIONS ==========')
  console.log('[Dashboard] User email:', currentUser.email)
  console.log('[Dashboard] Normalized user email:', normalizedUserEmail)
  console.log('[Dashboard] User ID:', currentUser.id)
  
  // APPROACH 1: Récupérer les conversations via booking_requests (plus fiable pour les clients)
  console.log('[Dashboard] ========== APPROACH 1: VIA BOOKING_REQUESTS ==========')
  // Récupérer TOUS les booking_requests et filtrer côté serveur pour éviter les problèmes de casse
  const { data: allBookingRequests, error: brError } = await supabaseAdmin
    .from('booking_requests')
    .select('conversation_id, id, status, first_name, last_name, booking_date, city, guests_count, children_count, email, service_type, period_days, selected_dates, meal_time, menu_content, budget, total_price, is_price_custom, extras')
  
  console.log('[Dashboard] All booking requests in DB:', allBookingRequests?.length || 0)
  console.log('[Dashboard] Sample booking requests (first 5):', allBookingRequests?.slice(0, 5).map((br: any) => ({
    id: br.id,
    email: br.email,
    normalizedEmail: br.email?.toLowerCase().trim(),
    conversation_id: br.conversation_id,
  })))
  
  // Filtrer les booking_requests avec l'email normalisé
  const userBookingRequests = (allBookingRequests || []).filter((br: any) => {
    const brEmail = br.email?.toLowerCase().trim() || ''
    const matches = brEmail === normalizedUserEmail
    if (matches) {
      console.log('[Dashboard] ✅ Matching booking request found:', {
        id: br.id,
        email: br.email,
        normalizedEmail: brEmail,
        userEmail: normalizedUserEmail,
        conversation_id: br.conversation_id,
      })
    }
    return matches
  })
  
  console.log('[Dashboard] User booking requests after filter:', userBookingRequests.length)
  
  console.log('[Dashboard] Booking requests found for user email:', {
    count: userBookingRequests?.length || 0,
    bookingRequests: userBookingRequests?.map((br: any) => ({
      id: br.id,
      conversation_id: br.conversation_id,
      status: br.status,
      email: br.email,
    })),
    error: brError?.message,
  })
  
  const conversationIdsFromBR = (userBookingRequests || [])
    .map((br: any) => br.conversation_id)
    .filter((id): id is string => Boolean(id) && typeof id === 'string') as string[]
  
  console.log('[Dashboard] Booking requests with conversation_id:', userBookingRequests.filter((br: any) => br.conversation_id).length)
  console.log('[Dashboard] Booking requests WITHOUT conversation_id:', userBookingRequests.filter((br: any) => !br.conversation_id).length)
  
  console.log('[Dashboard] Conversation IDs from booking_requests:', conversationIdsFromBR)
  
  // APPROACH 2: Récupérer les participants (pour les chefs aussi)
  console.log('[Dashboard] ========== APPROACH 2: VIA PARTICIPANTS ==========')
  const { data: allParticipants, error: participantsError } = await supabaseAdmin
    .from('participants')
    .select('conversation_id, role, email, user_id')

  if (participantsError) {
    console.error('[Dashboard] Error fetching participants:', participantsError)
  }

  console.log('[Dashboard] All participants in DB:', allParticipants?.length || 0)
  console.log('[Dashboard] Sample participants (first 5):', allParticipants?.slice(0, 5).map((p: any) => ({
    email: p.email,
    normalizedEmail: p.email?.toLowerCase().trim(),
    user_id: p.user_id,
    role: p.role,
    conversation_id: p.conversation_id,
  })))

  // Filtrer les participants correspondant à l'utilisateur
  const userParticipants = (allParticipants || []).filter((p: any) => {
    const participantEmail = p.email?.toLowerCase().trim() || ''
    const emailMatch = participantEmail === normalizedUserEmail
    const userIdMatch = p.user_id === currentUser.id
    const matches = emailMatch || userIdMatch
    
    if (matches) {
      console.log('[Dashboard] ✅ Matching participant found:', {
        email: p.email,
        normalizedEmail: participantEmail,
        userEmail: normalizedUserEmail,
        user_id: p.user_id,
        userId: currentUser.id,
        emailMatch,
        userIdMatch,
        role: p.role,
        conversation_id: p.conversation_id,
      })
    } else {
      // Log pour debug si pas de match
      if (participantEmail && normalizedUserEmail) {
        console.log('[Dashboard] ⚠️ Participant does not match:', {
          participantEmail,
          userEmail: normalizedUserEmail,
          emailsEqual: participantEmail === normalizedUserEmail,
          participantUserId: p.user_id,
          userUserId: currentUser.id,
          userIdsEqual: p.user_id === currentUser.id,
        })
      }
    }
    
    return matches
  })

  console.log('[Dashboard] Participants query result:', {
    count: userParticipants?.length || 0,
    totalParticipants: allParticipants?.length || 0,
    participants: userParticipants?.map((p: any) => ({
      email: p.email,
      user_id: p.user_id,
      role: p.role,
      conversation_id: p.conversation_id,
    })),
  })
  
  // Si aucun participant trouvé, afficher un warning détaillé
  if (userParticipants.length === 0 && (allParticipants || []).length > 0) {
    console.error('[Dashboard] ❌❌❌ NO PARTICIPANTS FOUND FOR USER ❌❌❌')
    console.error('[Dashboard] User email:', currentUser.email)
    console.error('[Dashboard] Normalized user email:', normalizedUserEmail)
    console.error('[Dashboard] User ID:', currentUser.id)
    console.error('[Dashboard] Total participants in DB:', (allParticipants || []).length)
    console.error('[Dashboard] All participant emails:', (allParticipants || []).map((p: any) => ({
      original: p.email,
      normalized: p.email?.toLowerCase().trim(),
      matches: p.email?.toLowerCase().trim() === normalizedUserEmail,
    })))
  }

  if (participantsError) {
    console.error('[Dashboard] Error fetching participants:', participantsError)
  }

  const conversationIdsFromParticipants = userParticipants.map((p: any) => p.conversation_id).filter(Boolean) as string[]
  
  // Combiner les deux approches : booking_requests + participants
  const allConversationIds = [...new Set([...conversationIdsFromBR, ...conversationIdsFromParticipants])]
  
  console.log('[Dashboard] ========== CONVERSATION IDs EXTRACTION ==========')
  console.log('[Dashboard] User participants count:', userParticipants.length)
  console.log('[Dashboard] Conversation IDs from participants:', conversationIdsFromParticipants)
  console.log('[Dashboard] Conversation IDs from booking_requests:', conversationIdsFromBR)
  console.log('[Dashboard] All unique conversation IDs:', allConversationIds)
  console.log('[Dashboard] Total conversation IDs count:', allConversationIds.length)
  console.log('[Dashboard] Conversation IDs (detailed):', allConversationIds.map((id, i) => ({
    index: i,
    id,
    type: typeof id,
    length: id?.length,
  })))

  if (allConversationIds.length === 0) {
    console.error('[Dashboard] ❌❌❌ NO CONVERSATION IDs - RETURNING EMPTY STATE ❌❌❌')
    console.error('[Dashboard] This means no participants matched the user')
      console.error('[Dashboard] User email:', user?.email)
      console.error('[Dashboard] Normalized email:', normalizedUserEmail)
      console.error('[Dashboard] User ID:', user?.id)
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-black mb-6">Mes conversations</h1>
          <div className="text-center py-12">
            <p className="text-gray-600">Aucune conversation pour le moment.</p>
            <p className="text-sm text-gray-500 mt-2">
              Email: {currentUser.email} | ID: {currentUser.id}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Récupérer les conversations avec leurs booking_requests pour avoir le statut
  // IMPORTANT: On récupère toutes les conversations où l'utilisateur est participant OU client
  console.log('[Dashboard] ========== FETCHING CONVERSATIONS FROM DB ==========')
  console.log('[Dashboard] Querying conversations with IDs:', allConversationIds)
  console.log('[Dashboard] Number of IDs to query:', allConversationIds.length)
  console.log('[Dashboard] Unique conversation IDs:', allConversationIds)
  
  let conversations: any[] | null = null
  let conversationsError: any = null
  
  if (allConversationIds.length > 0) {
    // Essayer d'abord avec la jointure
    const result = await supabaseAdmin
      .from('conversations')
      .select(`
        *,
        booking_requests (
          id,
          status,
          first_name,
          last_name,
          booking_date,
          city,
          guests_count,
          children_count,
          service_type,
          period_days,
          selected_dates,
          meal_time,
          budget,
          total_price,
          is_price_custom,
          extras
        )
      `)
      .in('id', allConversationIds)
    
    conversations = result.data
    conversationsError = result.error
    
    // Si la jointure échoue ou retourne vide, essayer sans jointure
    if (conversationsError || !conversations || conversations.length === 0) {
      console.log('[Dashboard] ⚠️ Jointure échouée ou vide, essayant sans jointure...')
      const resultSimple = await supabaseAdmin
        .from('conversations')
        .select('*')
        .in('id', allConversationIds)
      
      conversations = resultSimple.data
      conversationsError = resultSimple.error
      
      // Si on a des conversations, récupérer les booking_requests séparément
      if (conversations && conversations.length > 0) {
        console.log('[Dashboard] ✅ Conversations trouvées sans jointure, récupération des booking_requests...')
        const conversationsWithBR = await Promise.all(
          conversations.map(async (conv: any) => {
            const { data: bookingReqs } = await supabaseAdmin
              .from('booking_requests')
              .select('id, status, first_name, last_name, booking_date, city, guests_count, children_count, menu_id, chef_id, extras, service_type, period_days, selected_dates, meal_time, budget, total_price, is_price_custom')
              .eq('conversation_id', conv.id)
            
            return {
              ...conv,
              booking_requests: bookingReqs || [],
            }
          })
        )
        conversations = conversationsWithBR
      }
    }
  } else {
    console.log('[Dashboard] ⚠️ Aucun conversation ID à requêter')
  }
  
  console.log('[Dashboard] ========== CONVERSATIONS QUERY RESULT ==========')
  console.log('[Dashboard] Conversations found:', conversations?.length || 0)
  console.log('[Dashboard] Conversations data:', conversations ? JSON.stringify(conversations.map(c => ({
    id: c.id,
    booking_request_id: (c as any).booking_request_id,
    hasBookingRequests: !!(c as any).booking_requests,
    bookingRequestsCount: Array.isArray((c as any).booking_requests) ? (c as any).booking_requests.length : 0,
  })), null, 2) : 'null')
  console.log('[Dashboard] Conversation IDs queried:', allConversationIds)
  console.log('[Dashboard] Conversation IDs in result:', conversations?.map(c => c.id) || [])

  if (conversationsError) {
    console.error('[Dashboard] ❌❌❌ ERROR FETCHING CONVERSATIONS ❌❌❌')
    console.error('[Dashboard] Error:', conversationsError)
    console.error('[Dashboard] Error message:', conversationsError.message)
    console.error('[Dashboard] Error code:', conversationsError.code)
    console.error('[Dashboard] Error details:', JSON.stringify(conversationsError, null, 2))
  }
  
  if (!conversations || conversations.length === 0) {
    console.error('[Dashboard] ❌❌❌ NO CONVERSATIONS RETURNED FROM QUERY ❌❌❌')
    console.error('[Dashboard] This means the conversations exist in participants but not in conversations table')
      console.error('[Dashboard] Conversation IDs we searched for:', allConversationIds)
    
    // Vérifier si les conversations existent vraiment
    console.log('[Dashboard] ========== CHECKING IF CONVERSATIONS EXIST ==========')
    for (const convId of allConversationIds) {
      const { data: singleConv, error: singleError } = await supabaseAdmin
        .from('conversations')
        .select('id, booking_request_id, created_at')
        .eq('id', convId)
        .maybeSingle()
      
      console.log(`[Dashboard] Conversation ${convId}:`, {
        exists: !!singleConv,
        data: singleConv,
        error: singleError?.message,
        errorCode: singleError?.code,
      })
      
      // Vérifier aussi les participants pour cette conversation
      const { data: convParticipants, error: partError } = await supabaseAdmin
        .from('participants')
        .select('email, role, user_id')
        .eq('conversation_id', convId)
      
      console.log(`[Dashboard] Participants for conversation ${convId}:`, {
        count: convParticipants?.length || 0,
        participants: convParticipants,
        error: partError?.message,
      })
      
      // Vérifier les booking_requests liés
      const { data: bookingReqs, error: brError } = await supabaseAdmin
        .from('booking_requests')
        .select('id, email, status, conversation_id')
        .eq('conversation_id', convId)
      
      console.log(`[Dashboard] Booking requests for conversation ${convId}:`, {
        count: bookingReqs?.length || 0,
        bookingRequests: bookingReqs,
        error: brError?.message,
      })
    }
  }

  // Enrichir les conversations avec les participants et le dernier message
  console.log('[Dashboard] ========== ENRICHING CONVERSATIONS ==========')
  console.log('[Dashboard] Conversations to enrich:', (conversations || []).length)
  
  const enrichedConversations = await Promise.all(
    (conversations || []).map(async (conv: any, index: number) => {
      console.log(`[Dashboard] Enriching conversation ${index + 1}/${(conversations || []).length}:`, conv.id)
      
      // Récupérer les participants
      console.log(`[Dashboard] Fetching participants for conversation ${conv.id}...`)
      const { data: convParticipants, error: participantsError } = await supabaseAdmin
        .from('participants')
        .select('email, role')
        .eq('conversation_id', conv.id)
      
      console.log(`[Dashboard] Participants for ${conv.id}:`, {
        count: convParticipants?.length || 0,
        participants: convParticipants,
        error: participantsError?.message,
      })

      // Récupérer le dernier message
      console.log(`[Dashboard] Fetching last message for conversation ${conv.id}...`)
      const { data: lastMessageData, error: messageError } = await supabaseAdmin
        .from('messages')
        .select('content, created_at, sender_email')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
      
      console.log(`[Dashboard] Last message for ${conv.id}:`, {
        found: !!(lastMessageData && lastMessageData.length > 0),
        message: lastMessageData?.[0] ? {
          content: (lastMessageData[0] as any).content?.substring(0, 50) + '...',
          created_at: (lastMessageData[0] as any).created_at,
          sender_email: (lastMessageData[0] as any).sender_email,
        } : null,
        error: messageError?.message,
      })
      
      const lastMessage = lastMessageData && lastMessageData.length > 0 ? lastMessageData[0] : null

      // Déterminer le statut de la conversation basé sur le booking_request
      const bookingRequest = conv.booking_requests?.[0]
      console.log(`[Dashboard] Booking request for ${conv.id}:`, {
        exists: !!bookingRequest,
        status: bookingRequest?.status || 'none',
        id: bookingRequest?.id || 'none',
      })
      
      // Récupérer le nom du chef si booking_request existe
      let chefName: string | null = null
      let menuPrice: number | null = null
      let extras: any[] = []
      
      if (bookingRequest?.chef_id) {
        console.log(`[Dashboard] Fetching chef name for chef_id: ${bookingRequest.chef_id}`)
        const { data: chef, error: chefError } = await supabaseAdmin
          .from('chefs')
          .select('name')
          .eq('id', bookingRequest.chef_id)
          .maybeSingle()
        
        if (chefError) {
          console.error(`[Dashboard] Error fetching chef:`, chefError)
        }
        
        if (chef) {
          chefName = (chef as any).name
          console.log(`[Dashboard] Chef name found: ${chefName}`)
        } else {
          console.warn(`[Dashboard] No chef found for chef_id: ${bookingRequest.chef_id}`)
        }
      } else {
        console.log(`[Dashboard] No chef_id in booking_request for conversation ${conv.id}`)
      }
      
      // Récupérer le prix du menu si menu_id existe
      if (bookingRequest?.menu_id) {
        const { data: menu } = await supabaseAdmin
          .from('menus')
          .select('price')
          .eq('id', bookingRequest.menu_id)
          .maybeSingle()
        
        if (menu) {
          menuPrice = (menu as any).price || 0
        }
      }
      
      // Récupérer les extras depuis booking_requests.extras (JSONB)
      if ((bookingRequest as any)?.extras) {
        try {
          const extrasData = (bookingRequest as any).extras
          if (Array.isArray(extrasData)) {
            extras = extrasData
          } else if (typeof extrasData === 'string') {
            const parsed = JSON.parse(extrasData)
            if (Array.isArray(parsed)) {
              extras = parsed
            }
          }
        } catch (e) {
          console.error(`[Dashboard] Error parsing extras:`, e)
        }
      }
      
      let status: 'ongoing' | 'pending' | 'closed' = 'ongoing'
      
      if (bookingRequest) {
        // Mapper le statut de booking_request vers le statut de conversation
        switch (bookingRequest.status) {
          case 'pending':
            status = 'pending'
            break
          case 'accepted':
            status = 'ongoing' // Les réservations acceptées sont "en cours"
            break
          case 'validated_by_client':
            status = 'ongoing' // Les réservations validées par le client sont "en cours" (en attente de paiement)
            break
          case 'completed':
            status = 'closed' // Les réservations complétées sont "terminées"
            break
          case 'refused':
            status = 'closed' // Les réservations refusées sont "terminées"
            break
          case 'cancelled':
            status = 'closed' // Les réservations annulées sont "terminées"
            break
          default:
            // Par défaut, si le statut n'est pas reconnu, on met "en cours"
            console.warn(`[Dashboard] Unknown booking_request status for ${conv.id}:`, bookingRequest.status)
            status = 'ongoing'
        }
      } else {
        // Si pas de booking_request, on considère que c'est "en cours" par défaut
        console.log(`[Dashboard] No booking_request found for conversation ${conv.id}`)
        status = 'ongoing'
      }

      // Calculer le prix total selon le type de service
      const guestsCount = bookingRequest?.guests_count || 0
      const totalPrice = calculateBookingTotal(bookingRequest?.service_type, {
        menuPrice,
        guestsCount,
        budget: bookingRequest?.budget,
        totalPrice: bookingRequest?.total_price,
        periodDaysCount: Array.isArray(bookingRequest?.selected_dates) ? bookingRequest.selected_dates.length : 0,
        isPriceCustom: bookingRequest?.is_price_custom,
        extras,
      })

      const enrichedConv = {
        id: conv.id,
        status,
        bookingRequest: bookingRequest ? {
          ...bookingRequest,
          chefName,
          menuPrice,
          extras,
          totalPrice,
          budget: bookingRequest.budget, // Inclure budget pour cours_cuisine
          total_price: bookingRequest.total_price, // Inclure total_price pour mise_en_demeure
          service_type: bookingRequest.service_type,
          period_days: bookingRequest.period_days,
        } : null,
        participants: convParticipants || [],
        lastMessage: lastMessage || null,
        updatedAt: conv.updated_at,
      }
      
      console.log(`[Dashboard] ✅ Conversation ${conv.id} enriched:`, {
        id: enrichedConv.id,
        status: enrichedConv.status,
        bookingRequestStatus: bookingRequest?.status || 'none',
        hasBookingRequest: !!bookingRequest,
        chefName: enrichedConv.bookingRequest?.chefName || 'not set',
        participantsCount: enrichedConv.participants.length,
        hasLastMessage: !!enrichedConv.lastMessage,
        updatedAt: enrichedConv.updatedAt,
      })
      
      return enrichedConv
    })
  )

  // Trier par date de mise à jour (plus récent en premier)
  console.log('[Dashboard] ========== SORTING CONVERSATIONS ==========')
  console.log('[Dashboard] Conversations before sort:', enrichedConversations.length)
  
  enrichedConversations.sort((a: any, b: any) => {
    const dateA = new Date(a.updatedAt || (a.lastMessage as any)?.created_at || 0).getTime()
    const dateB = new Date(b.updatedAt || (b.lastMessage as any)?.created_at || 0).getTime()
    return dateB - dateA
  })
  
  // Log des conversations finales avec leurs statuts
  console.log('[Dashboard] ========== FINAL CONVERSATIONS ==========')
  console.log('[Dashboard] Final conversations count:', enrichedConversations.length)
  console.log('[Dashboard] Final conversations:', enrichedConversations.map(c => ({
    id: c.id,
    status: c.status,
    bookingRequestStatus: c.bookingRequest?.status || 'none',
    hasBookingRequest: !!c.bookingRequest,
    participantsCount: c.participants.length,
    hasLastMessage: !!c.lastMessage,
    updatedAt: c.updatedAt,
  })))

  // Créer un map des participants par conversation pour le composant
  console.log('[Dashboard] ========== CREATING PARTICIPANTS MAP ==========')
  const participantsMap = new Map()
  userParticipants.forEach((p: any) => {
    if (!participantsMap.has(p.conversation_id)) {
      participantsMap.set(p.conversation_id, [])
    }
    participantsMap.get(p.conversation_id).push(p)
  })
  
  console.log('[Dashboard] Participants map size:', participantsMap.size)
  console.log('[Dashboard] Participants map keys:', Array.from(participantsMap.keys()))
  
  console.log('[Dashboard] ========== FINAL SUMMARY ==========')
  console.log('[Dashboard] User:', { email: currentUser.email, id: currentUser.id })
  console.log('[Dashboard] User participants found:', userParticipants.length)
  console.log('[Dashboard] Conversation IDs extracted:', allConversationIds.length)
  console.log('[Dashboard] Conversations fetched:', (conversations || []).length)
  console.log('[Dashboard] Enriched conversations:', enrichedConversations.length)
  console.log('[Dashboard] Enriched conversations details:', enrichedConversations.map(c => ({
    id: c.id,
    status: c.status,
    hasBookingRequest: !!c.bookingRequest,
    participantsCount: c.participants.length,
  })))
  console.log('[Dashboard] ========== END FETCHING ==========')
  
  // Log final avant de passer au composant
  console.log('[Dashboard] ========== PASSING TO COMPONENT ==========')
  console.log('[Dashboard] Conversations array length:', enrichedConversations.length)
  console.log('[Dashboard] Conversations array:', JSON.stringify(enrichedConversations.map(c => ({ id: c.id, status: c.status })), null, 2))
  console.log('[Dashboard] Participants map size:', participantsMap.size)
  console.log('[Dashboard] ========== END PASSING ==========')

  return (
    <>
      {/* Client component to handle hash tokens from magic links */}
      <AuthTokenHandler />
      <ConversationsList
        conversations={enrichedConversations}
        currentUser={currentUser}
        participantsMap={participantsMap}
      />
    </>
  )
}
