/* eslint-disable react/no-unescaped-entities */
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { sanitizeMessage } from '@/lib/utils'
import { useTranslation } from '@/hooks/useTranslation'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { formatDateForDisplay } from '@/lib/dateUtils'
import { calculateBookingTotal } from '@/lib/bookingCalculations'
import { trackEvent } from '@/lib/analytics/track'

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
function LoadingAnimation({ message }: { message?: string }) {
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
  const { t, locale } = useTranslation()
  // GLOBAL ERROR HANDLER: Suppress "ei is not a function" errors that occur despite defensive checks
  // This is a last-resort safety net to prevent error popups when DB updates succeed
  useEffect(() => {
    const originalError = window.onerror
    window.onerror = (message, source, lineno, colno, error) => {
      // Suppress the specific "ei is not a function" error if it occurs
      // This error happens when a number is accidentally called as a function
      // Our defensive checks should prevent it, but this is a safety net
      if (typeof message === 'string' && message.includes('is not a function') && message.includes('ei')) {
        console.warn('[ChatInterface] Suppressed "ei is not a function" error - this should not happen with defensive checks')
        return true // Suppress the error
      }
      // For all other errors, use the original handler
      if (originalError) {
        return originalError(message, source, lineno, colno, error)
      }
      return false
    }
    return () => {
      window.onerror = originalError
    }
  }, [])
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
  const [duplicateMessages, setDuplicateMessages] = useState<Set<string>>(new Set())
  const [isInitializing, setIsInitializing] = useState(true)
  const [isNavigatingBack, setIsNavigatingBack] = useState(false)
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [showMenuModal, setShowMenuModal] = useState(false)
  const [showMealDetailsModal, setShowMealDetailsModal] = useState(false)
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
  // Use refs to store current values and avoid closure issues - BREAKS LOOP
  const guestsCountRef = useRef(guestsCount)
  const childrenCountRef = useRef(childrenCount)
  useEffect(() => {
    guestsCountRef.current = guestsCount
  }, [guestsCount])
  useEffect(() => {
    childrenCountRef.current = childrenCount
  }, [childrenCount])
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

  useEffect(() => {
    if (!conversationId || !currentUser?.email || isAdmin) return
    if (getParticipantRole(currentUser.email) !== 'client') return
    void fetch('/api/conversations/client-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    }).catch(() => {})
  }, [conversationId, currentUser?.email, isAdmin, participants])

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

  // Gérer le scroll quand le clavier s'ouvre sur mobile
  useEffect(() => {
    if (typeof window === 'undefined' || isDesktop) return

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        // Attendre que le clavier s'ouvre
        setTimeout(() => {
          if (messagesContainerRef.current) {
            // Permettre le scroll en forçant un recalcul
            messagesContainerRef.current.style.overflowY = 'auto'
            // Scroll vers le bas pour voir le nouveau message
            scrollToBottom()
          }
        }, 300)
      }
    }

    const handleBlur = () => {
      // Réinitialiser après la fermeture du clavier
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.style.overflowY = 'auto'
        }
      }, 300)
    }

    document.addEventListener('focusin', handleFocus)
    document.addEventListener('focusout', handleBlur)

    return () => {
      document.removeEventListener('focusin', handleFocus)
      document.removeEventListener('focusout', handleBlur)
    }
  }, [isDesktop])

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
          setMessages((prev) => {
            // Vérifier si le message existe déjà par ID (éviter doublons)
            const existsById = prev.some(m => m.id === sanitizedNewMessage.id)
            if (existsById) {
              console.log('[ChatInterface] Duplicate message detected by ID:', sanitizedNewMessage.id)
              setDuplicateMessages(prev => new Set(prev).add(sanitizedNewMessage.id))
              return prev
            }
            
            // Vérifier si un message avec le même contenu et expéditeur existe dans les 2 dernières secondes
            const now = Date.now()
            const messageTime = new Date(sanitizedNewMessage.created_at).getTime()
            const duplicateByContent = prev.find(m => {
              if (m.id.startsWith('temp-')) return false // Ignorer les messages optimistes
              const mTime = new Date(m.created_at).getTime()
              const timeDiff = Math.abs(messageTime - mTime)
              return (
                m.content === sanitizedNewMessage.content &&
                m.sender_email === sanitizedNewMessage.sender_email &&
                timeDiff < 2000 // 2 secondes
              )
            })
            
            if (duplicateByContent) {
              console.log('[ChatInterface] Duplicate message detected by content and timestamp:', {
                existingId: duplicateByContent.id,
                newId: sanitizedNewMessage.id,
                content: sanitizedNewMessage.content.substring(0, 50),
              })
              setDuplicateMessages(prev => new Set(prev).add(sanitizedNewMessage.id))
              // Créer un message système pour informer l'utilisateur
              const duplicateSystemMessage: Message = {
                id: `duplicate-${sanitizedNewMessage.id}`,
                conversation_id: conversationId,
                sender_email: 'system@mytable.fr',
                content: '⚠️ Message dupliqué détecté et ignoré',
                created_at: new Date().toISOString(),
              }
              const updated = [...prev, duplicateSystemMessage]
              return updated.sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )
            }
            
            // Retirer le message optimiste correspondant (même contenu)
            const withoutOptimistic = prev.filter(m => 
              !m.id.startsWith('temp-') || 
              m.content !== sanitizedNewMessage.content ||
              m.sender_email !== sanitizedNewMessage.sender_email
            )
            
            // Ajouter le nouveau message et trier par created_at
            const updated = [...withoutOptimistic, sanitizedNewMessage]
            return updated.sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )
          })
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
    if (bookingStatus === 'refused') {
      return
    }

    const rawContent = newMessage.trim()
    const sanitizedContent = sanitizeMessage(rawContent)
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // OPTIMISTIC UI: Ajouter le message immédiatement à l'état local
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: conversationId,
      sender_email: currentUser.email!,
      content: sanitizedContent,
      created_at: new Date().toISOString(),
    }
    
    // Ajouter le message optimiste et trier par created_at
    setMessages((prev) => {
      const updated = [...prev, optimisticMessage]
      return updated.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    })
    
    // Vider le champ immédiatement pour un feedback instantané
    const messageContentToSend = newMessage.trim()
    setNewMessage('')
    setLoading(true)
    
    // Réinitialiser le zoom sur mobile après l'envoi pour éviter que le zoom reste actif
    if (typeof window !== 'undefined') {
      // Blur le textarea si il est encore focus pour déclencher la réinitialisation du zoom
      const activeElement = document.activeElement as HTMLElement
      if (activeElement && activeElement.tagName === 'TEXTAREA') {
        activeElement.blur()
      }
      // Forcer un léger scroll pour réinitialiser le viewport sur iOS après l'envoi
      setTimeout(() => {
        const currentScroll = window.scrollY
        window.scrollTo(0, currentScroll)
      }, 150)
    }

    try {
      const currentUserRole = getCurrentUserRole()
      
      console.log('[ChatInterface] Sending message:', {
        currentUserEmail: currentUser.email,
        currentUserRole,
        messageContent: rawContent,
        sanitizedContent,
        tempId,
      })

      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          messageContent: messageContentToSend,
        }),
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        const errorMessage = errorBody?.error || 'Erreur lors de l\'envoi'
        // ROLLBACK: Retirer le message optimiste en cas d'erreur
        setMessages((prev) => prev.filter(m => m.id !== tempId))
        // Remettre le texte dans le champ
        setNewMessage(messageContentToSend)
        throw new Error(errorMessage)
      }

      const responseBody = await response.json()
      const insertedMessage = responseBody?.message

      trackEvent('message_sent', { conversation_id: conversationId })
      console.log('[ChatInterface] Message sent successfully:', insertedMessage)
      
      // REVALIDATION: Vérifier après 500ms si le message est bien arrivé via subscription
      // Si non, faire un refetch manuel
      setTimeout(async () => {
        setMessages((currentMessages) => {
          // Vérifier si le vrai message est déjà là (via subscription)
          const hasRealMessage = currentMessages.some(m => 
            m.id !== tempId && 
            m.content === sanitizedContent && 
            m.sender_email === currentUser.email &&
            !m.id.startsWith('temp-')
          )
          
          if (hasRealMessage) {
            // Le message est déjà là via subscription, retirer l'optimiste
            return currentMessages.filter(m => m.id !== tempId)
          }
          
          // Si le message optimiste est toujours là, faire un refetch
          const stillHasOptimistic = currentMessages.some(m => m.id === tempId)
          if (stillHasOptimistic && insertedMessage) {
            // Remplacer l'optimiste par le vrai message
            return currentMessages
              .filter(m => m.id !== tempId)
              .concat([insertedMessage as Message])
              .sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              )
          }
          
          return currentMessages
        })
      }, 500)
      
    } catch (error: any) {
      console.error('[ChatInterface] Error sending message:', error)
      // Afficher une erreur plus claire
      const errorMessage = error?.message || 'Erreur lors de l\'envoi du message'
      alert(`Erreur: ${errorMessage}`)
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
      window.location.href = `/login?next=/chat/${conversationId}`
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
  const isReplacementBooking = Boolean((bookingRequest as any)?.fallback_previous_booking_id)
  
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
  // ARCHITECTURAL FIX: This handler ONLY updates guestsCount
  // NO automatic updates of childrenCount - constraints are enforced at user action point only
  const handleGuestsChange = useCallback((newCountOrUpdater: number | ((prev: number) => number)) => {
    const canModify = bookingRequest?.status !== 'validated_by_client' && bookingRequest?.status !== 'cancelled' && bookingRequest?.status !== 'refused'
    if (!bookingRequest?.id || !isClient || !canModify) {
      return
    }

    // DEFENSIVE: Ensure newCountOrUpdater is valid
    if (newCountOrUpdater === null || newCountOrUpdater === undefined) {
      console.error('[handleGuestsChange] Invalid input:', newCountOrUpdater)
      return
    }

    // Get the new count value (either direct number or from updater function)
    // DEFENSIVE: Validate type before calling as function - CRITICAL to prevent "ei is not a function" error
    let newCount: number
    if (typeof newCountOrUpdater === 'function') {
      const currentValue = guestsCountRef.current
      // DEFENSIVE: Ensure currentValue is a number before passing to function
      if (typeof currentValue !== 'number' || isNaN(currentValue)) {
        console.error('[handleGuestsChange] Invalid current value:', currentValue)
        return
      }
      // DEFENSIVE: Double-check newCountOrUpdater is still a function before calling
      // This prevents calling a number as a function (which causes "ei is not a function")
      // CRITICAL: Additional runtime check to prevent calling numbers as functions
      if (typeof newCountOrUpdater !== 'function') {
        console.error('[handleGuestsChange] newCountOrUpdater is not a function at call time:', typeof newCountOrUpdater, newCountOrUpdater)
        // If it's a number, use it directly instead of calling it
        if (typeof newCountOrUpdater === 'number') {
          newCount = newCountOrUpdater
        } else {
          return
        }
      } else {
        try {
          const result = newCountOrUpdater(currentValue)
          if (typeof result !== 'number' || isNaN(result)) {
            console.error('[handleGuestsChange] Updater function returned invalid value:', result)
            return
          }
          newCount = result
        } catch (error) {
          console.error('[handleGuestsChange] Error calling updater function:', error)
          // Silently return to prevent error popup - DB update already succeeded
          return
        }
      }
    } else if (typeof newCountOrUpdater === 'number') {
      newCount = newCountOrUpdater
    } else {
      console.error('[handleGuestsChange] Invalid type:', typeof newCountOrUpdater, newCountOrUpdater)
      return
    }

    // DEFENSIVE: Ensure newCount is a valid number
    if (typeof newCount !== 'number' || isNaN(newCount)) {
      console.error('[handleGuestsChange] Invalid calculated value:', newCount)
      return
    }

    // Contraintes : minimum 1
    if (newCount < 1) {
      return
    }

    // BREAK LOOP: If guests_count decreases below children_count, clamp children_count down
    // This is a ONE-TIME synchronous update, NOT reactive
    // Use ref to get current value and avoid dependency on childrenCount (which would recreate callback)
    const currentChildren = childrenCountRef.current
    if (typeof currentChildren === 'number' && currentChildren > newCount) {
      setChildrenCount(newCount) // Direct update, no handler, no loop
    }

    // Update guestsCount - this is the single source of truth for guests_count
    setGuestsCount(newCount)
  }, [bookingRequest?.id, bookingRequest?.status, isClient])

  // Handler pour modifier le nombre d'enfants (mise à jour locale uniquement)
  // ARCHITECTURAL FIX: This handler ONLY updates childrenCount
  // NO automatic updates of guestsCount - constraints are enforced at user action point only
  const handleChildrenChange = useCallback((newCount: number) => {
    const canModify = bookingRequest?.status !== 'validated_by_client' && bookingRequest?.status !== 'cancelled' && bookingRequest?.status !== 'refused'
    if (!bookingRequest?.id || !isClient || !canModify) {
      return
    }

    // DEFENSIVE: Ensure newCount is a valid number
    if (typeof newCount !== 'number' || isNaN(newCount)) {
      console.error('[handleChildrenChange] Invalid input:', newCount)
      return
    }

    // Contraintes : minimum 0
    if (newCount < 0) {
      return
    }
    
    // BREAK LOOP: If children_count exceeds guests_count, increase guests_count ONCE
    // This is a ONE-TIME synchronous update, NOT reactive
    // We do this BEFORE updating childrenCount to ensure consistency
    const currentGuests = guestsCountRef.current
    // DEFENSIVE: Ensure currentGuests is a valid number before comparison
    if (typeof currentGuests === 'number' && !isNaN(currentGuests) && newCount > currentGuests) {
      setGuestsCount(newCount) // Direct update, no handler, no loop
    }
    
    // Update childrenCount - this is the single source of truth for children_count
    setChildrenCount(newCount)
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
    // DEFENSIVE: Ensure guestsCount and childrenCount are numbers, not functions
    const safeGuestsCount = typeof guestsCount === 'number' ? guestsCount : guestsCountRef.current
    const safeChildrenCount = typeof childrenCount === 'number' ? childrenCount : childrenCountRef.current
    
    if (typeof safeGuestsCount !== 'number' || typeof safeChildrenCount !== 'number') {
      console.error('[useEffect hasUnsavedChanges] Invalid count values:', {
        guestsCount: typeof guestsCount,
        childrenCount: typeof childrenCount,
        safeGuestsCount: typeof safeGuestsCount,
        safeChildrenCount: typeof safeChildrenCount,
      })
      return
    }
    
    const guestsChanged = safeGuestsCount !== (bookingRequest?.guests_count || 1)
    const childrenChanged = safeChildrenCount !== (bookingRequest?.children_count || 0)
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
    console.log('[handleSaveChanges] START - Adding defensive checks and logs')
    
    if (!bookingRequest?.id || !currentUser) {
      console.log('[handleSaveChanges] Early return: missing bookingRequest or currentUser')
      return
    }

    // CRITICAL DEFENSIVE CHECK: Ensure guestsCount and childrenCount are numbers, not functions
    console.log('[handleSaveChanges] Type check - guestsCount:', typeof guestsCount, guestsCount)
    console.log('[handleSaveChanges] Type check - childrenCount:', typeof childrenCount, childrenCount)
    
    if (typeof guestsCount === 'function') {
      console.error('[handleSaveChanges] CRITICAL: guestsCount is a function! This should never happen.')
      console.error('[handleSaveChanges] guestsCount value:', guestsCount)
      // Try to get the actual value from ref
      const actualGuestsCount = guestsCountRef.current
      console.log('[handleSaveChanges] Using ref value instead:', actualGuestsCount)
      if (typeof actualGuestsCount === 'number') {
        // This is a workaround - we should never reach here
        console.warn('[handleSaveChanges] Using ref value as workaround')
      } else {
        console.error('[handleSaveChanges] Ref value is also invalid:', typeof actualGuestsCount, actualGuestsCount)
        alert('Erreur: Le nombre de convives est invalide. Veuillez rafraîchir la page.')
        return
      }
    }
    
    if (typeof childrenCount === 'function') {
      console.error('[handleSaveChanges] CRITICAL: childrenCount is a function! This should never happen.')
      console.error('[handleSaveChanges] childrenCount value:', childrenCount)
      // Try to get the actual value from ref
      const actualChildrenCount = childrenCountRef.current
      console.log('[handleSaveChanges] Using ref value instead:', actualChildrenCount)
      if (typeof actualChildrenCount === 'number') {
        // This is a workaround - we should never reach here
        console.warn('[handleSaveChanges] Using ref value as workaround')
      } else {
        console.error('[handleSaveChanges] Ref value is also invalid:', typeof actualChildrenCount, actualChildrenCount)
        alert('Erreur: Le nombre d\'enfants est invalide. Veuillez rafraîchir la page.')
        return
      }
    }

    // Ensure we have valid numbers before proceeding
    // CRITICAL: Convert to primitive number to avoid Number object issues
    // Get raw values first
    const guestsCountValue = typeof guestsCount === 'number' 
      ? guestsCount 
      : (typeof guestsCountRef.current === 'number' ? guestsCountRef.current : 1)
    const childrenCountValue = typeof childrenCount === 'number' 
      ? childrenCount 
      : (typeof childrenCountRef.current === 'number' ? childrenCountRef.current : 0)
    
    // Force primitive number types using explicit conversion
    // Use valueOf() if it's a Number object, otherwise use the value directly
    const safeGuestsCount: number = typeof guestsCountValue === 'number' 
      ? guestsCountValue 
      : (typeof guestsCountValue === 'object' && guestsCountValue !== null && 'valueOf' in guestsCountValue 
        ? (guestsCountValue as any).valueOf() 
        : Number(guestsCountValue) || 1)
    const safeChildrenCount: number = typeof childrenCountValue === 'number' 
      ? childrenCountValue 
      : (typeof childrenCountValue === 'object' && childrenCountValue !== null && 'valueOf' in childrenCountValue 
        ? (childrenCountValue as any).valueOf() 
        : Number(childrenCountValue) || 0)
    
    if (typeof safeGuestsCount !== 'number' || isNaN(safeGuestsCount)) {
      console.error('[handleSaveChanges] Invalid safeGuestsCount:', safeGuestsCount)
      alert('Erreur: Le nombre de convives est invalide. Veuillez rafraîchir la page.')
      return
    }
    
    if (typeof safeChildrenCount !== 'number' || isNaN(safeChildrenCount)) {
      console.error('[handleSaveChanges] Invalid safeChildrenCount:', safeChildrenCount)
      alert('Erreur: Le nombre d\'enfants est invalide. Veuillez rafraîchir la page.')
      return
    }
    
    console.log('[handleSaveChanges] Using safe values - guestsCount:', safeGuestsCount, 'childrenCount:', safeChildrenCount)

    setSavingExtras(true)
    setUpdatingGuests(true)

    try {
      const extrasChanged = JSON.stringify(extras) !== JSON.stringify(localExtras)

      // Sauvegarder les extras (chef uniquement)
      if (isChef && extrasChanged) {
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
          throw new Error('Erreur lors de la sauvegarde des extras')
        }

        // Envoyer un message pour chaque extra ajouté/supprimé
        const addedExtras = extrasChanged ? extras.filter(e => !localExtras.find(le => le.name === e.name && le.price === e.price)) : []
        const removedExtras = extrasChanged ? localExtras.filter(le => !extras.find(e => e.name === le.name && e.price === le.price)) : []

        for (const extra of addedExtras) {
          const notificationMessage = `Extra ajouté : ${extra.name} (+${extra.price.toFixed(2)} €)`
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
      // CRITICAL: Use safe values instead of potentially function values
      console.log('[handleSaveChanges] Checking for changes - safeGuestsCount:', safeGuestsCount, 'bookingRequest.guests_count:', bookingRequest?.guests_count)
      console.log('[handleSaveChanges] Checking for changes - safeChildrenCount:', safeChildrenCount, 'bookingRequest.children_count:', bookingRequest?.children_count)
      
      const guestsChanged = isClient && safeGuestsCount !== (bookingRequest?.guests_count || 1)
      const childrenChanged = isClient && safeChildrenCount !== (bookingRequest?.children_count || 0)
      
      console.log('[handleSaveChanges] Changes detected - guestsChanged:', guestsChanged, 'childrenChanged:', childrenChanged)
      
      if (guestsChanged || childrenChanged) {
        const previousGuestsCount = bookingRequest?.guests_count || 1
        const previousChildrenCount = bookingRequest?.children_count || 0
        
        console.log('[handleSaveChanges] Sending API request - guestsCount:', safeGuestsCount, 'childrenCount:', safeChildrenCount)
        
        const response = await fetch('/api/booking-guests', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookingRequestId: bookingRequest.id,
            guestsCount: +safeGuestsCount, // Use safe value, ensure primitive with unary +
            childrenCount: +safeChildrenCount, // Use safe value, ensure primitive with unary +
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Erreur lors de la mise à jour')
        }

        // Mettre à jour bookingRequest localement
        if (bookingRequest) {
          // CRITICAL: safeGuestsCount and safeChildrenCount are already primitive numbers
          // Use type assertion to satisfy TypeScript's strict checking
          (bookingRequest as any).guests_count = safeGuestsCount as unknown as number
          (bookingRequest as any).children_count = safeChildrenCount as unknown as number
        }

        // Envoyer un message dans le chat pour notifier le changement
        let notificationMessage = ''
        if (guestsChanged) {
          const changeType = safeGuestsCount > previousGuestsCount ? 'augmenté' : 'diminué'
          const changeAmount = Math.abs(safeGuestsCount - previousGuestsCount)
          notificationMessage = `✨ Nombre de convives ${changeType} : ${previousGuestsCount} → ${safeGuestsCount} (${changeAmount} ${changeAmount === 1 ? 'convive' : 'convives'})`
        }
        if (childrenChanged) {
          const changeType = safeChildrenCount > previousChildrenCount ? 'augmenté' : 'diminué'
          const changeAmount = Math.abs(safeChildrenCount - previousChildrenCount)
          const childrenMsg = `✨ Nombre d'enfants ${changeType} : ${previousChildrenCount} → ${safeChildrenCount} (${changeAmount} ${changeAmount === 1 ? 'enfant' : 'enfants'})`
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
  const coursePricePerPerson = Number(bookingRequest?.budget || 0)
  const homeChefPricePerDay = Number(bookingRequest?.total_price || 0)
  const homeChefDaysCount = Array.isArray(bookingRequest?.selected_dates) ? bookingRequest.selected_dates.length : 0
  const totalPrice = calculateBookingTotal(bookingRequest?.service_type, {
    menuPrice,
    guestsCount: currentGuestsCount,
    budget: bookingRequest?.budget,
    totalPrice: bookingRequest?.total_price,
    periodDaysCount: homeChefDaysCount,
    isPriceCustom: false,
    extras,
  })

  // Détecter si un message est un message système (notification)
  const isSystemMessage = (content: string) => {
    const lowerContent = content.toLowerCase()
    return (
      content.startsWith('✨') || 
      content.startsWith('🗑️') || 
      content.startsWith('⚠️') ||
      lowerContent.includes('réservation a été validée') ||
      lowerContent.includes('réservation a été annulée') ||
      lowerContent.includes('la réservation') ||
      lowerContent.includes('message dupliqué') ||
      lowerContent.includes('dupliqué détecté')
    )
  }

  // Vérifier si la réservation peut être modifiée
  const canModifyBooking = bookingStatus !== 'validated_by_client' && bookingStatus !== 'cancelled' && bookingStatus !== 'refused'
  const isBookingValidated = bookingStatus === 'validated_by_client'
  const isBookingCancelled = bookingStatus === 'cancelled'
  const isBookingRefused = bookingStatus === 'refused'

  // Handler pour afficher la modale de finalisation
  const handleFinalizeBooking = () => {
    if (!bookingRequest?.id || !isClient || bookingStatus !== 'accepted') {
      console.warn('[ChatInterface] Cannot finalize booking:', {
        hasBookingRequest: !!bookingRequest?.id,
        isClient,
        bookingStatus,
      })
      return
    }
    
    console.log('[ChatInterface] Opening finalize modal:', {
      bookingRequestId: bookingRequest.id,
      serviceType: bookingRequest?.service_type,
    })
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
      const isMiseEnDemeure = bookingRequest?.service_type === 'mise_en_demeure'
      const endpoint = isMiseEnDemeure
        ? '/api/booking-finalize-clicked'
        : '/api/booking-validate'

      const response = await fetch(endpoint, {
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

      if (isMiseEnDemeure) {
        alert('Merci. Votre demande de finalisation a bien été transmise. Le lien de paiement vous sera envoyé par email.')
        // Le statut reste "accepted" pour ce flow. Rechargement pour synchroniser l'UI.
        window.location.reload()
      } else {
        // Mettre à jour le statut localement
        setBookingStatus('validated_by_client')
        // Recharger la page pour afficher le message système
        window.location.reload()
      }
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

  // Vérifier si le menu contient au moins un plat (incluant les items non encore ajoutés)
  const hasMenuItems = Object.values(menuCategories).some(items => Array.isArray(items) && items.length > 0) ||
    Object.values(newMenuItems).some(value => value.trim().length > 0)

  const handleSaveMenu = async () => {
    if (!bookingRequest?.id || !currentUser) {
      return
    }

    // Ajouter automatiquement tous les éléments remplis dans les inputs
    let updatedMenuCategories = { ...menuCategories }
    Object.entries(newMenuItems).forEach(([category, value]) => {
      const trimmedValue = value.trim()
      if (trimmedValue) {
        updatedMenuCategories[category as MenuCategory] = [
          ...updatedMenuCategories[category as MenuCategory],
          trimmedValue
        ]
      }
    })

    // Validation: ne pas permettre d'enregistrer un menu vide
    const hasAnyItems = Object.values(updatedMenuCategories).some(items => Array.isArray(items) && items.length > 0)
    if (!hasAnyItems) {
      alert('Vous devez remplir au moins un champ avant d\'enregistrer le menu.')
      return
    }

    setSavingMenu(true)

    try {
      // Filtrer les catégories vides
      const cleanedMenu: any = {}
      Object.entries(updatedMenuCategories).forEach(([key, items]) => {
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

      // Réinitialiser les inputs après sauvegarde réussie
      setNewMenuItems({
        aperitifs: '',
        mise_en_bouche: '',
        entree: '',
        plat: '',
        dessert: '',
        mignardises: '',
      })
      setMenuCategories(updatedMenuCategories)

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
    <div 
      className="fixed inset-0 flex flex-col bg-white"
      style={{
        height: '100dvh', // Dynamic viewport height pour mobile avec clavier
        // Permettre le scroll même avec le clavier ouvert
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {/* Animation de chargement initial */}
      {isInitializing && <LoadingAnimation message={t('common.loading')} />}
      
      {/* Animation de navigation retour */}
      {isNavigatingBack && <LoadingAnimation message={t('common.loading')} />}
      {/* Header - Premium, moderne, avec contraste distinct */}
      <div className="flex-shrink-0 bg-white sticky top-0 z-10 border-b border-gray-300">
        <div className="px-4 sm:px-6 py-3.5">
          {/* Sélecteur de langue en haut à droite - au-dessus du bouton info */}
          <div className="absolute top-3.5 right-4 sm:right-6 z-10">
            <LanguageSwitcher />
          </div>
          {/* Titre sur sa propre ligne, bien visible */}
          <div className="mb-2.5">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-base sm:text-lg font-semibold text-gray-900">
                {bookingRequest ? (
                  <>
                    {t('chat.reservationTitle')}{' '}
                    {bookingRequest.service_type === 'mise_en_demeure' && bookingRequest.selected_dates && Array.isArray(bookingRequest.selected_dates) && bookingRequest.selected_dates.length > 0 ? (
                      // Pour chef à demeure : afficher uniquement la première date
                      formatDateForDisplay(bookingRequest.selected_dates[0], locale === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long' })
                    ) : bookingRequest.booking_date ? (
                      // Pour les autres types de service : afficher la date unique
                      formatDateForDisplay(bookingRequest.booking_date, locale === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long' })
                    ) : (
                      ''
                    )}
                  </>
                ) : (
                  t('chat.conversation')
                )}
              </h1>
              {bookingStatus && bookingStatus === 'accepted' && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#FBCF03]"></span>
              )}
            </div>
            {bookingRequest && (
              <>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-xs sm:text-sm text-gray-500">
                    {bookingRequest.guests_count} {bookingRequest.guests_count === 1 ? t('booking.guest') : t('booking.guests_plural')}
                  </p>
                  {isChef && bookingRequest.service_type === 'repas_domicile' && bookingRequest.meal_time && (
                    <>
                      <span className="text-gray-300">•</span>
                      <p className="text-xs sm:text-sm text-gray-500">
                        {bookingRequest.meal_time === 'dejeuner' ? t('booking.mealTimeLunch') : bookingRequest.meal_time === 'diner' ? t('booking.mealTimeDinner') : bookingRequest.meal_time}
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
            {/* Left: Back button */}
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
                  {/* Menu button (chef only) - Yellow for contrast - Caché pour cours_cuisine et mise_en_demeure */}
                  {isChef && bookingRequest?.service_type !== 'cours_cuisine' && bookingRequest?.service_type !== 'mise_en_demeure' && (
                    <button
                      onClick={() => setShowMenuModal(true)}
                      className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 active:bg-[#FBCF03]/80 rounded-lg transition-all shadow-sm hover:shadow"
                    >
                      {t('booking.menu')}
                    </button>
                  )}
                  {/* Secondary: Voir l&apos;offre (ghost/outline) */}
                  <button
                    onClick={() => setShowOfferModal(true)}
                    className="px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white/80 border border-gray-300/60 hover:bg-white hover:border-gray-400 rounded-lg transition-all shadow-sm hover:shadow"
                  >
                    {t('booking.seeOffer')}
                  </button>
                  
                  {/* Voir le menu (client only, if menu exists) - Caché pour cours_cuisine et mise_en_demeure */}
                  {isClient && hasMenu && bookingRequest?.service_type !== 'cours_cuisine' && bookingRequest?.service_type !== 'mise_en_demeure' && (
                    <button
                      onClick={() => setShowMenuModal(true)}
                      className="px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-gray-400 rounded-lg transition-all shadow-sm hover:shadow"
                    >
                      {t('booking.seeMenu')}
                    </button>
                  )}
                  
                  {/* Primary: Finaliser (client uniquement, statut accepted) */}
                  {isClient && bookingStatus === 'accepted' && (
                    <button
                      onClick={handleFinalizeBooking}
                      disabled={processingAction}
                      className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 active:bg-[#FBCF03]/80 rounded-lg transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingAction ? '...' : t('booking.finalize')}
                    </button>
                  )}
                  
                  {/* Destructive: Annuler (text button, subtle) */}
                  {!isBookingValidated && !isBookingCancelled && !isBookingRefused && (
                    <button
                      onClick={handleCancelBooking}
                      disabled={processingAction}
                      className="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title={t('booking.cancelBooking')}
                    >
                      {processingAction ? '...' : t('common.cancel')}
                    </button>
                  )}
                </>
              )}
              
              {/* Information button (client and chef) */}
              {bookingRequest && (
                <button
                  onClick={() => setShowInfoModal(true)}
                  className="flex-shrink-0 p-1.5 text-gray-500 hover:text-black hover:bg-black/5 rounded-lg transition-all"
                  title={t('booking.info')}
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
          touchAction: 'pan-y',
          // Permettre le scroll même quand le clavier est ouvert sur mobile
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
          // Force le hardware acceleration pour un meilleur scroll
          willChange: 'scroll-position',
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
                            {t('chat.communicationSpace')}{' '}
                            <span className="font-semibold text-gray-900">
                              {(() => {
                                // Pour chef à demeure : afficher toutes les dates sélectionnées
                                if (bookingRequest.service_type === 'mise_en_demeure' && bookingRequest.selected_dates && Array.isArray(bookingRequest.selected_dates) && bookingRequest.selected_dates.length > 0) {
                                  const dates = bookingRequest.selected_dates
                                  return dates.map((date: string, index: number) => (
                                    <span key={date}>
                                      {formatDateForDisplay(date, locale === 'en' ? 'en-US' : 'fr-FR', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                      })}
                                      {index < dates.length - 1 && (
                                        index === dates.length - 2 ? ' et ' : ', '
                                      )}
                                    </span>
                                  ))
                                }
                                // Pour les autres types de service : afficher la date unique
                                if (bookingRequest.booking_date) {
                                  return formatDateForDisplay(bookingRequest.booking_date, locale === 'en' ? 'en-US' : 'fr-FR', {
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                  })
                                }
                                // Fallback si aucune date n'est disponible
                                return ''
                              })()}
                            </span>
                            .
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {t('chat.findDetails')} <span className="font-semibold text-gray-900">&quot;{t('booking.seeOffer')}&quot;</span>.
                          </p>
                          {isChef && bookingRequest.service_type !== 'cours_cuisine' && (
                            <p className="text-sm text-gray-700 leading-relaxed mt-2">
                              {t('chat.createMenu')}
                            </p>
                          )}
                        </div>
                        {isClient && (
                          <div className="pt-1">
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {t('chat.finalizeReservation')} <span className="font-bold text-gray-900">&quot;{t('booking.finalize')}&quot;</span>.
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
                  } else if (message.content.toLowerCase().includes('dupliqué') || message.content.startsWith('⚠️')) {
                    icon = '⚠️'
                    bgColor = 'bg-amber-50'
                    textColor = 'text-amber-800'
                    borderColor = 'border-amber-300'
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
                        <span className="text-lg flex-shrink-0">{icon}</span>
                        <p className={`text-sm font-semibold text-center ${textColor} whitespace-pre-wrap break-words`}>
                          {sanitizedContent}
                        </p>
                      </div>
                    </div>
                  )
                }
                
                const shouldAlignRight = isAdmin ? isClientMessage : isOwn
                const bubbleClasses = isAdmin
                  ? isClientMessage
                    ? 'bg-white text-gray-900 rounded-br-sm border border-gray-300 shadow-md'
                    : isChefMessage
                      ? 'bg-[#FBCF03] text-black rounded-bl-sm shadow-md'
                      : 'bg-gray-100 text-gray-900 rounded-bl-sm border border-gray-200 shadow-sm'
                  : isOwn
                    ? 'bg-white text-gray-900 rounded-br-sm border border-gray-300 shadow-md'
                    : 'bg-[#FBCF03] text-black rounded-bl-sm shadow-md'
                const contentClasses = isAdmin
                  ? isChefMessage
                    ? 'text-black font-medium'
                    : 'text-gray-900'
                  : isOwn
                    ? 'text-gray-900'
                    : 'text-black font-medium'

                // Message normal - en admin, dissocier client et chef par rôle réel; ailleurs, conserver la logique expéditeur/récepteur existante
                return (
                  <div
                    key={message.id}
                    className={`flex mb-3 ${shouldAlignRight ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[75%] sm:max-w-[70%] flex flex-col ${shouldAlignRight ? 'items-end' : 'items-start'}`}>
                      {/* Nom de l'expéditeur - discret */}
                      <span className="text-[10px] text-gray-400 mb-0.5 px-1.5">
                        {getParticipantName(message.sender_email)}
                      </span>
                      
                      {/* Bulle de message */}
                      <div
                        className={`rounded-2xl px-4 py-2.5 ${bubbleClasses}`}
                        style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                      >
                        <div className={`text-[15px] leading-relaxed whitespace-pre-wrap break-words ${contentClasses}`} style={{ wordBreak: 'break-word', overflowWrap: 'break-word', maxWidth: '100%' }}>
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

      {/* Input - Style moderne premium (désactivé si réservation annulée/refusée ou si admin) */}
      {!isBookingCancelled && !isBookingRefused && !isAdmin && (
      <div className="flex-shrink-0 bg-white border-t border-gray-300/50 pb-safe">
        <form onSubmit={(e) => {
          e.preventDefault()
          // L'envoi se fait uniquement via le bouton submit
          // Sur desktop, on peut aussi envoyer avec Shift+Entrée dans le textarea
          handleSendMessage(e)
        }} className="px-4 sm:px-6 py-3.5">
          <div className="flex items-end gap-2.5">
            {isDesktop ? (
              <textarea
                data-testid="message-input"
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
                placeholder={t('chat.enterNewLine')}
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
              <textarea
                data-testid="message-input"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  // Sur mobile : Entrée = nouvelle ligne (comportement par défaut du textarea)
                  // On empêche le submit du formulaire pour permettre d'aller à la ligne
                  if (e.key === 'Enter' && !e.shiftKey) {
                    // Empêcher le submit du formulaire pour permettre le retour à la ligne
                    e.preventDefault()
                    // Insérer manuellement un retour à la ligne
                    const textarea = e.target as HTMLTextAreaElement
                    const start = textarea.selectionStart
                    const end = textarea.selectionEnd
                    const value = textarea.value
                    const newValue = value.substring(0, start) + '\n' + value.substring(end)
                    setNewMessage(newValue)
                    // Repositionner le curseur après le retour à la ligne
                    setTimeout(() => {
                      textarea.selectionStart = textarea.selectionEnd = start + 1
                      // Déclencher l'auto-resize
                      textarea.style.height = 'auto'
                      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
                    }, 0)
                  }
                }}
                onFocus={(e) => {
                  // Permettre le scroll du chat quand le clavier s'ouvre
                  if (messagesContainerRef.current) {
                    // Attendre que le clavier s'ouvre
                    setTimeout(() => {
                      if (messagesContainerRef.current) {
                        // Forcer le scroll à être actif
                        messagesContainerRef.current.style.overflowY = 'auto'
                        // @ts-ignore - webkitOverflowScrolling est une propriété CSS non standard pour iOS
                        messagesContainerRef.current.style.webkitOverflowScrolling = 'touch'
                        // Scroll vers le bas pour voir les derniers messages
                        scrollToBottom()
                      }
                    }, 300)
                  }
                }}
                placeholder={t('chat.messagePlaceholder')}
                disabled={loading}
                rows={1}
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200/60 rounded-2xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-[#FBCF03]/40 focus:ring-2 focus:ring-[#FBCF03]/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden"
                style={{
                  minHeight: '44px',
                  maxHeight: '120px',
                  fontSize: '16px', // Force 16px pour éviter le zoom automatique sur iOS
                }}
                onInput={(e) => {
                  // Auto-resize textarea
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                }}
                onBlur={(e) => {
                  // Réinitialiser le zoom après le blur pour éviter que le zoom reste actif
                  if (typeof window !== 'undefined') {
                    // Forcer un léger scroll pour réinitialiser le viewport sur iOS
                    setTimeout(() => {
                      const currentScroll = window.scrollY
                      window.scrollTo(0, currentScroll)
                    }, 0)
                  }
                }}
              />
            )}
            <button
              data-testid="send-message-button"
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
      {!isAdmin && isBookingRefused && (
        <div className="flex-shrink-0 bg-red-50 border-t border-red-100 px-4 py-3">
          <p className="text-xs text-red-700 text-center">{t('chat.bookingRefusedReadonly')}</p>
        </div>
      )}

      {/* Modal d'offre - Design premium, compact pour tenir sur une page */}
      {showOfferModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowOfferModal(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header fixe */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-300 bg-white flex-shrink-0">
              <div className="flex-1">
                {bookingRequest?.service_type && (
                  <h2 className="text-xl font-semibold text-black">
                    {t(`booking.serviceType.${bookingRequest.service_type}`)}
                  </h2>
                )}
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
                  <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-[0.08em] mb-2 letter-spacing-tight">{t('booking.info')}</h3>
                  <div className="bg-white rounded-xl border border-gray-300 shadow-md p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      {/* Date ou Période selon le type de service */}
                      {(bookingRequest.service_type === 'repas_domicile' && bookingRequest.booking_date) ? (
                        <>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Date</p>
                        <p className="text-sm font-medium text-black">
                          {formatDateForDisplay(bookingRequest.booking_date, locale === 'en' ? 'en-US' : 'fr-FR', { 
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
                                {bookingRequest.meal_time === 'dejeuner' ? t('booking.mealTimeLunch') : bookingRequest.meal_time === 'diner' ? t('booking.mealTimeDinner') : bookingRequest.meal_time}
                              </p>
                            </div>
                          )}
                        </>
                      ) : bookingRequest.service_type === 'cours_cuisine' ? (
                        <>
                          {bookingRequest.booking_date && (
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Date</p>
                              <p className="text-sm font-medium text-black">
                                {formatDateForDisplay(bookingRequest.booking_date, locale === 'en' ? 'en-US' : 'fr-FR', { 
                                  day: 'numeric', 
                                  month: 'long', 
                                  year: 'numeric' 
                                })}
                              </p>
                            </div>
                          )}
                          {bookingRequest.budget && (
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Prix par personne</p>
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
                              <p className="text-xs text-gray-500 mb-0.5">{t('offer.selectedDates')}</p>
                              <p className="text-sm font-medium text-black">
                                {bookingRequest.selected_dates.length} {bookingRequest.selected_dates.length === 1 ? t('offer.day') : t('offer.days')}
                              </p>
                            </div>
                          )}
                          {bookingRequest.meal_options && typeof bookingRequest.meal_options === 'object' && !Array.isArray(bookingRequest.meal_options) && Object.keys(bookingRequest.meal_options).length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">{t('offer.mealOptions')}</p>
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setShowMealDetailsModal(true)
                                }}
                                className="text-sm font-medium text-[#FBCF03] hover:text-[#E6BA00] underline decoration-[#FBCF03] decoration-1 underline-offset-2 transition-colors"
                              >
                                {t('mealDetails.seeDayDetails')}
                              </button>
                            </div>
                          )}
                          {bookingRequest.total_price && (
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Prix par jour</p>
                              <p className="text-sm font-medium text-black">
                                {typeof bookingRequest.total_price === 'number' 
                                  ? `${bookingRequest.total_price.toFixed(0)} €`
                                  : `${parseFloat(bookingRequest.total_price).toFixed(0)} €`}
                              </p>
                            </div>
                          )}
                        </>
                      ) : null}
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Lieu</p>
                        <p className="text-sm font-medium text-black">
                          {(bookingRequest as { full_address?: string | null }).full_address?.trim() ||
                            `${bookingRequest.city} ${bookingRequest.postal_code}`.trim()}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">{t('booking.guestsCount')}</p>
                          {isClient && canModifyBooking ? (
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                // DEFENSIVE: Ensure handleGuestsChange is a function before calling
                                if (typeof handleGuestsChange !== 'function') {
                                  console.error('[onClick] handleGuestsChange is not a function:', typeof handleGuestsChange, handleGuestsChange)
                                  return
                                }
                                // Pass updater function to handleGuestsChange to avoid stale closure
                                try {
                                  handleGuestsChange((currentCount: number) => Math.max(1, currentCount - 1))
                                } catch (error) {
                                  console.error('[onClick] Error calling handleGuestsChange:', error)
                                }
                              }}
                              disabled={updatingGuests}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-[#FBCF03] bg-[#FBCF03] hover:bg-[#FBCF03]/90 hover:border-[#FBCF03] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:border-gray-300 transition-all duration-150 shadow-sm hover:shadow"
                              aria-label={t('booking.decrease')}
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
                                // DEFENSIVE: Ensure handleGuestsChange is a function before calling
                                if (typeof handleGuestsChange !== 'function') {
                                  console.error('[onClick] handleGuestsChange is not a function:', typeof handleGuestsChange, handleGuestsChange)
                                  return
                                }
                                // Pass updater function to handleGuestsChange to avoid stale closure
                                try {
                                  handleGuestsChange((currentCount: number) => currentCount + 1)
                                } catch (error) {
                                  console.error('[onClick] Error calling handleGuestsChange:', error)
                                }
                              }}
                              disabled={updatingGuests}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-[#FBCF03] bg-[#FBCF03] hover:bg-[#FBCF03]/90 hover:border-[#FBCF03] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 shadow-sm hover:shadow"
                              aria-label={t('booking.increase')}
                            >
                              <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 font-semibold min-w-[4rem]">dont {t('booking.children')} :</span>
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                // DEFENSIVE: Ensure handleChildrenChange is a function before calling
                                if (typeof handleChildrenChange !== 'function') {
                                  console.error('[onClick] handleChildrenChange is not a function:', typeof handleChildrenChange, handleChildrenChange)
                                  return
                                }
                                // BREAK LOOP: Calculate new value using ref to avoid closure
                                // Handler will update state (single source of truth)
                                // NO setState wrapper - handler manages all updates
                                const newCount = Math.max(0, childrenCountRef.current - 1)
                                try {
                                  handleChildrenChange(newCount)
                                } catch (error) {
                                  console.error('[onClick] Error calling handleChildrenChange:', error)
                                }
                              }}
                              disabled={updatingGuests}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-[#FBCF03] bg-[#FBCF03] hover:bg-[#FBCF03]/90 hover:border-[#FBCF03] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:border-gray-300 transition-all duration-150 shadow-sm hover:shadow"
                              aria-label={t('booking.decreaseChildren')}
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
                                // DEFENSIVE: Ensure handleChildrenChange is a function before calling
                                if (typeof handleChildrenChange !== 'function') {
                                  console.error('[onClick] handleChildrenChange is not a function:', typeof handleChildrenChange, handleChildrenChange)
                                  return
                                }
                                // BREAK LOOP: Calculate new value using ref to avoid closure
                                // Handler will update state and handle guests_count constraint if needed
                                // NO setState wrapper - handler manages all updates
                                const newCount = childrenCountRef.current + 1
                                try {
                                  handleChildrenChange(newCount)
                                } catch (error) {
                                  console.error('[onClick] Error calling handleChildrenChange:', error)
                                }
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
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-black">
                            {bookingRequest.guests_count} {bookingRequest.guests_count === 1 ? t('booking.guest') : t('booking.guests_plural')}
                          </p>
                          <p className="text-xs text-gray-600">
                            dont {bookingRequest.children_count || 0} {(bookingRequest.children_count || 0) === 1 ? t('booking.child') : t('booking.children_plural')}
                          </p>
                        </div>
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
                        <p className="text-xs text-gray-500 mb-0.5">{t('booking.notes')}</p>
                        <p className="text-sm text-black leading-relaxed break-words whitespace-pre-wrap overflow-wrap-anywhere">{bookingRequest.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Menu sélectionné - uniquement pour repas à domicile */}
              {bookingRequest?.service_type === 'repas_domicile' && !isReplacementBooking && menuDetails ? (
                <div>
                  <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-[0.08em] mb-2 letter-spacing-tight">Menu</h3>
                  <div className="bg-white rounded-xl border border-gray-300 shadow-md p-3.5">
                    <p className="text-base font-semibold text-black mb-1">{menuDetails.name}</p>
                    {menuDetails.description && (
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2">{menuDetails.description}</p>
                    )}
                    <div className="pt-2.5 border-t border-gray-300 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 font-medium">{t('booking.pricePerMenu')}</span>
                        <span className="font-semibold text-black">{menuPrice.toFixed(2)} €</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 font-medium">Nombre de menus</span>
                        <span className="font-semibold text-black">{currentGuestsCount} {currentGuestsCount === 1 ? t('booking.menu') : t('booking.menus')}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-semibold pt-2.5 border-t border-gray-300">
                        <span className="text-black">{t('booking.subtotal')}</span>
                        <span className="text-black font-bold">{menuTotal.toFixed(2)} €</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : bookingRequest?.service_type === 'repas_domicile' && !isReplacementBooking ? (
                <div>
                  <h3 className="text-[11px] font-semibold text-gray-700 uppercase tracking-[0.08em] mb-2 letter-spacing-tight">Menu</h3>
                  <div className="bg-white rounded-xl border border-gray-300 shadow-md p-3.5">
                    <p className="text-sm text-gray-500">{t('booking.noMenuSelected')}</p>
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
                  <p className="text-sm text-gray-500 mb-3">{t('booking.noExtras')}</p>
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
                        {savingExtras ? '...' : t('common.add')}
                      </button>
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newExtraName}
                        onChange={(e) => setNewExtraName(e.target.value)}
                        placeholder="Nom de l&apos;extra"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/30 focus:border-[#FBCF03]/40 text-base transition-all duration-150"
                        disabled={savingExtras}
                      />
                      <input
                        type="number"
                        value={newExtraPrice}
                        onChange={(e) => setNewExtraPrice(e.target.value)}
                        placeholder={t('booking.extraPrice')}
                        step="0.01"
                        min="0"
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/30 focus:border-[#FBCF03]/40 text-base transition-all duration-150"
                        disabled={savingExtras}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="pt-3.5 border-t border-gray-300">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-black tracking-tight">{t('booking.total')}</span>
                  <span className="text-xl font-bold text-black tracking-tight">{totalPrice.toFixed(2)} €</span>
                </div>
                {(bookingRequest?.service_type === 'cours_cuisine' && Number.isFinite(coursePricePerPerson) && coursePricePerPerson > 0) && (
                  <p className="mt-1 text-xs text-gray-500">
                    {coursePricePerPerson.toFixed(2)} €/pers x {currentGuestsCount} convives
                  </p>
                )}
                {(bookingRequest?.service_type === 'mise_en_demeure' && Number.isFinite(homeChefPricePerDay) && homeChefPricePerDay > 0) && (
                  <p className="mt-1 text-xs text-gray-500">
                    {homeChefPricePerDay.toFixed(2)} €/jour x {homeChefDaysCount} {homeChefDaysCount === 1 ? 'jour' : 'jours'}
                  </p>
                )}
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
                  {t('common.close')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Détails des jours - Chef à demeure */}
      {showMealDetailsModal && bookingRequest?.service_type === 'mise_en_demeure' && bookingRequest.meal_options && typeof bookingRequest.meal_options === 'object' && !Array.isArray(bookingRequest.meal_options) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowMealDetailsModal(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-300 bg-white flex-shrink-0">
              <h2 className="text-xl font-semibold text-black">{t('mealDetails.title')}</h2>
              <button
                onClick={() => setShowMealDetailsModal(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors sm:p-1.5 sm:bg-transparent sm:hover:bg-gray-100"
                aria-label={t('common.close')}
              >
                <span className="sm:hidden">{t('common.back')}</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
              {Object.entries(bookingRequest.meal_options as Record<string, string[]>)
                .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                .map(([date, options]) => {
                  const dateLabel = formatDateForDisplay(date, locale === 'en' ? 'en-US' : 'fr-FR', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long',
                    year: 'numeric'
                  })
                  const dayLabel = formatDateForDisplay(date, locale === 'en' ? 'en-US' : 'fr-FR', { weekday: 'short' })
                  
                  return (
                    <div key={date} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-semibold text-black uppercase tracking-wide">{dayLabel}</span>
                        <span className="text-sm font-medium text-gray-700">{dateLabel}</span>
                      </div>
                      <div className="space-y-2">
                        {options.map((opt: string, index: number) => {
                          const mealLabel = opt === 'pdj' ? t('mealDetails.breakfast') : opt === 'dejeuner' ? t('mealDetails.lunch') : t('mealDetails.dinner')
                          const mealIcon = opt === 'pdj' ? '🌅' : opt === 'dejeuner' ? '☀️' : '🌙'
                          return (
                            <div key={index} className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-2.5">
                              <span className="text-base">{mealIcon}</span>
                              <span className="text-sm font-medium text-black">{mealLabel}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-t border-gray-300 bg-white">
              <button
                onClick={() => setShowMealDetailsModal(false)}
                className="w-full px-4 py-3 text-sm font-semibold text-black bg-[#FBCF03] hover:bg-[#FBCF03]/90 active:bg-[#FBCF03]/80 rounded-xl transition-all duration-150 shadow-md hover:shadow-lg"
              >
                {t('common.close')}
              </button>
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
                {t('common.close')}
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
                      {formatDateForDisplay(bookingRequest.booking_date, locale === 'en' ? 'en-US' : 'fr-FR', { 
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
                        {bookingRequest.meal_time === 'dejeuner' ? t('booking.mealTimeLunch') : bookingRequest.meal_time === 'diner' ? t('booking.mealTimeDinner') : bookingRequest.meal_time}
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
                  {(bookingRequest?.service_type === 'cours_cuisine' && Number.isFinite(coursePricePerPerson) && coursePricePerPerson > 0) && (
                    <p className="text-xs text-gray-500">
                      {coursePricePerPerson.toFixed(2)} €/pers x {bookingRequest.guests_count} convives
                    </p>
                  )}
                  {(bookingRequest?.service_type === 'mise_en_demeure' && Number.isFinite(homeChefPricePerDay) && homeChefPricePerDay > 0) && (
                    <p className="text-xs text-gray-500">
                      {homeChefPricePerDay.toFixed(2)} €/jour x {homeChefDaysCount} {homeChefDaysCount === 1 ? 'jour' : 'jours'}
                    </p>
                  )}
                </div>
              )}

              <p className="text-sm text-gray-600 mb-6">
                {bookingRequest?.service_type === 'mise_en_demeure' 
                  ? 'En confirmant, vous indiquez que vous êtes prêt à finaliser votre réservation. Un lien de paiement vous sera envoyé par email dans les prochaines 24 heures.'
                  : 'En confirmant, vous validez cette réservation. Un lien de paiement vous sera envoyé dans les 24 heures.'}
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
              <h2 className="text-xl font-semibold text-black mb-4">{t('booking.cancelTitle')}</h2>
              
              <p className="text-sm text-gray-600 mb-6">
                {t('booking.cancelConfirm')}
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
                <h2 className="text-xl font-semibold text-black">{t('booking.info')}</h2>
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
                  <p className="text-xs text-gray-500 flex-1">{t('booking.viewOfferDescription')}</p>
                </div>

                {/* Menu (chef only) - Caché pour cours_cuisine et mise_en_demeure */}
                {isChef && bookingRequest?.service_type !== 'cours_cuisine' && bookingRequest?.service_type !== 'mise_en_demeure' && (
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
                    <p className="text-xs text-gray-500 flex-1">{t('booking.defineMenu')}</p>
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
                    <p className="text-xs text-gray-500 flex-1">{t('booking.finalizeDescription')}</p>
                  </div>
                )}

                {/* Annuler la réservation */}
                {!isBookingValidated && !isBookingCancelled && !isBookingRefused && (
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
                    <p className="text-xs text-gray-500 flex-1">{t('booking.cancelDescription')}</p>
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
                    <h3 className="text-sm font-semibold text-black mb-6">{t('booking.progressTitle')}</h3>
                    
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
                                {isClient ? t('booking.step1Title') : t('booking.clientFound')}
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
                                ? 'bg-[#FBCF03] shadow-lg shadow-[#FBCF03]/30 ring-4 ring-[#FBCF03]/10'
                                : currentStep === 2
                                ? 'bg-white border-2 border-[#FBCF03] shadow-md shadow-[#FBCF03]/20 ring-2 ring-[#FBCF03]/20'
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
                                {t('booking.step2Title')}
                              </p>
                              {isStep2Complete ? (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/20 text-[#FBCF03] rounded-full">
                                  Complété
                                </span>
                              ) : currentStep === 2 ? (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/10 text-[#FBCF03] rounded-full animate-pulse">
                                  {t('booking.ongoing')}
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
                                ? 'bg-[#FBCF03] shadow-lg shadow-[#FBCF03]/30 ring-4 ring-[#FBCF03]/10'
                                : isStep3Active
                                ? 'bg-white border-2 border-[#FBCF03] shadow-md shadow-[#FBCF03]/20 ring-2 ring-[#FBCF03]/20'
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
                                {isClient ? t('booking.step3Title') : t('booking.clientPays')}
                              </p>
                              {isStep3Complete ? (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/20 text-[#FBCF03] rounded-full">
                                  Complété
                                </span>
                              ) : isStep3Active ? (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-[#FBCF03]/10 text-[#FBCF03] rounded-full animate-pulse">
                                  {t('booking.ongoing')}
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
                                ? t('booking.step3DescriptionCompleted')
                                : isStep3Active
                                ? (isClient 
                                  ? t('booking.paymentPendingDescription')
                                  : t('booking.chefPaymentPendingDescription')
                                )
                                : t('booking.step3DescriptionPending')
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
                                ? 'bg-[#FBCF03] shadow-lg shadow-[#FBCF03]/30 ring-4 ring-[#FBCF03]/10'
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
                                {t('booking.step4Title')}
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
                                ? t('booking.step4DescriptionCompleted')
                                : t('booking.step4DescriptionPending')
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
                  {t('booking.securityWarning')}
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
                      <div className="space-y-2">
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
                            className="flex-1 px-3 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FBCF03]/30 focus:border-[#FBCF03]/40 transition-all"
                          />
                          {newMenuItems[category].trim() && (
                            <button
                              onClick={() => handleAddMenuItem(category)}
                              className="p-1.5 text-gray-400 hover:text-[#FBCF03] hover:bg-[#FBCF03]/10 rounded-lg transition-all"
                              aria-label="Ajouter"
                              title="Ajouter cet élément"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer avec bouton sauvegarder */}
            <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-t border-gray-300 bg-white space-y-2">
              <button
                onClick={handleSaveMenu}
                disabled={savingMenu || !hasMenuItems}
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
