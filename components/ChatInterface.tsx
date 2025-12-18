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
  menuDetails?: any
  showAcceptedMessage?: boolean
}

export default function ChatInterface({
  conversationId,
  initialMessages,
  participants,
  currentUser,
  bookingRequest,
  menuDetails,
  showAcceptedMessage = false,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [extras, setExtras] = useState<Array<{ name: string; price: number }>>([])
  const [newExtraName, setNewExtraName] = useState('')
  const [newExtraPrice, setNewExtraPrice] = useState('')
  const [savingExtras, setSavingExtras] = useState(false)
  const [bookingStatus, setBookingStatus] = useState<string | null>(bookingRequest?.status || null)
  const [processingAction, setProcessingAction] = useState(false)
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [guestsCount, setGuestsCount] = useState(bookingRequest?.guests_count || 1)
  const [updatingGuests, setUpdatingGuests] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [localExtras, setLocalExtras] = useState<Array<{ name: string; price: number }>>([])
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

  const isChef = currentUserRole === 'chef'
  const isClient = currentUserRole === 'client'
  
  console.log('[ChatInterface] Role check:', {
    currentUserRole,
    isChef,
    isClient,
    currentUserEmail: currentUser?.email,
    participants: participants.map(p => ({ email: p.email, role: p.role })),
  })

  // Logs de débogage
  useEffect(() => {
    console.log('[ChatInterface] ========== DEBUG OFFER BUTTON ==========')
    console.log('[ChatInterface] Current user role:', currentUserRole)
    console.log('[ChatInterface] Is chef:', isChef)
    console.log('[ChatInterface] Booking request:', bookingRequest ? {
      id: bookingRequest.id,
      menu_id: bookingRequest.menu_id,
      guests_count: bookingRequest.guests_count,
    } : 'null')
    console.log('[ChatInterface] Menu details:', menuDetails ? {
      id: menuDetails.id,
      name: menuDetails.name,
      price: menuDetails.price,
    } : 'null')
    console.log('[ChatInterface] Should show button:', bookingRequest && (menuDetails || isChef))
    console.log('[ChatInterface] ========================================')
  }, [currentUserRole, isChef, bookingRequest, menuDetails])

  // Mettre à jour le statut si bookingRequest change
  useEffect(() => {
    if (bookingRequest?.status) {
      setBookingStatus(bookingRequest.status)
    }
  }, [bookingRequest?.status])

  // Mettre à jour guestsCount si bookingRequest change
  useEffect(() => {
    if (bookingRequest?.guests_count) {
      setGuestsCount(bookingRequest.guests_count)
    }
  }, [bookingRequest?.guests_count])

  // Handler pour modifier le nombre de convives (mise à jour locale uniquement)
  const handleGuestsChange = (newCount: number) => {
    if (!bookingRequest?.id || !isClient || !canModifyBooking) {
      return
    }

    // Contraintes : minimum 1
    if (newCount < 1) {
      return
    }

    // Optionnel : max guests si défini par le chef (à implémenter si nécessaire)
    // const maxGuests = bookingRequest.max_guests
    // if (maxGuests && newCount > maxGuests) {
    //   return
    // }

    setGuestsCount(newCount)
  }

  // Charger les extras au montage
  useEffect(() => {
    if (bookingRequest?.id) {
      console.log('[ChatInterface] Fetching extras for booking request:', bookingRequest.id)
      fetch('/api/booking-extras?bookingRequestId=' + bookingRequest.id)
        .then(res => res.json())
        .then(data => {
          console.log('[ChatInterface] Extras fetched:', data)
          if (data.extras && Array.isArray(data.extras)) {
            setExtras(data.extras)
            setLocalExtras(data.extras)
          }
        })
        .catch(err => console.error('Error fetching extras:', err))
    }
  }, [bookingRequest?.id])

  // Vérifier s'il y a des changements non sauvegardés
  useEffect(() => {
    const guestsChanged = guestsCount !== (bookingRequest?.guests_count || 1)
    const extrasChanged = JSON.stringify(extras) !== JSON.stringify(localExtras)
    setHasUnsavedChanges(guestsChanged || extrasChanged)
  }, [guestsCount, extras, bookingRequest?.guests_count, localExtras])

  const handleAddExtra = async () => {
    if (!newExtraName.trim() || !newExtraPrice.trim()) {
      return
    }

    const price = parseFloat(newExtraPrice)
    if (isNaN(price) || price <= 0) {
      alert('Veuillez entrer un prix valide')
      return
    }

    const extraName = newExtraName.trim()
    const newExtras = [...extras, { name: extraName, price }]
    setExtras(newExtras)
    setNewExtraName('')
    setNewExtraPrice('')
  }

  // Handler pour sauvegarder les modifications (extras + convives)
  const handleSaveChanges = async () => {
    if (!bookingRequest?.id || !currentUser) {
      return
    }

    setSavingExtras(true)
    setUpdatingGuests(true)

    try {
      // Sauvegarder les extras si modifiés (chef uniquement)
      if (isChef && JSON.stringify(extras) !== JSON.stringify(localExtras)) {
        const response = await fetch('/api/booking-extras', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookingRequestId: bookingRequest.id,
            extras: extras,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to save extras')
        }

        // Envoyer un message pour chaque extra ajouté/supprimé
        const addedExtras = extras.filter(e => !localExtras.find(le => le.name === e.name && le.price === e.price))
        const removedExtras = localExtras.filter(le => !extras.find(e => e.name === le.name && e.price === le.price))

        for (const extra of addedExtras) {
          const notificationMessage = `✨ Extra ajouté : ${extra.name} (+${extra.price.toFixed(2)} €)`
          try {
            await supabase.from('messages').insert({
              conversation_id: conversationId,
              sender_email: currentUser.email!,
              content: notificationMessage,
            } as any)
          } catch (e) {
            console.error('[ChatInterface] Error sending extra notification:', e)
          }
        }

        for (const extra of removedExtras) {
          const notificationMessage = `🗑️ Extra retiré : ${extra.name} (-${extra.price.toFixed(2)} €)`
          try {
            await supabase.from('messages').insert({
              conversation_id: conversationId,
              sender_email: currentUser.email!,
              content: notificationMessage,
            } as any)
          } catch (e) {
            console.error('[ChatInterface] Error sending extra removal notification:', e)
          }
        }

        setLocalExtras(extras)
      }

      // Sauvegarder le nombre de convives si modifié (client uniquement)
      if (isClient && guestsCount !== (bookingRequest?.guests_count || 1)) {
        const previousCount = bookingRequest?.guests_count || 1
        const response = await fetch('/api/booking-guests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookingRequestId: bookingRequest.id,
            guestsCount: guestsCount,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Erreur lors de la mise à jour')
        }

        // Mettre à jour bookingRequest localement
        if (bookingRequest) {
          (bookingRequest as any).guests_count = guestsCount
        }

        // Envoyer un message dans le chat pour notifier le changement
        const changeType = guestsCount > previousCount ? 'augmenté' : 'diminué'
        const changeAmount = Math.abs(guestsCount - previousCount)
        const notificationMessage = `✨ Nombre de convives ${changeType} : ${previousCount} → ${guestsCount} (${changeAmount} ${changeAmount === 1 ? 'convive' : 'convives'})`
        
        try {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_email: currentUser.email!,
            content: notificationMessage,
          } as any)
        } catch (e) {
          console.error('[ChatInterface] Error sending guests change notification:', e)
        }
      }

      setHasUnsavedChanges(false)
    } catch (error: any) {
      console.error('Error saving changes:', error)
      alert(error.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSavingExtras(false)
      setUpdatingGuests(false)
    }
  }

  const handleRemoveExtra = (index: number) => {
    const newExtras = extras.filter((_, i) => i !== index)
    setExtras(newExtras)
  }

  // Calculer le prix total (utilise guestsCount local si modifié)
  const menuPrice = menuDetails?.price || 0
  const currentGuestsCount = guestsCount || bookingRequest?.guests_count || 0
  const menuTotal = menuPrice * currentGuestsCount
  const extrasTotal = extras.reduce((sum, extra) => sum + (extra.price || 0), 0)
  const totalPrice = menuTotal + extrasTotal

  // Détecter si un message est un message système (notification)
  const isSystemMessage = (content: string) => {
    const lowerContent = content.toLowerCase()
    return (
      content.startsWith('✨') || 
      content.startsWith('🗑️') || 
      lowerContent.includes('réservation a été validée') ||
      lowerContent.includes('réservation a été annulée') ||
      lowerContent.includes('la réservation')
    )
  }

  // Vérifier si la réservation peut être modifiée
  const canModifyBooking = bookingStatus !== 'validated_by_client' && bookingStatus !== 'cancelled'
  const isBookingValidated = bookingStatus === 'validated_by_client'
  const isBookingCancelled = bookingStatus === 'cancelled'

  // Handler pour afficher la modale de finalisation
  const handleFinalizeBooking = () => {
    if (!bookingRequest?.id || !isClient || bookingStatus !== 'accepted') {
      return
    }
    setShowFinalizeModal(true)
  }

  // Handler pour confirmer la finalisation (appelle l'API)
  const confirmFinalize = async () => {
    if (!bookingRequest?.id) {
      return
    }

    setProcessingAction(true)
    setShowFinalizeModal(false)
    
    try {
      const response = await fetch('/api/booking-validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingRequestId: bookingRequest.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors de la finalisation')
      }

      // Mettre à jour le statut localement
      setBookingStatus('validated_by_client')
      
      // Recharger la page pour afficher le message système
      window.location.reload()
    } catch (error: any) {
      console.error('[ChatInterface] Error finalizing booking:', error)
      alert(error.message || 'Erreur lors de la finalisation de la réservation')
    } finally {
      setProcessingAction(false)
    }
  }

  // Handler pour afficher la modale d'annulation
  const handleCancelBooking = () => {
    if (!bookingRequest?.id) {
      return
    }
    setShowCancelModal(true)
  }

  // Handler pour confirmer l'annulation (appelle l'API)
  const confirmCancel = async () => {
    if (!bookingRequest?.id) {
      return
    }

    setProcessingAction(true)
    setShowCancelModal(false)
    
    try {
      const response = await fetch('/api/booking-cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingRequestId: bookingRequest.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors de l\'annulation')
      }

      // Mettre à jour le statut localement
      setBookingStatus('cancelled')
      
      // Recharger la page pour afficher le message système
      window.location.reload()
    } catch (error: any) {
      console.error('[ChatInterface] Error cancelling booking:', error)
      alert(error.message || 'Erreur lors de l\'annulation de la réservation')
    } finally {
      setProcessingAction(false)
    }
  }

  // Obtenir le nom du chef
  const getChefName = () => {
    // Essayer d'abord chefName si disponible dans bookingRequest
    if ((bookingRequest as any)?.chefName) {
      return (bookingRequest as any).chefName
    }
    // Sinon, utiliser "Chef" comme valeur par défaut
    return 'Chef'
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      {/* Header - Premium, moderne, avec contraste distinct */}
      <div className="flex-shrink-0 bg-gray-50/95 backdrop-blur-md sticky top-0 z-10 border-b border-gray-200/80 shadow-sm">
        <div className="px-4 sm:px-6 py-3">
          {/* Titre sur sa propre ligne, bien visible */}
          <div className="mb-2.5">
            <h1 className="text-base sm:text-lg font-semibold text-black">
              {bookingRequest ? `Réservation du ${new Date(bookingRequest.booking_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : 'Conversation'}
            </h1>
            {bookingRequest && (
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                {bookingRequest.guests_count} {bookingRequest.guests_count === 1 ? 'convive' : 'convives'}
              </p>
            )}
          </div>
          
          {/* Actions en dessous */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-shrink-0 p-1.5 -ml-1.5 text-gray-500 hover:text-black hover:bg-black/5 rounded-lg transition-all"
              aria-label="Retour"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Right: Actions grouped */}
            <div className="flex items-center gap-2 flex-1 justify-end">
              {bookingRequest && (
                <>
                  {/* Secondary: Voir l'offre (ghost/outline) */}
                  <button
                    onClick={() => setShowOfferModal(true)}
                    className="px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white/80 border border-gray-300/60 hover:bg-white hover:border-gray-400 rounded-lg transition-all shadow-sm hover:shadow"
                  >
                    Voir l'offre
                  </button>
                  
                  {/* Primary: Finaliser (client uniquement, statut accepted) */}
                  {isClient && bookingStatus === 'accepted' && (
                    <button
                      onClick={handleFinalizeBooking}
                      disabled={processingAction}
                      className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 active:bg-[#FBCF03]/80 rounded-lg transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingAction ? '...' : 'Finaliser'}
                    </button>
                  )}
                  
                  {/* Destructive: Annuler (text button, subtle) */}
                  {!isBookingValidated && !isBookingCancelled && (
                    <button
                      onClick={handleCancelBooking}
                      disabled={processingAction}
                      className="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Annuler la réservation"
                    >
                      {processingAction ? '...' : 'Annuler'}
                    </button>
                  )}
                </>
              )}
              
              {/* Information button (client only) */}
              {isClient && bookingRequest && (
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="flex-shrink-0 p-1.5 text-gray-500 hover:text-black hover:bg-black/5 rounded-lg transition-all"
                  title="Informations"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}
              
              {/* Logout icon - subtle */}
              <button
                onClick={handleSignOut}
                className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100/60 rounded-lg transition-all"
                title="Se déconnecter"
              >
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Accepted message banner - Discret */}
      {showAcceptedMessage && (
        <div className="flex-shrink-0 bg-green-50/30 border-b border-green-100 px-4 sm:px-6 py-2.5">
          <p className="text-sm text-green-700">
            Réservation acceptée
          </p>
        </div>
      )}

      {/* Messages - Style premium */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain bg-white"
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="px-4 py-6 sm:px-6 sm:py-8 min-h-full flex flex-col justify-end">
          {messages.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-gray-400">Aucun message</p>
            </div>
          ) : (
            <>
              {messages.map((message) => {
                const senderRole = getParticipantRole(message.sender_email)
                const isChefMessage = senderRole === 'chef'
                const isClientMessage = senderRole === 'client'
                const isOwn = isOwnMessage(message)
                const isSystem = isSystemMessage(message.content)
                
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
                
                // Message système (notification)
                if (isSystem) {
                  let icon = 'ℹ️'
                  if (message.content.startsWith('✨')) {
                    icon = '✨'
                  } else if (message.content.startsWith('🗑️')) {
                    icon = '🗑️'
                  } else if (message.content.toLowerCase().includes('validée')) {
                    icon = '✅'
                  } else if (message.content.toLowerCase().includes('annulée')) {
                    icon = '❌'
                  }
                  
                  const contentWithoutIcon = message.content.replace(/^[✨🗑️✅❌ℹ️]+\s*/, '')
                  return (
                    <div key={message.id} className="flex justify-center my-3">
                      <div className="bg-gray-100 rounded-full px-4 py-2.5 max-w-[85%] flex items-center gap-2">
                        <span className="text-xs">{icon}</span>
                        <p className="text-xs text-gray-600 text-center">
                          {contentWithoutIcon}
                        </p>
                      </div>
                    </div>
                  )
                }
                
                // Message normal - Client à droite, Chef à gauche
                return (
                  <div
                    key={message.id}
                    className={`flex mb-4 ${isClientMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] sm:max-w-[65%] flex flex-col ${isClientMessage ? 'items-end' : 'items-start'}`}>
                      {/* Nom de l'expéditeur - discret */}
                      <span className="text-[11px] text-gray-400 mb-1 px-1">
                        {getParticipantName(message.sender_email)}
                      </span>
                      
                      {/* Bulle de message */}
                      <div
                        className={`rounded-2xl px-4 py-2.5 ${
                          isClientMessage
                            ? 'bg-[#FBCF03] text-black rounded-br-sm'
                            : 'bg-gray-900 text-white rounded-bl-sm'
                        }`}
                      >
                        <div className={`text-[15px] leading-relaxed whitespace-pre-wrap break-words ${
                          isClientMessage ? 'text-black' : 'text-white'
                        }`}>
                          {message.content}
                        </div>
                      </div>
                      
                      {/* Timestamp - très discret */}
                      <span className="text-[10px] text-gray-400 mt-1 px-1">
                        {new Date(message.created_at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Input - Style moderne premium (désactivé si réservation annulée) */}
      {!isBookingCancelled && (
      <div className="flex-shrink-0 bg-white border-t border-gray-100 pb-safe">
        <form onSubmit={handleSendMessage} className="px-4 py-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message"
              disabled={loading}
              className="flex-1 px-5 py-3 bg-gray-50 rounded-full text-[15px] focus:outline-none focus:bg-white focus:ring-1 focus:ring-gray-300 transition-all disabled:opacity-50"
              style={{
                minHeight: '44px',
              }}
            />
            <button
              type="submit"
              disabled={loading || !newMessage.trim()}
              className="flex-shrink-0 w-11 h-11 rounded-full bg-black text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
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
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Modal d'offre - Design premium, compact pour tenir sur une page */}
      {showOfferModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowOfferModal(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* Header fixe */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-xl font-semibold text-black">Détails de l'offre</h2>
              <button
                onClick={() => setShowOfferModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Fermer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contenu scrollable compact */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
              {/* Informations de la réservation */}
              {bookingRequest && (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Informations</h3>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Date</p>
                        <p className="text-sm font-medium text-black">
                          {new Date(bookingRequest.booking_date).toLocaleDateString('fr-FR', { 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Lieu</p>
                        <p className="text-sm font-medium text-black">{bookingRequest.city} {bookingRequest.postal_code}</p>
                      </div>
                    </div>
                    {bookingRequest.has_allergies && bookingRequest.allergies_details && (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-0.5">Allergies</p>
                        <p className="text-sm text-black">{bookingRequest.allergies_details}</p>
                      </div>
                    )}
                    {bookingRequest.notes && (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-0.5">Notes</p>
                        <p className="text-sm text-black">{bookingRequest.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Menu sélectionné */}
              {menuDetails ? (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Menu</h3>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                    <p className="text-base font-semibold text-black mb-1">{menuDetails.name}</p>
                    {menuDetails.description && (
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2">{menuDetails.description}</p>
                    )}
                    <div className="pt-2 border-t border-gray-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Prix par menu</span>
                        <span className="font-medium text-black">{menuPrice.toFixed(2)} €</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Nombre de menus</span>
                        {isClient && canModifyBooking ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleGuestsChange(currentGuestsCount - 1)}
                              disabled={currentGuestsCount <= 1 || updatingGuests}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              aria-label="Diminuer"
                            >
                              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                              </svg>
                            </button>
                            <span className="font-medium text-black min-w-[2rem] text-center">
                              {updatingGuests ? '...' : `${currentGuestsCount} ${currentGuestsCount === 1 ? 'menu' : 'menus'}`}
                            </span>
                            <button
                              onClick={() => handleGuestsChange(currentGuestsCount + 1)}
                              disabled={updatingGuests}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              aria-label="Augmenter"
                            >
                              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <span className="font-medium text-black">{currentGuestsCount} {currentGuestsCount === 1 ? 'menu' : 'menus'}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-gray-200">
                        <span className="text-black">Sous-total</span>
                        <span className="text-black">{menuTotal.toFixed(2)} €</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Menu</h3>
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                    <p className="text-sm text-gray-500">Aucun menu sélectionné</p>
                  </div>
                </div>
              )}

              {/* Extras */}
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Extras</h3>
                {extras.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {extras.map((extra, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg border border-gray-200 p-2.5">
                        <span className="text-sm font-medium text-black flex-1">{extra.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-black">{extra.price.toFixed(2)} €</span>
                          {isChef && canModifyBooking && (
                            <button
                              onClick={() => handleRemoveExtra(index)}
                              className="p-1 hover:bg-red-50 rounded transition-colors"
                              disabled={savingExtras}
                              aria-label="Supprimer"
                            >
                              <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mb-3">Aucun extra ajouté</p>
                )}

                {/* Formulaire d'ajout d'extra (chef uniquement, si réservation modifiable) */}
                {isChef && canModifyBooking && (
                  <div className="bg-[#FBCF03]/10 rounded-lg border border-[#FBCF03]/20 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-black">Ajouter un extra</p>
                      <button
                        onClick={handleAddExtra}
                        disabled={!newExtraName.trim() || !newExtraPrice.trim() || savingExtras}
                        className="px-3 py-1 text-xs font-medium text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingExtras ? '...' : 'Ajouter'}
                      </button>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newExtraName}
                        onChange={(e) => setNewExtraName(e.target.value)}
                        placeholder="Nom de l'extra"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent text-sm"
                        disabled={savingExtras}
                      />
                      <input
                        type="number"
                        value={newExtraPrice}
                        onChange={(e) => setNewExtraPrice(e.target.value)}
                        placeholder="Prix (€)"
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FBCF03] focus:border-transparent text-sm"
                        disabled={savingExtras}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-black">Total</span>
                  <span className="text-xl font-bold text-black">{totalPrice.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            {/* Bouton Valider en bas (si modifications) */}
            {hasUnsavedChanges && canModifyBooking && (
              <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-t border-gray-200 bg-white">
                <button
                  onClick={handleSaveChanges}
                  disabled={savingExtras || updatingGuests}
                  className="w-full px-4 py-3 text-sm font-semibold text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 active:bg-[#FBCF03]/80 rounded-lg transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingExtras || updatingGuests ? 'Sauvegarde...' : 'Valider les modifications'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de confirmation - Finaliser */}
      {showFinalizeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowFinalizeModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-black mb-4">Finaliser la réservation</h2>
              
              {/* Résumé de l'offre */}
              {bookingRequest && (
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-6 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Date</span>
                    <span className="font-medium text-black">
                      {new Date(bookingRequest.booking_date).toLocaleDateString('fr-FR', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Chef</span>
                    <span className="font-medium text-black">{getChefName()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Nombre de convives</span>
                    <span className="font-medium text-black">{bookingRequest.guests_count}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-base font-semibold text-black">Total</span>
                    <span className="text-lg font-bold text-black">{totalPrice.toFixed(2)} €</span>
                  </div>
                </div>
              )}

              <p className="text-sm text-gray-600 mb-6">
                En confirmant, vous validez cette réservation. Un lien de paiement vous sera envoyé dans les 24 heures.
              </p>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFinalizeModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Retour
                </button>
                <button
                  onClick={confirmFinalize}
                  disabled={processingAction}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingAction ? '...' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation - Annuler */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCancelModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-black mb-4">Annuler la réservation</h2>
              
              <p className="text-sm text-gray-600 mb-6">
                Êtes-vous sûr de vouloir annuler cette réservation ? Cette action est irréversible et la conversation sera fermée.
              </p>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Retour
                </button>
                <button
                  onClick={confirmCancel}
                  disabled={processingAction}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingAction ? '...' : 'Confirmer l\'annulation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'information (client uniquement) */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowInfoModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-black">Informations</h2>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Fermer"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Actions - Réplique exacte des boutons du header avec explications */}
              <div className="space-y-3 mb-6">
                {/* Voir l'offre */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowInfoModal(false)
                      setShowOfferModal(true)
                    }}
                    className="px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white/80 border border-gray-300/60 hover:bg-white hover:border-gray-400 rounded-lg transition-all shadow-sm hover:shadow flex-shrink-0"
                  >
                    Voir l'offre
                  </button>
                  <p className="text-xs text-gray-500 flex-1">Consulter les détails de votre réservation</p>
                </div>

                {/* Finaliser la réservation */}
                {isClient && bookingStatus === 'accepted' && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setShowInfoModal(false)
                        handleFinalizeBooking()
                      }}
                      disabled={processingAction}
                      className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 active:bg-[#FBCF03]/80 rounded-lg transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {processingAction ? '...' : 'Finaliser'}
                    </button>
                    <p className="text-xs text-gray-500 flex-1">À utiliser lorsque tout est validé et que vous êtes prêt à procéder au paiement.</p>
                  </div>
                )}

                {/* Annuler la réservation */}
                {!isBookingValidated && !isBookingCancelled && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setShowInfoModal(false)
                        handleCancelBooking()
                      }}
                      disabled={processingAction}
                      className="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {processingAction ? '...' : 'Annuler'}
                    </button>
                    <p className="text-xs text-gray-500 flex-1">Annule définitivement la demande de réservation.</p>
                  </div>
                )}
              </div>

              {/* Avertissement de sécurité */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Pour des raisons de sécurité, merci de ne pas partager d'informations personnelles (email, numéro de téléphone, coordonnées bancaires) dans la messagerie.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

