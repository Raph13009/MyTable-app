import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ADMIN_UID = '8d154623-1aba-475c-9a7b-9ab39f3f84d2'

type Period = 'day' | 'week' | 'month' | 'all' | 'custom'

type BookingRow = {
  id: string
  chef_id: string
  created_at: string
  status: 'pending' | 'accepted' | 'refused' | 'expired' | 'validated_by_client' | 'cancelled' | 'completed'
  conversation_id: string | null
}

type MessageRow = {
  id: string
  created_at: string
}

type ChefRow = {
  id: string
  name: string
  profile_picture: string | null
}

type WindowSet = {
  currentStart: Date
  currentEnd: Date
  previousStart: Date | null
  previousEnd: Date | null
  period: Period
}

export const dynamic = 'force-dynamic'

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function formatBucketDate(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
}

function formatBucketWeekday(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
  })
    .format(date)
    .replace('.', '')
}

function isWithin(dateIso: string, start: Date, end: Date) {
  const value = new Date(dateIso).getTime()
  return value >= start.getTime() && value < end.getTime()
}

function percentageChange(current: number, previous: number | null) {
  if (previous === null) return null
  if (previous === 0 && current === 0) return 0
  if (previous === 0) return 100
  return Math.round(((current - previous) / previous) * 100)
}

function getDefaultWindows(period: Exclude<Period, 'custom'>, now: Date): WindowSet {
  const todayStart = startOfDay(now)

  if (period === 'day') {
    const currentStart = todayStart
    const currentEnd = now
    const previousStart = addDays(currentStart, -1)
    const previousEnd = currentStart
    return { currentStart, currentEnd, previousStart, previousEnd, period }
  }

  if (period === 'week') {
    const currentStart = startOfDay(addDays(todayStart, -6))
    const currentEnd = now
    const previousStart = addDays(currentStart, -7)
    const previousEnd = currentStart
    return { currentStart, currentEnd, previousStart, previousEnd, period }
  }

  if (period === 'month') {
    const currentStart = startOfDay(addDays(todayStart, -29))
    const currentEnd = now
    const previousStart = addDays(currentStart, -30)
    const previousEnd = currentStart
    return { currentStart, currentEnd, previousStart, previousEnd, period }
  }

  return {
    currentStart: new Date(0),
    currentEnd: now,
    previousStart: null,
    previousEnd: null,
    period,
  }
}

