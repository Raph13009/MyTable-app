import type { SupabaseClient } from '@supabase/supabase-js'
import { parseClientCoord } from '@/lib/geo'
import { geocodeBookingAddress } from '@/lib/geocodeBookingAddress'

type BookingLocationSource = {
  event_latitude?: number | null
  event_longitude?: number | null
  full_address?: string | null
  city?: string | null
  postal_code?: string | null
}

export async function resolveBookingEventCoordinates(
  booking: BookingLocationSource
): Promise<{ latitude: number; longitude: number } | null> {
  const storedLat = parseClientCoord(booking.event_latitude)
  const storedLng = parseClientCoord(booking.event_longitude)
  if (
    storedLat !== null &&
    storedLng !== null &&
    storedLat >= -90 &&
    storedLat <= 90 &&
    storedLng >= -180 &&
    storedLng <= 180
  ) {
    return { latitude: storedLat, longitude: storedLng }
  }

  const geocoded = await geocodeBookingAddress({
    fullAddress: booking.full_address,
    city: booking.city,
    postalCode: booking.postal_code,
  })
  if (!geocoded) return null
  return geocoded
}

export async function persistBookingEventCoordinates(
  supabase: SupabaseClient,
  bookingId: string,
  coords: { latitude: number; longitude: number }
): Promise<void> {
  await (supabase.from('booking_requests') as any)
    .update({
      event_latitude: coords.latitude,
      event_longitude: coords.longitude,
    })
    .eq('id', bookingId)
}
