-- Script de seed pour les données de test
-- À exécuter dans le SQL Editor de Supabase après avoir créé les tables

-- Insérer des chefs de test
INSERT INTO chefs (slug, name, email, phone, city, postal_code)
VALUES 
  ('chef-pierre', 'Pierre Dubois', 'pierre.dubois@example.com', '+33123456789', 'Paris', '75001'),
  ('chef-marie', 'Marie Martin', 'marie.martin@example.com', '+33987654321', 'Lyon', '69001'),
  ('chef-jean', 'Jean Dupont', 'jean.dupont@example.com', '+33555666777', 'Marseille', '13001')
ON CONFLICT (slug) DO NOTHING;

-- Insérer des menus pour chaque chef
INSERT INTO menus (chef_id, name, description, price)
SELECT 
  c.id,
  'Menu Découverte',
  'Un menu pour découvrir notre cuisine avec des produits locaux et de saison',
  45.00
FROM chefs c
WHERE c.slug = 'chef-pierre'
ON CONFLICT DO NOTHING;

INSERT INTO menus (chef_id, name, description, price)
SELECT 
  c.id,
  'Menu Signature',
  'Notre menu signature avec les spécialités du chef',
  65.00
FROM chefs c
WHERE c.slug = 'chef-pierre'
ON CONFLICT DO NOTHING;

INSERT INTO menus (chef_id, name, description, price)
SELECT 
  c.id,
  'Menu Dégustation',
  'Menu dégustation en 5 services',
  85.00
FROM chefs c
WHERE c.slug = 'chef-marie'
ON CONFLICT DO NOTHING;

INSERT INTO menus (chef_id, name, description, price)
SELECT 
  c.id,
  'Menu Classique',
  'Menu traditionnel avec les grands classiques',
  55.00
FROM chefs c
WHERE c.slug = 'chef-jean'
ON CONFLICT DO NOTHING;

