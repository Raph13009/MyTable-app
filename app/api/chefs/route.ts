import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Route API pour créer un chef
 * POST /api/chefs
 * Body: { slug, name, email, phone?, city?, postal_code? }
 * 
 * Crée automatiquement l'utilisateur auth.users pour le chef
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { slug, name, email, phone, city, postal_code } = body

    // Validation
    if (!slug || !name || !email) {
      return NextResponse.json(
        { error: 'slug, name et email sont requis' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Vérifier si le chef existe déjà
    const { data: existingChef } = await supabase
      .from('chefs')
      .select('id, email')
      .eq('slug', slug)
      .single()

    if (existingChef) {
      return NextResponse.json(
        { error: 'Un chef avec ce slug existe déjà' },
        { status: 400 }
      )
    }

    // Créer l'utilisateur auth pour le chef
    let chefUserId: string | null = null
    try {
      // Essayer de créer l'utilisateur (créera une erreur si existe déjà)
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        email_confirm: true,
      })

      if (createError) {
        // Si l'utilisateur existe déjà, on le récupère
        if (createError.message.includes('already registered') || createError.message.includes('already exists')) {
          // Lister les utilisateurs pour trouver celui qui existe
          const { data: users } = await supabase.auth.admin.listUsers()
          const existingUser = users?.users.find(u => u.email === email)
          
          if (existingUser) {
            chefUserId = existingUser.id
          } else {
            return NextResponse.json(
              { error: 'Utilisateur existe mais introuvable' },
              { status: 500 }
            )
          }
        } else {
          return NextResponse.json(
            { error: `Erreur lors de la création de l'utilisateur auth: ${createError.message}` },
            { status: 500 }
          )
        }
      } else if (newUser?.user) {
        chefUserId = newUser.user.id
      }
    } catch (error: any) {
      return NextResponse.json(
        { error: `Erreur lors de la création de l'utilisateur auth: ${error.message}` },
        { status: 500 }
      )
    }

    // Créer le chef dans la table chefs
    const { data: chef, error: chefError } = await supabase
      .from('chefs')
      .insert({
        slug,
        name,
        email,
        phone: phone || null,
        city: city || null,
        postal_code: postal_code || null,
      })
      .select()
      .single()

    if (chefError || !chef) {
      // Si erreur, supprimer l'utilisateur auth créé (rollback)
      if (chefUserId) {
        await supabase.auth.admin.deleteUser(chefUserId)
      }
      return NextResponse.json(
        { error: `Erreur lors de la création du chef: ${chefError?.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      chef: {
        ...chef,
        auth_user_id: chefUserId,
      },
    })
  } catch (error: any) {
    console.error('Error creating chef:', error)
    return NextResponse.json(
      { error: error.message || 'Une erreur est survenue' },
      { status: 500 }
    )
  }
}

