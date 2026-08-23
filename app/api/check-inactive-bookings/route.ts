import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailLayout, emailSubjects, emailTemplates } from '@/lib/email'
import { getBaseUrl, generateDecisionToken, hashToken } from '@/lib/utils'
import { formatDateForDisplay } from '@/lib/dateUtils'
import { getChefInactivityReminderCreatedAtRange } from '@/lib/chefInactivityReminder'
import { getServiceTypeLabel } from '@/lib/i18n/constants'

/** Prevent static prerendering - must only run when called by Vercel Cron or manual request */
export const dynamic = 'force-dynamic'

/**
 * Relance unique à J+1 : demandes pending créées hier (Europe/Paris).
 * Email au chef et à contact@guidemytable.fr — pas de relance les jours suivants.
 *
 * Appelé via le cron Vercel quotidien, ou manuellement pour tester.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const baseUrl = getBaseUrl()

    const now = new Date()
    const { fromInclusive, toExclusive } = getChefInactivityReminderCreatedAtRange(now)

    console.log('[check-inactive-bookings] Checking J+1 bookings created between', fromInclusive, 'and', toExclusive)

    // Uniquement les pending créées hier (J+1), pour éviter les relances quotidiennes au-delà
    const { data: inactiveBookings, error: bookingsError } = await supabase
      .from('booking_requests')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        created_at,
        chef_id,
        service_type,
        booking_date,
        is_date_flexible,
        alternative_dates,
        meal_time,
        city,
        postal_code,
        guests_count,
        children_count,
        has_allergies,
        allergies_details,
        notes,
        budget,
        course_topic,
        selected_dates,
        meal_options,
        total_price,
        chefs (
          name,
          email,
          phone
        ),
        menus (
          name
        )
      `)
      .eq('status', 'pending')
      .gte('created_at', fromInclusive)
      .lt('created_at', toExclusive)

    if (bookingsError) {
      console.error('[check-inactive-bookings] Error fetching inactive bookings:', bookingsError)
      return NextResponse.json(
        { error: 'Failed to fetch inactive bookings', details: bookingsError.message },
        { status: 500 }
      )
    }

    if (!inactiveBookings || inactiveBookings.length === 0) {
      console.log('[check-inactive-bookings] No J+1 inactive bookings found')
      return NextResponse.json({
        success: true,
        message: 'No J+1 inactive bookings found',
        count: 0,
      })
    }

    console.log(`[check-inactive-bookings] Found ${inactiveBookings.length} inactive booking(s)`)

    // Envoyer un email pour chaque booking inactive
    const emailPromises = inactiveBookings.map(async (booking: any) => {
      const chef = booking.chefs as any
      const clientName = `${booking.first_name} ${booking.last_name}`
      const chefName = chef?.name || 'Chef inconnu'
      
      // Calculer le temps écoulé depuis la création
      const createdAt = new Date(booking.created_at)
      const hoursElapsed = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60))
      const minutesElapsed = Math.floor(((now.getTime() - createdAt.getTime()) / (1000 * 60)) % 60)

      const timeElapsedLabel = `${hoursElapsed}h ${minutesElapsed}min`

      const content = `
        <p><strong style="font-size: 18px; color: #000;">⚠️ Inactivité d'un chef</strong></p>
        
        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-weight: 600; color: #000; font-size: 16px;">
            Le chef <strong>${chefName}</strong> n'a toujours pas donné de réponse à <strong>${clientName}</strong>
          </p>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #666;">
            Temps écoulé : ${timeElapsedLabel}
          </p>
        </div>
        
        <div style="margin: 24px 0; padding: 20px; background-color: #ffffff; border: 1px solid #e8e8e8; border-radius: 8px;">
          <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #000; font-weight: 600;">📋 Détails de la demande</h3>
          
          <div style="margin-bottom: 12px;">
            <p style="margin: 0; color: #666; font-size: 13px;"><strong>ID de la demande :</strong></p>
            <p style="margin: 4px 0 0 0; color: #000; font-size: 15px;">${booking.id}</p>
          </div>
          
          <div style="margin-bottom: 12px; padding-top: 12px; border-top: 1px solid #e8e8e8;">
            <p style="margin: 0; color: #666; font-size: 13px;"><strong>Date de création :</strong></p>
            <p style="margin: 4px 0 0 0; color: #000; font-size: 15px;">
              ${createdAt.toLocaleDateString('fr-FR', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
        
        <div style="margin: 24px 0; padding: 20px; background-color: #f9f9f9; border: 1px solid #e8e8e8; border-radius: 8px;">
          <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #000; font-weight: 600;">👤 Coordonnées du client</h3>
          
          <div style="margin-bottom: 12px;">
            <p style="margin: 0; color: #666; font-size: 13px;"><strong>Nom complet :</strong></p>
            <p style="margin: 4px 0 0 0; color: #000; font-size: 15px;">${clientName}</p>
          </div>
          
          <div style="margin-bottom: 12px; padding-top: 12px; border-top: 1px solid #e8e8e8;">
            <p style="margin: 0; color: #666; font-size: 13px;"><strong>Email :</strong></p>
            <p style="margin: 4px 0 0 0; color: #000; font-size: 15px;">
              <a href="mailto:${booking.email}" style="color: #000; text-decoration: underline;">${booking.email}</a>
            </p>
          </div>
          
          <div style="margin-bottom: 12px; padding-top: 12px; border-top: 1px solid #e8e8e8;">
            <p style="margin: 0; color: #666; font-size: 13px;"><strong>Téléphone :</strong></p>
            <p style="margin: 4px 0 0 0; color: #000; font-size: 15px;">
              <a href="tel:${booking.phone}" style="color: #000; text-decoration: underline;">${booking.phone}</a>
            </p>
          </div>
        </div>
        
        <div style="margin: 24px 0; padding: 20px; background-color: #f9f9f9; border: 1px solid #e8e8e8; border-radius: 8px;">
          <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #000; font-weight: 600;">👨‍🍳 Coordonnées du chef</h3>
          
          <div style="margin-bottom: 12px;">
            <p style="margin: 0; color: #666; font-size: 13px;"><strong>Nom complet :</strong></p>
            <p style="margin: 4px 0 0 0; color: #000; font-size: 15px;">${chefName}</p>
          </div>
          
          ${chef?.email ? `
          <div style="margin-bottom: 12px; padding-top: 12px; border-top: 1px solid #e8e8e8;">
            <p style="margin: 0; color: #666; font-size: 13px;"><strong>Email :</strong></p>
            <p style="margin: 4px 0 0 0; color: #000; font-size: 15px;">
              <a href="mailto:${chef.email}" style="color: #000; text-decoration: underline;">${chef.email}</a>
            </p>
          </div>
          ` : ''}
          
          ${chef?.phone ? `
          <div style="margin-bottom: 12px; padding-top: 12px; border-top: 1px solid #e8e8e8;">
            <p style="margin: 0; color: #666; font-size: 13px;"><strong>Téléphone :</strong></p>
            <p style="margin: 4px 0 0 0; color: #000; font-size: 15px;">
              <a href="tel:${chef.phone}" style="color: #000; text-decoration: underline;">${chef.phone}</a>
            </p>
          </div>
          ` : ''}
        </div>
        
        <div style="margin-top: 24px; padding: 20px; background-color: #FBCF03; border-radius: 8px; text-align: center;">
          <p style="margin: 0; font-weight: 600; color: #000; font-size: 16px;">
            ⚠️ Action requise : Contacter le chef pour relancer la réponse
          </p>
        </div>
      `

      const emailHtml = emailLayout({
        title: `Inactivité d'un chef - ${chefName}`,
        content,
        baseUrl,
      })

      const emailJobs: Promise<void>[] = []

      // Email d'alerte à l'admin
      emailJobs.push(
        sendEmail({
          to: 'contact@guidemytable.fr',
          subject: `Inactivité d'un chef - ${chefName} n'a pas répondu à ${clientName}`,
          html: emailHtml,
        })
      )

      // Email de relance au chef (si email disponible)
      if (chef?.email) {
        const acceptToken = generateDecisionToken()
        const refuseToken = generateDecisionToken()
        const acceptTokenHash = await hashToken(acceptToken)
        const refuseTokenHash = await hashToken(refuseToken)

        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7)

        // @ts-expect-error - Supabase type inference issue
        await supabase.from('decision_tokens').insert([
          {
            booking_request_id: booking.id,
            token_hash: acceptTokenHash,
            action: 'accept',
            expires_at: expiresAt.toISOString(),
          },
          {
            booking_request_id: booking.id,
            token_hash: refuseTokenHash,
            action: 'refuse',
            expires_at: expiresAt.toISOString(),
          },
        ])

        const acceptUrl = `${baseUrl}/decision?token=${acceptToken}&action=accept`
        const refuseUrl = `${baseUrl}/decision?token=${refuseToken}&action=refuse`

        const serviceType = booking.service_type || 'repas_domicile'
        const serviceTypeLabel = getServiceTypeLabel(serviceType, 'fr')

        const bookingDetails: any = {
          firstName: booking.first_name,
          lastName: booking.last_name,
          phone: booking.phone,
          serviceType,
          serviceTypeLabel,
          city: booking.city,
          postalCode: booking.postal_code,
          guestsCount: booking.guests_count,
          childrenCount: booking.children_count || 0,
          hasAllergies: booking.has_allergies,
          allergiesDetails: booking.allergies_details || '',
          notes: booking.notes || '',
          isDateFlexible: Boolean(booking.is_date_flexible),
          alternativeDates: Array.isArray(booking.alternative_dates)
            ? booking.alternative_dates.map((d: string) => formatDateForDisplay(d, 'fr-FR'))
            : [],
        }

        if (serviceType === 'repas_domicile') {
          bookingDetails.bookingDate = booking.booking_date
            ? formatDateForDisplay(booking.booking_date, 'fr-FR')
            : null
          bookingDetails.mealTimeLabel = booking.meal_time === 'dejeuner'
            ? 'Déjeuner'
            : booking.meal_time === 'diner'
              ? 'Dîner'
              : null
          bookingDetails.menuName = booking.menus?.name || null
        } else if (serviceType === 'cours_cuisine') {
          bookingDetails.bookingDate = booking.booking_date
            ? formatDateForDisplay(booking.booking_date, 'fr-FR')
            : null
          const pricePerPerson = booking.budget ? Number(booking.budget) : null
          bookingDetails.budgetPerPerson = pricePerPerson
          bookingDetails.estimatedTotalPrice = pricePerPerson
            ? pricePerPerson * Number(booking.guests_count || 0)
            : null
          bookingDetails.courseTopic = booking.course_topic || null
        } else if (serviceType === 'mise_en_demeure') {
          bookingDetails.selectedDates = Array.isArray(booking.selected_dates)
            ? booking.selected_dates
            : null
          const mealOptions = booking.meal_options
          if (mealOptions && typeof mealOptions === 'object' && !Array.isArray(mealOptions)) {
            const allOptions = Object.values(mealOptions).flat() as string[]
            const uniqueOptions = [...new Set(allOptions)]
            bookingDetails.mealOptionsLabel = uniqueOptions.map(opt =>
              opt === 'pdj' ? 'Petit-déjeuner' : opt === 'dejeuner' ? 'Déjeuner' : 'Dîner'
            ).join(', ')
          } else if (Array.isArray(mealOptions)) {
            bookingDetails.mealOptionsLabel = mealOptions.map(opt =>
              opt === 'pdj' ? 'Petit-déjeuner' : opt === 'dejeuner' ? 'Déjeuner' : 'Dîner'
            ).join(', ')
          }
          const pricePerDay = booking.total_price ? Number(booking.total_price) : null
          const daysCount = Array.isArray(booking.selected_dates) ? booking.selected_dates.length : 0
          bookingDetails.pricePerDay = pricePerDay
          bookingDetails.estimatedTotalPrice = pricePerDay
            ? pricePerDay * daysCount
            : null
        }

        emailJobs.push(
          sendEmail({
            to: chef.email,
            subject: emailSubjects.bookingReminderToChef,
            html: emailTemplates.bookingReminderToChef(
              chefName,
              bookingDetails,
              acceptUrl,
              refuseUrl,
              timeElapsedLabel,
              baseUrl
            ),
          })
        )
      }

      await Promise.all(emailJobs)
    })

    // Envoyer tous les emails en parallèle
    await Promise.all(emailPromises)

    console.log(`[check-inactive-bookings] ✅ Sent ${inactiveBookings.length} alert email(s) to contact@guidemytable.fr`)

    return NextResponse.json({
      success: true,
      message: `Sent ${inactiveBookings.length} alert email(s)`,
      count: inactiveBookings.length,
      bookings: inactiveBookings.map((b: any) => ({
        id: b.id,
        client: `${b.first_name} ${b.last_name}`,
        chef: (b.chefs as any)?.name || 'Unknown',
        created_at: b.created_at,
      })),
    })
  } catch (error: any) {
    console.error('[check-inactive-bookings] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
