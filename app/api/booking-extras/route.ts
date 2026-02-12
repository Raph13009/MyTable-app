import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const { bookingRequestId, extras, customPrice, isPriceCustom } = await request.json()

    if (!bookingRequestId) {
      return NextResponse.json({ error: 'Missing bookingRequestId' }, { status: 400 })
    }

    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    // Vérifier l'authentification
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (!user || userError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Récupérer le booking_request pour vérifier que l'utilisateur est le chef
    const { data: bookingRequest, error: bookingError } = await supabaseAdmin
      .from('booking_requests')
      .select('chef_id')
      .eq('id', bookingRequestId)
      .single()

    if (bookingError || !bookingRequest) {
      return NextResponse.json({ error: 'Booking request not found' }, { status: 404 })
    }

    // Récupérer le chef pour vérifier l'email
    const { data: chef, error: chefError } = await supabaseAdmin
      .from('chefs')
      .select('email')
      .eq('id', (bookingRequest as any).chef_id)
      .single()

    if (chefError || !chef) {
      return NextResponse.json({ error: 'Chef not found' }, { status: 404 })
    }

    // Vérifier que l'utilisateur est bien le chef
    const normalizedChefEmail = (chef as any).email?.toLowerCase().trim()
    const normalizedUserEmail = user.email?.toLowerCase().trim()

    if (normalizedChefEmail !== normalizedUserEmail) {
      return NextResponse.json({ error: 'Only the chef can add extras' }, { status: 403 })
    }

    // Sauvegarder le prix personnalisé si fourni
    if (isPriceCustom === true) {
      const normalizedCustomPrice = Number(customPrice)
      if (!Number.isFinite(normalizedCustomPrice) || normalizedCustomPrice <= 0) {
        return NextResponse.json({ error: 'Prix personnalisé invalide' }, { status: 400 })
      }

      const { error: pricingError } = await supabaseAdmin
        .from('booking_requests')
        // @ts-expect-error - Supabase type inference issue
        .update({
          total_price: normalizedCustomPrice,
          is_price_custom: true,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', bookingRequestId)

      if (pricingError) {
        throw pricingError
      }
    }

    // Sauvegarder les extras dans le champ extras (JSONB)
    // Format: [{"name": "...", "price": ...}, ...]
    // Si le champ extras n'existe pas encore (ancienne DB), on utilise notes en fallback
    const extrasArray = extras || []

    // Essayer d'abord avec le champ extras (JSONB)
    const { error: updateError } = await supabaseAdmin
      .from('booking_requests')
      // @ts-expect-error - Supabase type inference issue
      .update({
        extras: extrasArray,
      } as any)
      .eq('id', bookingRequestId)
    
    // Si erreur (champ n'existe pas), fallback sur notes (pour compatibilité)
    if (updateError && updateError.message?.includes('extras')) {
      console.log('[booking-extras] Extras column not found, using notes as fallback')
      const extrasData = {
        extras: extrasArray,
      }
      const { error: fallbackError } = await supabaseAdmin
        .from('booking_requests')
        // @ts-expect-error - Supabase type inference issue
        .update({
          notes: JSON.stringify(extrasData),
        } as any)
        .eq('id', bookingRequestId)
      
      if (fallbackError) {
        throw fallbackError
      }
    } else if (updateError) {
      throw updateError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving extras:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bookingRequestId = searchParams.get('bookingRequestId')

    if (!bookingRequestId) {
      return NextResponse.json({ error: 'Missing bookingRequestId' }, { status: 400 })
    }

    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    // Vérifier l'authentification
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (!user || userError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Récupérer le booking_request avec extras et notes (pour compatibilité)
    const { data: bookingRequest, error: bookingError } = await supabaseAdmin
      .from('booking_requests')
      .select('extras, notes')
      .eq('id', bookingRequestId)
      .single()

    if (bookingError || !bookingRequest) {
      return NextResponse.json({ error: 'Booking request not found' }, { status: 404 })
    }

    // Essayer d'abord avec le champ extras (JSONB)
    let extras: any[] = []
    if ((bookingRequest as any).extras) {
      // Si extras est un tableau JSONB, l'utiliser directement
      if (Array.isArray((bookingRequest as any).extras)) {
        extras = (bookingRequest as any).extras
      } else {
        // Sinon, c'est peut-être une string JSONB, essayer de parser
        try {
          const parsed = typeof (bookingRequest as any).extras === 'string' 
            ? JSON.parse((bookingRequest as any).extras)
            : (bookingRequest as any).extras
          if (Array.isArray(parsed)) {
            extras = parsed
          }
        } catch (e) {
          console.error('Error parsing extras:', e)
        }
      }
    } else if ((bookingRequest as any).notes) {
      // Fallback: parser depuis notes (ancienne méthode)
      try {
        const parsed = JSON.parse((bookingRequest as any).notes)
        if (parsed.extras && Array.isArray(parsed.extras)) {
          extras = parsed.extras
        }
      } catch (e) {
        // Si ce n'est pas du JSON, c'est peut-être juste du texte, on ignore
      }
    }

    return NextResponse.json({ extras })
  } catch (error: any) {
    console.error('Error fetching extras:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
