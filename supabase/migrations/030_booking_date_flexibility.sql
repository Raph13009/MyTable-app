-- Migration 030: flexibilité de date sur les réservations
-- Pour repas_domicile et cours_cuisine : le client peut indiquer qu'il est flexible
-- et proposer jusqu'à 3 dates alternatives. La date finale retenue est confirmée
-- au moment de la finalisation (pour la facturation).

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS is_date_flexible BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alternative_dates JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS confirmed_date DATE;

COMMENT ON COLUMN booking_requests.is_date_flexible IS 'true si le client accepte des dates alternatives';
COMMENT ON COLUMN booking_requests.alternative_dates IS 'Tableau JSONB des dates alternatives proposées (YYYY-MM-DD), max 3';
COMMENT ON COLUMN booking_requests.confirmed_date IS 'Date finale confirmée par le client à la finalisation, pour la facturation';
