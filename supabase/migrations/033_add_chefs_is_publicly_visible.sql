-- Persistent public visibility for chefs (hide from map / discovery without deleting data).
-- Existing chefs remain visible by default.

ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS is_publicly_visible boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.chefs.is_publicly_visible IS
  'When false, the chef is hidden from the public map, listings, and new booking entry points. Admin, account, conversations and existing bookings remain accessible.';

CREATE INDEX IF NOT EXISTS idx_chefs_is_publicly_visible
  ON public.chefs (is_publicly_visible)
  WHERE is_publicly_visible = true;
