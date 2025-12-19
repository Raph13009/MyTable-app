import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export default async function DebugDashboardPage() {
  const supabase = await createClient()
  const supabaseAdmin = createAdminClient()
  
  // Vérifier l'authentification
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const normalizedUserEmail = user.email?.toLowerCase().trim() || ''

  // 1. Récupérer TOUS les booking_requests et filtrer
  const { data: allBookingRequests, error: brError } = await supabaseAdmin
    .from('booking_requests')
    .select('conversation_id, id, status, first_name, last_name, booking_date, city, guests_count, email')
  
  // Filtrer les booking_requests avec l'email normalisé
  const userBookingRequests = (allBookingRequests || []).filter((br: any) => {
    const brEmail = br.email?.toLowerCase().trim() || ''
    return brEmail === normalizedUserEmail
  })

  // 2. Récupérer tous les participants
  const { data: allParticipants, error: participantsError } = await supabaseAdmin
    .from('participants')
    .select('conversation_id, role, email, user_id')

  // 3. Filtrer les participants
  const userParticipants = (allParticipants || []).filter((p: any) => {
    const participantEmail = p.email?.toLowerCase().trim() || ''
    return participantEmail === normalizedUserEmail || p.user_id === user.id
  })

  // 4. Extraire les conversation IDs
  const conversationIdsFromBR = (userBookingRequests || [])
    .map((br: any) => br.conversation_id)
    .filter(Boolean) as string[]
  
  const conversationIdsFromParticipants = userParticipants.map((p: any) => p.conversation_id).filter(Boolean) as string[]
  
  const allConversationIds = [...new Set([...conversationIdsFromBR, ...conversationIdsFromParticipants])]

  // 5. Récupérer les conversations
  const { data: conversations, error: conversationsError } = await supabaseAdmin
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
        guests_count
      )
    `)
    .in('id', allConversationIds)

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-black mb-8">Debug Dashboard</h1>
        
        <div className="space-y-8">
          {/* User Info */}
          <section className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">User Info</h2>
            <pre className="bg-white p-4 rounded overflow-auto text-sm">
              {JSON.stringify({
                email: user.email,
                normalizedEmail: normalizedUserEmail,
                id: user.id,
              }, null, 2)}
            </pre>
          </section>

          {/* All Booking Requests */}
          <section className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">All Booking Requests</h2>
            <p className="mb-2">Total: {allBookingRequests?.length || 0}</p>
            {brError && (
              <p className="text-red-600 mb-2">Error: {brError.message}</p>
            )}
            <pre className="bg-white p-4 rounded overflow-auto text-sm max-h-96">
              {JSON.stringify(allBookingRequests, null, 2)}
            </pre>
          </section>

          {/* User Booking Requests */}
          <section className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">User Booking Requests (Filtered)</h2>
            <p className="mb-2">Count: {userBookingRequests.length}</p>
            <pre className="bg-white p-4 rounded overflow-auto text-sm">
              {JSON.stringify(userBookingRequests, null, 2)}
            </pre>
            <p className="mt-4">Conversation IDs from BR: {JSON.stringify(conversationIdsFromBR)}</p>
          </section>

          {/* Participants */}
          <section className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">All Participants</h2>
            <p className="mb-2">Total: {allParticipants?.length || 0}</p>
            {participantsError && (
              <p className="text-red-600 mb-2">Error: {participantsError.message}</p>
            )}
            <pre className="bg-white p-4 rounded overflow-auto text-sm max-h-96">
              {JSON.stringify(allParticipants, null, 2)}
            </pre>
          </section>

          {/* User Participants */}
          <section className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">User Participants (Filtered)</h2>
            <p className="mb-2">Count: {userParticipants.length}</p>
            <pre className="bg-white p-4 rounded overflow-auto text-sm">
              {JSON.stringify(userParticipants, null, 2)}
            </pre>
            <p className="mt-4">Conversation IDs from Participants: {JSON.stringify(conversationIdsFromParticipants)}</p>
          </section>

          {/* Conversation IDs */}
          <section className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">All Conversation IDs</h2>
            <p className="mb-2">Count: {allConversationIds.length}</p>
            <pre className="bg-white p-4 rounded overflow-auto text-sm">
              {JSON.stringify(allConversationIds, null, 2)}
            </pre>
          </section>

          {/* Conversations */}
          <section className="bg-gray-50 p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Conversations</h2>
            <p className="mb-2">Count: {conversations?.length || 0}</p>
            {conversationsError && (
              <p className="text-red-600 mb-2">Error: {conversationsError.message}</p>
            )}
            <pre className="bg-white p-4 rounded overflow-auto text-sm max-h-96">
              {JSON.stringify(conversations, null, 2)}
            </pre>
          </section>
        </div>
      </div>
    </div>
  )
}

