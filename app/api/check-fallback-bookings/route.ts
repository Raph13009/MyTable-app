import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FALLBACK_EXCLUSIVE_WINDOW_HOURS } from '@/lib/fallbackBookings'
import { processExpiredPrimaryExclusiveWindows } from '@/lib/processExpiredPrimaryBookings'

export const dynamic = 'force-dynamic'

/**
 * Cron for the primary chef exclusive window (always 3h, even without replacement chefs):
 * - If the primary request is still pending after fallback_timeout_at, mark it expired
 * - If the client selected backup chefs, broadcast to them
 * - Otherwise email the client nearby-chef suggestions
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
    const result = await processExpiredPrimaryExclusiveWindows(supabase as any)

    if (result.processed === 0) {
      return NextResponse.json({
        success: true,
        expired: 0,
        forwarded: 0,
        notified: 0,
        message: `Aucune demande expirée (fenêtre exclusive ${FALLBACK_EXCLUSIVE_WINDOW_HOURS}h)`,
      })
    }

    return NextResponse.json({
      success: true,
      processed: result.processed,
      expired: result.expired,
      forwarded: result.forwarded,
      notified: result.notified,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erreur interne' },
      { status: 500 }
    )
  }
}
