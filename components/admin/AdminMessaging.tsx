'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateForDisplay, parseDateFromDB } from '@/lib/dateUtils'

/** Demandes toujours en pending dont la création date de plus de 6h (chef n’a pas répondu à temps). */
const PENDING_NO_RESPONSE_HOURS = 6

function isExpiredPendingNoResponse(bookingRequest?: {
  status: string
  created_at?: string
} | null): boolean {
  if (!bookingRequest || bookingRequest.status !== 'pending') return false
  if (!bookingRequest.created_at) return false
  const created = new Date(bookingRequest.created_at)
  if (Number.isNaN(created.getTime())) return false
  const cutoff = Date.now() - PENDING_NO_RESPONSE_HOURS * 60 * 60 * 1000
  return created.getTime() <= cutoff
}

/** Statut « effectif » affiché : une mission expirée (DB ou trop vieille) est toujours 'expired'. */
function getEffectiveStatus(bookingRequest?: {
  status: string
  created_at?: string
} | null): string | null {
  if (!bookingRequest) return null
  if (bookingRequest.status === 'expired') return 'expired'
  if (isExpiredPendingNoResponse(bookingRequest)) return 'expired'
  return bookingRequest.status
}

interface Conversation {
  id: string
  booking_request_id: string | null
  created_at: string
  updated_at: string
  bookingRequest?: {
    id: string
    status: string
    created_at?: string
    first_name: string
    last_name: string
    email: string
    booking_date: string
    city: string
    guests_count: number
    chef_id: string
    chefName?: string
    chefProfilePicture?: string | null
  }
  lastMessage?: {
    content: string
    created_at: string
    sender_email: string
  }
}

