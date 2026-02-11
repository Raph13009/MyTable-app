import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNextFallbackBooking } from '@/lib/fallbackBookings'

export const dynamic = 'force-dynamic'

/**
 * Cron +6h pour les demandes fallback:
 * - Si la demande est toujours pending après fallback_timeout_at, on la passe en expired
 * - Puis on envoie automatiquement au chef suivant (si disponible)
 */
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
    const nowIso = new Date().toISOString()

    const { data: timedOutBookings, error: fetchError } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('status', 'pending')
      .eq('fallback_enabled', true)
      .not('fallback_timeout_at', 'is', null)
      .lt('fallback_timeout_at', nowIso)
      .limit(100)

    if (fetchError) {
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des demandes timeout', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!timedOutBookings || timedOutBookings.length === 0) {
      return NextResponse.json({ success: true, expired: 0, forwarded: 0, message: 'Aucune demande fallback expirée' })
    }

    let expiredCount = 0
    let forwardedCount = 0

    for (const booking of timedOutBookings as any[]) {
      // "Lock" via update conditionnelle pour éviter les doubles traitements concurrents
      const { data: lockedRow } = await (supabase
        .from('booking_requests') as any)
        .update({ status: 'expired' })
        .eq('id', booking.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

      if (!lockedRow?.id) {
        continue
      }

      expiredCount += 1

      await (supabase
        .from('decision_tokens') as any)
        .update({ used: true })
        .eq('booking_request_id', booking.id)
        .eq('used', false)

      const fallbackResult = await createNextFallbackBooking(supabase as any, booking, 'timeout')
      if (fallbackResult) {
        forwardedCount += 1
      }
    }

    return NextResponse.json({
      success: true,
      processed: timedOutBookings.length,
      expired: expiredCount,
      forwarded: forwardedCount,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erreur interne' },
      { status: 500 }
    )
  }
}
