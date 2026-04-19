-- Si la migration 026 n’a pas été exécutée sur votre projet Supabase, exécutez ce fichier
-- (ou collez le SQL ci-dessous dans l’éditeur SQL Supabase) pour ajouter la colonne optionnelle.
-- Les champs structurés city et postal_code restent obligatoires côté appli ; full_address stocke le libellé complet.

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS full_address TEXT;

COMMENT ON COLUMN public.booking_requests.full_address IS 'Libellé complet d’adresse (rue, CP, ville). Les colonnes city et postal_code sont toujours renseignées pour le reste du produit.';
