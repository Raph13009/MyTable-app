import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const conversationId = searchParams.get('conversationId')
    const email = searchParams.get('email')

    if (!conversationId || !email) {
      return NextResponse.json(
        { error: 'conversationId and email are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const normalizedEmail = email.toLowerCase().trim()
    console.log('[check-participant] ========== CHECKING PARTICIPANT ==========')
    console.log('[check-participant] Conversation ID:', conversationId)
    console.log('[check-participant] Email to check:', normalizedEmail)

    // Vérifier d'abord que la conversation existe
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, booking_request_id, created_at')
      .eq('id', conversationId)
      .single()

    console.log('[check-participant] Conversation exists:', !!conversation)
    console.log('[check-participant] Conversation data:', conversation)
    console.log('[check-participant] Conversation error:', convError)

    // Récupérer TOUS les participants de cette conversation pour debug
    const { data: allParticipants, error: allError } = await supabase
      .from('participants')
      .select('id, email, user_id, role, conversation_id, created_at')
      .eq('conversation_id', conversationId)

    console.log('[check-participant] All participants query result:', allParticipants)
    console.log('[check-participant] All participants count:', allParticipants?.length || 0)
    console.log('[check-participant] All participants error:', allError)
    
    if (allParticipants && allParticipants.length > 0) {
      console.log('[check-participant] Participant emails:', allParticipants.map((p: any) => (p as any).email))
      console.log('[check-participant] Participant user_ids:', allParticipants.map((p: any) => (p as any).user_id))
    } else {
      console.log('[check-participant] ⚠️ WARNING: No participants found for this conversation!')
      
      // Vérifier s'il y a des participants dans d'autres conversations (pour debug)
      const { data: allParticipantsAny, error: anyError } = await supabase
        .from('participants')
        .select('conversation_id, email, role')
        .limit(10)
      
      console.log('[check-participant] Sample participants from DB (any conversation):', allParticipantsAny)
    }

    // Vérifier si l'email correspond (comparaison case-insensitive)
    const { data: participants, error } = await supabase
      .from('participants')
      .select('email, user_id, role, conversation_id')
      .eq('conversation_id', conversationId)
      .ilike('email', normalizedEmail) // Utiliser ilike pour comparaison case-insensitive

    console.log('[check-participant] Matching participants:', participants)
    console.log('[check-participant] Error:', error)

    if (error) {
      console.error('[check-participant] Error:', error)
      return NextResponse.json(
        { error: 'Error checking participant', details: error.message },
        { status: 500 }
      )
    }

    const isParticipant = participants && participants.length > 0
    console.log('[check-participant] Is participant:', isParticipant)

    console.log('[check-participant] Final result - isParticipant:', isParticipant)
    console.log('[check-participant] ========== CHECK DONE ==========')
    
    return NextResponse.json({
      isParticipant,
      allParticipants: allParticipants || [],
      matchingParticipants: participants || [],
      conversation: conversation || null,
      debug: {
        conversationExists: !!conversation,
        totalParticipants: allParticipants?.length || 0,
        matchingCount: participants?.length || 0,
      },
    })
  } catch (error: any) {
    console.error('[check-participant] Fatal error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

