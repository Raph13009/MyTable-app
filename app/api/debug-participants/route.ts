import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    console.log('[debug-participants] Checking conversation:', conversationId)

    // Vérifier que la conversation existe
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single()

    console.log('[debug-participants] Conversation:', conversation)
    console.log('[debug-participants] Conversation error:', convError)

    // Récupérer tous les participants
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('*')
      .eq('conversation_id', conversationId)

    console.log('[debug-participants] Participants:', participants)
    console.log('[debug-participants] Participants error:', participantsError)

    // Récupérer le booking request associé
    let bookingRequest = null
    if (conversation?.booking_request_id) {
      const { data: booking, error: bookingError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('id', conversation.booking_request_id)
        .single()
      
      bookingRequest = booking
      console.log('[debug-participants] Booking request:', booking)
      console.log('[debug-participants] Booking request error:', bookingError)
    }

    return NextResponse.json({
      conversationId,
      conversation,
      participants: participants || [],
      participantsCount: participants?.length || 0,
      bookingRequest,
      errors: {
        conversation: convError,
        participants: participantsError,
      },
    })
  } catch (error: any) {
    console.error('[debug-participants] Fatal error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error', stack: error.stack },
      { status: 500 }
    )
  }
}

