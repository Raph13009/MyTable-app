import type { SupabaseClient } from '@supabase/supabase-js'

export type ParticipantRole = 'client' | 'chef'

export type ParticipantInput = {
  conversation_id: string
  email: string
  role: ParticipantRole
  user_id?: string | null
}

export type EnsuredParticipant = {
  id?: string
  conversation_id: string
  email: string
  role: ParticipantRole
  user_id: string | null
  created_at?: string
}

/**
 * Normalize + dedupe participants for a conversation.
 * Unique key is (conversation_id, email) — matches participants_conversation_id_email_key.
 * If the same email appears twice (e.g. client === chef), keep the first role and
 * prefer a non-null user_id.
 */
export function prepareParticipantsForUpsert(
  participants: ParticipantInput[]
): ParticipantInput[] {
  const byKey = new Map<string, ParticipantInput>()

  for (const raw of participants) {
    const conversation_id = String(raw.conversation_id || '').trim()
    const email = String(raw.email || '').toLowerCase().trim()
    if (!conversation_id || !email) continue

    const key = `${conversation_id}::${email}`
    const next: ParticipantInput = {
      conversation_id,
      email,
      role: raw.role,
      user_id: raw.user_id ?? null,
    }

    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, next)
      continue
    }

    byKey.set(key, {
      ...existing,
      // Keep the first role (client is usually listed first in booking flow)
      role: existing.role,
      user_id: existing.user_id ?? next.user_id ?? null,
    })
  }

  return Array.from(byKey.values())
}

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  const message = (error.message || '').toLowerCase()
  return (
    message.includes('participants_conversation_id_email_key') ||
    message.includes('uniq_participants_conv_email') ||
    message.includes('duplicate key')
  )
}

/**
 * Idempotent participant creation for a conversation.
 * Uses upsert on (conversation_id, email). On unique-violation races, falls back to SELECT.
 * Unrelated DB errors are returned as-is (not swallowed).
 */
export async function ensureConversationParticipants(
  supabase: SupabaseClient,
  participants: ParticipantInput[]
): Promise<{ data: EnsuredParticipant[] | null; error: { message: string; code?: string } | null }> {
  const rows = prepareParticipantsForUpsert(participants)

  if (rows.length === 0) {
    return { data: [], error: null }
  }

  const conversationId = rows[0].conversation_id

  const { data: upserted, error: upsertError } = await supabase
    .from('participants')
    .upsert(rows as any, {
      onConflict: 'conversation_id,email',
      ignoreDuplicates: false,
    })
    .select()

  if (!upsertError) {
    return { data: (upserted as EnsuredParticipant[]) || [], error: null }
  }

  if (!isUniqueViolation(upsertError)) {
    return {
      data: null,
      error: {
        message: upsertError.message,
        code: (upsertError as { code?: string }).code,
      },
    }
  }

  // Concurrent insert won the race — reuse existing rows for this conversation.
  console.warn(
    '[ensureParticipants] Unique conflict on upsert; selecting existing participants',
    { conversationId, emails: rows.map((r) => r.email) }
  )

  // Best-effort: attach user_id when we have one and the row is missing it
  for (const row of rows) {
    if (!row.user_id) continue
    await supabase
      .from('participants')
      .update({ user_id: row.user_id } as any)
      .eq('conversation_id', row.conversation_id)
      .eq('email', row.email)
      .is('user_id', null)
  }

  const { data: existing, error: selectError } = await supabase
    .from('participants')
    .select('*')
    .eq('conversation_id', conversationId)
    .in(
      'email',
      rows.map((r) => r.email)
    )

  if (selectError) {
    return {
      data: null,
      error: {
        message: selectError.message,
        code: (selectError as { code?: string }).code,
      },
    }
  }

  if (!existing || existing.length === 0) {
    return {
      data: null,
      error: {
        message: upsertError.message,
        code: (upsertError as { code?: string }).code,
      },
    }
  }

  return { data: existing as EnsuredParticipant[], error: null }
}
