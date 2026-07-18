import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import { getBaseUrl } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Envoie un email de test « nouvelle demande au chef » (repas à domicile avec prix).
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
    const showFallbackPriority = request.nextUrl.searchParams.get('fallback') === '1'

    const bookingDetails = {
      firstName: 'Jean',
      lastName: 'Test',
      phone: '06 00 00 00 00',
      serviceType: 'repas_domicile',
      serviceTypeLabel: 'Repas à domicile',
      city: 'Paris',
      postalCode: '75001',
      guestsCount: 4,
      childrenCount: 0,
      hasAllergies: false,
      allergiesDetails: '',
      notes: 'Email de test — prix fictifs.',
      bookingDate: 'samedi 18 avril 2026',
      mealTimeLabel: 'Dîner',
      menuName: 'Menu dégustation (exemple)',
      menuPricePerPerson: 85,
      estimatedTotalPrice: 340,
    }

    await sendEmail({
      to,
      subject: emailSubjects.bookingRequestToChef(
        bookingDetails.firstName,
        bookingDetails.lastName
      ),
      html: emailTemplates.bookingRequestToChef(
        'Chef Test',
        bookingDetails,
        `${baseUrl}/decision?token=TEST&action=accept`,
        `${baseUrl}/decision?token=TEST&action=refuse`,
        baseUrl,
        { showFallbackPriority }
      ),
    })

    return NextResponse.json({ success: true, to })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
