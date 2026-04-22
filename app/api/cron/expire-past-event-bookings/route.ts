import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Passe en `expired` toute demande « en cours » (status `accepted` ou
 * `validated_by_client`) dont la date de l'événement (`booking_date`) est déjà
 * passée.
 * Scheduled via Vercel Cron (voir vercel.json → /api/cron/expire-past-event-bookings).
 */
const ONGOING_STATUSES = ['accepted', 'validated_by_client'] as const

function getTodayDateString(): string {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export async function GET(request: NextRequest) {
  try {
    const configuredCronSecret = process.env.CRON_SECRET
    if (configuredCronSecret) {
      const bearerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
      const headerToken = request.headers.get('x-cron-secret')?.trim()
      const queryToken = request.nextUrl.searchParams.get('cron_secret')?.trim()
      const providedToken = bearerToken || headerToken || queryToken
      if (!providedToken || providedToken !== configuredCronSecret) {
        return NextResponse.json({ error: 'Unauthorized cron call' }, { status: 401 })
      }
    }

    const supabase = createAdminClient()
    const today = getTodayDateString()

    const { data, error } = await (supabase.from('booking_requests') as any)
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .in('status', ONGOING_STATUSES)
      .not('booking_date', 'is', null)
      .lt('booking_date', today)
      .select('id')

    if (error) {
      console.error('[cron/expire-past-event-bookings] update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const expired = Array.isArray(data) ? data.length : 0
    return NextResponse.json({ success: true, expired, today })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[cron/expire-past-event-bookings]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
