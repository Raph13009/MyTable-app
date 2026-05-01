-- 029_unique_constraints_participants_chefs.sql
--
-- Empêche les doublons silencieux qui ont causé l'incident "3 sessions de chat" :
--  - Plusieurs lignes participants pour la même (conversation, email)
--  - Plusieurs profils chefs avec le même email (admin double-clique sur "Enregistrer")
--
-- L'unicité d'email est case-insensitive : on indexe sur lower(email).

-- Pré-condition vérifiée hors migration : pas de doublons existants au moment de l'écriture.
-- En cas de migration réappliquée, CREATE UNIQUE INDEX échouera proprement et signalera le
-- conflit à investiguer.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_participants_conv_email
  ON participants (conversation_id, lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS uniq_chefs_email_lower
  ON chefs (lower(email));
