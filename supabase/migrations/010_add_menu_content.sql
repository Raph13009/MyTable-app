-- Migration: Ajouter menu_content à booking_requests
-- Cette colonne permet au chef de définir un menu détaillé directement dans la conversation
-- Note: Cette colonne ne sera jamais remplie lors de la création initiale du formulaire

-- Ajouter la colonne menu_content (contenu du menu défini par le chef)
ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS menu_content JSONB;

-- Commentaire pour documenter
COMMENT ON COLUMN booking_requests.menu_content IS 'Menu détaillé défini par le chef dans la conversation. Structure JSON avec catégories (apéritifs, mise_en_bouche, entree, plat, dessert, mignardises) et leurs items.';
