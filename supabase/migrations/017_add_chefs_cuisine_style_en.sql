ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS cuisine_style_en text;

COMMENT ON COLUMN public.chefs.cuisine_style_en IS 'Style de cuisine en anglais pour l interface Explore/Booking';
