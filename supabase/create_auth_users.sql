-- Script pour créer les utilisateurs auth.users pour les chefs existants
-- À exécuter dans le SQL Editor de Supabase
-- Note: Ce script nécessite d'utiliser l'API Admin, donc il faut l'exécuter via une fonction ou l'API

-- Fonction pour créer un utilisateur auth si il n'existe pas déjà
-- Note: Cette fonction doit être exécutée avec les permissions admin
CREATE OR REPLACE FUNCTION create_auth_user_for_chef(chef_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Vérifier si l'utilisateur existe déjà
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = chef_email;
  
  -- Si l'utilisateur n'existe pas, on ne peut pas le créer directement via SQL
  -- Il faut utiliser l'API Admin de Supabase
  -- Cette fonction sert juste de placeholder
  -- Utilisez plutôt l'API ou le dashboard Supabase
  
  RETURN user_id;
END;
$$;

-- Pour créer les utilisateurs des chefs existants, utilisez plutôt :
-- 1. L'API Admin de Supabase (via votre code)
-- 2. Ou le dashboard Supabase > Authentication > Users > Add User

-- Exemple de requête pour lister les chefs sans utilisateur auth :
-- SELECT c.email, c.name
-- FROM chefs c
-- LEFT JOIN auth.users au ON au.email = c.email
-- WHERE au.id IS NULL;

