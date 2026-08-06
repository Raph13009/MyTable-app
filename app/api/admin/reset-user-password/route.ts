import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Admin API to check user status and send password reset link
 * GET /api/admin/reset-user-password?email=user@example.com
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')?.toLowerCase().trim()

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // 1. Check if user exists in auth.users
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('[reset-user-password] Error listing users:', listError)
      return NextResponse.json(
        { error: 'Failed to list users', details: listError.message },
        { status: 500 }
      )
    }

    const user = users?.users.find(u => u.email?.toLowerCase() === email)

    if (!user) {
      // User doesn't exist - check if they exist in chefs table
      const { data: chef, error: chefError } = await supabase
        .from('chefs')
        .select('email, name, last_name')
        .ilike('email', email)
        .single()

      if (chefError || !chef) {
        return NextResponse.json({
          exists: false,
          message: 'User not found in auth.users or chefs table',
          email,
        })
      }

      // Chef exists in chefs table but not in auth.users - create them
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: chef.email,
        email_confirm: true,
      })

      if (createError) {
        console.error('[reset-user-password] Error creating user:', createError)
        return NextResponse.json(
          { 
            error: 'Failed to create user', 
            details: createError.message,
            chefExists: true,
            chefData: chef 
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        exists: false,
        created: true,
        userId: newUser.user?.id,
        email,
        message: 'User was created. They can now use "Forgot Password" on the login page.',
        chefData: chef,
      })
    }

    // 2. User exists - get detailed info
    const userInfo = {
      id: user.id,
      email: user.email,
      emailConfirmed: user.email_confirmed_at !== null,
      createdAt: user.created_at,
      lastSignIn: user.last_sign_in_at,
      identities: user.identities?.map(i => ({
        provider: i.provider,
        created_at: i.created_at,
      })),
    }

    // 3. Send password reset email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent('/login?reset=success')}`

    const { error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: user.email!,
      options: {
        redirectTo,
      },
    })

    if (resetError) {
      console.error('[reset-user-password] Error generating reset link:', resetError)
      return NextResponse.json({
        exists: true,
        userInfo,
        error: 'Failed to send reset email',
        details: resetError.message,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      exists: true,
      userInfo,
      message: `Password reset email sent to ${email}`,
      instructions: 'The user should check their email (including spam folder) for a password reset link.',
    })

  } catch (error: any) {
    console.error('[reset-user-password] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Unexpected error', details: error.message },
      { status: 500 }
    )
  }
}
