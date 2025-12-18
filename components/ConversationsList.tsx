'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type ConversationStatus = 'ongoing' | 'pending' | 'closed'

interface Conversation {
  id: string
  status: ConversationStatus
  bookingRequest: {
    id?: string
    status?: string
    first_name?: string
    last_name?: string
    booking_date?: string
    city?: string
    guests_count?: number
    chef_id?: string
    chefName?: string | null
    menuPrice?: number | null
    extras?: Array<{ name: string; price: number }>
    totalPrice?: number
  } | null
  participants: Array<{ email: string; role: string }>
  lastMessage: { content: string; created_at: string; sender_email: string } | null
  updatedAt: string
}

interface ConversationsListProps {
  conversations: Conversation[]
  currentUser: User
  participantsMap?: Map<string, Array<{ email: string; role: string }>>
}

export default function ConversationsList({ conversations, currentUser, participantsMap }: ConversationsListProps) {
  const router = useRouter()
  const supabase = createClient()
  const [filter, setFilter] = useState<ConversationStatus | 'all'>('all')

  console.log('[ConversationsList] ========== COMPONENT RENDER ==========')
  console.log('[ConversationsList] Props received:', {
    conversationsCount: conversations.length,
    currentUserEmail: currentUser.email,
    currentUserId: currentUser.id,
    participantsMapSize: participantsMap?.size || 0,
  })
  console.log('[ConversationsList] Conversations received:', conversations.map(c => ({
    id: c.id,
    status: c.status,
    hasBookingRequest: !!c.bookingRequest,
    bookingRequestStatus: c.bookingRequest?.status || 'none',
    participantsCount: c.participants.length,
    hasLastMessage: !!c.lastMessage,
  })))

  const filteredConversations = filter === 'all'
    ? conversations
    : conversations.filter(c => c.status === filter)
  
  console.log('[ConversationsList] Filter:', filter)
  console.log('[ConversationsList] Total conversations:', conversations.length)
  console.log('[ConversationsList] Filtered conversations:', filteredConversations.length)
  console.log('[ConversationsList] Conversations by status:', {
    all: conversations.length,
    ongoing: conversations.filter(c => c.status === 'ongoing').length,
    pending: conversations.filter(c => c.status === 'pending').length,
    closed: conversations.filter(c => c.status === 'closed').length,
  })
  console.log('[ConversationsList] Filtered conversations details:', filteredConversations.map(c => ({
    id: c.id,
    status: c.status,
  })))
  console.log('[ConversationsList] ========== END COMPONENT RENDER ==========')

  const getStatusLabel = (status: ConversationStatus) => {
    switch (status) {
      case 'ongoing':
        return 'En cours'
      case 'pending':
        return 'En attente'
      case 'closed':
        return 'Terminée'
    }
  }

  const getStatusColor = (status: ConversationStatus) => {
    switch (status) {
      case 'ongoing':
        return 'bg-[#FBCF03] text-black'
      case 'pending':
        return 'bg-gray-200 text-gray-700'
      case 'closed':
        return 'bg-gray-100 text-gray-500'
    }
  }

  const getOtherParticipantInfo = (conversation: Conversation) => {
    const otherParticipant = conversation.participants.find(
      p => p.email.toLowerCase() !== currentUser.email?.toLowerCase()
    )
    
    if (!otherParticipant) {
      return { name: 'Utilisateur', role: 'unknown', isChef: false }
    }
    
    const isChef = otherParticipant.role === 'chef'
    const isClient = otherParticipant.role === 'client'
    
    if (isClient && conversation.bookingRequest) {
      return {
        name: `${conversation.bookingRequest.first_name} ${conversation.bookingRequest.last_name}`,
        role: 'client',
        isChef: false,
      }
    }
    
    if (isChef) {
      // Récupérer le nom du chef depuis bookingRequest.chefName
      const chefName = conversation.bookingRequest?.chefName || 'Chef'
      console.log('[ConversationsList] Chef name for conversation:', {
        conversationId: conversation.id,
        chefName,
        hasBookingRequest: !!conversation.bookingRequest,
        bookingRequestChefName: conversation.bookingRequest?.chefName,
      })
      return {
        name: chefName,
        role: 'chef',
        isChef: true,
      }
    }
    
    return {
      name: otherParticipant.email.split('@')[0] || 'Utilisateur',
      role: otherParticipant.role,
      isChef: false,
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Bannière jaune avec logo */}
      <div className="bg-[#FBCF03] border-b-2 border-black">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-center">
            <img 
              src="/logo-banner.jpeg" 
              alt="MyTable" 
              className="h-12 sm:h-14 w-auto object-contain"
            />
          </div>
        </div>
      </div>

      {/* Header fixe */}
      <div className="sticky top-0 z-10 bg-white/98 backdrop-blur-md border-b border-gray-200/60 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-semibold text-black">Messages</h1>
            <button
              onClick={handleSignOut}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100/60 rounded-lg transition-all"
              title="Se déconnecter"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>

          {/* Filtres subtils */}
          <div className="flex gap-2 pb-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-3.5 py-1.5 text-sm font-medium transition-all rounded-lg ${
                filter === 'all'
                  ? 'text-black bg-gray-100'
                  : 'text-gray-500 hover:text-black hover:bg-gray-50'
              }`}
            >
              Toutes
            </button>
            <button
              onClick={() => setFilter('ongoing')}
              className={`px-3.5 py-1.5 text-sm font-medium transition-all rounded-lg ${
                filter === 'ongoing'
                  ? 'text-black bg-gray-100'
                  : 'text-gray-500 hover:text-black hover:bg-gray-50'
              }`}
            >
              En cours
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3.5 py-1.5 text-sm font-medium transition-all rounded-lg ${
                filter === 'pending'
                  ? 'text-black bg-gray-100'
                  : 'text-gray-500 hover:text-black hover:bg-gray-50'
              }`}
            >
              En attente
            </button>
            <button
              onClick={() => setFilter('closed')}
              className={`px-3.5 py-1.5 text-sm font-medium transition-all rounded-lg ${
                filter === 'closed'
                  ? 'text-black bg-gray-100'
                  : 'text-gray-500 hover:text-black hover:bg-gray-50'
              }`}
            >
              Terminées
            </button>
          </div>
        </div>
      </div>

      {/* Liste des conversations - style premium Instagram/WhatsApp */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-2">
        {filteredConversations.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 text-sm">Aucune conversation {filter !== 'all' ? getStatusLabel(filter as ConversationStatus).toLowerCase() : ''}.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredConversations.map((conversation) => {
              const otherParticipant = getOtherParticipantInfo(conversation)
              const isActive = conversation.status === 'ongoing'
              
              // Format date pour meta
              const eventDate = conversation.bookingRequest?.booking_date
                ? new Date(conversation.bookingRequest.booking_date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                  })
                : null
              
              // Format dernier message
              const lastMessagePreview = conversation.lastMessage
                ? conversation.lastMessage.content.trim()
                : null
              
              return (
                <button
                  key={conversation.id}
                  onClick={() => router.push(`/chat/${conversation.id}`)}
                  className={`w-full px-4 py-3.5 rounded-xl transition-all text-left ${
                    isActive 
                      ? 'bg-gray-50/80 hover:bg-gray-100/80 shadow-sm' 
                      : 'bg-white hover:bg-gray-50/60 shadow-sm hover:shadow'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar - cercle avec initiales */}
                    <div className="flex-shrink-0 w-14 h-14 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center shadow-sm">
                      <span className="text-base font-semibold text-gray-700">
                        {otherParticipant.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    
                    {/* Contenu principal */}
                    <div className="flex-1 min-w-0">
                      {/* Ligne 1: Nom + Badge statut + Prix */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <h3 className="text-[15px] font-semibold text-black truncate">
                            {otherParticipant.name}
                          </h3>
                          {/* Badge statut */}
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            conversation.status === 'ongoing'
                              ? 'bg-[#FBCF03]/20 text-[#FBCF03]'
                              : conversation.status === 'pending'
                              ? 'bg-gray-200 text-gray-600'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {getStatusLabel(conversation.status)}
                          </span>
                        </div>
                        {/* Prix aligné à droite */}
                        {conversation.bookingRequest?.totalPrice !== undefined && conversation.bookingRequest.totalPrice > 0 && (
                          <p className="text-sm font-semibold text-black whitespace-nowrap">
                            {conversation.bookingRequest.totalPrice.toFixed(2)} €
                          </p>
                        )}
                      </div>
                      
                      {/* Ligne 2: Dernier message */}
                      {lastMessagePreview ? (
                        <p className="text-sm text-gray-500 line-clamp-1 mb-1.5">
                          {lastMessagePreview}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400 italic mb-1.5">Aucun message</p>
                      )}
                      
                      {/* Ligne 3: Meta info (Date + Convives) */}
                      {conversation.bookingRequest && (
                        <div className="flex items-center gap-1.5">
                          {eventDate && (
                            <p className="text-xs text-gray-400">
                              {eventDate}
                            </p>
                          )}
                          {conversation.bookingRequest.guests_count && (
                            <>
                              {eventDate && <span className="text-xs text-gray-300">•</span>}
                              <p className="text-xs text-gray-400">
                                {conversation.bookingRequest.guests_count} {conversation.bookingRequest.guests_count === 1 ? 'convive' : 'convives'}
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

