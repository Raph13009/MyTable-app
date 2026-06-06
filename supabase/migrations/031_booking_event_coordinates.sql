-- Coordonnées du lieu de prestation (pour suggestions de chefs après refus sans fallback)
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS event_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS event_longitude DOUBLE PRECISION;

COMMENT ON COLUMN booking_requests.event_latitude IS 'Latitude du lieu de la prestation (Mapbox / saisie client).';
COMMENT ON COLUMN booking_requests.event_longitude IS 'Longitude du lieu de la prestation (Mapbox / saisie client).';
