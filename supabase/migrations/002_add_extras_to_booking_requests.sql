-- Migration: Ajouter un champ extras JSONB à booking_requests
-- Cette migration ajoute un champ dédié pour stocker les extras de manière structurée

-- Ajouter la colonne extras de type JSONB
ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '[]'::jsonb;

-- Créer un index GIN pour les requêtes efficaces sur les extras (optionnel mais recommandé)
CREATE INDEX IF NOT EXISTS idx_booking_requests_extras ON booking_requests USING GIN (extras);

-- Commentaire pour documenter la structure attendue
COMMENT ON COLUMN booking_requests.extras IS 'Array JSON des extras ajoutés par le chef. Format: [{"name": "string", "price": number}, ...]';

-- Migration des données existantes depuis notes vers extras (si des données existent)
-- Cette partie est optionnelle et peut être commentée si vous n'avez pas encore de données
DO $$
DECLARE
  booking_record RECORD;
  parsed_extras JSONB;
BEGIN
  FOR booking_record IN 
    SELECT id, notes 
    FROM booking_requests 
    WHERE notes IS NOT NULL 
    AND notes != ''
    AND (extras IS NULL OR extras = '[]'::jsonb)
  LOOP
    BEGIN
      -- Essayer de parser le JSON depuis notes
      parsed_extras := booking_record.notes::jsonb;
      
      -- Si c'est un objet avec une clé "extras", extraire le tableau
      IF parsed_extras ? 'extras' THEN
        UPDATE booking_requests
        SET extras = parsed_extras->'extras'
        WHERE id = booking_record.id;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        -- Si ce n'est pas du JSON valide, on ignore (c'est peut-être juste du texte)
        NULL;
    END;
  END LOOP;
END $$;

