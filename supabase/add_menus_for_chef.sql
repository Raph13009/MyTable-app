-- Ajouter 2 menus pour le chef avec l'ID e153f45d-b055-45e8-a86e-f9dd4151fa47
-- À exécuter dans le SQL Editor de Supabase

-- Menu 1
INSERT INTO menus (chef_id, name, description, price)
VALUES (
  'e153f45d-b055-45e8-a86e-f9dd4151fa47',
  'Menu Découverte',
  'Un menu pour découvrir notre cuisine avec des produits locaux et de saison. Entrée, plat, dessert.',
  45.00
);

-- Menu 2
INSERT INTO menus (chef_id, name, description, price)
VALUES (
  'e153f45d-b055-45e8-a86e-f9dd4151fa47',
  'Menu Signature',
  'Notre menu signature avec les spécialités du chef. Apéritif, entrée, plat, fromage, dessert et café.',
  75.00
);

-- Vérification : Afficher les menus ajoutés
SELECT 
  m.id,
  m.name,
  m.description,
  m.price,
  c.name as chef_name,
  c.email as chef_email
FROM menus m
JOIN chefs c ON c.id = m.chef_id
WHERE m.chef_id = 'e153f45d-b055-45e8-a86e-f9dd4151fa47'
ORDER BY m.name;

