# AGENTS.md

## Cursor Cloud specific instructions

For small UI/CSS changes, do not re-bootstrap the environment. Reuse existing services and run only targeted validation. Full build/test/bootstrap is reserved for structural or backend changes.

MyTable is a single Next.js 14 (App Router) app backed by Supabase (Postgres + Auth + Realtime + Storage). There is one runnable service — the Next.js dev server — plus a local Supabase stack it depends on.

### Standard commands (see `package.json` scripts)
- `npm run dev` — dev server on http://localhost:3000
- `npm run lint` — ESLint (currently only warnings)
- `npm run test:unit` — node:test unit tests (all pass)
- `npm run build` — production build (passes)
- `npm run typecheck` — raw `tsc --noEmit`. NOTE: this reports **pre-existing** errors in test files only (`lib/__tests__/dateUtils.test.ts` uses Jest globals; `tests/e2e/booking-form.spec.ts` uses an old Playwright API). App code is clean and `npm run build` is unaffected — do not "fix" these as part of unrelated work.

### The app needs a local Supabase stack (non-obvious)
This repo has no committed dev credentials and (originally) no `supabase/config.toml`; it was built against a hosted Supabase project. For self-contained local dev, run a local Supabase stack. This requires system tools that are **not** installed by the update script: Docker, the Supabase CLI, plus `mkcert` + `caddy` (see the CSP note below). On a fresh VM these must be installed once before the steps below.

Bring-up (after Docker daemon is running and the Supabase CLI is installed):
1. `supabase start` — boots Postgres/Auth/REST/Realtime/Storage. `supabase status -o env` prints the local URL + keys.
2. `./scripts/dev-db-bootstrap.sh` — applies the schema and seeds a demo chef. This is required because migrations/seed are **disabled in `supabase/config.toml`**: the migrations reuse version prefixes (two files each start with `002`/`003`/`004`), which the CLI migration tracker rejects. The script applies the SQL directly with `psql`, then `GRANT`s the `anon`/`authenticated`/`service_role` roles access to the `public` schema (hosted Supabase does this automatically; a psql-applied schema does not — otherwise you get `permission denied for table ...`).

### CSP requires an HTTPS `*.supabase.co` origin for the browser (important gotcha)
`next.config.js` sets a Content-Security-Policy whose `connect-src` only allows `https://*.supabase.co` / `wss://*.supabase.co`. The browser therefore **cannot** talk to `http://127.0.0.1:54321`, so client-side auth (login, the booking account step) and Realtime fail with "Failed to fetch" if `NEXT_PUBLIC_SUPABASE_URL` points at the raw local host. Server-side rendering / API routes are unaffected.

Workaround used for local dev (no app-code changes):
- Expose the local stack over HTTPS at a `*.supabase.co` hostname via a reverse proxy: map `mytable-local.supabase.co` → `127.0.0.1` in `/etc/hosts`, run Caddy (`reverse_proxy 127.0.0.1:54321`) with an `mkcert` cert, and `mkcert -install` so Chrome trusts it (initialise `~/.pki/nssdb` with `certutil -N` first so the CA lands in Chrome's NSS store; restart Chrome afterward).
- Set `NEXT_PUBLIC_SUPABASE_URL=https://mytable-local.supabase.co` in `.env.local`.
- Start the dev server with `NODE_EXTRA_CA_CERTS=$(mkcert -CAROOT)/rootCA.pem npm run dev` so server-side Node also trusts the cert.

Alternative: point `.env.local` at a real hosted Supabase dev project (its `https://<ref>.supabase.co` URL already satisfies the CSP) — then the Caddy/mkcert proxy is unnecessary.

### Other local caveats
- `.env.local` is gitignored and holds the well-known default local Supabase keys.
- Email: `sendEmail` in `lib/email.ts` is a silent no-op unless `EMAIL_PROVIDER` is `resend` or `make`. Keep it set to something else (e.g. `disabled`) locally so bookings don't fail on Resend calls.
- Mapbox: with a placeholder `NEXT_PUBLIC_MAPBOX_TOKEN` the map tiles / address autocomplete return 403 and the map is blank. Browse (list) and booking (manual city/postal entry) still work.
- Auth is email+password (`signInWithPassword`), not magic links, despite older docs. New accounts are created confirmed via `/api/auth/register` (admin API), so they can sign in immediately.
- The seeded demo chef is at `/book/chef-demo` and appears on `/explore`.
