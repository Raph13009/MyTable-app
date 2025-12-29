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
    children_count?: number
    chef_id?: string
    chefName?: string | null
    menuPrice?: number | null
    extras?: Array<{ name: string; price: number }>
    totalPrice?: number
    service_type?: 'repas_domicile' | 'cours_cuisine' | 'mise_en_demeure'
    period_days?: string | null
    meal_time?: 'dejeuner' | 'diner' | null
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
      // Extraire le prénom (premier mot) pour l'initiale
      const chefFirstName = chefName.split(' ')[0] || chefName
      console.log('[ConversationsList] Chef name for conversation:', {
        conversationId: conversation.id,
        chefName,
        chefFirstName,
        hasBookingRequest: !!conversation.bookingRequest,
        bookingRequestChefName: conversation.bookingRequest?.chefName,
      })
      return {
        name: chefName,
        firstName: chefFirstName, // Stocker le prénom séparément pour l'initiale
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
    <div className="min-h-screen bg-gray-50">
      {/* Header fixe (sticky) - Premium et compact */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto">
          {/* Bannière jaune compacte */}
          <div className="bg-[#FBCF03] border-b border-black/10">
            <div className="px-4 sm:px-6 py-2.5">
              <div className="flex items-center justify-center">
                <img 
                  src="/logo-banner.jpeg" 
                  alt="MyTable" 
                  className="h-10 sm:h-12 w-auto object-contain"
                />
              </div>
            </div>
          </div>

          {/* Header principal avec titre et actions */}
          <div className="px-4 sm:px-6">
            <div className="flex items-center justify-between h-14">
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Messages</h1>
              <button
                onClick={handleSignOut}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                title="Se déconnecter"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>

            {/* Filtres subtils et élégants */}
            <div className="flex gap-1.5 pb-3.5">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium transition-all rounded-md ${
                  filter === 'all'
                    ? 'text-gray-900 bg-gray-100'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                Toutes
              </button>
              <button
                onClick={() => setFilter('ongoing')}
                className={`px-3 py-1.5 text-xs font-medium transition-all rounded-md ${
                  filter === 'ongoing'
                    ? 'text-gray-900 bg-gray-100'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                En cours
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-3 py-1.5 text-xs font-medium transition-all rounded-md ${
                  filter === 'pending'
                    ? 'text-gray-900 bg-gray-100'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                En attente
              </button>
              <button
                onClick={() => setFilter('closed')}
                className={`px-3 py-1.5 text-xs font-medium transition-all rounded-md ${
                  filter === 'closed'
                    ? 'text-gray-900 bg-gray-100'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                Terminées
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Liste des conversations - commence EN DESSOUS du header */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {filteredConversations.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-gray-400">
              Aucune conversation {filter !== 'all' ? getStatusLabel(filter as ConversationStatus).toLowerCase() : ''}.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConversations.map((conversation) => {
              const otherParticipant = getOtherParticipantInfo(conversation)
              
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
                  className="w-full bg-white rounded-2xl p-4 text-left transition-all hover:shadow-sm border border-gray-100 hover:border-gray-200 active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar - minimal et élégant */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {(otherParticipant as any).firstName 
                          ? (otherParticipant as any).firstName.charAt(0).toUpperCase()
                          : otherParticipant.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    
                    {/* Contenu principal */}
                    <div className="flex-1 min-w-0">
                      {/* Ligne 1: Nom + Badge statut */}
                      <div className="flex items-start justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <h3 className="text-[15px] font-semibold text-gray-900 truncate">
                            {otherParticipant.name}
                          </h3>
                          {/* Badge statut - subtil */}
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-medium leading-tight ${
                            conversation.status === 'ongoing'
                              ? 'bg-[#FBCF03]/10 text-[#E6BA00]'
                              : conversation.status === 'pending'
                              ? 'bg-gray-100 text-gray-500'
                              : 'bg-gray-50 text-gray-400'
                          }`}>
                            {getStatusLabel(conversation.status)}
                          </span>
                        </div>
                        {/* Prix - visuellement secondaire */}
                        {conversation.bookingRequest?.totalPrice !== undefined && conversation.bookingRequest.totalPrice > 0 && (
                          <p className="text-xs font-medium text-gray-400 whitespace-nowrap flex-shrink-0">
                            {conversation.bookingRequest.totalPrice.toFixed(0)} €
                          </p>
                        )}
                      </div>
                      
                      {/* Ligne 2: Dernier message */}
                      {lastMessagePreview ? (
                        <p className="text-sm text-gray-500 line-clamp-2 mb-2 leading-relaxed">
                          {lastMessagePreview}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-400 italic mb-2">Aucun message</p>
                      )}
                      
                      {/* Ligne 3: Meta info (Date + Convives + Ville) - subtile */}
                      {conversation.bookingRequest && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {eventDate && (
                            <span className="text-xs text-gray-400">
                              {eventDate}
                            </span>
                          )}
                          {conversation.bookingRequest.guests_count && (
                            <>
                              {eventDate && <span className="text-xs text-gray-300">·</span>}
                              <span className="text-xs text-gray-400">
                                {conversation.bookingRequest.guests_count} {conversation.bookingRequest.guests_count === 1 ? 'convive' : 'convives'}
                                {(conversation.bookingRequest.children_count ?? 0) > 0 && (
                                  <span className="text-gray-400 ml-0.5">
                                    ({(conversation.bookingRequest.children_count ?? 0)} {(conversation.bookingRequest.children_count ?? 0) === 1 ? 'enfant' : 'enfants'})
                                  </span>
                                )}
                              </span>
                            </>
                          )}
                          {conversation.bookingRequest.city && (
                            <>
                              {(eventDate || conversation.bookingRequest.guests_count) && <span className="text-xs text-gray-300">·</span>}
                              <span className="text-xs text-gray-400">
                                {conversation.bookingRequest.city}
                              </span>
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
      </main>
    </div>
  )
}

