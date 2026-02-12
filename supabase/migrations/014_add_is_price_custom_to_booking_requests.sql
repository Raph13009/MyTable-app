-- Migration: Ajouter un indicateur de prix personnalisé saisi par le chef
-- Quand is_price_custom = true, total_price représente le montant final décidé par le chef

ALTER TABLE booking_requests
ADD COLUMN IF NOT EXISTS is_price_custom BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN booking_requests.is_price_custom IS 'Indique si le chef a défini un prix final personnalisé';
