ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS availability_radius_km integer NOT NULL DEFAULT 10;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chefs_availability_radius_km_allowed'
      AND conrelid = 'public.chefs'::regclass
  ) THEN
    ALTER TABLE public.chefs
    ADD CONSTRAINT chefs_availability_radius_km_allowed
    CHECK (availability_radius_km IN (5, 10, 20, 50, 100));
  END IF;
END
$$;

COMMENT ON COLUMN public.chefs.availability_radius_km IS 'Rayon de déplacement en kilomètres pour les missions';
