'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type Message = Database['public']['Tables']['messages']['Row']
type Participant = Database['public']['Tables']['participants']['Row']

interface ChatInterfaceProps {
  conversationId: string
  initialMessages: Message[]
  participants: Participant[]
  currentUser: User | null
  bookingRequest: any
  showAcceptedMessage?: boolean
}

export default function ChatInterface({
  conversationId,
  initialMessages,
  participants,
  currentUser,
  bookingRequest,
  showAcceptedMessage = false,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const router = useRouter()

  const getParticipantRole = (email: string): 'chef' | 'client' | null => {
    if (!email) return null
    const normalizedEmail = email?.toLowerCase().trim()
    const participant = participants.find(p => {
      const participantEmail = p.email?.toLowerCase().trim()
      return participantEmail === normalizedEmail
    })
    
    console.log('[ChatInterface] getParticipantRole:', {
      searchEmail: normalizedEmail,
      participantFound: !!participant,
      participantRole: participant?.role,
      allParticipants: participants.map(p => ({
        email: p.email?.toLowerCase().trim(),
        role: p.role,
      })),
    })
    
    return participant?.role || null
  }

  const getCurrentUserRole = (): 'chef' | 'client' | null => {
    if (!currentUser?.email) return null
    const role = getParticipantRole(currentUser.email)
    console.log('[ChatInterface] getCurrentUserRole:', {
      userEmail: currentUser.email,
      role,
    })
    return role
  }

  // Logs au montage du composant
  useEffect(() => {
    console.log('[ChatInterface] ========== COMPONENT MOUNTED ==========')
    console.log('[ChatInterface] Current user:', {
      email: currentUser?.email,
      id: currentUser?.id,
    })
    console.log('[ChatInterface] Participants:', participants.map(p => ({
      email: p.email,
      role: p.role,
      user_id: p.user_id,
    })))
    console.log('[ChatInterface] Initial messages count:', initialMessages.length)
    console.log('[ChatInterface] Initial messages:', initialMessages.map(m => ({
      id: m.id,
      sender_email: m.sender_email,
      content: m.content?.substring(0, 50),
      created_at: m.created_at,
    })))
    console.log('[ChatInterface] Current user role:', getCurrentUserRole())
    console.log('[ChatInterface] ======================================')
  }, [])

  const scrollToBottom = () => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Abonnement aux nouveaux messages en temps réel
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, supabase])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim() || !currentUser) {
      return
    }

    setLoading(true)

    try {
      const currentUserRole = getCurrentUserRole()
      console.log('[ChatInterface] Sending message:', {
        currentUserEmail: currentUser.email,
        currentUserRole,
        messageContent: newMessage.trim(),
      })

      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_email: currentUser.email!,
          content: newMessage.trim(),
        })

      if (error) {
        throw error
      }

      console.log('[ChatInterface] Message sent successfully')
      
      // Envoyer une notification email au destinataire
      try {
        await fetch('/api/send-message-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId,
            senderEmail: currentUser.email,
            messageContent: newMessage.trim(),
          }),
        })
        console.log('[ChatInterface] Notification email sent')
      } catch (emailError) {
        console.error('[ChatInterface] Error sending notification email:', emailError)
        // Ne pas bloquer l'envoi du message si l'email échoue
      }
      
      setNewMessage('')
    } catch (error) {
      console.error('[ChatInterface] Error sending message:', error)
      alert('Erreur lors de l\'envoi du message')
    } finally {
      setLoading(false)
    }
  }

  const getParticipantName = (email: string) => {
    const normalizedEmail = email?.toLowerCase().trim()
    const participant = participants.find(p => {
      const participantEmail = p.email?.toLowerCase().trim()
      return participantEmail === normalizedEmail
    })
    
    if (participant?.role === 'client' && bookingRequest) {
      return `${bookingRequest.first_name} ${bookingRequest.last_name}`
    }
    if (participant?.role === 'chef' && bookingRequest) {
      return 'Chef'
    }
    return email.split('@')[0]
  }

  const isOwnMessage = (message: Message) => {
    return currentUser?.email === message.sender_email
  }

  if (!currentUser) {
    return null
  }

  const handleSignOut = async () => {
    console.log('[ChatInterface] Signing out...')
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('[ChatInterface] Error signing out:', error)
      alert('Erreur lors de la déconnexion')
    } else {
      console.log('[ChatInterface] Signed out successfully')
      // Rediriger vers la page de login
      window.location.href = `/chat/${conversationId}/login`
    }
  }

  const currentUserRole = getCurrentUserRole()
  const currentUserName = currentUserRole === 'chef' 
    ? 'Chef' 
    : bookingRequest 
      ? `${bookingRequest.first_name} ${bookingRequest.last_name}`
      : currentUser?.email?.split('@')[0] || 'Utilisateur'

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      {/* Header - Fixe en haut */}
      <div className="flex-shrink-0 bg-[#FBCF03] border-b-2 border-black">
        <div className="px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-black hover:opacity-70 transition-opacity"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Retour</span>
            </button>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-xs sm:text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              title="Se déconnecter"
            >
              Déconnexion
            </button>
          </div>
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-black">
              {bookingRequest ? `Réservation du ${new Date(bookingRequest.booking_date).toLocaleDateString('fr-FR')}` : 'Conversation'}
            </h1>
            {bookingRequest && (
              <p className="text-xs sm:text-sm text-gray-700 mt-1">
                {bookingRequest.guests_count} {bookingRequest.guests_count === 1 ? 'convive' : 'convives'} • {bookingRequest.city}
              </p>
            )}
            <p className="text-xs text-gray-600 mt-1">
              Connecté en tant que : <span className="font-semibold">{currentUserName}</span> ({currentUserRole || 'inconnu'})
            </p>
          </div>
        </div>
      </div>

      {/* Accepted message banner - Fixe sous le header */}
      {showAcceptedMessage && (
        <div className="flex-shrink-0 bg-green-50 border-b-2 border-green-500 px-4 py-2 sm:px-6 sm:py-3">
          <p className="text-sm sm:text-base text-green-700 font-medium">
            ✓ Réservation acceptée ! Vous pouvez maintenant échanger.
          </p>
        </div>
      )}

      {/* Messages - Scrollable au milieu */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-3 sm:space-y-4 min-h-full flex flex-col justify-end">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <p className="text-sm sm:text-base">Aucun message pour le moment.</p>
              <p className="text-xs sm:text-sm mt-1">Commencez la conversation !</p>
            </div>
          ) : (
            <>
              {messages.map((message) => {
                const senderRole = getParticipantRole(message.sender_email)
                const isChefMessage = senderRole === 'chef'
                const isClientMessage = senderRole === 'client'
                
                // Logs pour chaque message
                console.log('[ChatInterface] Rendering message:', {
                  messageId: message.id,
                  senderEmail: message.sender_email,
                  senderRole,
                  isChefMessage,
                  isClientMessage,
                  currentUserEmail: currentUser?.email,
                  isOwn: isOwnMessage(message),
                })
                
                return (
                  <div
                    key={message.id}
                    className={`flex ${isChefMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 ${
                        isChefMessage
                          ? 'bg-black text-white rounded-br-sm'
                          : 'bg-[#FBCF03] text-black rounded-bl-sm border-2 border-black'
                      }`}
                    >
                      {/* Nom de l'expéditeur */}
                      <div className={`text-xs font-medium mb-1 opacity-80 ${
                        isChefMessage ? 'text-white' : 'text-black'
                      }`}>
                        {getParticipantName(message.sender_email)}
                      </div>
                      
                      {/* Contenu du message */}
                      <div className={`text-sm sm:text-base whitespace-pre-wrap break-words leading-relaxed ${
                        isChefMessage ? 'text-white' : 'text-black'
                      }`}>
                        {message.content}
                      </div>
                      
                      {/* Heure */}
                      <div className={`text-xs opacity-60 mt-1 ${
                        isChefMessage ? 'text-white' : 'text-black'
                      }`}>
                        {new Date(message.created_at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input - Fixe en bas */}
      <div className="flex-shrink-0 border-t-2 border-gray-200 bg-white safe-area-inset-bottom">
        <form onSubmit={handleSendMessage} className="p-3 sm:p-4">
          <div className="flex gap-2 sm:gap-3 items-end">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Tapez votre message..."
              disabled={loading}
              className="flex-1 px-4 py-2.5 sm:py-3 text-base sm:text-base border-2 border-gray-300 rounded-full focus:outline-none focus:border-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white"
              style={{
                minHeight: '44px',
              }}
            />
            <button
              type="submit"
              disabled={loading || !newMessage.trim()}
              className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              style={{
                minHeight: '44px',
                minWidth: '44px',
              }}
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

