-- Ajouter la logique de fallback automatique des reservations

-- 1) Statut etendu avec 'expired' pour la chaine de fallback
ALTER TABLE booking_requests
DROP CONSTRAINT IF EXISTS booking_requests_status_check;

ALTER TABLE booking_requests
ADD CONSTRAINT booking_requests_status_check
CHECK (status IN ('pending', 'accepted', 'refused', 'expired', 'validated_by_client', 'cancelled', 'completed'));

COMMENT ON COLUMN booking_requests.status IS 'Statut de la reservation: pending, accepted, refused, expired, validated_by_client, cancelled, completed';

-- 2) Colonnes fallback
ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS request_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS fallback_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fallback_next_chef_ids UUID[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS fallback_group_id UUID,
ADD COLUMN IF NOT EXISTS fallback_timeout_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS fallback_previous_booking_id UUID REFERENCES booking_requests(id) ON DELETE SET NULL;

-- Index pour les jobs de bascule
CREATE INDEX IF NOT EXISTS idx_booking_requests_fallback_timeout
  ON booking_requests (fallback_timeout_at)
  WHERE status = 'pending' AND fallback_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_booking_requests_fallback_group
  ON booking_requests (fallback_group_id)
  WHERE fallback_group_id IS NOT NULL;

-- Accelere la recherche des chefs par prefixe de code postal (2 chiffres)
CREATE INDEX IF NOT EXISTS idx_chefs_postal_code
  ON chefs (postal_code);
