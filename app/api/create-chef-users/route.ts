import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Prevent static prerendering - mutates auth.users, must only run when explicitly requested */
export const dynamic = 'force-dynamic'

/**
 * Route API pour créer les utilisateurs auth.users pour les chefs existants
 * À appeler une fois pour migrer les chefs existants
 * GET /api/create-chef-users
 */
export async function GET() {
  try {
    const supabase = createAdminClient()

    // Récupérer tous les chefs
    const { data: chefs, error: chefsError } = await supabase
      .from('chefs')
      .select('email, name')

    if (chefsError || !chefs) {
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des chefs' },
        { status: 500 }
      )
    }

    const results = []

    for (const chef of chefs) {
      try {
        // Essayer de créer l'utilisateur (créera une erreur si existe déjà)
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: (chef as any).email,
          email_confirm: true,
        })

        if (createError) {
          // Si l'utilisateur existe déjà, on le récupère
          if (createError.message.includes('already registered') || createError.message.includes('already exists')) {
            // Lister les utilisateurs pour trouver celui qui existe
            const { data: users, error: listError } = await supabase.auth.admin.listUsers()
            const existingUser = users?.users.find(u => u.email === (chef as any).email)
            
            if (existingUser) {
              results.push({
                email: (chef as any).email,
                status: 'exists',
                userId: existingUser.id,
              })
            } else {
              results.push({
                email: (chef as any).email,
                status: 'error',
                error: 'User exists but could not be found',
              })
            }
          } else {
            results.push({
              email: (chef as any).email,
              status: 'error',
              error: createError.message,
            })
          }
        } else if (newUser?.user) {
          results.push({
            email: (chef as any).email,
            status: 'created',
            userId: newUser.user.id,
          })
        }
      } catch (error: any) {
        results.push({
          email: (chef as any).email,
          status: 'error',
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      results,
      total: chefs.length,
    })
  } catch (error: any) {
    console.error('Error creating chef users:', error)
    return NextResponse.json(
      { error: error.message || 'Une erreur est survenue' },
      { status: 500 }
    )
  }
}

