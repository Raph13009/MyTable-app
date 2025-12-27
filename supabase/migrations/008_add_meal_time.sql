-- Migration: Ajouter meal_time à booking_requests
-- Cette migration permet de spécifier le moment du repas (déjeuner/dîner) pour les réservations

-- Ajouter la colonne meal_time (moment du repas)
ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS meal_time TEXT;

-- Ajouter une contrainte CHECK pour s'assurer que meal_time est soit 'dejeuner' soit 'diner' ou NULL
ALTER TABLE booking_requests
DROP CONSTRAINT IF EXISTS booking_requests_meal_time_check;

ALTER TABLE booking_requests
ADD CONSTRAINT booking_requests_meal_time_check
CHECK (meal_time IS NULL OR meal_time IN ('dejeuner', 'diner'));

-- Commentaire pour documenter
COMMENT ON COLUMN booking_requests.meal_time IS 'Moment du repas : déjeuner ou dîner. Applicable uniquement pour les repas à domicile.';
