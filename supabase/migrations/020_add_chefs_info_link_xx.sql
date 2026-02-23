ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS info_link_xx text;

COMMENT ON COLUMN public.chefs.info_link_xx IS 'Lien custom (champ XX) utilise par le bouton info depuis explore';
