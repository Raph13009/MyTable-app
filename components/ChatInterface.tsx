/* eslint-disable react/no-unescaped-entities */
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { sanitizeMessage } from '@/lib/utils'

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
  isAdmin?: boolean
}

// Icônes culinaires pour l'animation
const CULINARY_ICONS = ['🍳', '👨‍🍳', '🍽️', '🥘', '🍲']

// Composant d'animation de chargement avec icônes culinaires
function LoadingAnimation({ message = 'Chargement...' }: { message?: string }) {
  const [currentIcon, setCurrentIcon] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIcon((prev) => (prev + 1) % CULINARY_ICONS.length)
    }, 300)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce">
          {CULINARY_ICONS[currentIcon]}
        </div>
        <p className="text-sm text-gray-600 font-medium">{message}</p>
        <div className="mt-4 flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 bg-[#FBCF03] rounded-full animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ChatInterface({
  conversationId,
  initialMessages,
  participants,
  currentUser,
  bookingRequest,
  menuDetails,
  showAcceptedMessage = false,
  isAdmin: isAdminProp = false,
}: ChatInterfaceProps) {
  // Vérifier si l'utilisateur est admin (lecture seule)
  const ADMIN_UID = '8d154623-1aba-475c-9a7b-9ab39f3f84d2'
  const [isAdminState, setIsAdminState] = useState(isAdminProp)
  const [cameFromAdmin, setCameFromAdmin] = useState(false)
  
  useEffect(() => {
    // Vérifier si l'utilisateur est l'admin via UID ou via prop
    const isAdmin = isAdminProp || currentUser?.id === ADMIN_UID
    setIsAdminState(isAdmin)
    
    // Vérifier si on vient de l'admin (via referrer ou sessionStorage)
    if (typeof window !== 'undefined') {
      const fromAdmin = sessionStorage.getItem('from_admin') === 'true' || 
                       document.referrer.includes('/admin')
      setCameFromAdmin(fromAdmin || isAdmin)
      if (isAdmin) {
        sessionStorage.setItem('from_admin', 'true')
      }
    }
  }, [currentUser, isAdminProp])

  // Animation de chargement initial
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitializing(false)
    }, 800) // Animation de 800ms
    return () => clearTimeout(timer)
  }, [])

  // Détecter si on est sur desktop
  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 768) // md breakpoint
    }
    checkIsDesktop()
    window.addEventListener('resize', checkIsDesktop)
    return () => window.removeEventListener('resize', checkIsDesktop)
  }, [])
  
  const isAdmin = isAdminState
  // Sanitize initial messages (extra safety layer)
  const sanitizedInitialMessages = initialMessages.map(msg => ({
    ...msg,
    content: sanitizeMessage(msg.content || '')
  }))
  const [messages, setMessages] = useState<Message[]>(sanitizedInitialMessages)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isNavigatingBack, setIsNavigatingBack] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [showMenuModal, setShowMenuModal] = useState(false)
  const [extras, setExtras] = useState<Array<{ name: string; price: number }>>([])
  const [newExtraName, setNewExtraName] = useState('')
  const [newExtraPrice, setNewExtraPrice] = useState('')
  const [savingExtras, setSavingExtras] = useState(false)
  const [savingMenu, setSavingMenu] = useState(false)
  
  // Menu state structure
  type MenuCategory = 'aperitifs' | 'mise_en_bouche' | 'entree' | 'plat' | 'dessert' | 'mignardises'
  const [menuCategories, setMenuCategories] = useState<Record<MenuCategory, string[]>>({
    aperitifs: [],
    mise_en_bouche: [],
    entree: [],
    plat: [],
    dessert: [],
    mignardises: [],
  })
  const [newMenuItems, setNewMenuItems] = useState<Record<MenuCategory, string>>({
    aperitifs: '',
    mise_en_bouche: '',
    entree: '',
    plat: '',
    dessert: '',
    mignardises: '',
  })
  const [bookingStatus, setBookingStatus] = useState<string | null>(bookingRequest?.status || null)
  const [processingAction, setProcessingAction] = useState(false)
  const [showFinalizeModal, setShowFinalizeModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [guestsCount, setGuestsCount] = useState(bookingRequest?.guests_count || 1)
  const [childrenCount, setChildrenCount] = useState(bookingRequest?.children_count || 0)
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
          const newMessage = payload.new as Message
          // Sanitize new message before adding to state (extra safety layer)
          const sanitizedNewMessage = {
            ...newMessage,
            content: sanitizeMessage(newMessage.content || '')
          }
          setMessages((prev) => [...prev, sanitizedNewMessage])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, supabase])

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    if (!newMessage.trim() || !currentUser) {
      return
    }

    setLoading(true)

    try {
      const currentUserRole = getCurrentUserRole()
      const rawContent = newMessage.trim()
      
      // Sanitize message content before saving (mask emails and phone numbers)
      const sanitizedContent = sanitizeMessage(rawContent)
      
      console.log('[ChatInterface] Sending message:', {
        currentUserEmail: currentUser.email,
        currentUserRole,
        messageContent: rawContent,
        sanitizedContent,
      })

      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_email: currentUser.email!,
          content: sanitizedContent, // Store sanitized version
        } as any)

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
      alert('Erreur lors de l&apos;envoi du message')
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

  // Mettre à jour guestsCount et childrenCount si bookingRequest change
  useEffect(() => {
    if (bookingRequest?.guests_count) {
      setGuestsCount(bookingRequest.guests_count)
    }
    if (bookingRequest?.children_count !== undefined) {
      setChildrenCount(bookingRequest.children_count || 0)
    }
  }, [bookingRequest?.guests_count, bookingRequest?.children_count])

  // Handler pour modifier le nombre de convives (mise à jour locale uniquement)
  // Using useCallback to prevent minification issues and ensure stable reference
  // Note: canModifyBooking is calculated later, so we check bookingStatus directly
  const handleGuestsChange = useCallback((newCount: number) => {
    const canModify = bookingRequest?.status !== 'validated_by_client' && bookingRequest?.status !== 'cancelled'
    if (!bookingRequest?.id || !isClient || !canModify) {
      return
    }

    // Contraintes : minimum 1
    if (newCount < 1) {
      return
    }

    // S'assurer que childrenCount ne dépasse pas guestsCount
    // Use functional update to get current childrenCount value
    setChildrenCount((currentChildren: number) => {
      if (currentChildren > newCount) {
        return newCount
      }
      return currentChildren
    })

    setGuestsCount(newCount)
  }, [bookingRequest?.id, bookingRequest?.status, isClient])

  // Handler pour modifier le nombre d'enfants (mise à jour locale uniquement)
  // Use functional update pattern to avoid stale closure issues
  const handleChildrenChange = useCallback((newCount: number, currentGuests?: number) => {
    const canModify = bookingRequest?.status !== 'validated_by_client' && bookingRequest?.status !== 'cancelled'
    if (!bookingRequest?.id || !isClient || !canModify) {
      return
    }

    // Contraintes : minimum 0, maximum guestsCount
    if (newCount < 0) {
      return
    }
    
    // If currentGuests provided, use it; otherwise get it via functional update
    if (currentGuests !== undefined) {
      if (newCount > currentGuests) {
        return // Don't update if exceeds guestsCount
      }
      setChildrenCount(newCount)
    } else {
      // Fallback: use functional update to get current guestsCount
      setGuestsCount((currentGuestsValue: number) => {
        if (newCount > currentGuestsValue) {
          return currentGuestsValue // Don't update guestsCount, just prevent childrenCount update
        }
        setChildrenCount(newCount)
        return currentGuestsValue // Return unchanged
      })
    }
  }, [bookingRequest?.id, bookingRequest?.status, isClient])

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

  // Charger le menu_content au montage
  useEffect(() => {
    if (bookingRequest?.menu_content && typeof bookingRequest.menu_content === 'object') {
      const menuData = bookingRequest.menu_content as any
      setMenuCategories({
        aperitifs: menuData.aperitifs || [],
        mise_en_bouche: menuData.mise_en_bouche || [],
        entree: menuData.entree || [],
        plat: menuData.plat || [],
        dessert: menuData.dessert || [],
        mignardises: menuData.mignardises || [],
      })
    }
  }, [bookingRequest?.menu_content])

  // Vérifier s'il y a des changements non sauvegardés
  useEffect(() => {
    const guestsChanged = guestsCount !== (bookingRequest?.guests_count || 1)
    const childrenChanged = childrenCount !== (bookingRequest?.children_count || 0)
    const extrasChanged = JSON.stringify(extras) !== JSON.stringify(localExtras)
    setHasUnsavedChanges(guestsChanged || childrenChanged || extrasChanged)
  }, [guestsCount, childrenCount, extras, bookingRequest?.guests_count, bookingRequest?.children_count, localExtras])

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
          // Sanitize notification message before saving
          const sanitizedNotification = sanitizeMessage(notificationMessage)
          try {
            await supabase.from('messages').insert({
              conversation_id: conversationId,
              sender_email: currentUser.email!,
              content: sanitizedNotification,
            } as any)
          } catch (e) {
            console.error('[ChatInterface] Error sending extra notification:', e)
          }
        }

        for (const extra of removedExtras) {
          const notificationMessage = `🗑️ Extra retiré : ${extra.name} (-${extra.price.toFixed(2)} €)`
          // Sanitize notification message before saving
          const sanitizedNotification = sanitizeMessage(notificationMessage)
          try {
            await supabase.from('messages').insert({
              conversation_id: conversationId,
              sender_email: currentUser.email!,
              content: sanitizedNotification,
            } as any)
          } catch (e) {
            console.error('[ChatInterface] Error sending extra removal notification:', e)
          }
        }

        setLocalExtras(extras)
      }

      // Sauvegarder le nombre de convives et d'enfants si modifié (client uniquement)
      const guestsChanged = isClient && guestsCount !== (bookingRequest?.guests_count || 1)
      const childrenChanged = isClient && childrenCount !== (bookingRequest?.children_count || 0)
      
      if (guestsChanged || childrenChanged) {
        const previousGuestsCount = bookingRequest?.guests_count || 1
        const previousChildrenCount = bookingRequest?.children_count || 0
        
        const response = await fetch('/api/booking-guests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookingRequestId: bookingRequest.id,
            guestsCount: guestsCount,
            childrenCount: childrenCount,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Erreur lors de la mise à jour')
        }

        // Mettre à jour bookingRequest localement
        if (bookingRequest) {
          (bookingRequest as any).guests_count = guestsCount
          (bookingRequest as any).children_count = childrenCount
        }

        // Envoyer un message dans le chat pour notifier le changement
        let notificationMessage = ''
        if (guestsChanged) {
          const changeType = guestsCount > previousGuestsCount ? 'augmenté' : 'diminué'
          const changeAmount = Math.abs(guestsCount - previousGuestsCount)
          notificationMessage = `✨ Nombre de convives ${changeType} : ${previousGuestsCount} → ${guestsCount} (${changeAmount} ${changeAmount === 1 ? 'convive' : 'convives'})`
        }
        if (childrenChanged) {
          const changeType = childrenCount > previousChildrenCount ? 'augmenté' : 'diminué'
          const changeAmount = Math.abs(childrenCount - previousChildrenCount)
          const childrenMsg = `✨ Nombre d'enfants ${changeType} : ${previousChildrenCount} → ${childrenCount} (${changeAmount} ${changeAmount === 1 ? 'enfant' : 'enfants'})`
          notificationMessage = notificationMessage ? `${notificationMessage}\n${childrenMsg}` : childrenMsg
        }
        
        if (notificationMessage) {
        // Sanitize notification message before saving
        const sanitizedNotification = sanitizeMessage(notificationMessage)
        try {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_email: currentUser.email!,
            content: sanitizedNotification,
          } as any)
        } catch (e) {
            console.error('[ChatInterface] Error sending guests/children change notification:', e)
          }
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
        throw new Error(error.error || 'Erreur lors de l&apos;annulation')
      }

      // Mettre à jour le statut localement
      setBookingStatus('cancelled')
      
      // Recharger la page pour afficher le message système
      window.location.reload()
    } catch (error: any) {
      console.error('[ChatInterface] Error cancelling booking:', error)
      alert(error.message || 'Erreur lors de l&apos;annulation de la réservation')
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

  // Handlers pour le menu
  const handleAddMenuItem = (category: MenuCategory) => {
    const item = newMenuItems[category].trim()
    if (!item) return
    setMenuCategories(prev => ({
      ...prev,
      [category]: [...prev[category], item],
    }))
    setNewMenuItems(prev => ({
      ...prev,
      [category]: '',
    }))
  }

  const handleRemoveMenuItem = (category: MenuCategory, index: number) => {
    setMenuCategories(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index),
    }))
  }

  const handleNewMenuItemChange = (category: MenuCategory, value: string) => {
    setNewMenuItems(prev => ({
      ...prev,
      [category]: value,
    }))
  }

  const handleSaveMenu = async () => {
    if (!bookingRequest?.id || !currentUser) {
      return
    }

    setSavingMenu(true)

    try {
      // Filtrer les catégories vides
      const cleanedMenu: any = {}
      Object.entries(menuCategories).forEach(([key, items]) => {
        if (items.length > 0) {
          cleanedMenu[key] = items
        }
      })

      const response = await fetch('/api/booking-menu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingRequestId: bookingRequest.id,
          menuContent: cleanedMenu,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la sauvegarde')
      }

      // eslint-disable-next-line react/no-unescaped-entities
      // Recharger la page pour afficher le nouveau message
      window.location.reload()
    } catch (error: any) {
      console.error('[ChatInterface] Error saving menu:', error)
      alert(error.message || 'Erreur lors de la sauvegarde du menu')
    } finally {
      setSavingMenu(false)
    }
  }

  // Vérifier si un menu existe
  const hasMenu = bookingRequest?.menu_content && typeof bookingRequest.menu_content === 'object' && 
    Object.values(bookingRequest.menu_content as any).some((items: any) => Array.isArray(items) && items.length > 0)

  if (!currentUser) {
    return null
  }

  // Gestion du retour avec animation
  const handleBackClick = () => {
    setIsNavigatingBack(true)
    setTimeout(() => {
      if (cameFromAdmin || isAdmin) {
        router.push('/admin?section=messaging')
      } else {
        router.push('/dashboard')
      }
    }, 300)
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-white">
      {/* Animation de chargement initial */}
      {isInitializing && <LoadingAnimation message="Préparation de la conversation..." />}
      
      {/* Animation de navigation retour */}
      {isNavigatingBack && <LoadingAnimation message="Retour en cours..." />}
      {/* Header - Premium, moderne, avec contraste distinct */}
      <div className="flex-shrink-0 bg-white sticky top-0 z-10 border-b border-gray-300">
        <div className="px-4 sm:px-6 py-3.5">
          {/* Titre sur sa propre ligne, bien visible */}
          <div className="mb-2.5">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-base sm:text-lg font-semibold text-gray-900">
                {bookingRequest ? `Réservation du ${new Date(bookingRequest.booking_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : 'Conversation'}
              </h1>
              {bookingStatus && bookingStatus === 'accepted' && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#FBCF03]"></span>
              )}
            </div>
            {bookingRequest && (
              <>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-xs sm:text-sm text-gray-500">
                    {bookingRequest.guests_count} {bookingRequest.guests_count === 1 ? 'convive' : 'convives'}
                  </p>
                  {isChef && bookingRequest.service_type === 'repas_domicile' && bookingRequest.meal_time && (
                    <>
                      <span className="text-gray-300">•</span>
                      <p className="text-xs sm:text-sm text-gray-500">
                        {bookingRequest.meal_time === 'dejeuner' ? 'Déjeuner' : bookingRequest.meal_time === 'diner' ? 'Dîner' : bookingRequest.meal_time}
                      </p>
                    </>
                  )}
                  {isChef && (
                    <>
                      <span className="text-gray-300">•</span>
                      <p className="text-xs sm:text-sm font-medium text-gray-700">
                        {bookingRequest.first_name} {bookingRequest.last_name}
                      </p>
                    </>
                  )}
                </div>
                {/* Emails du chef et du client - Uniquement pour l'admin */}
                {isAdmin && (
                  <div className="mt-2 space-y-1">
                    {bookingRequest.chefEmail && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Chef:</span> {bookingRequest.chefEmail}
                      </p>
                    )}
                    {bookingRequest.email && (
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Client:</span> {bookingRequest.email}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Actions en dessous */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handleBackClick}
              disabled={isNavigatingBack}
              className="flex-shrink-0 p-1.5 -ml-1.5 text-gray-500 hover:text-black hover:bg-black/5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Retour"
            >
              {isNavigatingBack ? (
                <div className="w-5 h-5 flex items-center justify-center">
                  <span className="text-lg animate-spin">🍳</span>
                </div>
              ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              )}
            </button>

            {/* Right: Actions grouped */}
            <div className="flex items-center gap-2 flex-1 justify-end">
              {bookingRequest && (
                <>
                  {/* Menu button (chef only) - Yellow for contrast */}
                  {isChef && (
                    <button
                      onClick={() => setShowMenuModal(true)}
                      className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 active:bg-[#FBCF03]/80 rounded-lg transition-all shadow-sm hover:shadow"
                    >
                      Menu
                    </button>
                  )}
                  {/* Secondary: Voir l&apos;offre (ghost/outline) */}
                  <button
                    onClick={() => setShowOfferModal(true)}
                    className="px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white/80 border border-gray-300/60 hover:bg-white hover:border-gray-400 rounded-lg transition-all shadow-sm hover:shadow"
                  >
                    Voir l&apos;offre
                  </button>
                  
                  {/* Voir le menu (client only, if menu exists) */}
                  {isClient && hasMenu && (
                    <button
                      onClick={() => setShowMenuModal(true)}
                      className="px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 rounded-lg transition-all shadow-sm hover:shadow"
                    >
                      Voir le menu
                    </button>
                  )}
                  
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
              
              {/* Information button (client and chef) */}
              {bookingRequest && (
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
        className="flex-1 overflow-y-auto overscroll-contain bg-gray-100"
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="px-4 py-4 sm:px-6 sm:py-5 min-h-full flex flex-col justify-end">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              {/* Message système par défaut pour nouvelle conversation */}
              {bookingRequest && (
                <div className="flex justify-center my-4 sm:my-6 w-full px-2">
                  <div className="bg-white rounded-2xl sm:rounded-3xl px-5 py-6 sm:px-6 sm:py-7 max-w-[90%] sm:max-w-[500px] shadow-lg border-2 border-gray-300">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#FBCF03] rounded-full flex items-center justify-center">
                          <span className="text-black text-lg sm:text-xl">💬</span>
                        </div>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <p className="text-sm sm:text-base text-gray-900 font-medium leading-relaxed">
                            Voici l&apos;espace pour communiquer à propos de la prestation du{' '}
                            <span className="font-semibold text-gray-900">
                              {new Date(bookingRequest.booking_date).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </span>
                            .
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            Retrouvez les détails de votre évènement dans <span className="font-semibold text-gray-900">&quot;Voir l&apos;offre&quot;</span>.
                          </p>
                        </div>
                        {isClient && (
                          <div className="pt-1">
                            <p className="text-sm text-gray-700 leading-relaxed">
                              Pour confirmer définitivement votre réservation, appuyez sur <span className="font-bold text-gray-900">&quot;Finaliser&quot;</span>.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {!bookingRequest && (
                <p className="text-sm text-gray-400">Aucun message</p>
              )}
            </div>
          ) : (
            <>
              {messages.map((message) => {
                const senderRole = getParticipantRole(message.sender_email)
                const isChefMessage = senderRole === 'chef'
                const isClientMessage = senderRole === 'client'
                const isOwn = isOwnMessage(message)
                const isSystem = isSystemMessage(message.content)
                
                // eslint-disable-next-line react/no-unescaped-entities
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
                
                // Message système (notification) - Très voyant
                if (isSystem) {
                  const isMenuMessage = message.content.includes('Menu défini') || message.content.startsWith('✨ Menu')
                  let icon = 'ℹ️'
                  let bgColor = 'bg-[#FBCF03]'
                  let textColor = 'text-black'
                  let borderColor = 'border-[#FBCF03]'
                  
                  if (isMenuMessage) {
                    icon = '📋'
                    bgColor = 'bg-[#FBCF03]'
                    textColor = 'text-black'
                    borderColor = 'border-[#FBCF03]'
                  } else if (message.content.startsWith('✨')) {
                    icon = '✨'
                    bgColor = 'bg-[#FBCF03]'
                    textColor = 'text-black'
                    borderColor = 'border-[#FBCF03]'
                  } else if (message.content.startsWith('🗑️')) {
                    icon = '🗑️'
                    bgColor = 'bg-red-50'
                    textColor = 'text-red-700'
                    borderColor = 'border-red-200'
                  } else if (message.content.toLowerCase().includes('validée')) {
                    icon = '✅'
                    bgColor = 'bg-green-50'
                    textColor = 'text-green-700'
                    borderColor = 'border-green-200'
                  } else if (message.content.toLowerCase().includes('annulée')) {
                    icon = '❌'
                    bgColor = 'bg-red-50'
                    textColor = 'text-red-700'
                    borderColor = 'border-red-200'
                  } else if (message.content.toLowerCase().includes('extra') || message.content.toLowerCase().includes('convive') || message.content.toLowerCase().includes('modifié')) {
                    bgColor = 'bg-[#FBCF03]'
                    textColor = 'text-black'
                    borderColor = 'border-[#FBCF03]'
                  }
                  
                  const contentWithoutIcon = message.content.replace(/^[✨🗑️✅❌ℹ️📋]+\s*/, '')
                  // Sanitize content before rendering (extra safety layer)
                  const sanitizedContent = sanitizeMessage(contentWithoutIcon)
                  
                  // Format spécial pour les messages de menu
                  if (isMenuMessage) {
                    const menuLines = sanitizedContent.split('\n').filter(line => line.trim())
                    return (
                      <div key={message.id} className="flex justify-center my-4" data-message-id={message.id}>
                        <div 
                          className={`${bgColor} ${textColor} border-2 ${borderColor} rounded-xl px-5 py-4 max-w-[90%] shadow-lg cursor-pointer hover:shadow-xl transition-shadow`}
                          onClick={() => {
                            // Open menu modal when clicking on menu card
                            setShowMenuModal(true)
                          }}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-lg">{icon}</span>
                            <p className={`text-sm font-bold ${textColor}`}>
                              Menu défini
                            </p>
                          </div>
                          <div className="mt-3 pt-3 border-t border-black/20 space-y-3">
                            {menuLines.map((line, idx) => {
                              if (line.includes(':')) {
                                const [category, ...rest] = line.split(':')
                                const itemsText = rest.join(':').trim()
                                if (itemsText) {
                                  const items = itemsText.split('\n').filter(l => l.trim().startsWith('•'))
                                  return (
                                    <div key={idx} className="text-sm">
                                      <p className="font-semibold mb-1.5">{category.trim()}</p>
                                      <div className="pl-3 space-y-1">
                                        {items.map((item, i) => (
                                          <p key={i} className="text-sm">{item.trim()}</p>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                }
                              }
                              return null
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  }
                  
                  return (
                    <div key={message.id} className="flex justify-center my-4">
                      <div className={`${bgColor} ${textColor} border-2 ${borderColor} rounded-xl px-5 py-3 max-w-[90%] flex items-center gap-3 shadow-lg`}>
                        <span className="text-lg">{icon}</span>
                        <p className={`text-sm font-semibold text-center ${textColor}`}>
                          {sanitizedContent}
                        </p>
                      </div>
                    </div>
                  )
                }
                
                // Message normal - Chef à gauche en jaune, Client à droite
                return (
                  <div
                    key={message.id}
                    className={`flex mb-3 ${isChefMessage ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[75%] sm:max-w-[70%] flex flex-col ${isChefMessage ? 'items-start' : 'items-end'}`}>
                      {/* Nom de l'expéditeur - discret */}
                      <span className="text-[10px] text-gray-400 mb-0.5 px-1.5">
                        {getParticipantName(message.sender_email)}
                      </span>
                      
                      {/* Bulle de message */}
                      <div
                        className={`rounded-2xl px-4 py-2.5 ${
                          isChefMessage
                            ? 'bg-[#FBCF03] text-black rounded-bl-sm shadow-md'
                            : 'bg-white text-gray-900 rounded-br-sm border border-gray-300 shadow-md'
                        }`}
                      >
                        <div className={`text-[15px] leading-relaxed whitespace-pre-wrap break-words ${
                          isChefMessage ? 'text-black font-medium' : 'text-gray-900'
                        }`}>
                          {sanitizeMessage(message.content)}
                        </div>
                      </div>
                      
                      {/* Timestamp - très discret */}
                      <span className="text-[10px] text-gray-400 mt-0.5 px-1.5">
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

      {/* Input - Style moderne premium (désactivé si réservation annulée ou si admin) */}
      {!isBookingCancelled && !isAdmin && (
      <div className="flex-shrink-0 bg-white border-t border-gray-300/50 pb-safe">
        <form onSubmit={(e) => {
          e.preventDefault()
          if (!isDesktop) {
            // Sur mobile, le formulaire envoie avec Entrée
            handleSendMessage(e)
          }
          // Sur desktop, on envoie uniquement avec le bouton ou Shift+Entrée
        }} className="px-4 sm:px-6 py-3.5">
          <div className="flex items-end gap-2.5">
            {isDesktop ? (
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  // Sur desktop : Entrée = nouvelle ligne (comportement par défaut du textarea)
                  // Shift+Entrée ou Cmd+Entrée = envoyer
                  if (e.key === 'Enter' && (e.shiftKey || e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                  // Sinon, laisser Entrée créer une nouvelle ligne (comportement par défaut)
                }}
                placeholder="Tapez un message... (Entrée pour nouvelle ligne)"
                disabled={loading}
                rows={1}
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200/60 rounded-2xl text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-[#FBCF03]/40 focus:ring-2 focus:ring-[#FBCF03]/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden"
                style={{
                  minHeight: '44px',
                  maxHeight: '120px',
                }}
                onInput={(e) => {
                  // Auto-resize textarea
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                }}
              />
            ) : (
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Tapez un message..."
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200/60 rounded-2xl text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-[#FBCF03]/40 focus:ring-2 focus:ring-[#FBCF03]/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  minHeight: '44px',
                }}
              />
            )}
            <button
              type="submit"
              disabled={loading || !newMessage.trim()}
              className="flex-shrink-0 w-11 h-11 rounded-full bg-[#FBCF03] text-black hover:bg-[#FBCF03]/90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center shadow-sm hover:shadow disabled:shadow-none"
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
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>
      )}
      {/* Message pour admin (lecture seule) */}
      {isAdmin && (
        <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500 text-center">Mode lecture seule - Vous ne pouvez pas envoyer de messages</p>
        </div>
      )}

      {/* Modal d'offre - Design premium, compact pour tenir sur une page */}
      {showOfferModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowOfferModal(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header fixe */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-300 bg-white flex-shrink-0">
              <div className="flex-1">
                {bookingRequest?.service_type && (() => {
                  const getServiceTypeLabel = (type: string) => {
                    switch (type) {
                      case 'repas_domicile':
                        return 'Repas à domicile'
                      case 'cours_cuisine':
                        return 'Cours de Cuisine'
                      case 'mise_en_demeure':
                        return 'Mise en demeure'
                      default:
                        return 'Détails de l\'offre'
                    }
                  }
                  return (
                    <h2 className="text-xl font-semibold text-black">{getServiceTypeLabel(bookingRequest.service_type)}</h2>
                  )
                })()}
                {!bookingRequest?.service_type && (
              <h2 className="text-xl font-semibold text-black">Détails de l&apos;offre</h2>
                )}
              </div>
              {/* Bouton fermer - Plus visible sur mobile */}
              <button
                onClick={() => setShowOfferModal(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors sm:p-1.5 sm:bg-transparent sm:hover:bg-gray-100"
                aria-label="Fermer"
              >
                <span className="sm:hidden">Retour</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contenu scrollable compact */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-3.5 space-y-3 bg-gray-100">
              {/* Informations de la réservation */}
              {bookingRequest && (
                <div>
                  <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-[0.08em] mb-2 letter-spacing-tight">Informations</h3>
                  <div className="bg-white rounded-xl border border-gray-300 shadow-md p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Date ou Période selon le type de service */}
                      {(bookingRequest.service_type === 'repas_domicile' && bookingRequest.booking_date) ? (
                        <>
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
                          {bookingRequest.meal_time && (
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Moment du repas</p>
                              <p className="text-sm font-medium text-black">
                                {bookingRequest.meal_time === 'dejeuner' ? 'Déjeuner' : bookingRequest.meal_time === 'diner' ? 'Dîner' : bookingRequest.meal_time}
                              </p>
                            </div>
                          )}
                        </>
                      ) : bookingRequest.service_type === 'cours_cuisine' ? (
                        <>
                          {bookingRequest.budget && (
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Budget global</p>
                              <p className="text-sm font-medium text-black">
                                {typeof bookingRequest.budget === 'number' 
                                  ? `${bookingRequest.budget.toFixed(2)} €`
                                  : `${parseFloat(bookingRequest.budget).toFixed(2)} €`}
                              </p>
                            </div>
                          )}
                          {bookingRequest.course_topic && (
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Sujet du cours</p>
                              <p className="text-sm font-medium text-black">{bookingRequest.course_topic}</p>
                            </div>
                          )}
                        </>
                      ) : bookingRequest.service_type === 'mise_en_demeure' ? (
                        <>
                          {bookingRequest.selected_dates && Array.isArray(bookingRequest.selected_dates) && bookingRequest.selected_dates.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Dates sélectionnées</p>
                              <p className="text-sm font-medium text-black">
                                {bookingRequest.selected_dates.map((date: string) => 
                                  new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                                ).join(', ')}
                              </p>
                            </div>
                          )}
                          {bookingRequest.meal_options && Array.isArray(bookingRequest.meal_options) && bookingRequest.meal_options.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Options de repas</p>
                              <p className="text-sm font-medium text-black">
                                {bookingRequest.meal_options.map((opt: string) => 
                                  opt === 'pdj' ? 'Petit-déjeuner' : opt === 'dejeuner' ? 'Déjeuner' : 'Dîner'
                                ).join(', ')}
                              </p>
                            </div>
                          )}
                          {bookingRequest.total_price && (
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Prix global</p>
                              <p className="text-sm font-medium text-black">
                                {typeof bookingRequest.total_price === 'number' 
                                  ? `${bookingRequest.total_price.toFixed(2)} €`
                                  : `${parseFloat(bookingRequest.total_price).toFixed(2)} €`}
                              </p>
                            </div>
                          )}
                        </>
                      ) : null}
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Lieu</p>
                        <p className="text-sm font-medium text-black">{bookingRequest.city} {bookingRequest.postal_code}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Nombre de convives</p>
                          {isClient && canModifyBooking ? (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                // Use functional update to get current value and avoid stale closure
                                setGuestsCount((currentCount: number) => {
                                  const newCount = Math.max(1, currentCount - 1)
                                  handleGuestsChange(newCount)
                                  return newCount
                                })
                              }}
                              disabled={guestsCount <= 1 || updatingGuests}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-[#FBCF03] bg-[#FBCF03] hover:bg-[#FBCF03]/90 hover:border-[#FBCF03] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:border-gray-300 transition-all duration-150 shadow-sm hover:shadow"
                              aria-label="Diminuer"
                            >
                              <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                              </svg>
                            </button>
                            <span className="font-bold text-black min-w-[3rem] text-center text-sm">
                              {updatingGuests ? '...' : `${guestsCount} ${guestsCount === 1 ? 'convive' : 'convives'}`}
                            </span>
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                // Use functional update to get current value and avoid stale closure
                                setGuestsCount((currentCount: number) => {
                                  const newCount = currentCount + 1
                                  handleGuestsChange(newCount)
                                  return newCount
                                })
                              }}
                              disabled={updatingGuests}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-[#FBCF03] bg-[#FBCF03] hover:bg-[#FBCF03]/90 hover:border-[#FBCF03] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 shadow-sm hover:shadow"
                              aria-label="Augmenter"
                            >
                              <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 font-semibold min-w-[4rem]">Enfants :</span>
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                // Use functional update to get current value and avoid stale closure
                                setChildrenCount((currentChildren: number) => {
                                  const newCount = Math.max(0, currentChildren - 1)
                                  handleChildrenChange(newCount)
                                  return newCount
                                })
                              }}
                              disabled={updatingGuests}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-[#FBCF03] bg-[#FBCF03] hover:bg-[#FBCF03]/90 hover:border-[#FBCF03] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:border-gray-300 transition-all duration-150 shadow-sm hover:shadow"
                              aria-label="Diminuer enfants"
                            >
                              <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                              </svg>
                            </button>
                            <span className="font-bold text-black min-w-[2.5rem] text-center text-sm">
                              {updatingGuests ? '...' : childrenCount}
                            </span>
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                // Use functional updates to get current values and avoid stale closures
                                setGuestsCount((currentGuests: number) => {
                                  setChildrenCount((currentChildren: number) => {
                                    const newCount = Math.min(currentGuests, currentChildren + 1)
                                    handleChildrenChange(newCount, currentGuests)
                                    return newCount
                                  })
                                  return currentGuests
                                })
                              }}
                              disabled={updatingGuests}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-[#FBCF03] bg-[#FBCF03] hover:bg-[#FBCF03]/90 hover:border-[#FBCF03] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 shadow-sm hover:shadow"
                              aria-label="Augmenter enfants"
                            >
                              <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-black">
                          {bookingRequest.guests_count} {bookingRequest.guests_count === 1 ? 'convive' : 'convives'}
                        </p>
                      )}
                    </div>
                    {/* Allergies uniquement pour repas à domicile */}
                    {bookingRequest.service_type === 'repas_domicile' && bookingRequest.has_allergies && bookingRequest.allergies_details && (
                      <div className="pt-2.5 border-t border-gray-300">
                        <p className="text-xs text-gray-500 mb-0.5">Allergies</p>
                        <p className="text-sm text-black leading-relaxed break-words whitespace-pre-wrap overflow-wrap-anywhere">{bookingRequest.allergies_details}</p>
                      </div>
                    )}
                    {bookingRequest.notes && (
                      <div className="pt-2.5 border-t border-gray-300">
                        <p className="text-xs text-gray-500 mb-0.5">Notes</p>
                        <p className="text-sm text-black leading-relaxed break-words whitespace-pre-wrap overflow-wrap-anywhere">{bookingRequest.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Menu sélectionné - uniquement pour repas à domicile */}
              {bookingRequest?.service_type === 'repas_domicile' && menuDetails ? (
                <div>
                  <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-[0.08em] mb-2 letter-spacing-tight">Menu</h3>
                  <div className="bg-white rounded-xl border border-gray-300 shadow-md p-3.5">
                    <p className="text-base font-semibold text-black mb-1">{menuDetails.name}</p>
                    {menuDetails.description && (
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2">{menuDetails.description}</p>
                    )}
                    <div className="pt-2.5 border-t border-gray-300 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 font-medium">Prix par menu</span>
                        <span className="font-semibold text-black">{menuPrice.toFixed(2)} €</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 font-medium">Nombre de menus</span>
                        <span className="font-semibold text-black">{currentGuestsCount} {currentGuestsCount === 1 ? 'menu' : 'menus'}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-semibold pt-2.5 border-t border-gray-300">
                        <span className="text-black">Sous-total</span>
                        <span className="text-black font-bold">{menuTotal.toFixed(2)} €</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : bookingRequest?.service_type === 'repas_domicile' ? (
                <div>
                  <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-[0.08em] mb-2 letter-spacing-tight">Menu</h3>
                  <div className="bg-white rounded-xl border border-gray-300 shadow-md p-3.5">
                    <p className="text-sm text-gray-500">Aucun menu sélectionné</p>
                  </div>
                </div>
              ) : null}

              {/* Extras */}
              <div>
                <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-[0.08em] mb-2 letter-spacing-tight">Extras</h3>
                {extras.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {extras.map((extra, index) => (
                      <div key={index} className="flex items-center justify-between bg-white rounded-lg border border-gray-300 shadow-md p-2.5">
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
                  <div className="bg-white rounded-xl border border-gray-300 shadow-md p-3">
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-xs font-semibold text-black">Ajouter un extra</p>
                      <button
                        onClick={handleAddExtra}
                        disabled={!newExtraName.trim() || !newExtraPrice.trim() || savingExtras}
                        className="px-3 py-1.5 text-xs font-semibold text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 active:bg-[#FBCF03]/80 rounded-md transition-all duration-150 shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingExtras ? '...' : 'Ajouter'}
                      </button>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newExtraName}
                        onChange={(e) => setNewExtraName(e.target.value)}
                        placeholder="Nom de l&apos;extra"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/30 focus:border-[#FBCF03]/40 text-sm transition-all duration-150"
                        disabled={savingExtras}
                      />
                      <input
                        type="number"
                        value={newExtraPrice}
                        onChange={(e) => setNewExtraPrice(e.target.value)}
                        placeholder="Prix (€)"
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/30 focus:border-[#FBCF03]/40 text-sm transition-all duration-150"
                        disabled={savingExtras}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="pt-3.5 border-t border-gray-300">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-black tracking-tight">Total</span>
                  <span className="text-xl font-bold text-black tracking-tight">{totalPrice.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            {/* Footer avec CTA clair */}
            <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-t border-gray-300 bg-white">
              {hasUnsavedChanges && canModifyBooking ? (
                <button
                  onClick={handleSaveChanges}
                  disabled={savingExtras || updatingGuests}
                  className="w-full px-4 py-3 text-sm font-semibold text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 active:bg-[#FBCF03]/80 rounded-xl transition-all duration-150 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingExtras || updatingGuests ? 'Sauvegarde...' : 'Valider les modifications'}
                </button>
              ) : (
                <button
                  onClick={() => setShowOfferModal(false)}
                  className="w-full px-4 py-3 text-sm font-semibold text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 active:bg-[#FBCF03]/80 rounded-xl transition-all duration-150 shadow-md hover:shadow-lg"
                >
                  Fermer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Menu - Affiche le menu défini par le chef */}
      {showMenuModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowMenuModal(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-300 bg-white flex-shrink-0">
              <h2 className="text-xl font-semibold text-black">Menu</h2>
              <button
                onClick={() => setShowMenuModal(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors sm:p-1.5 sm:bg-transparent sm:hover:bg-gray-100"
                aria-label="Fermer"
              >
                <span className="sm:hidden">Retour</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
              {(() => {
                const categoryLabels: Record<string, string> = {
                  aperitifs: 'Apéritifs',
                  mise_en_bouche: 'Mise en bouche',
                  entree: 'Entrée',
                  plat: 'Plat',
                  dessert: 'Dessert',
                  mignardises: 'Mignardises',
                }

                const hasAnyItems = Object.values(menuCategories).some(items => Array.isArray(items) && items.length > 0)

                if (!hasAnyItems) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-gray-500">Aucun menu défini pour le moment.</p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-4">
                    {Object.entries(categoryLabels).map(([key, label]) => {
                      const items = menuCategories[key as keyof typeof menuCategories]
                      if (!Array.isArray(items) || items.length === 0) {
                        return null
                      }

                      return (
                        <div key={key} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                          <h3 className="text-sm font-semibold text-black mb-3 uppercase tracking-wide">{label}</h3>
                          <ul className="space-y-2">
                            {items.map((item: string, index: number) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="text-[#FBCF03] mt-1">•</span>
                                <span className="text-sm text-black flex-1">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-t border-gray-300 bg-white">
              <button
                onClick={() => setShowMenuModal(false)}
                className="w-full px-4 py-3 text-sm font-semibold text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 active:bg-[#FBCF03]/80 rounded-xl transition-all duration-150 shadow-md hover:shadow-lg"
              >
                Fermer
              </button>
            </div>
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
                  {bookingRequest.meal_time && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Moment du repas</span>
                      <span className="font-medium text-black">
                        {bookingRequest.meal_time === 'dejeuner' ? 'Déjeuner' : bookingRequest.meal_time === 'diner' ? 'Dîner' : bookingRequest.meal_time}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Chef</span>
                    <span className="font-medium text-black">{getChefName()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Nombre de convives</span>
                    <span className="font-medium text-black">
                      {bookingRequest.guests_count} {bookingRequest.guests_count === 1 ? 'convive' : 'convives'}
                    </span>
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

      {/* Modal d&apos;information (client uniquement) */}
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
                {/* Voir l&apos;offre */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowInfoModal(false)
                      setShowOfferModal(true)
                    }}
                    className="px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white/80 border border-gray-300/60 hover:bg-white hover:border-gray-400 rounded-lg transition-all shadow-sm hover:shadow flex-shrink-0"
                  >
                    Voir l&apos;offre
                  </button>
                  <p className="text-xs text-gray-500 flex-1">Consulter les détails de votre réservation</p>
                </div>

                {/* Menu (chef only) */}
                {isChef && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setShowInfoModal(false)
                        setShowMenuModal(true)
                      }}
                      className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 active:bg-[#FBCF03]/80 rounded-lg transition-all shadow-sm hover:shadow flex-shrink-0"
                    >
                      Menu
                    </button>
                    <p className="text-xs text-gray-500 flex-1">Définir et partager le menu détaillé de la prestation (apéritifs, entrées, plats, desserts, etc.)</p>
                  </div>
                )}

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

              {/* Système d'étapes visuelles - Stepper moderne premium */}
              {bookingRequest && (() => {
                const isCompleted = bookingStatus === 'completed'
                const isCancelled = bookingStatus === 'cancelled'
                const isStep1Complete = true // Chef/Client trouvé - toujours complété
                const isStep2Complete = bookingStatus === 'validated_by_client' || isCompleted
                const isStep3Complete = isCompleted // Paiement complété si mission terminée
                const isStep3Active = (isStep2Complete && !isCancelled && !isCompleted) // Paiement actif si step 2 complété mais pas encore terminé
                const isStep4Complete = isCompleted // Prestation confirmée si mission terminée
                
                const currentStep = isCompleted ? 4 : isStep2Complete ? 3 : isStep1Complete ? 2 : 1
                
                return (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-black mb-6">Progression de la réservation</h3>
                    
                    {/* Stepper vertical avec lignes de connexion */}
                    <div className="relative">
                      {/* Ligne de progression verticale */}
                      <div className="absolute left-5 top-0 bottom-0 w-0.5">
                        {/* Ligne complétée */}
                        <div 
                          className={`absolute top-0 left-0 w-full transition-all duration-500 ease-out ${
                            isCompleted
                              ? 'bg-[#FBCF03] h-full'
                              : isStep3Complete
                              ? 'bg-[#FBCF03] h-3/4'
                              : isStep2Complete 
                              ? 'bg-[#FBCF03] h-1/2' 
                              : isStep1Complete 
                              ? 'bg-[#FBCF03] h-1/4'
                              : 'bg-gray-200 h-0'
                          }`}
                          style={{ 
                            height: isCompleted ? '100%' : isStep3Complete ? '75%' : isStep2Complete ? '50%' : isStep1Complete ? '25%' : '0%' 
                          }}
                        />
                        {/* Ligne en attente */}
                        <div 
                          className={`absolute top-0 left-0 w-full bg-gray-200 transition-all duration-500 ${
                            isCompleted ? 'h-0' : isStep3Complete ? 'h-1/4' : isStep2Complete ? 'h-1/2' : isStep1Complete ? 'h-3/4' : 'h-full'
                          }`}
                          style={{ 
                            top: isCompleted ? '100%' : isStep3Complete ? '75%' : isStep2Complete ? '50%' : isStep1Complete ? '25%' : '0%',
                            height: isCompleted ? '0%' : isStep3Complete ? '25%' : isStep2Complete ? '50%' : isStep1Complete ? '75%' : '100%'
                          }}
                        />
                      </div>

                      <div className="relative space-y-6">
                        {/* Étape 1: Chef/Client trouvé (toujours complétée) */}
                        <div className="relative flex items-start gap-4">
                          {/* Icône de l'étape */}
                          <div className="relative flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-[#FBCF03] flex items-center justify-center shadow-lg shadow-[#FBCF03]/30 ring-4 ring-[#FBCF03]/10 transition-all duration-300">
                              <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            {/* Badge de complétion */}
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-[#FBCF03]" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                          
                          {/* Contenu de l'étape */}
                          <div className="flex-1 pt-1.5">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-semibold text-black">
                                {isClient ? 'Chef sélectionné' : 'Client trouvé'}
                              </p>
                              <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/20 text-[#FBCF03] rounded-full">
                                Complété
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">
                              {isClient 
                                ? 'Votre demande a été acceptée par le chef'
                                : 'La demande de réservation a été reçue'
                              }
                            </p>
                          </div>
                        </div>

                        {/* Étape 2: Prestation validée */}
                        <div className="relative flex items-start gap-4">
                          {/* Icône de l'étape */}
                          <div className="relative flex-shrink-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                              isStep2Complete
                                ? 'bg-[#FBCF03] shadow-lg shadow-[#FBCF03]/30 ring-4 ring-[#FBCF03]/10 scale-105'
                                : currentStep === 2
                                ? 'bg-white border-2 border-[#FBCF03] shadow-md shadow-[#FBCF03]/20 ring-2 ring-[#FBCF03]/20 scale-105'
                                : 'bg-gray-100 border-2 border-gray-300'
                            }`}>
                              {isStep2Complete ? (
                                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : currentStep === 2 ? (
                                <svg className="w-5 h-5 text-[#FBCF03]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : (
                                <div className="w-3 h-3 rounded-full bg-gray-400" />
                              )}
                            </div>
                            {isStep2Complete && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-[#FBCF03]" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          
                          {/* Contenu de l'étape */}
                          <div className="flex-1 pt-1.5">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`text-sm font-semibold transition-colors ${
                                isStep2Complete 
                                  ? 'text-black' 
                                  : currentStep === 2 
                                  ? 'text-[#FBCF03]'
                                  : 'text-gray-400'
                              }`}>
                                Prestation validée
                              </p>
                              {isStep2Complete ? (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/20 text-[#FBCF03] rounded-full">
                                  Complété
                                </span>
                              ) : currentStep === 2 ? (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/10 text-[#FBCF03] rounded-full animate-pulse">
                                  En cours
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-400 rounded-full">
                                  En attente
                                </span>
                              )}
                            </div>
                            <p className={`text-xs leading-relaxed transition-colors ${
                              isStep2Complete ? 'text-gray-600' : currentStep === 2 ? 'text-gray-600' : 'text-gray-400'
                            }`}>
                              {isStep2Complete 
                                ? 'La réservation a été confirmée'
                                : 'En attente de validation'
                              }
                            </p>
                          </div>
                        </div>

                        {/* Étape 3: Paiement */}
                        <div className="relative flex items-start gap-4">
                          {/* Icône de l'étape */}
                          <div className="relative flex-shrink-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                              isStep3Complete
                                ? 'bg-[#FBCF03] shadow-lg shadow-[#FBCF03]/30 ring-4 ring-[#FBCF03]/10 scale-105'
                                : isStep3Active
                                ? 'bg-white border-2 border-[#FBCF03] shadow-md shadow-[#FBCF03]/20 ring-2 ring-[#FBCF03]/20 scale-105'
                                : 'bg-gray-100 border-2 border-gray-300'
                            }`}>
                              {isStep3Complete ? (
                                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : isStep3Active ? (
                                <svg className="w-5 h-5 text-[#FBCF03]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : (
                                <div className="w-3 h-3 rounded-full bg-gray-400" />
                              )}
                            </div>
                            {isStep3Complete && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-[#FBCF03]" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          
                          {/* Contenu de l'étape */}
                          <div className="flex-1 pt-1.5">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`text-sm font-semibold transition-colors ${
                                isStep3Complete 
                                  ? 'text-black' 
                                  : isStep3Active 
                                  ? 'text-[#FBCF03]' 
                                  : 'text-gray-400'
                              }`}>
                                {isClient ? 'Paiement en attente' : 'Client paye'}
                              </p>
                              {isStep3Complete ? (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/20 text-[#FBCF03] rounded-full">
                                  Complété
                                </span>
                              ) : isStep3Active ? (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/10 text-[#FBCF03] rounded-full animate-pulse">
                                  En cours
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-400 rounded-full">
                                  En attente
                                </span>
                              )}
                            </div>
                            <p className={`text-xs leading-relaxed transition-colors ${
                              isStep3Complete ? 'text-gray-600' : isStep3Active ? 'text-gray-600' : 'text-gray-400'
                            }`}>
                              {isStep3Complete
                                ? 'Le paiement a été effectué'
                                : isStep3Active
                                ? (isClient 
                                  ? 'Un lien de paiement vous sera envoyé par email sous 24h'
                                  : 'Le client va procéder au paiement. Vous serez notifié dès que le paiement sera effectué.'
                                )
                                : 'En attente de validation de la réservation'
                              }
                            </p>
                          </div>
                        </div>

                        {/* Étape 4: Prestation confirmée */}
                        <div className="relative flex items-start gap-4">
                          {/* Icône de l'étape */}
                          <div className="relative flex-shrink-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                              isStep4Complete
                                ? 'bg-[#FBCF03] shadow-lg shadow-[#FBCF03]/30 ring-4 ring-[#FBCF03]/10 scale-105'
                                : 'bg-gray-100 border-2 border-gray-300'
                            }`}>
                              {isStep4Complete ? (
                                <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <div className="w-3 h-3 rounded-full bg-gray-400" />
                              )}
                            </div>
                            {isStep4Complete && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-[#FBCF03]" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          
                          {/* Contenu de l'étape */}
                          <div className="flex-1 pt-1.5">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`text-sm font-semibold transition-colors ${
                                isStep4Complete ? 'text-black' : 'text-gray-400'
                              }`}>
                                Prestation confirmée
                              </p>
                              {isStep4Complete ? (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/20 text-[#FBCF03] rounded-full">
                                  Complété
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-400 rounded-full">
                                  En attente
                                </span>
                              )}
                            </div>
                            <p className={`text-xs leading-relaxed transition-colors ${
                              isStep4Complete ? 'text-gray-600' : 'text-gray-400'
                            }`}>
                              {isStep4Complete 
                                ? 'La prestation a été livrée avec succès'
                                : 'En attente du paiement'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Avertissement de sécurité */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Pour des raisons de sécurité, merci de ne pas partager d&apos;informations personnelles (email, numéro de téléphone, coordonnées bancaires) dans la messagerie.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Menu (chef uniquement) */}
      {showMenuModal && isChef && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowMenuModal(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-300 bg-white flex-shrink-0">
              <h2 className="text-xl font-semibold text-black">Menu</h2>
              <button
                onClick={() => setShowMenuModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Fermer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 bg-gray-100 space-y-4">
              {(['aperitifs', 'mise_en_bouche', 'entree', 'plat', 'dessert', 'mignardises'] as MenuCategory[]).map((category) => {
                const categoryLabels: Record<MenuCategory, string> = {
                  aperitifs: 'Apéritifs',
                  mise_en_bouche: 'Mise en bouche',
                  entree: 'Entrée',
                  plat: 'Plat',
                  dessert: 'Dessert',
                  mignardises: 'Mignardises',
                }
                const items = menuCategories[category]

                return (
                  <div key={category} className="bg-white rounded-xl border border-gray-300 shadow-md p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900">{categoryLabels[category]}</h3>
                    </div>
                    <div className="space-y-2">
                      {items.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                          <span className="flex-1 text-sm text-gray-900">{item}</span>
                          <button
                            onClick={() => handleRemoveMenuItem(category, index)}
                            className="p-1 hover:bg-red-50 rounded transition-colors"
                            aria-label="Supprimer"
                          >
                            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newMenuItems[category]}
                          onChange={(e) => handleNewMenuItemChange(category, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newMenuItems[category].trim()) {
                              e.preventDefault()
                              handleAddMenuItem(category)
                            }
                          }}
                          placeholder={`Ajouter un ${categoryLabels[category].toLowerCase()}...`}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/30 focus:border-[#FBCF03]/40 transition-all"
                        />
                        <button
                          onClick={() => handleAddMenuItem(category)}
                          disabled={!newMenuItems[category].trim()}
                          className="px-3 py-2 text-sm font-medium text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Ajouter
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer avec bouton sauvegarder */}
            <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-t border-gray-300 bg-white">
              <button
                onClick={handleSaveMenu}
                disabled={savingMenu}
                className="w-full px-4 py-3 text-sm font-semibold text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 active:bg-[#FBCF03]/80 rounded-xl transition-all duration-150 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingMenu ? 'Sauvegarde...' : 'Enregistrer le menu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