export default function AdminMessaging() {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchConversations()
  }, [])

  const fetchConversations = async () => {
    try {
      setLoading(true)
      
      // Utiliser l'API route pour récupérer les conversations avec les noms
      const response = await fetch('/api/admin/conversations')
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des conversations')
      }
      
      const { conversations } = await response.json()
      setConversations(conversations as Conversation[])
      
      console.log('[AdminMessaging] Conversations loaded:', conversations.length)
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConversationClick = (conversation: Conversation) => {
    // Marquer qu'on vient de l'admin pour la navigation retour
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('from_admin', 'true')
    }
    // Rediriger vers la page de chat complète
    router.push(`/chat/${conversation.id}`)
  }

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      !searchQuery ||
      conv.bookingRequest?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.bookingRequest?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.bookingRequest?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.bookingRequest?.chefName?.toLowerCase().includes(searchQuery.toLowerCase())

    let matchesStatus = true
    if (statusFilter !== 'all') {
      const effective = getEffectiveStatus(conv.bookingRequest)
      if (statusFilter === 'expired') {
        matchesStatus = effective === 'expired'
      } else if (statusFilter === 'ongoing') {
        matchesStatus =
          effective === 'accepted' || effective === 'validated_by_client'
      } else if (statusFilter === 'cancelled') {
        matchesStatus = effective === 'refused' || effective === 'cancelled'
      } else {
        matchesStatus = effective === statusFilter
      }
    }

    return matchesSearch && matchesStatus
  })

  // Helper function to get status info for badge and dot
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { 
          label: 'En attente', 
          badgeColor: 'bg-[#FBCF03]/20 text-[#FBCF03]',
          dotColor: 'bg-[#FBCF03]'
        }
      case 'accepted':
      case 'validated_by_client':
        return { 
          label: 'En cours', 
          badgeColor: 'bg-gray-100 text-gray-600',
          dotColor: 'bg-gray-400'
        }
      case 'completed':
        return { 
          label: 'Terminée', 
          badgeColor: 'bg-green-100 text-green-700',
          dotColor: 'bg-green-500'
        }
      case 'expired':
        return {
          label: 'Expirée',
          badgeColor: 'bg-amber-50 text-amber-900 border border-amber-600/40',
          dotColor: 'bg-amber-500',
        }
      case 'refused':
      case 'cancelled':
        return { 
          label: 'Terminée', 
          badgeColor: 'bg-gray-100 text-gray-600',
          dotColor: 'bg-gray-400'
        }
      default:
        return { 
          label: status, 
          badgeColor: 'bg-gray-100 text-gray-600',
          dotColor: 'bg-gray-400'
        }
    }
  }

  // Helper function to format relative date
  // Peut être utilisé pour booking_date (DATE) ou created_at (TIMESTAMP)
  const formatRelativeDate = (dateString: string) => {
    // Essayer de parser comme date locale d'abord (pour booking_date)
    let date = parseDateFromDB(dateString)
    // Si ça ne fonctionne pas, c'est probablement un timestamp
    if (!date) {
      date = new Date(dateString)
    }
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const diffTime = today.getTime() - eventDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Aujourd\'hui'
    if (diffDays === 1) return 'Hier'
    if (diffDays <= 7) return `Il y a ${diffDays}j`
    return formatDateForDisplay(date, 'fr-FR', { day: 'numeric', month: 'short' })
  }

  // Helper function to format date
  const formatEventDate = (dateString: string) => {
    return formatDateForDisplay(dateString, 'fr-FR', {
      day: 'numeric',
      month: 'short',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-200px)] bg-white">
      {/* Liste des conversations - Style Instagram moderne */}
      <div className="w-full h-full flex flex-col">
        {/* Header avec recherche et filtre - Style moderne mobile-first */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
          <div className="px-4 sm:px-6 py-4">
            <h2 className="text-xl font-bold text-black mb-4">Conversations</h2>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Recherche */}
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 pl-10 bg-gray-50 border border-gray-200 rounded-xl text-sm text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/30 focus:border-[#FBCF03] transition-all"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              {/* Filtre par statut */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/30 focus:border-[#FBCF03] transition-all sm:min-w-[180px] appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 0.5rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em',
                  paddingRight: '2.5rem',
                }}
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente paiement</option>
                <option value="expired">Expiré</option>
                <option value="ongoing">En cours</option>
                <option value="completed">Confirmée</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>
          </div>
        </div>

        {/* Liste des conversations - Style moderne mobile-first, liste verticale sur mobile, grille sur desktop */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-gray-100 mx-4 my-4">
              <p className="text-sm text-gray-400">Aucune conversation trouvée</p>
            </div>
          ) : (
            <div className="space-y-2 p-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-4 sm:space-y-0">
              {filteredConversations.map((conv) => {
                const effectiveStatus = getEffectiveStatus(conv.bookingRequest)
                const statusInfo = effectiveStatus ? getStatusInfo(effectiveStatus) : null
                
                // Nom du chef depuis la table chefs (via chefName)
                const chefName = conv.bookingRequest?.chefName || 'Chef'
                
                // Nom du client depuis booking_requests (first_name + last_name)
                const clientFirstName = conv.bookingRequest?.first_name || ''
                const clientLastName = conv.bookingRequest?.last_name || ''
                const clientName = clientFirstName && clientLastName
                  ? `${clientFirstName} ${clientLastName}`
                  : clientFirstName || clientLastName || 'Client'
                
                const chefInitial = chefName.charAt(0).toUpperCase()
                const lastMessagePreview = conv.lastMessage?.content
                  ? conv.lastMessage.content.trim()
                  : null
                const eventDate = conv.bookingRequest?.booking_date
                  ? formatRelativeDate(conv.bookingRequest.booking_date)
                  : null

                return (
                  <button
                    key={conv.id}
                    onClick={() => handleConversationClick(conv)}
                    className="group w-full text-left bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200 active:scale-[0.98] sm:hover:scale-[1.02]"
                  >
                    {/* Mobile: Layout vertical comme Instagram DM */}
                    <div className="p-4 sm:p-4">
                      <div className="flex items-start gap-3 sm:flex-col sm:gap-3">
                        {/* Avatar et info principale - Mobile horizontal, Desktop vertical */}
                        <div className="flex items-center gap-3 flex-1 min-w-0 sm:flex-col sm:items-start sm:w-full">
                          {/* Avatar avec statut */}
                          <div className="relative flex-shrink-0">
                            {conv.bookingRequest?.chefProfilePicture ? (
                              <img
                                src={conv.bookingRequest.chefProfilePicture}
                                alt={chefName}
                                className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-50 shadow-sm sm:w-16 sm:h-16"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FBCF03] to-[#E6BA00] flex items-center justify-center ring-2 ring-gray-50 shadow-sm sm:w-16 sm:h-16">
                                <span className="text-lg font-bold text-black sm:text-xl">
                                  {chefInitial}
                                </span>
                              </div>
                            )}
                            {statusInfo && (
                              <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${statusInfo.dotColor} sm:w-5 sm:h-5`} />
                            )}
                          </div>
                          
                          {/* Contenu principal */}
                          <div className="flex-1 min-w-0 sm:w-full">
                            {/* Mobile: Chef pour Client sur une ligne */}
                            <div className="sm:hidden">
                              <p className="text-sm font-semibold text-black leading-tight truncate">
                                Chef {chefName}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">
                                pour {clientName}
                              </p>
                            </div>
                            
                            {/* Desktop: Chef et Client séparés */}
                            <div className="hidden sm:block space-y-1">
                              <p className="text-sm font-semibold text-black leading-tight">
                                Chef {chefName}
                              </p>
                              <p className="text-xs text-gray-500">
                                pour
                              </p>
                              <p className="text-base font-semibold text-gray-900 leading-tight">
                                {clientName}
                              </p>
                            </div>
                            
                            {/* Dernier message preview - Mobile seulement */}
                            {lastMessagePreview && (
                              <p className="text-xs text-gray-600 line-clamp-1 leading-relaxed mt-1.5 sm:hidden">
                                {lastMessagePreview}
                              </p>
                            )}
                            
                            {/* Desktop: Dernier message */}
                            {lastMessagePreview && (
                              <p className="hidden sm:block text-xs text-gray-600 line-clamp-2 leading-relaxed mt-2">
                                {lastMessagePreview}
                              </p>
                            )}
                            {!lastMessagePreview && (
                              <p className="hidden sm:block text-xs text-gray-400 italic mt-2">
                                Aucun message
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Meta info - Mobile à droite, Desktop en bas */}
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0 sm:flex-row sm:items-center sm:justify-between sm:w-full sm:mt-2 sm:pt-2 sm:border-t sm:border-gray-100">
                          {/* Date du dernier message */}
                          {conv.lastMessage?.created_at && (
                            <span className="text-[10px] text-gray-400 whitespace-nowrap sm:text-xs">
                              {formatRelativeDate(conv.lastMessage.created_at)}
                            </span>
                          )}
                          
                          {/* Statut badge */}
                          {statusInfo && (
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusInfo.badgeColor} sm:text-xs`}
                              title={
                                effectiveStatus === 'expired' &&
                                conv.bookingRequest?.status === 'pending'
                                  ? `Pending sans réponse du chef depuis plus de ${PENDING_NO_RESPONSE_HOURS} h`
                                  : undefined
                              }
                            >
                              {statusInfo.label}
                            </span>
                          )}
                          
                          {/* Date d'événement - Desktop seulement */}
                          {eventDate && (
                            <p className="hidden sm:block text-[10px] text-gray-500">
                              📅 {eventDate}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Mobile: Footer avec date d'événement */}
                      {eventDate && (
                        <div className="mt-2 pt-2 border-t border-gray-100 sm:hidden">
                          <p className="text-[10px] text-gray-500">
                            📅 {eventDate}
                          </p>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

