-- Requête SQL pour ajouter un chef avec 2 menus (données d'exemple)
-- À exécuter dans le SQL Editor de Supabase

-- 1. Insérer le chef
INSERT INTO chefs (slug, name, email, phone, city, postal_code)
VALUES (
  'chef-michel',
  'Michel Dubois',
  'michel.dubois@example.com',
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

-- 2. Insérer les 2 menus pour ce chef
INSERT INTO menus (chef_id, name, description, price)
SELECT 
  c.id,
  'Menu Découverte',
  'Un menu pour découvrir notre cuisine avec des produits locaux et de saison. Entrée, plat, dessert.',
  45.00
FROM chefs c
WHERE c.slug = 'chef-michel'
ON CONFLICT DO NOTHING;

INSERT INTO menus (chef_id, name, description, price)
SELECT 
  c.id,
  'Menu Signature',
  'Notre menu signature avec les spécialités du chef. Apéritif, entrée, plat, fromage, dessert et café.',
  75.00
FROM chefs c
WHERE c.slug = 'chef-michel'
ON CONFLICT DO NOTHING;

-- Vérification : Afficher le chef et ses menus
SELECT 
  c.id,
  c.slug,
  c.name as chef_name,
  c.email,
  c.city,
  m.id as menu_id,
  m.name as menu_name,
  m.description,
  m.price
FROM chefs c
LEFT JOIN menus m ON m.chef_id = c.id
WHERE c.slug = 'chef-michel';

