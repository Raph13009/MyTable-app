-- Simplification maximale des RLS pour débloquer l'accès
-- À exécuter dans le SQL Editor de Supabase

-- Supprimer toutes les anciennes politiques
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON participants;
DROP POLICY IF EXISTS "Users can view participants by email or user_id" ON participants;
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON messages;

-- Désactiver RLS complètement sur les tables critiques (pas de sécurité)
ALTER TABLE participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Ou si vous préférez garder RLS mais avec des politiques très permissives :
-- (décommentez si vous voulez garder RLS activé)

/*
-- Supprimer toutes les anciennes politiques
DROP POLICY IF EXISTS "Users can view participants by email or user_id" ON participants;
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON messages;

-- Réactiver RLS
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Politiques très permissives (accès si connecté)
CREATE POLICY "Allow all for authenticated users" ON participants
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON conversations
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON messages
  FOR ALL USING (auth.role() = 'authenticated');
*/

