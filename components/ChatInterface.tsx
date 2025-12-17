'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

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
  const [authLoading, setAuthLoading] = useState(!currentUser)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!currentUser) {
      // Si l'utilisateur n'est pas connecté, essayer de récupérer l'email depuis les participants
      const userEmail = participants.find(p => p.role === 'client')?.email || 
                       participants.find(p => p.role === 'chef')?.email

      if (userEmail) {
        // Envoyer un magic link
        handleMagicLink(userEmail)
      }
    }
  }, [currentUser, participants])

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

  const handleMagicLink = async (email: string) => {
    setAuthLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/chat/${conversationId}`,
        },
      })

      if (error) {
        console.error('Error sending magic link:', error)
        alert('Erreur lors de l\'envoi du lien de connexion')
      } else {
        alert('Un lien de connexion a été envoyé à votre email')
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim() || !currentUser) {
      return
    }

    setLoading(true)

    try {
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

      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Erreur lors de l\'envoi du message')
    } finally {
      setLoading(false)
    }
  }

  const getParticipantName = (email: string) => {
    const participant = participants.find(p => p.email === email)
    if (participant?.role === 'client' && bookingRequest) {
      return `${bookingRequest.first_name} ${bookingRequest.last_name}`
    }
    if (participant?.role === 'chef' && bookingRequest) {
      // On pourrait récupérer le nom du chef depuis la DB, pour l'instant on utilise l'email
      return 'Chef'
    }
    return email.split('@')[0]
  }

  const isOwnMessage = (message: Message) => {
    return currentUser?.email === message.sender_email
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Envoi du lien de connexion...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-black mb-4">Connexion requise</h1>
          <p className="text-gray-600 mb-6">
            Un lien de connexion a été envoyé à votre email. Vérifiez votre boîte de réception.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-[#FBCF03] px-6 py-4 border-b-2 border-black">
        <h1 className="text-xl font-bold text-black">
          Chat - {bookingRequest ? `Réservation du ${new Date(bookingRequest.booking_date).toLocaleDateString('fr-FR')}` : 'Conversation'}
        </h1>
        {bookingRequest && (
          <p className="text-sm text-gray-700 mt-1">
            {bookingRequest.guests_count} {bookingRequest.guests_count === 1 ? 'convive' : 'convives'} - {bookingRequest.city}
          </p>
        )}
      </div>

      {/* Accepted message banner */}
      {showAcceptedMessage && (
        <div className="bg-green-50 border-b-2 border-green-500 px-6 py-3">
          <p className="text-green-700 font-medium">
            ✓ Réservation acceptée ! Vous pouvez maintenant échanger avec le chef.
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            Aucun message pour le moment. Commencez la conversation !
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${isOwnMessage(message) ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  isOwnMessage(message)
                    ? 'bg-black text-white'
                    : 'bg-white border-2 border-gray-300 text-black'
                }`}
              >
                <div className="text-xs opacity-70 mb-1">
                  {getParticipantName(message.sender_email)}
                </div>
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className="text-xs opacity-70 mt-1">
                  {new Date(message.created_at).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="border-t-2 border-gray-300 bg-white p-4">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Tapez votre message..."
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !newMessage.trim()}>
            Envoyer
          </Button>
        </div>
      </form>
    </div>
  )
}

