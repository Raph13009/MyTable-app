-- Requête SQL pour insérer le chef dans la table chefs
-- À exécuter dans le SQL Editor de Supabase

INSERT INTO chefs (slug, name, email, phone, city, postal_code)
VALUES (
  'chef-raphael',
  'Raphael Levy',
  'raphaellevy027@gmail.com',
  '+33123456789',
  'Paris',
  '75001'
)
ON CONFLICT (slug) DO UPDATE
SET 
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  city = EXCLUDED.city,
  postal_code = EXCLUDED.postal_code;

-- Vérification
SELECT id, slug, name, email, city FROM chefs WHERE email = 'raphaellevy027@gmail.com';

