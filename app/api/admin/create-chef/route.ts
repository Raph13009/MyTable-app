import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ADMIN_UID = '8d154623-1aba-475c-9a7b-9ab39f3f84d2'

export async function POST(request: NextRequest) {
  try {
    // Vérifier que l'utilisateur est l'admin
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user || user.id !== ADMIN_UID) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 403 }
      )
    }
    
    const body = await request.json()
    const {
      slug,
      name,
      last_name,
      email,
      phone,
      address,
      latitude,
      longitude,
      city,
      postal_code,
      profile_picture,
      cuisine_style,
      cuisine_style_en,
      info_link_xx,
      primary_dish_photo,
      availability_radius_km,
      dish_photos,
      min_guests,
      max_guests,
      menus,
    } = body

    const supabaseAdmin = createAdminClient()
    const normalizedMenus = Array.isArray(menus)
      ? menus
          .map((menu: any) => {
            const menuName = String(menu?.name || '').trim()
            if (!menuName) return null
            const menuDescription = String(menu?.description || '').trim()
            const rawPrice = menu?.price
            const priceNumber = rawPrice === null || rawPrice === undefined || rawPrice === ''
              ? null
              : Number.parseFloat(rawPrice.toString())
            const safePrice = Number.isFinite(priceNumber) ? priceNumber : null
            return {
              name: menuName,
              description: menuDescription || null,
              price: safePrice,
              key: `${menuName}__${menuDescription || ''}__${safePrice ?? ''}`,
            }
          })
          .filter(Boolean)
      : []
    const dedupedMenus = (() => {
      const seen = new Set<string>()
      return (normalizedMenus as Array<{ name: string; description: string | null; price: number | null; key: string }>).filter(
        (menu) => {
          if (seen.has(menu.key)) return false
          seen.add(menu.key)
          return true
        }
      )
    })()

    const normalizedCuisineStyle = typeof cuisine_style === 'string' ? cuisine_style.trim() : ''
    const normalizedCuisineStyleEn = typeof cuisine_style_en === 'string' ? cuisine_style_en.trim() : ''
    const normalizedInfoLinkXx = typeof info_link_xx === 'string' ? info_link_xx.trim() : ''
    const normalizedPrimaryDishPhoto = typeof primary_dish_photo === 'string' ? primary_dish_photo.trim() : ''
    const normalizedLastName = typeof last_name === 'string' ? last_name.trim() : ''
    const normalizedAddress = typeof address === 'string' ? address.trim() : ''
    const parsedLatitude = latitude === null || latitude === undefined || latitude === ''
      ? null
      : Number.parseFloat(String(latitude))
    const parsedLongitude = longitude === null || longitude === undefined || longitude === ''
      ? null
      : Number.parseFloat(String(longitude))
    const normalizedLatitude = Number.isFinite(parsedLatitude) ? parsedLatitude : null
    const normalizedLongitude = Number.isFinite(parsedLongitude) ? parsedLongitude : null
    const normalizedCity = typeof city === 'string' ? city.trim() : ''
    const normalizedPostalCode = typeof postal_code === 'string' ? postal_code.trim() : ''
    const normalizedDishPhotos = Array.isArray(dish_photos)
      ? dish_photos
          .map((url: unknown) => (typeof url === 'string' ? url.trim() : ''))
          .filter((url: string) => url.length > 0)
          .slice(0, 3)
      : []
    const safePrimaryDishPhoto =
      normalizedPrimaryDishPhoto && normalizedDishPhotos.includes(normalizedPrimaryDishPhoto)
        ? normalizedPrimaryDishPhoto
        : normalizedDishPhotos[0] || null
    const normalizedMinGuests = min_guests === null || min_guests === undefined || min_guests === ''
      ? null
      : Number.parseInt(String(min_guests), 10)
    const normalizedMaxGuests = max_guests === null || max_guests === undefined || max_guests === ''
      ? null
      : Number.parseInt(String(max_guests), 10)
    const parsedAvailabilityRadiusKm = availability_radius_km === null || availability_radius_km === undefined || availability_radius_km === ''
      ? 10
      : Number.parseInt(String(availability_radius_km), 10)
    const normalizedAvailabilityRadiusKm = Number.isFinite(parsedAvailabilityRadiusKm) ? parsedAvailabilityRadiusKm : 10

    if (normalizedMinGuests !== null && (!Number.isFinite(normalizedMinGuests) || normalizedMinGuests < 1)) {
      return NextResponse.json({ error: 'Le minimum de convives est invalide' }, { status: 400 })
    }
    if (normalizedMaxGuests !== null && (!Number.isFinite(normalizedMaxGuests) || normalizedMaxGuests < 1)) {
      return NextResponse.json({ error: 'Le maximum de convives est invalide' }, { status: 400 })
    }
    if (normalizedMinGuests !== null && normalizedMaxGuests !== null && normalizedMinGuests > normalizedMaxGuests) {
      return NextResponse.json({ error: 'Le minimum de convives doit être inférieur ou égal au maximum' }, { status: 400 })
    }
    if (normalizedAddress && (normalizedLatitude === null || normalizedLongitude === null)) {
      return NextResponse.json({ error: 'Latitude et longitude sont requises quand une adresse est définie' }, { status: 400 })
    }
    if (normalizedLatitude !== null && (normalizedLatitude < -90 || normalizedLatitude > 90)) {
      return NextResponse.json({ error: 'Latitude invalide' }, { status: 400 })
    }
    if (normalizedLongitude !== null && (normalizedLongitude < -180 || normalizedLongitude > 180)) {
      return NextResponse.json({ error: 'Longitude invalide' }, { status: 400 })
    }
    if (![10, 20, 30, 40, 50, 60].includes(normalizedAvailabilityRadiusKm)) {
      return NextResponse.json({ error: 'Rayon de disponibilité invalide' }, { status: 400 })
    }

    // Créer le chef
    const { data: newChef, error: chefError } = await supabaseAdmin
      .from('chefs')
      // @ts-expect-error - Supabase type inference issue
      .insert({
        slug,
        name,
        last_name: normalizedLastName || null,
        email: email.toLowerCase().trim(),
        phone: phone || null,
        address: normalizedAddress || null,
        latitude: normalizedLatitude,
        longitude: normalizedLongitude,
        city: normalizedCity || null,
        postal_code: normalizedPostalCode || null,
        profile_picture: profile_picture || null,
        cuisine_style: normalizedCuisineStyle || null,
        cuisine_style_en: normalizedCuisineStyleEn || null,
        info_link_xx: normalizedInfoLinkXx || null,
        primary_dish_photo: safePrimaryDishPhoto,
        availability_radius_km: normalizedAvailabilityRadiusKm,
        dish_photos: normalizedDishPhotos,
        min_guests: normalizedMinGuests,
        max_guests: normalizedMaxGuests,
      })
      .select()
      .single()

    if (chefError) {
      throw chefError
    }

    // Créer l'utilisateur auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      email_confirm: true,
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      // On continue même si l'auth échoue, on peut le créer plus tard
    }

    // Ajouter les menus si fournis
    if (dedupedMenus.length > 0 && newChef) {
      const menusToInsert = dedupedMenus.map((menu) => ({
        chef_id: (newChef as any).id,
        name: menu.name,
        description: menu.description || null,
        price: menu.price === null ? null : menu.price,
      }))

      // @ts-expect-error - Supabase type inference issue
      const { error: menusError } = await supabaseAdmin.from('menus').insert(menusToInsert)
      if (menusError) {
        console.error('Error creating menus:', menusError)
        // On continue même si les menus échouent
      }
    }

    return NextResponse.json({
      success: true,
      chef: newChef,
      authUser: authUser?.user || null,
    })
  } catch (error: any) {
    console.error('Error creating chef:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la création du chef' },
      { status: 500 }
    )
  }
}
