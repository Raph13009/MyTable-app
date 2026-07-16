import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Creates a client auth account (email confirmed) so the browser can sign in
 * BEFORE POST /api/bookings. Does not create bookings or conversations.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = String(body?.email ?? '').toLowerCase().trim()
    const password = String(body?.password ?? '')

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'invalid_password' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json(
          { error: 'email_exists', message: 'Un compte existe déjà avec cet email.' },
          { status: 409 }
        )
      }
      console.error('[auth/register] createUser error:', error)
      return NextResponse.json({ error: error.message || 'register_failed' }, { status: 500 })
    }

    if (!data?.user?.id) {
      return NextResponse.json({ error: 'register_failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, userId: data.user.id })
  } catch (error: any) {
    console.error('[auth/register] unexpected error:', error)
    return NextResponse.json(
      { error: error?.message || 'register_failed' },
      { status: 500 }
    )
  }
}
