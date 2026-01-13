import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailLayout } from '@/lib/email'
import { getBaseUrl } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Endpoint pour vérifier les booking_requests terminés (J+1 après la date de fin)
 * et envoyer un email d'alerte à contact@guidemytable.fr pour le paiement du chef
 * 
 * Ce endpoint est appelé via un cron job Vercel quotidien
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient()
    const baseUrl = getBaseUrl()

    // Calculer la date limite (J+1 = hier)
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayISO = yesterday.toISOString().split('T')[0] // Format YYYY-MM-DD

    console.log('[check-completed-bookings] Checking for bookings completed on:', yesterdayISO)

    // Récupérer les booking_requests terminés (status = 'completed')
    // On va filtrer côté code pour vérifier la date de fin
    const { data: completedBookings, error: bookingsError } = await supabase
      .from('booking_requests')
      .select(`
        id,
        status,
        service_type,
        booking_date,
        selected_dates,
        total_price,
        first_name,
        last_name,
        email,
        chefs (
          id,
          name,
          email
        )
      `)
      .eq('status', 'completed')
      .or(`booking_date.eq.${yesterdayISO},selected_dates.is.not.null`)

    if (bookingsError) {
      console.error('[check-completed-bookings] Error fetching completed bookings:', bookingsError)
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des réservations terminées' },
        { status: 500 }
      )
    }

    if (!completedBookings || completedBookings.length === 0) {
      console.log('[check-completed-bookings] No completed bookings found for', yesterdayISO)
      return NextResponse.json({ 
        message: 'Aucune réservation terminée trouvée',
        count: 0 
      })
    }

    console.log(`[check-completed-bookings] Found ${completedBookings.length} completed booking(s)`)

    // Filtrer les réservations dont la date de fin correspond à hier
    const bookingsToProcess = completedBookings.filter((booking: any) => {
      if (booking.service_type === 'mise_en_demeure' && booking.selected_dates) {
        // Pour chef à demeure, vérifier si la dernière date est hier
        let dates: string[] = []
        
        // Gérer selected_dates qui peut être un array JSONB ou un objet
        if (Array.isArray(booking.selected_dates)) {
          dates = booking.selected_dates
        } else if (typeof booking.selected_dates === 'object' && booking.selected_dates !== null) {
          // Si c'est un objet (meal_options par date), extraire les clés (dates)
          dates = Object.keys(booking.selected_dates)
        }
        
        if (dates.length > 0) {
          // Trier les dates et prendre la dernière
          const sortedDates = dates.sort()
          const lastDate = sortedDates[sortedDates.length - 1]
          const lastDateISO = getLocalDateString(new Date(lastDate))
          return lastDateISO === yesterdayISO
        }
        return false
      } else if (booking.booking_date) {
        // Pour repas à domicile ou cours, vérifier si la date est hier
        const bookingDate = getLocalDateString(new Date(booking.booking_date))
        return bookingDate === yesterdayISO
      }
      return false
    })

    if (bookingsToProcess.length === 0) {
      console.log('[check-completed-bookings] No bookings match the completion date criteria')
      return NextResponse.json({ 
        message: 'Aucune réservation ne correspond aux critères',
        count: 0 
      })
    }

    // Envoyer un email pour chaque réservation
    for (const booking of bookingsToProcess as any[]) {
      const chef = booking.chefs
      if (!chef) {
        console.warn(`[check-completed-bookings] No chef found for booking ${booking.id}`)
        continue
      }

      const clientName = `${booking.first_name} ${booking.last_name}`
      const chefName = chef.name || 'Chef'
      const chefEmail = chef.email || ''
      
      // Calculer le montant à payer au chef (total - 15% commission)
      const totalPrice = booking.total_price || 0
      const commissionRate = 0.15
      const commissionAmount = totalPrice * commissionRate
      const amountToPay = totalPrice - commissionAmount

      // Déterminer la date de fin de l'événement
      let eventEndDate = ''
      if (booking.service_type === 'mise_en_demeure' && booking.selected_dates) {
        let dates: string[] = []
        
        // Gérer selected_dates qui peut être un array JSONB ou un objet
        if (Array.isArray(booking.selected_dates)) {
          dates = booking.selected_dates
        } else if (typeof booking.selected_dates === 'object' && booking.selected_dates !== null) {
          // Si c'est un objet (meal_options par date), extraire les clés (dates)
          dates = Object.keys(booking.selected_dates)
        }
        
        if (dates.length > 0) {
          const sortedDates = dates.sort()
          const lastDate = sortedDates[sortedDates.length - 1]
          eventEndDate = formatDateForDisplay(lastDate, 'fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })
        }
      } else if (booking.booking_date) {
        eventEndDate = formatDateForDisplay(booking.booking_date, 'fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      }

      const emailContent = `
        <p><strong style="font-size: 18px; color: #000;">Action requise : Paiement du chef</strong></p>
        
        <div style="background-color: #f9f9f9; border-left: 4px solid #FBCF03; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-weight: 600; color: #000; font-size: 16px;">📧 L'événement du chef <strong>${chefName}</strong> pour le client <strong>${clientName}</strong> est terminé.</p>
          <p style="margin: 8px 0 0 0; font-size: 15px; color: #000;">Date de fin de l'événement : <strong>${eventEndDate}</strong></p>
        </div>
        
        <div style="margin-top: 24px; padding: 20px; background-color: #FBCF03; border-radius: 8px; text-align: center;">
          <p style="margin: 0; font-weight: 600; color: #000; font-size: 18px;">
            💰 Montant à payer au chef : <strong>${amountToPay.toFixed(2)} €</strong>
          </p>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #000;">
            (Prix total : ${totalPrice.toFixed(2)} € - Commission plateforme 15% : ${commissionAmount.toFixed(2)} € = ${amountToPay.toFixed(2)} €)
          </p>
        </div>
        
        <div style="margin-top: 20px; padding: 16px; background-color: #f0f0f0; border-radius: 8px;">
          <p style="margin: 0; font-weight: 600; color: #000; font-size: 14px; margin-bottom: 8px;">Détails :</p>
          <ul style="margin: 0; padding-left: 20px; color: #000; font-size: 14px;">
            <li>Chef : <strong>${chefName}</strong> (${chefEmail})</li>
            <li>Client : <strong>${clientName}</strong> (${booking.email})</li>
            <li>Date de fin : <strong>${eventEndDate}</strong></li>
            <li>Montant total : <strong>${totalPrice.toFixed(2)} €</strong></li>
            <li>Commission (15%) : <strong>${commissionAmount.toFixed(2)} €</strong></li>
            <li>Montant à payer : <strong>${amountToPay.toFixed(2)} €</strong></li>
          </ul>
        </div>
      `

      try {
        await sendEmail({
          to: 'contact@guidemytable.fr',
          subject: `Paiement chef requis - ${chefName} - ${clientName}`,
          html: emailLayout({
            title: 'Paiement du chef requis',
            content: emailContent,
            baseUrl,
          }),
        })

        console.log(`[check-completed-bookings] ✅ Sent payment email for booking ${booking.id}`)
      } catch (emailError) {
        console.error(`[check-completed-bookings] ❌ Error sending email for booking ${booking.id}:`, emailError)
      }
    }

    console.log(`[check-completed-bookings] ✅ Sent ${bookingsToProcess.length} payment email(s) to contact@guidemytable.fr`)

    return NextResponse.json({
      message: 'Emails envoyés avec succès',
      count: bookingsToProcess.length,
    })
  } catch (error: any) {
    console.error('[check-completed-bookings] Error:', error)
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    )
  }
}
