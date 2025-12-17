-- Fix: Corriger les politiques RLS qui causent une récursion infinie
-- À exécuter dans le SQL Editor de Supabase

-- Supprimer les anciennes politiques problématiques
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON participants;
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON messages;

-- Nouvelle politique pour participants (sans récursion)
-- Un utilisateur peut voir les participants si son email correspond OU si son user_id correspond
CREATE POLICY "Users can view participants by email or user_id" ON participants
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR user_id = auth.uid()
  );

-- Nouvelle politique pour conversations (sans récursion)
-- Un utilisateur peut voir une conversation si son email ou user_id est dans les participants
CREATE POLICY "Users can view conversations they participate in" ON conversations
  FOR SELECT USING (
    id IN (
      SELECT conversation_id FROM participants 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
         OR user_id = auth.uid()
    )
  );

-- Nouvelle politique pour messages (sans récursion)
CREATE POLICY "Users can view messages in their conversations" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT conversation_id FROM participants 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
         OR user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their conversations" ON messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT conversation_id FROM participants 
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
         OR user_id = auth.uid()
    )
  );
