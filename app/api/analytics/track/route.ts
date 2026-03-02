import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      event_type,
      page,
      metadata = {},
      user_id: userIdFromClient,
      role: roleFromClient,
    } = body

    if (!event_type || typeof event_type !== 'string') {
      return new NextResponse(null, { status: 204 })
    }

    let userId = userIdFromClient ?? null
    let role = roleFromClient ?? null

    if (!userId) {
      const supabaseAuth = await createClient()
      const { data: { user } } = await supabaseAuth.auth.getUser()
      if (user) {
        userId = user.id
      }
    }

    const supabase = createAdminClient()
    const row = {
      user_id: userId || null,
      role: role || null,
      event_type: event_type.trim(),
      page: page || null,
      metadata: typeof metadata === 'object' ? metadata : {},
    }
    const db = supabase as unknown as { from: (t: string) => { insert: (r: object) => Promise<unknown> } }
    await db.from('analytics_events').insert(row)

    return new NextResponse(null, { status: 204 })
  } catch {
    return new NextResponse(null, { status: 204 })
  }
}
