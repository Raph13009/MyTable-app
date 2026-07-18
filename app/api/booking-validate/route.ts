import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import { getBaseUrl } from '@/lib/utils'
import { calculateBookingTotal } from '@/lib/bookingCalculations'
import { isValidDateString } from '@/lib/dateUtils'

/**
 * API Route pour finaliser une réservation (client uniquement)
 * Met à jour le statut à 'validated_by_client' et envoie les emails appropriés
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { bookingRequestId, confirmedDate: confirmedDateRaw } = await request.json()
    if (!bookingRequestId) {
      return NextResponse.json({ error: 'bookingRequestId requis' }, { status: 400 })
    }

    // Récupérer la réservation
    const { data: bookingRequest, error: bookingError } = await supabaseAdmin
      .from('booking_requests')
      .select('*, chefs(*), menus(*)')
      .eq('id', bookingRequestId)
      .single()

    if (bookingError || !bookingRequest) {
      console.error('[booking-validate] Error fetching booking:', bookingError)
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
    }

    // Vérifier que l'utilisateur est le client
    const normalizedUserEmail = user.email?.toLowerCase().trim()
    const normalizedBookingEmail = (bookingRequest as any).email?.toLowerCase().trim()
    if (normalizedUserEmail !== normalizedBookingEmail) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Vérifier que le statut est 'accepted'
    if ((bookingRequest as any).status !== 'accepted') {
      return NextResponse.json({
        error: 'La réservation doit être acceptée par le chef avant d\'être validée'
      }, { status: 400 })
    }

    // Déterminer la date finale retenue (pour la facturation).
    // Si le client était flexible, il choisit parmi la date principale + les dates alternatives.
    const originalBookingDate = (bookingRequest as any).booking_date as string | null
    const altDates: string[] = Array.isArray((bookingRequest as any).alternative_dates)
      ? (bookingRequest as any).alternative_dates
      : []
    const isDateFlexible = Boolean((bookingRequest as any).is_date_flexible)

    let effectiveBookingDate = originalBookingDate
    // Seule une réservation flexible permet au client de choisir une date parmi
    // celles proposées. Hors flexibilité, on ignore toute date envoyée par le client
    // pour qu'il ne puisse pas réécrire la date convenue avec le chef.
    if (isDateFlexible && typeof confirmedDateRaw === 'string' && isValidDateString(confirmedDateRaw)) {
      const allowedDates = [originalBookingDate, ...altDates].filter(Boolean) as string[]
      if (allowedDates.length > 0 && !allowedDates.includes(confirmedDateRaw)) {
        return NextResponse.json({
          error: 'La date confirmée doit faire partie des dates proposées',
        }, { status: 400 })
      }
      effectiveBookingDate = confirmedDateRaw
    }

    // Mettre à jour le statut + la date finale retenue
    const updatePayload: Record<string, any> = {
      status: 'validated_by_client',
      confirmed_date: effectiveBookingDate,
      updated_at: new Date().toISOString(),
    }
    // Aligner booking_date sur la date retenue pour cohérence facturation / affichage
    if (effectiveBookingDate && effectiveBookingDate !== originalBookingDate) {
      updatePayload.booking_date = effectiveBookingDate
    }

    const { error: updateError } = await supabaseAdmin
      .from('booking_requests')
      // @ts-expect-error - Supabase type inference issue
      .update(updatePayload as any)
      .eq('id', bookingRequestId)

    if (updateError) {
      console.error('[booking-validate] Error updating status:', updateError)
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }

    // Récupérer les extras
    let extras: Array<{ name: string; price: number }> = []
    if ((bookingRequest as any).extras) {
      try {
        const extrasData = (bookingRequest as any).extras
        if (Array.isArray(extrasData)) {
          extras = extrasData
        } else if (typeof extrasData === 'string') {
          const parsed = JSON.parse(extrasData)
          if (parsed.extras && Array.isArray(parsed.extras)) {
            extras = parsed.extras
          }
        }
      } catch (e) {
        console.error('[booking-validate] Error parsing extras:', e)
      }
    }
    
    // Calculer le montant total selon le type de service
    const menuPrice = (bookingRequest as any).menus?.price || 0
    const guestsCount = (bookingRequest as any).guests_count || 0
    const childrenCount = (bookingRequest as any).children_count || 0
    const totalAmount = calculateBookingTotal((bookingRequest as any).service_type, {
      menuPrice,
      guestsCount,
      budget: (bookingRequest as any).budget,
      totalPrice: (bookingRequest as any).total_price,
      periodDaysCount: Array.isArray((bookingRequest as any).selected_dates)
        ? (bookingRequest as any).selected_dates.length
        : 0,
      isPriceCustom: (bookingRequest as any).is_price_custom,
      extras,
    })

    // Formater la date selon le type de service
    const { formatDateForDisplay } = await import('@/lib/dateUtils')
    const serviceType = (bookingRequest as any).service_type
    let bookingDate = ''
    
    if (serviceType === 'mise_en_demeure') {
      // Pour chef à demeure, utiliser selected_dates
      const selectedDates = (bookingRequest as any).selected_dates
      if (selectedDates && Array.isArray(selectedDates) && selectedDates.length > 0) {
        // Formater toutes les dates et les joindre
        const formattedDates = selectedDates.map((date: string) => 
          formatDateForDisplay(date, 'fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        )
        // Joindre les dates avec "et" pour la dernière
        if (formattedDates.length === 1) {
          bookingDate = formattedDates[0]
        } else if (formattedDates.length === 2) {
          bookingDate = `${formattedDates[0]} et ${formattedDates[1]}`
        } else {
          bookingDate = `${formattedDates.slice(0, -1).join(', ')} et ${formattedDates[formattedDates.length - 1]}`
        }
      } else {
        // Fallback si selected_dates n'est pas disponible
        bookingDate = formatDateForDisplay((bookingRequest as any).booking_date, 'fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      }
    } else {
      // Pour les autres types de service, utiliser la date finale retenue
      bookingDate = formatDateForDisplay(effectiveBookingDate, 'fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }

    const baseUrl = getBaseUrl()

    // Envoyer les emails (séparément pour ne jamais bloquer l'email admin)
    const chef = (bookingRequest as any).chefs

    try {
      await sendEmail({
        to: (bookingRequest as any).email,
        subject: emailSubjects.bookingValidatedToClient,
        html: emailTemplates.bookingValidatedToClient(
          `${(bookingRequest as any).first_name} ${(bookingRequest as any).last_name}`,
          bookingDate,
          baseUrl
        ),
      })
      console.log('[booking-validate] ✅ Client email sent successfully')
    } catch (clientEmailError) {
      console.error('[booking-validate] ❌ Error sending client email:', clientEmailError)
    }

    console.log('[booking-validate] Sending email to admin: contact@guidemytable.fr')
    try {
      await sendEmail({
        to: 'contact@guidemytable.fr',
        subject: emailSubjects.bookingValidatedToAdmin,
        html: emailTemplates.bookingValidatedToAdmin(
          `${(bookingRequest as any).first_name} ${(bookingRequest as any).last_name}`,
          (bookingRequest as any).email,
          (bookingRequest as any).phone || 'N/A',
          chef?.name || 'Chef',
          chef?.email || '',
          bookingDate,
          guestsCount,
          childrenCount,
          totalAmount,
          (bookingRequest as any).menus?.name || null,
          extras,
          baseUrl
        ),
      })
      console.log('[booking-validate] ✅ Admin email sent successfully')
    } catch (adminEmailError) {
      console.error('[booking-validate] ❌ Error sending admin email:', adminEmailError)
      // Ne pas bloquer la réponse API si l'email admin échoue
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[booking-validate] Error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
