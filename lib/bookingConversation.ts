import type { SupabaseClient } from '@supabase/supabase-js'

export async function insertBookingNotesAsFirstMessage(
  supabase: SupabaseClient,
  conversationId: string,
  clientEmail: string,
  notes: string | null | undefined
): Promise<void> {
  const content = String(notes ?? '').trim()
  if (!content) return

  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_email: clientEmail.toLowerCase().trim(),
    content,
  } as any)

  if (error) {
    console.error('[bookingConversation] Error inserting notes as first message:', error)
  }
}
