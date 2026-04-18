-- Suivi des visites client sur le chat (relance inactivité 48h)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS client_last_chat_open_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_inactivity_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN conversations.client_last_chat_open_at IS 'Dernière ouverture de la page chat par le client';
COMMENT ON COLUMN conversations.client_inactivity_reminder_sent_at IS 'Date d''envoi de l''email de relance inactivité (une fois par conversation)';

CREATE INDEX IF NOT EXISTS idx_conversations_client_reminder_pending
  ON conversations (updated_at)
  WHERE client_inactivity_reminder_sent_at IS NULL;
