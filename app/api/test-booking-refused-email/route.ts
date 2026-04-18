import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import { getBaseUrl } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Envoie un email de test « demande refusée par le chef » (template client).
 * Protégé comme les crons si CRON_SECRET est défini.
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
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const to =
      request.nextUrl.searchParams.get('to')?.trim() || 'raphaellevy027@gmail.com'
    const baseUrl = getBaseUrl()

    /** Optionnel : expéditeur explicite (sinon RESEND_FROM ou contact@guidemytable.fr). */
    const testFrom = process.env.RESEND_TEST_FROM?.trim()

    await sendEmail({
      to,
      subject: emailSubjects.bookingRefusedToClient,
      html: emailTemplates.bookingRefusedToClient('Raphael', 'Marie', baseUrl),
      ...(testFrom ? { from: testFrom } : {}),
    })

    return NextResponse.json({
      success: true,
      to,
      from: testFrom || process.env.RESEND_FROM || 'MyTable <contact@guidemytable.fr>',
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
