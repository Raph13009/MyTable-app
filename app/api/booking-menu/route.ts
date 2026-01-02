import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import { getBaseUrl } from '@/lib/utils'

/**
 * API Route pour sauvegarder le menu défini par le chef
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { bookingRequestId, menuContent } = await request.json()
    if (!bookingRequestId) {
      return NextResponse.json({ error: 'bookingRequestId requis' }, { status: 400 })
    }

    // Récupérer la réservation
    const { data: bookingRequest, error: bookingError } = await supabaseAdmin
      .from('booking_requests')
      .select('*, chefs(*)')
      .eq('id', bookingRequestId)
      .single()

    if (bookingError || !bookingRequest) {
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
    }

    // Vérifier que l'utilisateur est le chef
    const chefEmail = (bookingRequest as any).chefs?.email?.toLowerCase().trim()
    const userEmail = user.email?.toLowerCase().trim()
    if (chefEmail !== userEmail) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Mettre à jour le menu_content
    const { error: updateError } = await supabaseAdmin
      .from('booking_requests')
      // @ts-expect-error - Supabase type inference issue
      .update({ 
        menu_content: menuContent,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', bookingRequestId)

    if (updateError) {
      console.error('[booking-menu] Error updating menu:', updateError)
      return NextResponse.json({ error: 'Erreur lors de la sauvegarde' }, { status: 500 })
    }

    // Récupérer la conversation pour l'URL de redirection
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('booking_request_id', bookingRequestId)
      .single()

    if (conversation) {
      // Générer le texte du menu pour le message
      const menuText = generateMenuMessage(menuContent)
      
      await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: (conversation as any).id,
          sender_email: user.email!,
          content: `✨ Menu défini\n\n${menuText}`,
        } as any)
    }

    // Envoyer une notification email au client avec un magic link
    const clientEmail = (bookingRequest as any).email?.toLowerCase().trim()
    if (clientEmail) {
      try {
        const baseUrl = getBaseUrl()
        const redirectUrl = `${baseUrl}/auth/callback?next=/chat/${(conversation as any)?.id || '/dashboard'}`
        
        // Générer un magic link pour le client
        const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
          email: clientEmail,
          options: {
            emailRedirectTo: redirectUrl,
            shouldCreateUser: false, // Client should already exist
          },
        })

        if (otpError) {
          console.error('[booking-menu] Error sending magic link to client:', otpError)
          // Si l'utilisateur n'existe pas, essayer avec shouldCreateUser: true
          if (otpError.message?.includes('not found') || otpError.message?.includes('does not exist')) {
            await supabaseAdmin.auth.signInWithOtp({
              email: clientEmail,
              options: {
                emailRedirectTo: redirectUrl,
                shouldCreateUser: true,
              },
            })
          }
        }

        // Envoyer l'email de notification via Resend
        const clientName = `${(bookingRequest as any).first_name || ''} ${(bookingRequest as any).last_name || ''}`.trim() || 'Client'
        const loginUrl = `${baseUrl}/login?next=/chat/${(conversation as any)?.id || '/dashboard'}`
        
        await sendEmail({
          to: clientEmail,
          subject: emailSubjects.menuUpdated,
          html: emailTemplates.menuUpdated(clientName, loginUrl, baseUrl),
        })
      } catch (emailError) {
        console.error('[booking-menu] Error sending notification email:', emailError)
        // Ne pas faire échouer la requête si l'email échoue
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[booking-menu] Error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

/**
 * Génère le texte formaté du menu pour l'affichage dans le chat
 */
function generateMenuMessage(menuContent: any): string {
  if (!menuContent || typeof menuContent !== 'object') {
    return ''
  }

  const categoryLabels: Record<string, string> = {
    aperitifs: 'Apéritifs',
    mise_en_bouche: 'Mise en bouche',
    entree: 'Entrée',
    plat: 'Plat',
    dessert: 'Dessert',
    mignardises: 'Mignardises',
  }

  const categories: string[] = []
  
  Object.entries(categoryLabels).forEach(([key, label]) => {
    const items = menuContent[key]
    if (items && Array.isArray(items) && items.length > 0) {
      const itemsList = items.map((item: string) => `• ${item}`).join('\n')
      categories.push(`${label} :\n${itemsList}`)
    }
  })

  return categories.join('\n\n')
}
