import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()
    
    // Vérifier l'authentification
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const normalizedUserEmail = user.email?.toLowerCase().trim() || ''

    // 1. Récupérer TOUS les booking_requests
    const { data: allBookingRequests, error: brError } = await supabaseAdmin
      .from('booking_requests')
      .select('conversation_id, id, status, first_name, last_name, booking_date, city, guests_count, email')
    
    const userBookingRequests = (allBookingRequests || []).filter(br => {
      const brEmail = br.email?.toLowerCase().trim() || ''
      return brEmail === normalizedUserEmail
    })

    const conversationIdsFromBR = (userBookingRequests || [])
      .map(br => br.conversation_id)
      .filter((id): id is string => Boolean(id) && typeof id === 'string')

    // 2. Récupérer tous les participants
    const { data: allParticipants, error: participantsError } = await supabaseAdmin
      .from('participants')
      .select('conversation_id, role, email, user_id')

    const userParticipants = (allParticipants || []).filter(p => {
      const participantEmail = p.email?.toLowerCase().trim() || ''
      return participantEmail === normalizedUserEmail || p.user_id === user.id
    })

    const conversationIdsFromParticipants = userParticipants.map(p => p.conversation_id).filter(Boolean) as string[]
    
    const allConversationIds = [...new Set([...conversationIdsFromBR, ...conversationIdsFromParticipants])]

    // 3. Récupérer les conversations
    let conversations: any[] | null = null
    let conversationsError: any = null
    
    if (allConversationIds.length > 0) {
      const result = await supabaseAdmin
        .from('conversations')
        .select('*')
        .in('id', allConversationIds)
      
      conversations = result.data
      conversationsError = result.error
      
      // Récupérer les booking_requests séparément
      if (conversations && conversations.length > 0) {
        for (const conv of conversations) {
          const { data: bookingReqs } = await supabaseAdmin
            .from('booking_requests')
            .select('id, status, first_name, last_name, booking_date, city, guests_count')
            .eq('conversation_id', conv.id)
          
          (conv as any).booking_requests = bookingReqs || []
        }
      }
    }

    return NextResponse.json({
      user: {
        email: user.email,
        normalizedEmail: normalizedUserEmail,
        id: user.id,
      },
      bookingRequests: {
        all: allBookingRequests?.length || 0,
        user: userBookingRequests.length,
        data: userBookingRequests,
        conversationIds: conversationIdsFromBR,
      },
      participants: {
        all: allParticipants?.length || 0,
        user: userParticipants.length,
        data: userParticipants,
        conversationIds: conversationIdsFromParticipants,
      },
      conversationIds: {
        fromBR: conversationIdsFromBR,
        fromParticipants: conversationIdsFromParticipants,
        all: allConversationIds,
        count: allConversationIds.length,
      },
      conversations: {
        count: conversations?.length || 0,
        data: conversations,
        error: conversationsError?.message,
      },
      errors: {
        brError: brError?.message,
        participantsError: participantsError?.message,
        conversationsError: conversationsError?.message,
      },
    })
  } catch (error: any) {
    console.error('[test-dashboard] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

