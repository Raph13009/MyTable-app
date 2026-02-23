ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS primary_dish_photo text;

COMMENT ON COLUMN public.chefs.primary_dish_photo IS 'Photo de plat principale choisie en admin pour affichage prioritaire';

UPDATE public.chefs
SET primary_dish_photo = dish_photos[1]
WHERE primary_dish_photo IS NULL
  AND dish_photos IS NOT NULL
  AND array_length(dish_photos, 1) >= 1;
