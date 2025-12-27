-- Migration: Ajouter children_count à booking_requests
-- Cette migration permet de distinguer le nombre d'adultes et d'enfants

-- Ajouter la colonne children_count (nombre d'enfants)
ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS children_count INTEGER DEFAULT 0;

-- Ajouter une contrainte CHECK pour s'assurer que children_count >= 0
ALTER TABLE booking_requests
DROP CONSTRAINT IF EXISTS booking_requests_children_count_check;

ALTER TABLE booking_requests
ADD CONSTRAINT booking_requests_children_count_check
CHECK (children_count >= 0);

-- Commentaire pour documenter
COMMENT ON COLUMN booking_requests.children_count IS 'Nombre d''enfants dans la réservation. Par défaut 0 (tous adultes).';
