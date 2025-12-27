-- Migration: Ajouter service_type et period_days à booking_requests
-- Cette migration permet de gérer différents types de services (repas à domicile, cours de cuisine, mise en demeure)

-- Ajouter la colonne service_type
ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'repas_domicile';

-- Ajouter une contrainte CHECK pour les valeurs possibles
ALTER TABLE booking_requests
DROP CONSTRAINT IF EXISTS booking_requests_service_type_check;

ALTER TABLE booking_requests
ADD CONSTRAINT booking_requests_service_type_check 
CHECK (service_type IN ('repas_domicile', 'cours_cuisine', 'mise_en_demeure'));

-- Ajouter la colonne period_days (pour cours de cuisine et mise en demeure)
ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS period_days TEXT;

-- Rendre booking_date nullable (car pour cours de cuisine et mise en demeure, on n'a pas de date spécifique)
ALTER TABLE booking_requests
ALTER COLUMN booking_date DROP NOT NULL;

-- Commentaires pour documenter
COMMENT ON COLUMN booking_requests.service_type IS 'Type de service: repas_domicile, cours_cuisine, mise_en_demeure';
COMMENT ON COLUMN booking_requests.period_days IS 'Période pour cours de cuisine et mise en demeure: 1-2, 3, 4+';
