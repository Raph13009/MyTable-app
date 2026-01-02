-- Migration: Changer meal_options de TEXT[] à JSONB
-- Cette migration permet de stocker les options de repas par date sous forme d'objet JSON
-- Format: { "2024-01-15": ["pdj", "dejeuner"], "2024-01-16": ["diner"], ... }

-- Supprimer la contrainte existante
ALTER TABLE booking_requests
DROP CONSTRAINT IF EXISTS booking_requests_meal_options_check;

-- Changer le type de colonne de TEXT[] à JSONB
-- Convertir les arrays existants en format JSONB array
ALTER TABLE booking_requests
ALTER COLUMN meal_options TYPE JSONB USING 
  CASE 
    WHEN meal_options IS NULL THEN NULL::jsonb
    ELSE to_jsonb(meal_options)
  END;

-- Commentaire mis à jour
COMMENT ON COLUMN booking_requests.meal_options IS 'Options de repas par date pour un chef à demeure. Format: objet JSON avec dates comme clés et arrays de repas comme valeurs. Ex: {"2024-01-15": ["pdj", "dejeuner"], "2024-01-16": ["diner"]}. Peut aussi être un array simple pour rétrocompatibilité.';

