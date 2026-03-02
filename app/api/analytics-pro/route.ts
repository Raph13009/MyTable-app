import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ADMIN_UID = '8d154623-1aba-475c-9a7b-9ab39f3f84d2'

export const dynamic = 'force-dynamic'

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function addDays(d: Date, n: number) {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()

    if (!user || user.id !== ADMIN_UID) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const daysParam = searchParams.get('days')
    const days = Math.min(90, Math.max(1, parseInt(daysParam || '14', 10) || 14))

    const now = new Date()
    const endDate = startOfDay(addDays(now, 1))
    const startDate = addDays(endDate, -days)

    const supabase = createAdminClient()

    const { data: events, error } = await supabase
      .from('analytics_events')
      .select('id, event_type, user_id, metadata, created_at')
      .gte('created_at', startDate.toISOString())
      .lt('created_at', endDate.toISOString())
      .order('created_at', { ascending: true })

    if (error) throw error

    const eventsList = (events ?? []) as Array<{
      id: string
      event_type: string
      user_id: string | null
      metadata: Record<string, unknown>
      created_at: string
    }>

    const searchesByDay: Record<string, number> = {}
    const profileViewsByChef: Record<string, { count: number; slug?: string }> = {}
    const messageSentUserIds = new Set<string>()
    const bookingRequestUserIds = new Set<string>()
    const signupCount = { count: 0 }
    const loginCount = { count: 0 }

    for (const ev of eventsList) {
      const day = ev.created_at.slice(0, 10)

      if (ev.event_type === 'search') {
        searchesByDay[day] = (searchesByDay[day] ?? 0) + 1
      }

      if (ev.event_type === 'profile_view') {
        const chefId = (ev.metadata?.chef_id as string) || 'unknown'
        if (!profileViewsByChef[chefId]) {
          profileViewsByChef[chefId] = { count: 0, slug: ev.metadata?.chef_slug as string }
        }
        profileViewsByChef[chefId].count++
      }

      if (ev.event_type === 'message_sent' && ev.user_id) {
        messageSentUserIds.add(ev.user_id)
      }

      if (ev.event_type === 'booking_request' && ev.user_id) {
        bookingRequestUserIds.add(ev.user_id)
      }

      if (ev.event_type === 'signup') signupCount.count++
      if (ev.event_type === 'login') loginCount.count++
    }

    const searchesPerDay = Array.from({ length: days }, (_, i) => {
      const d = addDays(startDate, i)
      const key = d.toISOString().slice(0, 10)
      return { date: key, count: searchesByDay[key] ?? 0 }
    })

    const profileViewsSorted = Object.entries(profileViewsByChef)
      .map(([chefId, data]) => ({ chef_id: chefId, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    const usersWhoMessaged = messageSentUserIds.size
    const usersWhoBooked = bookingRequestUserIds.size
    const usersWhoMessagedAndBooked = [...messageSentUserIds].filter((id) =>
      bookingRequestUserIds.has(id)
    ).length
    const messageToBookingConversion =
      usersWhoMessaged > 0
        ? Math.round((usersWhoMessagedAndBooked / usersWhoMessaged) * 100)
        : 0

    const funnelSearch = eventsList.filter((e) => e.event_type === 'search').length
    const funnelProfileView = eventsList.filter((e) => e.event_type === 'profile_view').length
    const funnelMessage = eventsList.filter((e) => e.event_type === 'message_sent').length
    const funnelBooking = eventsList.filter((e) => e.event_type === 'booking_request').length

    const chefs = await supabase.from('chefs').select('id, name').then((r) => r.data ?? [])
    const chefById = new Map(chefs.map((c: { id: string; name: string }) => [c.id, c]))

    const profileViewsWithNames = profileViewsSorted.map((p) => ({
      ...p,
      name: chefById.get(p.chef_id)?.name ?? 'Chef inconnu',
    }))

    return NextResponse.json({
      period: { start: startDate.toISOString(), end: endDate.toISOString(), days },
      searchesPerDay,
      profileViewsByChef: profileViewsWithNames,
      conversion: {
        usersWhoMessaged,
        usersWhoBooked,
        usersWhoMessagedAndBooked,
        messageToBookingConversionPct: messageToBookingConversion,
      },
      funnel: {
        search: funnelSearch,
        profile_view: funnelProfileView,
        message_sent: funnelMessage,
        booking_request: funnelBooking,
      },
      auth: { signup: signupCount.count, login: loginCount.count },
    })
  } catch (err) {
    console.error('[analytics-pro]', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des analytics' },
      { status: 500 }
    )
  }
}
