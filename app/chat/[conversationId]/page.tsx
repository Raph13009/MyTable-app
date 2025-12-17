import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatInterface from '@/components/ChatInterface'

interface PageProps {
  params: {
    conversationId: string
  }
  searchParams: {
    accepted?: string
  }
}

export default async function ChatPage({ params, searchParams }: PageProps) {
  const supabase = await createClient()
  const { conversationId } = params

  // Vérifier que la conversation existe
  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('*, booking_requests(*)')
    .eq('id', conversationId)
    .single()

  if (conversationError || !conversation) {
    redirect('/')
  }

  // Récupérer les participants
  const { data: participants } = await supabase
    .from('participants')
    .select('*')
    .eq('conversation_id', conversationId)

  // Récupérer les messages
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  // Récupérer l'utilisateur actuel
  const { data: { user } } = await supabase.auth.getUser()

  // Vérifier l'accès (l'utilisateur doit être un participant)
  const hasAccess = user && participants?.some(
    p => p.email === user.email || p.user_id === user.id
  )

  if (!hasAccess && user) {
    redirect('/')
  }

  const bookingRequest = conversation.booking_requests as any

  return (
    <div className="min-h-screen bg-white">
      <ChatInterface
        conversationId={conversationId}
        initialMessages={messages || []}
        participants={participants || []}
        currentUser={user}
        bookingRequest={bookingRequest}
        showAcceptedMessage={searchParams.accepted === 'true'}
      />
    </div>
  )
}

