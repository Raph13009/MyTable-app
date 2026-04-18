import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const ADMIN_UID = '8d154623-1aba-475c-9a7b-9ab39f3f84d2'

export const dynamic = 'force-dynamic'

function uniqueSortedEmails(rows: { email: string | null }[]): string[] {
  const map = new Map<string, string>()
  for (const r of rows) {
    const raw = r.email?.trim()
    if (!raw) continue
    const key = raw.toLowerCase()
    if (!map.has(key)) map.set(key, raw)
  }
  return Array.from(map.values()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase(), 'fr')
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
      admin.from('booking_requests').select('email'),
      admin.from('participants').select('email').eq('role', 'client'),
      admin.from('chefs').select('email'),
    ])

    if (bookingsRes.error) {
      console.error('[admin/contacts] booking_requests:', bookingsRes.error)
      return NextResponse.json({ error: 'Erreur lecture réservations' }, { status: 500 })
    }
    if (participantsRes.error) {
      console.error('[admin/contacts] participants:', participantsRes.error)
      return NextResponse.json({ error: 'Erreur lecture participants' }, { status: 500 })
    }
    if (chefsRes.error) {
      console.error('[admin/contacts] chefs:', chefsRes.error)
      return NextResponse.json({ error: 'Erreur lecture chefs' }, { status: 500 })
    }

    const clientRows = [
      ...(bookingsRes.data ?? []),
      ...(participantsRes.data ?? []),
    ]

    return NextResponse.json({
      clientEmails: uniqueSortedEmails(clientRows),
      chefEmails: uniqueSortedEmails(chefsRes.data ?? []),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/contacts]', err)
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des contacts', details: message },
      { status: 500 }
    )
  }
}
