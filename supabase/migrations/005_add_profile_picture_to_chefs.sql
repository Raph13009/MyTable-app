-- Migration: Ajouter le champ profile_picture à la table chefs
-- Ce champ stocke l'URL de la photo de profil du chef

ALTER TABLE chefs
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Commentaire pour documenter le champ
COMMENT ON COLUMN chefs.profile_picture IS 'URL de la photo de profil du chef (stockée dans Supabase Storage)';

