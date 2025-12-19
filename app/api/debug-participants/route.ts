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

    // Récupérer tous les participants
    const { data: allParticipants, error: participantsError } = await supabaseAdmin
      .from('participants')
      .select('conversation_id, role, email, user_id')

    // Récupérer toutes les booking_requests
    const { data: bookingRequests, error: bookingRequestsError } = await supabaseAdmin
      .from('booking_requests')
      .select('id, email, status, conversation_id')

    // Filtrer les participants correspondant à l'utilisateur
    const userParticipants = (allParticipants || []).filter((p: any) => {
      const participantEmail = (p as any).email?.toLowerCase().trim() || ''
      return participantEmail === normalizedUserEmail || p.user_id === user.id
    })

    // Trouver les booking_requests correspondant à l'utilisateur
    const userBookingRequests = (bookingRequests || []).filter((br: any) => {
      const bookingEmail = br.email?.toLowerCase().trim() || ''
      return bookingEmail === normalizedUserEmail
    })

    return NextResponse.json({
      user: {
        email: user.email,
        normalizedEmail: normalizedUserEmail,
        id: user.id,
      },
      allParticipants: {
        total: allParticipants?.length || 0,
        participants: allParticipants?.map((p: any) => ({
          email: p.email,
          normalizedEmail: p.email?.toLowerCase().trim(),
          role: p.role,
          user_id: p.user_id,
          conversation_id: p.conversation_id,
          matchesUser: p.email?.toLowerCase().trim() === normalizedUserEmail || p.user_id === user.id,
        })),
      },
      userParticipants: {
        count: userParticipants.length,
        participants: userParticipants.map((p: any) => ({
          email: p.email,
          role: p.role,
          user_id: p.user_id,
          conversation_id: p.conversation_id,
        })),
      },
      bookingRequests: {
        total: bookingRequests?.length || 0,
        userBookingRequests: userBookingRequests.map((br: any) => ({
          id: br.id,
          email: br.email,
          normalizedEmail: br.email?.toLowerCase().trim(),
          status: br.status,
          conversation_id: br.conversation_id,
        })),
      },
      errors: {
        participantsError: participantsError?.message,
        bookingRequestsError: bookingRequestsError?.message,
      },
    })
  } catch (error: any) {
    console.error('[debug-participants] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
