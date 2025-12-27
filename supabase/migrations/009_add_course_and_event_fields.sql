-- Migration: Ajouter les champs pour cours_cuisine et mise_en_demeure (événement sur plusieurs jours)
-- Cette migration ajoute les champs nécessaires pour les nouveaux formulaires

-- Champs pour cours_cuisine
ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS budget DECIMAL(10, 2);

ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS course_topic TEXT;

-- Champs pour mise_en_demeure (événement sur plusieurs jours)
ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS selected_dates JSONB;

ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS meal_options TEXT[];

ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS total_price DECIMAL(10, 2);

-- Contraintes
ALTER TABLE booking_requests
DROP CONSTRAINT IF EXISTS booking_requests_budget_check;

ALTER TABLE booking_requests
ADD CONSTRAINT booking_requests_budget_check
CHECK (budget IS NULL OR budget >= 0);

ALTER TABLE booking_requests
DROP CONSTRAINT IF EXISTS booking_requests_total_price_check;

ALTER TABLE booking_requests
ADD CONSTRAINT booking_requests_total_price_check
CHECK (total_price IS NULL OR total_price >= 0);

-- Contrainte pour meal_options (doit être un array de valeurs valides)
ALTER TABLE booking_requests
DROP CONSTRAINT IF EXISTS booking_requests_meal_options_check;

ALTER TABLE booking_requests
ADD CONSTRAINT booking_requests_meal_options_check
CHECK (
  meal_options IS NULL OR 
  (
    array_length(meal_options, 1) IS NULL OR
    (meal_options <@ ARRAY['pdj', 'dejeuner', 'diner']::TEXT[])
  )
);

-- Commentaires pour documenter
COMMENT ON COLUMN booking_requests.budget IS 'Budget global pour un cours de cuisine';
COMMENT ON COLUMN booking_requests.course_topic IS 'Sujet sur lequel les convives veulent que le cours porte';
COMMENT ON COLUMN booking_requests.selected_dates IS 'Dates sélectionnées pour un événement sur plusieurs jours (format JSON array)';
COMMENT ON COLUMN booking_requests.meal_options IS 'Options de repas pour un événement sur plusieurs jours (pdj, dejeuner, diner)';
COMMENT ON COLUMN booking_requests.total_price IS 'Prix global pour la période d''un événement sur plusieurs jours';
