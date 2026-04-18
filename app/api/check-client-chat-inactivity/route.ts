import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailSubjects, emailTemplates } from '@/lib/email'
import { getBaseUrl } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const INACTIVE_MS = 48 * 60 * 60 * 1000

/**
 * Cron : relance le client par email s'il n'a pas ouvert le chat depuis 48h
 * (une fois par conversation, tant que le dossier est actif).
 */
export async function GET(request: NextRequest) {
  try {
    const configuredCronSecret = process.env.CRON_SECRET
    if (configuredCronSecret) {
      const bearerToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
      const headerToken = request.headers.get('x-cron-secret')?.trim()
      const queryToken = request.nextUrl.searchParams.get('cron_secret')?.trim()
      const providedToken = bearerToken || headerToken || queryToken
      if (!providedToken || providedToken !== configuredCronSecret) {
        return NextResponse.json({ error: 'Unauthorized cron call' }, { status: 401 })
      }
    }

    const supabase = createAdminClient()
    const baseUrl = getBaseUrl()
    const cutoff = new Date(Date.now() - INACTIVE_MS)

    const { data: bookings, error } = await supabase
      .from('booking_requests')
      .select('id, first_name, last_name, email, status, created_at, conversation_id')
      .in('status', ['pending', 'accepted', 'validated_by_client'])
      .not('conversation_id', 'is', null)
      .limit(400)

    if (error) {
      console.error('[check-client-chat-inactivity] fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const list = (bookings || []) as Array<{
      id: string
      first_name: string
      last_name: string
      email: string
      status: string
      created_at: string
      conversation_id: string | null
    }>

    const convIds = [...new Set(list.map((b) => b.conversation_id).filter(Boolean))] as string[]
    let convMap = new Map<
      string,
      { id: string; client_last_chat_open_at: string | null; client_inactivity_reminder_sent_at: string | null }
    >()

    if (convIds.length > 0) {
      const { data: convs, error: convErr } = await supabase
        .from('conversations')
        .select('id, client_last_chat_open_at, client_inactivity_reminder_sent_at')
        .in('id', convIds)

      if (convErr) {
        console.error('[check-client-chat-inactivity] conversations error:', convErr)
        return NextResponse.json({ error: convErr.message }, { status: 500 })
      }
      convMap = new Map((convs || []).map((c: any) => [c.id as string, c]))
    }

    let sent = 0
    const nowIso = new Date().toISOString()

    for (const br of list) {
      const cid = br.conversation_id
      if (!cid) continue
      const conv = convMap.get(cid)
      if (!conv || conv.client_inactivity_reminder_sent_at) continue

      const createdAt = br.created_at ? new Date(br.created_at) : new Date()
      const lastOpen = conv.client_last_chat_open_at ? new Date(conv.client_last_chat_open_at) : null
      const reference = lastOpen && lastOpen > createdAt ? lastOpen : createdAt

      if (reference > cutoff) continue

      const clientEmail = String(br.email || '')
        .toLowerCase()
        .trim()
      if (!clientEmail) continue

      const firstName = String(br.first_name || 'Client').trim()
      const loginUrl = `${baseUrl}/login?next=/chat/${conv.id}`

      try {
        await sendEmail({
          to: clientEmail,
          subject: emailSubjects.clientChatInactivityReminder,
          html: emailTemplates.clientChatInactivityReminder(firstName, loginUrl, baseUrl),
        })

        const { error: upErr } = await (supabase.from('conversations') as any)
          .update({
            client_inactivity_reminder_sent_at: nowIso,
            updated_at: nowIso,
          })
          .eq('id', conv.id)

        if (upErr) {
          console.error('[check-client-chat-inactivity] mark sent error:', upErr)
        } else {
          sent += 1
        }
      } catch (e) {
        console.error('[check-client-chat-inactivity] send fail booking', br.id, e)
      }
    }

    return NextResponse.json({ success: true, sent, checked: list.length })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[check-client-chat-inactivity]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
