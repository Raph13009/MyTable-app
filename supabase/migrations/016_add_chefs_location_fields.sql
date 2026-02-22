ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS latitude float8,
ADD COLUMN IF NOT EXISTS longitude float8;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chefs_address_requires_coordinates'
      AND conrelid = 'public.chefs'::regclass
  ) THEN
    ALTER TABLE public.chefs
    ADD CONSTRAINT chefs_address_requires_coordinates
    CHECK (
      NULLIF(BTRIM(address), '') IS NULL
      OR (latitude IS NOT NULL AND longitude IS NOT NULL)
    );
  END IF;
END
$$;
