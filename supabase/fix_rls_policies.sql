-- Script pour corriger les politiques RLS si nécessaire
-- À exécuter dans le SQL Editor de Supabase si les politiques bloquent l'accès

-- Vérifier les politiques existantes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('conversations', 'participants', 'messages', 'booking_requests')
ORDER BY tablename, policyname;

-- Si les politiques bloquent, vous pouvez temporairement les désactiver pour tester :
-- ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE participants DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Mais il vaut mieux corriger les politiques pour qu'elles fonctionnent correctement

