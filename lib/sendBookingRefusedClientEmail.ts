import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail, emailTemplates, emailSubjects } from '@/lib/email'
import { findNearbyChefSuggestions } from '@/lib/nearbyChefSuggestions'
import { persistBookingEventCoordinates, resolveBookingEventCoordinates } from '@/lib/bookingEventLocation'

type AdminClient = SupabaseClient

/**
 * Email client après refus sans chef fallback contacté.
 * Si des chefs à proximité existent, propose jusqu'à 3 profils avec liens de réservation.
 */
export async function sendBookingRefusedClientEmail(
  supabase: AdminClient,
  booking: {
    id: string
    chef_id: string
    first_name?: string | null
    email: string
    fallback_enabled?: boolean
    event_latitude?: number | null
    event_longitude?: number | null
    full_address?: string | null
    city?: string | null
    postal_code?: string | null
  },
  chefFirstName: string,
  baseUrl: string
): Promise<void> {
  const clientFirstName = booking.first_name || ''
  let nearbyChefs: Awaited<ReturnType<typeof findNearbyChefSuggestions>> = []

  const coords = await resolveBookingEventCoordinates(booking)
  if (coords && booking.event_latitude == null && booking.event_longitude == null) {
    await persistBookingEventCoordinates(supabase, booking.id, coords)
  }
  if (coords) {
    nearbyChefs = await findNearbyChefSuggestions(supabase, {
      latitude: coords.latitude,
      longitude: coords.longitude,
      excludeChefId: booking.chef_id,
      limit: 3,
      baseUrl,
    })
  }

  if (nearbyChefs.length > 0) {
    await sendEmail({
      to: booking.email,
      subject: emailSubjects.bookingRefusedNearbyChefsToClient,
      html: emailTemplates.bookingRefusedNearbyChefsToClient(
        clientFirstName,
        chefFirstName,
        nearbyChefs,
        baseUrl
      ),
    })
    return
  }

  await sendEmail({
    to: booking.email,
    subject: emailSubjects.bookingRefusedToClient,
    html: emailTemplates.bookingRefusedToClient(clientFirstName, chefFirstName, baseUrl),
  })
}
