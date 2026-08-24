#!/usr/bin/env bash
#
# Local development database bootstrap for the Supabase local stack.
#
# The migrations in supabase/migrations reuse version prefixes (e.g. two files
# start with 002/003/004), which the Supabase CLI migration tracker rejects.
# That is why [db.migrations] / [db.seed] are disabled in supabase/config.toml.
# This script instead applies the schema directly with psql (which does not
# track migration versions) and seeds a demo chef so /explore and the booking
# flow have data to work with.
#
# Prerequisites: `supabase start` must already be running.
# Usage: ./scripts/dev-db-bootstrap.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_CONTAINER="${SUPABASE_DB_CONTAINER:-supabase_db_workspace}"

if ! docker inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  echo "ERROR: Supabase db container '$DB_CONTAINER' not found. Run 'supabase start' first." >&2
  exit 1
fi

psql_run() { docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -q -U postgres -d postgres "$@"; }

# Apply migrations only when the schema is not present yet (CREATE TABLE in
# 001 is not idempotent, so we never re-apply on an already-initialised DB).
if psql_run -tAc "SELECT to_regclass('public.chefs')" | grep -q chefs; then
  echo "Schema already present — skipping migration apply."
else
  echo "Applying migrations..."
  for f in $(ls "$ROOT_DIR"/supabase/migrations/*.sql | sort); do
    echo "  -> $(basename "$f")"
    psql_run < "$f" >/dev/null
  done
fi

# Grant the PostgREST roles access to the public schema. Hosted Supabase wires
# these up automatically; a schema applied directly with psql does not, so anon
# / service_role would otherwise hit "permission denied for table ...".
echo "Granting PostgREST role privileges..."
psql_run >/dev/null <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
SQL

echo "Seeding demo chef (idempotent)..."
psql_run >/dev/null <<'SQL'
INSERT INTO chefs (slug, name, last_name, email, phone, city, postal_code,
                   cuisine_style, cuisine_style_en, latitude, longitude,
                   min_guests, max_guests, availability_radius_km, is_publicly_visible)
VALUES ('chef-demo', 'Chef Demo', 'Demo', 'chef-demo@example.com', '+33123456789',
        'Paris', '75001', 'Cuisine française', 'French cuisine',
        48.8566, 2.3522, 2, 12, 25, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
  is_publicly_visible = EXCLUDED.is_publicly_visible, min_guests = EXCLUDED.min_guests,
  max_guests = EXCLUDED.max_guests, cuisine_style = EXCLUDED.cuisine_style;

INSERT INTO menus (chef_id, name, description, price)
SELECT c.id, 'Menu Découverte',
       'Entrée, plat et dessert au fil des saisons, avec des produits locaux.', 65.00
FROM chefs c WHERE c.slug = 'chef-demo'
  AND NOT EXISTS (SELECT 1 FROM menus m WHERE m.chef_id = c.id AND m.name = 'Menu Découverte');

INSERT INTO menus (chef_id, name, description, price)
SELECT c.id, 'Menu Signature',
       'Le menu signature du chef : apéritif, entrée, plat, fromage et dessert.', 95.00
FROM chefs c WHERE c.slug = 'chef-demo'
  AND NOT EXISTS (SELECT 1 FROM menus m WHERE m.chef_id = c.id AND m.name = 'Menu Signature');
SQL

echo "Done. Demo chef 'chef-demo' is available at /book/chef-demo and on /explore."
