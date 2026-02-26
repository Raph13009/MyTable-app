-- Fix: drop constraint FIRST, then update, then add new constraint
-- (update was failing because 25 is not in old allowed values 10,20,30,40,50,60)

ALTER TABLE public.chefs
DROP CONSTRAINT IF EXISTS chefs_availability_radius_km_allowed;

UPDATE public.chefs
SET availability_radius_km = 25
WHERE availability_radius_km NOT IN (25, 50, 75, 100, 125, 150, 200);

ALTER TABLE public.chefs
ADD CONSTRAINT chefs_availability_radius_km_allowed
CHECK (availability_radius_km IN (25, 50, 75, 100, 125, 150, 200));

ALTER TABLE public.chefs
ALTER COLUMN availability_radius_km SET DEFAULT 25;
