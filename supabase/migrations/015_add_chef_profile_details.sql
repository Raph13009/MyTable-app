-- Nouvelles informations de profil chef pour la popup "chefs de remplacement"
-- - style de cuisine
-- - photos de plats (2-3)
-- - capacité min/max convives

ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS cuisine_style TEXT,
ADD COLUMN IF NOT EXISTS dish_photos TEXT[] DEFAULT '{}'::TEXT[],
ADD COLUMN IF NOT EXISTS min_guests INTEGER,
ADD COLUMN IF NOT EXISTS max_guests INTEGER;

-- Harmoniser les données existantes pour éviter les NULL côté UI
UPDATE public.chefs
SET dish_photos = '{}'::TEXT[]
WHERE dish_photos IS NULL;

-- Contrainte: min/max cohérents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chefs_min_max_guests_check'
  ) THEN
    ALTER TABLE public.chefs
    ADD CONSTRAINT chefs_min_max_guests_check
    CHECK (
      (min_guests IS NULL OR min_guests >= 1)
      AND (max_guests IS NULL OR max_guests >= 1)
      AND (min_guests IS NULL OR max_guests IS NULL OR min_guests <= max_guests)
    );
  END IF;
END $$;

COMMENT ON COLUMN public.chefs.cuisine_style IS 'Style de cuisine affiché dans le profil chef';
COMMENT ON COLUMN public.chefs.dish_photos IS 'URLs publiques des photos de plats (2-3 recommandées)';
COMMENT ON COLUMN public.chefs.min_guests IS 'Nombre minimum de convives accepté';
COMMENT ON COLUMN public.chefs.max_guests IS 'Nombre maximum de convives accepté';
