import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ADMIN_UID = '8d154623-1aba-475c-9a7b-9ab39f3f84d2'

export async function GET(request: NextRequest) {
  try {
    // Vérifier que l'utilisateur est l'admin
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user || user.id !== ADMIN_UID) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 403 }
      )
    }
    
    const supabaseAdmin = createAdminClient()

    // Récupérer toutes les conversations
    const { data: conversationsData, error: conversationsError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })

    if (conversationsError) throw conversationsError

    // Récupérer les booking_requests et les chefs avec leurs noms
    const conversationsWithDetails = await Promise.all(
      (conversationsData || []).map(async (conv) => {
        let bookingRequest = null
        let chefName = null
        
        if (conv.booking_request_id) {
          // Récupérer le booking_request avec le chef_id
          const { data: booking, error: bookingError } = await supabaseAdmin
            .from('booking_requests')
            .select('*')
            .eq('id', conv.booking_request_id)
            .single()

          if (booking && !bookingError) {
            // Récupérer le nom et la photo de profil du chef depuis la table chefs
            let chefProfilePicture = null
            if (booking.chef_id) {
              const { data: chef, error: chefError } = await supabaseAdmin
                .from('chefs')
                .select('name, profile_picture')
                .eq('id', booking.chef_id)
                .single()

              if (chef && !chefError) {
                chefName = chef.name
                chefProfilePicture = chef.profile_picture
              }
            }

            bookingRequest = {
              ...booking,
              chefName: chefName,
              chefProfilePicture: chefProfilePicture,
            }
          }
        }

        // Récupérer le dernier message
        const { data: lastMsg } = await supabaseAdmin
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        return {
          ...conv,
          bookingRequest,
          lastMessage: lastMsg || null,
        }
      })
    )

    return NextResponse.json({ conversations: conversationsWithDetails })
  } catch (error: any) {
    console.error('[admin/conversations] Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des conversations', details: error.message },
      { status: 500 }
    )
  }
}

