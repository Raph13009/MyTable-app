ALTER TABLE public.chefs
ADD COLUMN IF NOT EXISTS last_name text;

COMMENT ON COLUMN public.chefs.last_name IS 'Nom de famille du chef (separe du prenom)';
