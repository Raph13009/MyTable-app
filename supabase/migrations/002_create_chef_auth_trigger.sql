-- Trigger pour créer automatiquement un utilisateur auth.users quand un chef est créé
-- Note: Cette fonction nécessite l'extension pg_net ou doit être appelée via l'API
-- Pour l'instant, on utilise l'API /api/chefs pour créer les chefs avec leur utilisateur auth

-- Fonction pour créer un utilisateur auth (à utiliser via l'API, pas directement en SQL)
-- Les utilisateurs auth doivent être créés via l'API Admin de Supabase
-- Utilisez la route POST /api/chefs pour créer un chef avec son utilisateur auth

-- Alternative: Créer une fonction qui sera appelée via un webhook ou l'API
-- Pour l'instant, on recommande d'utiliser l'API /api/chefs

