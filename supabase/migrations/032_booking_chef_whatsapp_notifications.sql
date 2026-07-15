-- Track chef WhatsApp booking notifications with atomic claim support.

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS chef_whatsapp_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chef_whatsapp_notification_status TEXT,
  ADD COLUMN IF NOT EXISTS chef_whatsapp_message_id TEXT,
  ADD COLUMN IF NOT EXISTS chef_whatsapp_last_error TEXT;

ALTER TABLE booking_requests
  DROP CONSTRAINT IF EXISTS booking_requests_chef_whatsapp_notification_status_check;

ALTER TABLE booking_requests
  ADD CONSTRAINT booking_requests_chef_whatsapp_notification_status_check
  CHECK (
    chef_whatsapp_notification_status IS NULL
    OR chef_whatsapp_notification_status IN ('sending', 'sent', 'failed', 'skipped')
  );

CREATE OR REPLACE FUNCTION claim_chef_whatsapp_notification(p_booking_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE booking_requests
  SET
    chef_whatsapp_notification_status = 'sending',
    chef_whatsapp_last_error = NULL,
    updated_at = NOW()
  WHERE id = p_booking_id
    AND chef_whatsapp_notified_at IS NULL
    AND (
      chef_whatsapp_notification_status IS NULL
      OR chef_whatsapp_notification_status IN ('failed', 'skipped')
      OR (
        chef_whatsapp_notification_status = 'sending'
        AND updated_at < NOW() - INTERVAL '10 minutes'
      )
    );

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION complete_chef_whatsapp_notification(
  p_booking_id UUID,
  p_status TEXT,
  p_message_id TEXT DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_status NOT IN ('sent', 'failed', 'skipped') THEN
    RAISE EXCEPTION 'Invalid chef WhatsApp notification status: %', p_status;
  END IF;

  UPDATE booking_requests
  SET
    chef_whatsapp_notification_status = p_status,
    chef_whatsapp_message_id = CASE WHEN p_status = 'sent' THEN p_message_id ELSE chef_whatsapp_message_id END,
    chef_whatsapp_notified_at = CASE WHEN p_status = 'sent' THEN NOW() ELSE chef_whatsapp_notified_at END,
    chef_whatsapp_last_error = CASE WHEN p_status IN ('failed', 'skipped') THEN p_error ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_booking_id;
END;
$$;
