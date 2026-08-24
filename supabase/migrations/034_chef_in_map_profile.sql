-- In-map Chef profile: Portrait MyTable (admin-managed).
-- Non-destructive. Existing chef rows remain valid; empty portraits are hidden in the UI.
-- dish_photos[] already exists (gallery). App-level cap is raised 3 → 12 separately.

ALTER TABLE public.chefs
  ADD COLUMN IF NOT EXISTS portrait_fr TEXT,
  ADD COLUMN IF NOT EXISTS portrait_en TEXT;

COMMENT ON COLUMN public.chefs.portrait_fr IS
  'Portrait MyTable (FR), editorial blurb for the in-map chef profile. Admin-managed.';
COMMENT ON COLUMN public.chefs.portrait_en IS
  'Portrait MyTable (EN). If null, the UI falls back to portrait_fr.';
