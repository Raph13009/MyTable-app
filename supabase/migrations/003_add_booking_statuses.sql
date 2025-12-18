-- Migration: Ajouter les statuts 'validated_by_client' et 'cancelled' à booking_requests
-- Cette migration étend les statuts possibles pour gérer la finalisation et l'annulation

-- Supprimer l'ancienne contrainte CHECK
ALTER TABLE booking_requests
DROP CONSTRAINT IF EXISTS booking_requests_status_check;

-- Ajouter la nouvelle contrainte CHECK avec les nouveaux statuts
ALTER TABLE booking_requests
ADD CONSTRAINT booking_requests_status_check 
CHECK (status IN ('pending', 'accepted', 'refused', 'validated_by_client', 'cancelled'));

-- Commentaire pour documenter les nouveaux statuts
COMMENT ON COLUMN booking_requests.status IS 'Statut de la réservation: pending (en attente), accepted (acceptée par le chef), refused (refusée), validated_by_client (validée par le client), cancelled (annulée)';
