'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useTranslation } from '@/hooks/useTranslation'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { formatDateForDisplay } from '@/lib/dateUtils'

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
    budget?: number | string | null // Pour cours_cuisine
    total_price?: number | string | null // Pour mise_en_demeure
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
  const { t } = useTranslation()
  const [filter, setFilter] = useState<ConversationStatus | 'all'>('all')
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

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
        return t('dashboard.statusOngoing')
      case 'pending':
        return t('dashboard.statusPending')
      case 'closed':
        return t('dashboard.statusClosed')
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

  const handleSignOut = () => {
    setShowLogoutConfirm(true)
  }

  const confirmSignOut = async () => {
    setShowLogoutConfirm(false)
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Déterminer le rôle de l'utilisateur (chef ou client)
  // Si l'utilisateur a le rôle "chef" dans au moins une conversation, c'est un chef
  const getUserRole = (): 'chef' | 'client' => {
    const userEmail = currentUser.email?.toLowerCase().trim()
    if (!userEmail) return 'client'
    
    // Vérifier dans toutes les conversations
    for (const conversation of conversations) {
      const userParticipant = conversation.participants.find(
        p => p.email.toLowerCase().trim() === userEmail
      )
      if (userParticipant?.role === 'chef') {
        return 'chef'
      }
    }
    return 'client'
  }

  const currentUserRole = getUserRole()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header fixe (sticky) - Premium et compact */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        {/* Mobile: max-w-2xl, Desktop: max-w-7xl avec layout 2 colonnes */}
        <div className="max-w-2xl lg:max-w-7xl mx-auto">
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
          <div className="px-4 sm:px-6 lg:px-8 relative">
            {/* Desktop: Sélecteur de langue et bouton déconnexion en haut à droite */}
            <div className="hidden lg:flex absolute top-4 right-8 items-center gap-3 z-10">
              <LanguageSwitcher />
              <button
                onClick={handleSignOut}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                title={t('auth.logout')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>

            {/* Mobile: vertical stack, Desktop: horizontal avec titre + tabs alignés */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between h-auto lg:h-16 gap-3 lg:gap-0">
              <div className="flex items-center justify-between h-14 lg:h-auto">
                <h1 className="text-lg font-semibold text-gray-900 tracking-tight">{t('dashboard.title')}</h1>
                <div className="flex items-center gap-2 lg:hidden">
                  <LanguageSwitcher />
                  <button
                    onClick={handleSignOut}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                    title={t('auth.logout')}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Filtres - Mobile: sous le titre, Desktop: alignés horizontalement avec le titre - Espacés du bouton déconnexion */}
              <div className="flex gap-1.5 pb-3.5 lg:pb-0 lg:ml-6 lg:mr-20">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 lg:px-4 lg:py-2 text-xs lg:text-sm font-medium transition-all rounded-md ${
                    filter === 'all'
                      ? 'text-gray-900 bg-gray-100 lg:bg-gray-200'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 lg:hover:bg-gray-100'
                  }`}
                >
                  {t('dashboard.filterAll')}
                </button>
                <button
                  onClick={() => setFilter('ongoing')}
                  className={`px-3 py-1.5 lg:px-4 lg:py-2 text-xs lg:text-sm font-medium transition-all rounded-md ${
                    filter === 'ongoing'
                      ? 'text-gray-900 bg-gray-100 lg:bg-gray-200'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 lg:hover:bg-gray-100'
                  }`}
                >
                  {t('dashboard.filterOngoing')}
                </button>
                <button
                  onClick={() => setFilter('pending')}
                  className={`px-3 py-1.5 lg:px-4 lg:py-2 text-xs lg:text-sm font-medium transition-all rounded-md ${
                    filter === 'pending'
                      ? 'text-gray-900 bg-gray-100 lg:bg-gray-200'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 lg:hover:bg-gray-100'
                  }`}
                >
                  {t('dashboard.filterPending')}
                </button>
                <button
                  onClick={() => setFilter('closed')}
                  className={`px-3 py-1.5 lg:px-4 lg:py-2 text-xs lg:text-sm font-medium transition-all rounded-md ${
                    filter === 'closed'
                      ? 'text-gray-900 bg-gray-100 lg:bg-gray-200'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 lg:hover:bg-gray-100'
                  }`}
                >
                  {t('dashboard.filterClosed')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Liste des conversations - Desktop: layout 2 colonnes avec panneau d'aide */}
      <main className="max-w-2xl lg:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Desktop: Container 2 colonnes */}
        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-8">
          {/* Colonne gauche: Liste des conversations */}
          <div className="lg:min-w-0">
            {filteredConversations.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-sm text-gray-400">
                  {t('dashboard.noConversations')} {filter !== 'all' ? getStatusLabel(filter as ConversationStatus).toLowerCase() : ''}.
                </p>
              </div>
            ) : (
              <div className="space-y-3 lg:space-y-2">
                {filteredConversations.map((conversation) => {
                  const otherParticipant = getOtherParticipantInfo(conversation)
                  
                  // Format date pour meta
                  const eventDate = conversation.bookingRequest?.booking_date
                    ? formatDateForDisplay(conversation.bookingRequest.booking_date, 'fr-FR', {
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
                      className="w-full bg-white rounded-2xl lg:rounded-xl p-4 lg:p-3.5 text-left transition-all border border-gray-100 hover:border-gray-200 active:scale-[0.99] lg:hover:bg-gray-50/50 lg:cursor-pointer lg:hover:shadow-sm"
                    >
                      <div className="flex items-start gap-3 lg:gap-3.5">
                        {/* Avatar - Desktop: légèrement plus petit */}
                        <div className="flex-shrink-0 w-12 h-12 lg:w-11 lg:h-11 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                          <span className="text-sm lg:text-xs font-medium text-gray-600">
                            {(otherParticipant as any).firstName 
                              ? (otherParticipant as any).firstName.charAt(0).toUpperCase()
                              : otherParticipant.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        
                        {/* Contenu principal - Desktop: layout optimisé */}
                        <div className="flex-1 min-w-0 lg:flex lg:items-center lg:justify-between lg:gap-4">
                          {/* Colonne gauche: Nom, message, meta */}
                          <div className="flex-1 min-w-0">
                            {/* Ligne 1: Badge type de service (chef uniquement) + Nom + Badge statut - Desktop: alignement horizontal amélioré */}
                            <div className="flex items-center gap-2 mb-1.5 lg:mb-1 flex-wrap">
                              {/* Badge type de service - Visible uniquement côté chef, placé en premier pour plus de visibilité */}
                              {currentUserRole === 'chef' && conversation.bookingRequest?.service_type && (() => {
                                const getServiceTypeLabel = (type: string) => {
                                  switch (type) {
                                    case 'repas_domicile':
                                      return t('booking.serviceType.repas_domicile')
                                    case 'cours_cuisine':
                                      return t('booking.serviceType.cours_cuisine')
                                    case 'mise_en_demeure':
                                      return t('booking.serviceType.mise_en_demeure')
                                    default:
                                      return type
                                  }
                                }
                                return (
                                  <span className="flex-shrink-0 px-2 py-0.5 lg:px-1.5 lg:py-0.5 rounded-md text-[10px] lg:text-[11px] font-medium leading-tight bg-gray-100 text-gray-700 border border-gray-200">
                                    {getServiceTypeLabel(conversation.bookingRequest.service_type)}
                                  </span>
                                )
                              })()}
                              <h3 className="text-[15px] lg:text-base font-semibold text-gray-900 truncate">
                                {otherParticipant.name}
                              </h3>
                              {/* Badge statut - Desktop: plus compact */}
                              <span className={`flex-shrink-0 px-2 py-0.5 lg:px-1.5 lg:py-0.5 rounded-md text-[10px] lg:text-[11px] font-medium leading-tight ${
                                conversation.status === 'ongoing'
                                  ? 'bg-[#FBCF03]/10 text-[#E6BA00]'
                                  : conversation.status === 'pending'
                                  ? 'bg-gray-100 text-gray-500'
                                  : 'bg-gray-50 text-gray-400'
                              }`}>
                                {getStatusLabel(conversation.status)}
                              </span>
                            </div>
                            
                            {/* Ligne 2: Dernier message - Desktop: line-clamp-1 pour plus de densité */}
                            {lastMessagePreview ? (
                              <p className="text-sm lg:text-sm text-gray-500 line-clamp-2 lg:line-clamp-1 mb-2 lg:mb-1 leading-relaxed">
                                {lastMessagePreview}
                              </p>
                            ) : (
                              <p className="text-sm lg:text-sm text-gray-400 italic mb-2 lg:mb-1">{t('dashboard.noMessages')}</p>
                            )}
                            
                            {/* Ligne 3: Meta info - Desktop: plus compact */}
                            {conversation.bookingRequest && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {eventDate && (
                                  <span className="text-xs lg:text-xs text-gray-400">
                                    {eventDate}
                                  </span>
                                )}
                                {conversation.bookingRequest.guests_count && (
                                  <>
                                    {eventDate && <span className="text-xs text-gray-300">·</span>}
                                    <span className="text-xs lg:text-xs text-gray-400">
                                      {conversation.bookingRequest.guests_count} {conversation.bookingRequest.guests_count === 1 ? t('booking.guest') : t('booking.guests_plural')}
                                      {(conversation.bookingRequest.children_count ?? 0) > 0 && (
                                        <span className="text-gray-400 ml-0.5">
                                          ({(conversation.bookingRequest.children_count ?? 0)} {(conversation.bookingRequest.children_count ?? 0) === 1 ? t('booking.child') : t('booking.children_plural')})
                                        </span>
                                      )}
                                    </span>
                                  </>
                                )}
                                {conversation.bookingRequest.city && (
                                  <>
                                    {(eventDate || conversation.bookingRequest.guests_count) && <span className="text-xs text-gray-300">·</span>}
                                    <span className="text-xs lg:text-xs text-gray-400">
                                      {conversation.bookingRequest.city}
                                    </span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          
                          {/* Colonne droite: Prix - Desktop: aligné à droite, plus visible */}
                          {(() => {
                            // Calculer ou récupérer le prix selon le type de service
                            let displayPrice: number | null = null
                            
                            if (conversation.bookingRequest?.totalPrice !== undefined && conversation.bookingRequest.totalPrice !== null) {
                              displayPrice = conversation.bookingRequest.totalPrice
                            } else if (conversation.bookingRequest?.service_type === 'cours_cuisine' && conversation.bookingRequest?.budget !== undefined && conversation.bookingRequest.budget !== null) {
                              // Pour cours de cuisine, utiliser le budget
                              displayPrice = typeof conversation.bookingRequest.budget === 'number' 
                                ? conversation.bookingRequest.budget 
                                : parseFloat(conversation.bookingRequest.budget) || 0
                            } else if (conversation.bookingRequest?.service_type === 'mise_en_demeure' && conversation.bookingRequest?.total_price !== undefined && conversation.bookingRequest.total_price !== null) {
                              // Pour chef à demeure, utiliser total_price
                              displayPrice = typeof conversation.bookingRequest.total_price === 'number'
                                ? conversation.bookingRequest.total_price
                                : parseFloat(conversation.bookingRequest.total_price) || 0
                            }
                            
                            return displayPrice !== null && displayPrice >= 0 ? (
                              <div className="flex-shrink-0 lg:flex lg:flex-col lg:items-end lg:justify-center">
                                <p className="text-xs lg:text-sm font-semibold text-gray-900 whitespace-nowrap">
                                  {displayPrice.toFixed(0)} €
                                </p>
                              </div>
                            ) : null
                          })()}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          
          {/* Colonne droite: Panneau d'aide contextuel (Desktop uniquement) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Logo MyTable - subtil */}
                <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                  <div className="flex items-center justify-center">
                    <img 
                      src="/logo-cercle.png" 
                      alt="MyTable" 
                      className="h-8 w-8 object-contain opacity-60"
                    />
                  </div>
                </div>
                
                {/* Contenu selon le rôle */}
                <div className="px-6 py-6 space-y-6">
                  {currentUserRole === 'chef' ? (
                    <div>
                      {/* VUE CHEF */}
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        {t('helper.chef.title')}
                      </h2>
                      
                      {/* Section 1: Respond quickly */}
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">
                          {t('helper.chef.respondQuickly.title')}
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {t('helper.chef.respondQuickly.description')}
                        </p>
                      </div>
                      
                      {/* Section 2: Use the Menu button */}
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">
                          {t('helper.chef.useMenuButton.title')}
                        </h3>
                        {/* Réplique du bouton Menu (non-cliquable, visuel uniquement) */}
                        <div className="mb-3">
                          <button
                            disabled
                            className="w-full px-4 py-2.5 text-sm font-semibold text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 rounded-xl transition-all duration-150 shadow-sm cursor-default"
                            style={{ pointerEvents: 'none' }}
                          >
                            {t('booking.menu')}
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {t('helper.chef.useMenuButton.description')}
                        </p>
                      </div>
                      
                      {/* Section 3: Guests & children */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">
                          {t('helper.chef.guestsAndChildren.title')}
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {t('helper.chef.guestsAndChildren.description')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* VUE CLIENT */}
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        {t('helper.client.title')}
                      </h2>
                      
                      {/* Section 1: Menu availability */}
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">
                          {t('helper.client.menuAvailable.title')}
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {t('helper.client.menuAvailable.description')}
                        </p>
                      </div>
                      
                      {/* Section 2: Extras */}
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">
                          {t('helper.client.extras.title')}
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {t('helper.client.extras.description')}
                        </p>
                      </div>
                      
                      {/* Section 3: Guests management */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">
                          {t('helper.client.guestsManagement.title')}
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {t('helper.client.guestsManagement.description')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Popup de confirmation de déconnexion */}
      {showLogoutConfirm && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t('auth.logoutConfirm')}
              </h3>
              <p className="text-sm text-gray-600">
                {t('auth.logoutMessage')}
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmSignOut}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
              >
                {t('auth.logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

