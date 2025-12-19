import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import ChatInterface from '@/components/ChatInterface'

interface PageProps {
  params: {
    conversationId: string
  }
  searchParams: {
    accepted?: string
  }
}

export default async function ChatPage({ params, searchParams }: PageProps) {
  try {
    console.log('[ChatPage] ========== START ==========')
    console.log('[ChatPage] Conversation ID:', params.conversationId)
    
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()
    const conversationId = params.conversationId.trim()
    
    // 1. Vérifier l'authentification
    console.log('[ChatPage] Step 1: Checking auth...')
    
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.log('[ChatPage] ❌ No user, redirecting to login')
      redirect(`/login?next=/chat/${conversationId}`)
    }
    
    // Vérifier si l'utilisateur est l'admin
    const ADMIN_UID = '8d154623-1aba-475c-9a7b-9ab39f3f84d2'
    const isAdmin = user.id === ADMIN_UID
    
    console.log('[ChatPage] ✅ User authenticated:', user.email, isAdmin ? '(Admin)' : '')
    
    // 2. Récupérer la conversation (SANS jointure pour éviter les erreurs)
    console.log('[ChatPage] Step 2: Fetching conversation...')
    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle()
    
    if (conversationError) {
      console.error('[ChatPage] ❌ Conversation error:', conversationError)
      // Essayer sans .maybeSingle() comme fallback
      const { data: conversations, error: listError } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
      
      if (listError || !conversations || conversations.length === 0) {
        console.error('[ChatPage] ❌ Conversation not found in DB')
        redirect(`/login?next=/chat/${conversationId}&error=conversation_not_found`)
      }
      
      // Utiliser le premier résultat
      const conv = conversations[0] as any
      console.log('[ChatPage] ✅ Found conversation with fallback method')
      
      // Récupérer les participants
      const { data: participants } = await supabaseAdmin
        .from('participants')
        .select('*')
        .eq('conversation_id', conversationId)
      
      // Récupérer les messages
      const { data: messages } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      
      // Récupérer le booking_request séparément
      let bookingRequest = null
      if (conv.booking_request_id) {
        const { data: booking } = await supabaseAdmin
          .from('booking_requests')
          .select('*')
          .eq('id', conv.booking_request_id)
          .maybeSingle()
        
        if (booking) {
          // Récupérer le nom et l'email du chef
          let chefName = null
          let chefEmail = null
          if ((booking as any).chef_id) {
            const { data: chef } = await supabaseAdmin
              .from('chefs')
              .select('name, email')
              .eq('id', (booking as any).chef_id)
              .single()
            if (chef) {
              chefName = chef.name
              chefEmail = (chef as any).email
            }
          }
          bookingRequest = {
            ...booking,
            chefName: chefName,
            chefEmail: chefEmail,
          }
        }
      }
      
      // Vérifier l'accès (admin a toujours accès)
      const hasAccess = isAdmin || participants?.some(
        p => p.email === user.email || p.user_id === user.id
      )
      
      if (!hasAccess) {
        redirect(`/login?next=/chat/${conversationId}&error=unauthorized`)
      }
      
      return (
        <ChatInterface
          conversationId={conversationId}
          initialMessages={messages || []}
          participants={participants || []}
          currentUser={user}
          bookingRequest={bookingRequest}
          menuDetails={menuDetails}
          showAcceptedMessage={searchParams.accepted === 'true'}
          isAdmin={isAdmin}
        />
      )
    }
    
    if (!conversation) {
      console.error('[ChatPage] ❌ Conversation is null')
      redirect(`/login?next=/chat/${conversationId}&error=conversation_not_found`)
    }
    
    console.log('[ChatPage] ✅ Conversation found:', conversation.id)
    
    // 3. Récupérer les participants
    console.log('[ChatPage] Step 3: Fetching participants...')
    const { data: participants, error: participantsError } = await supabaseAdmin
      .from('participants')
      .select('*')
      .eq('conversation_id', conversationId)
    
    console.log('[ChatPage] Participants:', participants?.length || 0)
    if (participantsError) {
      console.error('[ChatPage] Participants error:', participantsError)
    }
    
    // 4. Récupérer les messages
    console.log('[ChatPage] Step 4: Fetching messages...')
    console.log('[ChatPage] Conversation ID for messages:', conversationId)
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    
    console.log('[ChatPage] Messages count:', messages?.length || 0)
    console.log('[ChatPage] Messages details:', messages?.map(m => ({
      id: m.id,
      sender_email: m.sender_email,
      content: m.content?.substring(0, 50),
      created_at: m.created_at,
    })))
    if (messagesError) {
      console.error('[ChatPage] Messages error:', messagesError)
    }
    
    // 5. Récupérer le booking_request séparément avec les détails du menu
    console.log('[ChatPage] Step 5: Fetching booking request...')
    let bookingRequest = null
    let menuDetails = null
    if ((conversation as any).booking_request_id) {
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('booking_requests')
        .select('*')
        .eq('id', (conversation as any).booking_request_id)
        .maybeSingle()
      
      if (!bookingError && booking) {
        // Récupérer le nom et l'email du chef depuis la table chefs
        let chefName = null
        let chefEmail = null
        if ((booking as any).chef_id) {
          const { data: chef, error: chefError } = await supabaseAdmin
            .from('chefs')
            .select('name, email')
            .eq('id', (booking as any).chef_id)
            .single()
          
          if (!chefError && chef) {
            chefName = chef.name
            chefEmail = (chef as any).email
            console.log('[ChatPage] ✅ Chef name found:', chefName)
            console.log('[ChatPage] ✅ Chef email found:', chefEmail)
          }
        }
        
        bookingRequest = {
          ...booking,
          chefName: chefName,
          chefEmail: chefEmail,
        }
        console.log('[ChatPage] ✅ Booking request found')
        
        // Récupérer les détails du menu si menu_id existe
        if ((booking as any).menu_id) {
          const { data: menu, error: menuError } = await supabaseAdmin
            .from('menus')
            .select('*')
            .eq('id', (booking as any).menu_id)
            .single()
          
          if (!menuError && menu) {
            menuDetails = menu
            console.log('[ChatPage] ✅ Menu details found:', menu)
          } else {
            console.log('[ChatPage] ⚠️  Menu not found or error:', menuError)
          }
        }
      } else {
        console.log('[ChatPage] ⚠️  Booking request not found or error:', bookingError)
      }
    }
    
    // 6. Vérifier l'accès (admin a toujours accès)
    console.log('[ChatPage] Step 6: Checking access...')
    const hasAccess = isAdmin || participants?.some(
      p => p.email === user.email || p.user_id === user.id
    )
    
    console.log('[ChatPage] Has access:', hasAccess, isAdmin ? '(Admin bypass)' : '')
    console.log('[ChatPage] User email:', user.email)
    console.log('[ChatPage] Participants emails:', participants?.map(p => p.email))
    
    if (!hasAccess) {
      console.log('[ChatPage] ❌ No access, redirecting to login')
      redirect(`/login?next=/chat/${conversationId}&error=unauthorized`)
    }
    
    console.log('[ChatPage] ✅✅✅ ALL CHECKS PASSED - RENDERING CHAT ✅✅✅')
    console.log('[ChatPage] ========== END ==========')
    
    return (
      <ChatInterface
        conversationId={conversationId}
        initialMessages={messages || []}
        participants={participants || []}
        currentUser={user}
        bookingRequest={bookingRequest}
        menuDetails={menuDetails}
        showAcceptedMessage={searchParams.accepted === 'true'}
        isAdmin={isAdmin}
      />
    )
  } catch (error: any) {
    console.error('[ChatPage] ❌❌❌ FATAL ERROR ❌❌❌')
    console.error('[ChatPage] Error:', error)
    console.error('[ChatPage] Stack:', error.stack)
    throw error
  }
}
