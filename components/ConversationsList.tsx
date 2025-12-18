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
      {/* Header fixe */}
      <div className="sticky top-0 z-10 bg-white border-b-2 border-black">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-black">Mes conversations</h1>
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Déconnexion
            </button>
          </div>

          {/* Filtres mobile-first */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            <button
              onClick={() => setFilter('all')}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Toutes
            </button>
            <button
              onClick={() => setFilter('ongoing')}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === 'ongoing'
                  ? 'bg-[#FBCF03] text-black'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              En cours
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === 'pending'
                  ? 'bg-gray-200 text-gray-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              En attente
            </button>
            <button
              onClick={() => setFilter('closed')}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === 'closed'
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Terminées
            </button>
          </div>
        </div>
      </div>

      {/* Liste des conversations */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        {filteredConversations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Aucune conversation {filter !== 'all' ? getStatusLabel(filter as ConversationStatus).toLowerCase() : ''}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredConversations.map((conversation) => {
              const otherParticipant = getOtherParticipantInfo(conversation)
              const isCurrentUserChef = conversation.participants.find(
                p => p.email.toLowerCase() === currentUser.email?.toLowerCase()
              )?.role === 'chef'
              
              return (
                <button
                  key={conversation.id}
                  onClick={() => router.push(`/chat/${conversation.id}`)}
                  className="group relative w-full bg-white rounded-2xl overflow-hidden border-2 border-gray-100 hover:border-black transition-all duration-300 hover:shadow-xl"
                >
                  {/* Header avec gradient */}
                  <div className={`relative h-32 ${otherParticipant.isChef ? 'bg-gradient-to-br from-black to-gray-800' : 'bg-gradient-to-br from-[#FBCF03] to-yellow-400'}`}>
                    {/* Badge de statut en haut à droite */}
                    <div className="absolute top-3 right-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${
                        conversation.status === 'ongoing' 
                          ? 'bg-[#FBCF03]/90 text-black' 
                          : conversation.status === 'pending'
                          ? 'bg-white/90 text-gray-700'
                          : 'bg-gray-100/90 text-gray-500'
                      }`}>
                        {getStatusLabel(conversation.status)}
                      </span>
                    </div>
                    
                    {/* Nom de l'autre participant en gros */}
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          otherParticipant.isChef 
                            ? 'bg-white/20 text-white backdrop-blur-sm' 
                            : 'bg-black/20 text-black backdrop-blur-sm'
                        }`}>
                          {otherParticipant.isChef ? '👨‍🍳 Chef' : '👤 Client'}
                        </span>
                      </div>
                      <h3 className={`text-2xl sm:text-3xl font-bold ${
                        otherParticipant.isChef ? 'text-white' : 'text-black'
                      }`}>
                        {otherParticipant.name}
                      </h3>
                    </div>
                  </div>
                  
                  {/* Contenu de la carte */}
                  <div className="p-4">
                    {conversation.bookingRequest && (
                      <div className="mb-3 space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>📅</span>
                          <span className="font-medium">
                            {new Date(conversation.bookingRequest.booking_date).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <span>📍</span>
                            <span>{conversation.bookingRequest.city}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>👥</span>
                            <span>{conversation.bookingRequest.guests_count} {conversation.bookingRequest.guests_count === 1 ? 'convive' : 'convives'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {conversation.lastMessage ? (
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                          {conversation.lastMessage.content}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(conversation.lastMessage.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    ) : (
                      <div className="pt-3 border-t border-gray-100">
                        <p className="text-sm text-gray-400 italic">Aucun message pour le moment</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Effet hover */}
                  <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

