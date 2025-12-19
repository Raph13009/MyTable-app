import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ADMIN_UID = '8d154623-1aba-475c-9a7b-9ab39f3f84d2'

export async function POST(request: NextRequest) {
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
    
    const body = await request.json()
    const {
      chefId,
      slug,
      name,
      email,
      phone,
      city,
      postal_code,
      profile_picture,
      menus,
    } = body

    const supabaseAdmin = createAdminClient()

    // Mettre à jour le chef
    const { error: chefError } = await supabaseAdmin
      .from('chefs')
      .update({
        slug,
        name,
        email: email.toLowerCase().trim(),
        phone: phone || null,
        city: city || null,
        postal_code: postal_code || null,
        profile_picture: profile_picture || null,
      })
      .eq('id', chefId)

    if (chefError) {
      throw chefError
    }

    // Mettre à jour les menus
    if (menus !== undefined) {
      // Supprimer les anciens menus
      await supabaseAdmin.from('menus').delete().eq('chef_id', chefId)

      // Ajouter les nouveaux menus
      if (menus.length > 0) {
        const menusToInsert = menus.map((menu: any) => ({
          chef_id: chefId,
          name: menu.name,
          description: menu.description || null,
          price: menu.price ? parseFloat(menu.price.toString()) : null,
        }))

        const { error: menusError } = await supabaseAdmin.from('menus').insert(menusToInsert)
        if (menusError) {
          console.error('Error updating menus:', menusError)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating chef:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour du chef' },
      { status: 500 }
    )
  }
}

