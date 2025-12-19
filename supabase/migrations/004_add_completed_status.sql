-- Migration: Ajouter le statut 'completed' à booking_requests
-- Ce statut indique que la mission est complètement terminée (paiement effectué, prestation livrée)

-- Supprimer l'ancienne contrainte CHECK
ALTER TABLE booking_requests
DROP CONSTRAINT IF EXISTS booking_requests_status_check;

-- Ajouter la nouvelle contrainte CHECK avec le statut 'completed'
ALTER TABLE booking_requests
ADD CONSTRAINT booking_requests_status_check 
CHECK (status IN ('pending', 'accepted', 'refused', 'validated_by_client', 'cancelled', 'completed'));

-- Commentaire pour documenter le nouveau statut
COMMENT ON COLUMN booking_requests.status IS 'Statut de la réservation: pending (en attente), accepted (acceptée par le chef), refused (refusée), validated_by_client (validée par le client), cancelled (annulée), completed (terminée - paiement effectué et prestation livrée)';