function getCustomWindows(startRaw: string | null, endRaw: string | null, now: Date): WindowSet {
  if (!startRaw || !endRaw) {
    return getDefaultWindows('week', now)
  }

  const start = startOfDay(new Date(startRaw))
  const end = endOfDay(new Date(endRaw))

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return getDefaultWindows('week', now)
  }

  const durationMs = end.getTime() - start.getTime()
  const previousEnd = new Date(start)
  const previousStart = new Date(start.getTime() - durationMs)

  return {
    currentStart: start,
    currentEnd: end,
    previousStart,
    previousEnd,
    period: 'custom',
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user || user.id !== ADMIN_UID) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const periodParam = request.nextUrl.searchParams.get('period')
    const startParam = request.nextUrl.searchParams.get('start')
    const endParam = request.nextUrl.searchParams.get('end')

    const now = new Date()
    const period: Period =
      periodParam === 'day' || periodParam === 'week' || periodParam === 'month' || periodParam === 'all' || periodParam === 'custom'
        ? periodParam
        : 'week'

    const windows = period === 'custom' ? getCustomWindows(startParam, endParam, now) : getDefaultWindows(period, now)
    const { currentStart, currentEnd, previousStart, previousEnd } = windows

    const queryStart = previousStart ?? currentStart
    const supabaseAdmin = createAdminClient()

    const bookingsQuery = supabaseAdmin
      .from('booking_requests')
      .select('id, chef_id, created_at, status, conversation_id')
      .gte('created_at', queryStart.toISOString())
      .lt('created_at', currentEnd.toISOString())

    const messagesQuery = supabaseAdmin
      .from('messages')
      .select('id, created_at')
      .gte('created_at', queryStart.toISOString())
      .lt('created_at', currentEnd.toISOString())

    const [bookingsResult, messagesResult, chefsResult] = await Promise.all([
      bookingsQuery,
      messagesQuery,
      supabaseAdmin.from('chefs').select('id, name, profile_picture'),
    ])

    if (bookingsResult.error) throw bookingsResult.error
    if (messagesResult.error) throw messagesResult.error
    if (chefsResult.error) throw chefsResult.error

    const bookings = (bookingsResult.data ?? []) as BookingRow[]
    const messages = (messagesResult.data ?? []) as MessageRow[]
    const chefs = (chefsResult.data ?? []) as ChefRow[]

    const bookingsCurrent = bookings.filter((booking) => isWithin(booking.created_at, currentStart, currentEnd))
    const bookingsPrevious = previousStart && previousEnd
      ? bookings.filter((booking) => isWithin(booking.created_at, previousStart, previousEnd))
      : []

    const messagesCurrent = messages.filter((message) => isWithin(message.created_at, currentStart, currentEnd))
    const messagesPrevious = previousStart && previousEnd
      ? messages.filter((message) => isWithin(message.created_at, previousStart, previousEnd))
      : []

    const ongoingCurrent = bookingsCurrent.filter(
      (booking) => booking.status === 'accepted' && booking.conversation_id !== null
    ).length

    const ongoingPrevious = previousStart && previousEnd
      ? bookingsPrevious.filter((booking) => booking.status === 'accepted' && booking.conversation_id !== null).length
      : null

    const statusCounts = bookingsCurrent.reduce<Record<string, number>>((acc, booking) => {
      acc[booking.status] = (acc[booking.status] ?? 0) + 1
      return acc
    }, {})

    const statusDistribution = Object.entries(statusCounts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count)

    const chefById = new Map(chefs.map((chef) => [chef.id, chef]))
    const topChefCounts = bookingsCurrent.reduce<Record<string, number>>((acc, booking) => {
      acc[booking.chef_id] = (acc[booking.chef_id] ?? 0) + 1
      return acc
    }, {})

    const topChefs = Object.entries(topChefCounts)
      .map(([chefId, requestCount]) => {
        const chef = chefById.get(chefId)
        return {
          chefId,
          name: chef?.name ?? 'Chef inconnu',
          profilePicture: chef?.profile_picture ?? null,
          requestCount,
        }
      })
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 3)

    const activityBuckets: Array<{ key: string; label: string; requests: number; messages: number }> = []

    const totalDays = Math.max(
      1,
      Math.ceil((startOfDay(currentEnd).getTime() - startOfDay(currentStart).getTime()) / (1000 * 60 * 60 * 24)) + 1
    )

    if (windows.period === 'day') {
      for (let hour = 0; hour < 24; hour += 1) {
        const bucketStart = new Date(currentStart)
        bucketStart.setHours(hour, 0, 0, 0)
        const bucketEnd = new Date(bucketStart)
        bucketEnd.setHours(hour + 1, 0, 0, 0)

        const requestsCount = bookingsCurrent.filter((booking) => isWithin(booking.created_at, bucketStart, bucketEnd)).length
        const messagesCount = messagesCurrent.filter((message) => isWithin(message.created_at, bucketStart, bucketEnd)).length

        activityBuckets.push({
          key: bucketStart.toISOString(),
          label: `${String(hour).padStart(2, '0')}h`,
          requests: requestsCount,
          messages: messagesCount,
        })
      }
    } else {
      const stepDays = totalDays > 120 ? 7 : 1
      for (let index = 0; index < totalDays; index += stepDays) {
        const bucketStart = addDays(startOfDay(currentStart), index)
        const bucketEnd = addDays(bucketStart, stepDays)

        const requestsCount = bookingsCurrent.filter((booking) => isWithin(booking.created_at, bucketStart, bucketEnd)).length
        const messagesCount = messagesCurrent.filter((message) => isWithin(message.created_at, bucketStart, bucketEnd)).length

        const label = windows.period === 'week'
          ? formatBucketWeekday(bucketStart)
          : stepDays === 7
            ? `S${Math.floor(index / 7) + 1}`
            : formatBucketDate(bucketStart)

        activityBuckets.push({
          key: bucketStart.toISOString(),
          label,
          requests: requestsCount,
          messages: messagesCount,
        })
      }
    }

    return NextResponse.json({
      generatedAt: now.toISOString(),
      period: windows.period,
      dateRange: {
        start: currentStart.toISOString(),
        end: currentEnd.toISOString(),
      },
      kpis: {
        requests: bookingsCurrent.length,
        requestsDelta: percentageChange(bookingsCurrent.length, previousStart && previousEnd ? bookingsPrevious.length : null),
        ongoingAcceptedConversations: ongoingCurrent,
        ongoingAcceptedDelta: percentageChange(ongoingCurrent, ongoingPrevious),
        messages: messagesCurrent.length,
        messagesDelta: percentageChange(messagesCurrent.length, previousStart && previousEnd ? messagesPrevious.length : null),
      },
      statusDistribution,
      activityBuckets,
      topChefs,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    console.error('[admin/analytics] Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des analytics', details: message },
      { status: 500 }
    )
  }
}
