-- Normalize existing values before tightening constraint
UPDATE public.chefs
SET availability_radius_km = 10
WHERE availability_radius_km NOT IN (10, 20, 30, 40, 50, 60);

ALTER TABLE public.chefs
DROP CONSTRAINT IF EXISTS chefs_availability_radius_km_allowed;

ALTER TABLE public.chefs
ADD CONSTRAINT chefs_availability_radius_km_allowed
CHECK (availability_radius_km IN (10, 20, 30, 40, 50, 60));
