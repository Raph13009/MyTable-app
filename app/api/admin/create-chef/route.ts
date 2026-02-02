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
    const normalizedMenus = Array.isArray(menus)
      ? menus
          .map((menu: any) => {
            const menuName = String(menu?.name || '').trim()
            if (!menuName) return null
            const menuDescription = String(menu?.description || '').trim()
            const rawPrice = menu?.price
            const priceNumber = rawPrice === null || rawPrice === undefined || rawPrice === ''
              ? null
              : Number.parseFloat(rawPrice.toString())
            const safePrice = Number.isFinite(priceNumber) ? priceNumber : null
            return {
              name: menuName,
              description: menuDescription || null,
              price: safePrice,
              key: `${menuName}__${menuDescription || ''}__${safePrice ?? ''}`,
            }
          })
          .filter(Boolean)
      : []
    const dedupedMenus = (() => {
      const seen = new Set<string>()
      return (normalizedMenus as Array<{ name: string; description: string | null; price: number | null; key: string }>).filter(
        (menu) => {
          if (seen.has(menu.key)) return false
          seen.add(menu.key)
          return true
        }
      )
    })()

    // Créer le chef
    const { data: newChef, error: chefError } = await supabaseAdmin
      .from('chefs')
      // @ts-expect-error - Supabase type inference issue
      .insert({
        slug,
        name,
        email: email.toLowerCase().trim(),
        phone: phone || null,
        city: city || null,
        postal_code: postal_code || null,
        profile_picture: profile_picture || null,
      })
      .select()
      .single()

    if (chefError) {
      throw chefError
    }

    // Créer l'utilisateur auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      email_confirm: true,
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      // On continue même si l'auth échoue, on peut le créer plus tard
    }

    // Ajouter les menus si fournis
    if (dedupedMenus.length > 0 && newChef) {
      const menusToInsert = dedupedMenus.map((menu) => ({
        chef_id: (newChef as any).id,
        name: menu.name,
        description: menu.description || null,
        price: menu.price === null ? null : menu.price,
      }))

      // @ts-expect-error - Supabase type inference issue
      const { error: menusError } = await supabaseAdmin.from('menus').insert(menusToInsert)
      if (menusError) {
        console.error('Error creating menus:', menusError)
        // On continue même si les menus échouent
      }
    }

    return NextResponse.json({
      success: true,
      chef: newChef,
      authUser: authUser?.user || null,
    })
  } catch (error: any) {
    console.error('Error creating chef:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création du chef' },
      { status: 500 }
    )
  }
}
