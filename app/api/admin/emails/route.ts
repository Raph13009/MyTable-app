import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ADMIN_UID = '8d154623-1aba-475c-9a7b-9ab39f3f84d2'

export const dynamic = 'force-dynamic'

export type AdminEmailRow = {
  email: string
  role: 'client' | 'chef'
  created_at: string | null
}

type SourceRow = { email: string | null; created_at: string | null }

function mergeClients(rows: SourceRow[]): AdminEmailRow[] {
  const map = new Map<
    string,
    { display: string; dates: string[] }
  >()

  for (const r of rows) {
    const raw = r.email?.trim()
    if (!raw) continue
    const key = raw.toLowerCase()
    const d = r.created_at
    const prev = map.get(key)
    if (!prev) {
      map.set(key, { display: raw, dates: d ? [d] : [] })
    } else {
      if (d) prev.dates.push(d)
    }
  }

  const rowsOut: AdminEmailRow[] = []
  for (const { display, dates } of map.values()) {
    const created_at =
      dates.length > 0 ? dates.slice().sort()[0]! : null
    rowsOut.push({
      email: display,
      role: 'client',
      created_at,
    })
  }

  return rowsOut.sort((a, b) =>
    a.email.toLowerCase().localeCompare(b.email.toLowerCase(), 'fr')
  )
}

function chefsToRows(
  rows: { email: string | null; created_at: string | null }[]
): AdminEmailRow[] {
  const map = new Map<
    string,
    { display: string; created_at: string | null }
  >()

  for (const r of rows) {
    const raw = r.email?.trim()
    if (!raw) continue
    const key = raw.toLowerCase()
    if (!map.has(key)) {
      map.set(key, { display: raw, created_at: r.created_at })
    }
  }

  return Array.from(map.values())
    .map((v) => ({
      email: v.display,
      role: 'chef' as const,
      created_at: v.created_at,
    }))
    .sort((a, b) =>
      a.email.toLowerCase().localeCompare(b.email.toLowerCase(), 'fr')
    )
}

export async function GET() {
  try {
    const supabaseAuth = await createClient()
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser()

    if (!user || user.id !== ADMIN_UID) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const admin = createAdminClient()

    const [bookingsRes, participantsRes, chefsRes] = await Promise.all([
      admin.from('booking_requests').select('email, created_at'),
      admin
        .from('participants')
        .select('email, created_at')
        .eq('role', 'client'),
      admin.from('chefs').select('email, created_at'),
    ])

    if (bookingsRes.error) {
      console.error('[admin/emails] booking_requests:', bookingsRes.error)
      return NextResponse.json({ error: 'Erreur lecture réservations' }, { status: 500 })
    }
    if (participantsRes.error) {
      console.error('[admin/emails] participants:', participantsRes.error)
      return NextResponse.json({ error: 'Erreur lecture participants' }, { status: 500 })
    }
    if (chefsRes.error) {
      console.error('[admin/emails] chefs:', chefsRes.error)
      return NextResponse.json({ error: 'Erreur lecture chefs' }, { status: 500 })
    }

    const clientSource: SourceRow[] = [
      ...(bookingsRes.data ?? []),
      ...(participantsRes.data ?? []),
    ]

    const clients = mergeClients(clientSource)
    const chefs = chefsToRows(chefsRes.data ?? [])

    return NextResponse.json({ clients, chefs })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/emails]', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des e-mails', details: message },
      { status: 500 }
    )
  }
}
