# Booking funnel — remaining human gate (diagnosed)

Agent has completed app code, tests, build, import JSON, Explore shell, and rollback docs.
GTM/GA4 write access is blocked by **account permission + OAuth client policy**, not by missing recipes.

## Root cause (evidence)

### GTM container `GTM-W6XLJMD5` users

| Email | Permission |
|---|---|
| `contact@guidemytable.fr` | **Publish** |
| `raphaellevy027@gmail.com` | **Read** |

- Browser automation session = `raphaellevy027@gmail.com` → Import UI: *“You do not have permission to import a container.”* (expected for Read).
- CLI/API account = `contact.avenirea@gmail.com` → token has **no** Tag Manager scopes (only `cloud-platform` + email).

### Why refreshing ADC scopes failed

`gcloud auth application-default login --scopes=...tagmanager.edit.containers...` → Google returns:

**`Error 401: disabled_client`** — “Sign in with Google temporarily disabled for this app” on the **default** gcloud OAuth client when requesting Tag Manager scopes.

So the agent cannot mint a Tag Manager API token with the stock gcloud client. Options: custom OAuth client, or UI work as a user with **Edit** (or higher).

## Smallest action for you (pick ONE)

### Option A — preferred (30 seconds)

Signed in as **`contact@guidemytable.fr`** in Tag Manager:

1. Admin → User Management (container `GTM-W6XLJMD5`)
2. Set **`raphaellevy027@gmail.com`** from **Read → Edit** (or **Publish**)
3. Reply here: “Edit granted”

Agent will then: create workspace `Booking | Funnel Tracking`, create tags/triggers/vars from `scripts/gtm-booking-funnel-import.json` (no whole-container overwrite; Ads untouched), Preview, finish Explore funnel, re-validate.

### Option B

Sign the IDE/browser into Tag Manager as **`contact@guidemytable.fr`** (Publish) and tell the agent — same follow-up work.

### Option C (API path)

Provide a **verified** GCP OAuth client JSON that allows Tag Manager scopes, then agent runs `scripts/gtm-booking-funnel-setup.mjs`.

## After GTM is live (agent + you)

1. Agent: Preview booking demo (no Publish without your OK)
2. You approve Publish / merge / deploy when ready
3. Star `booking_completed` as key event once it appears in Recent events

## Already done (no action)

- App dataLayer funnel + mount `booking_form_started` + dedupe
- Unit tests 42/42, production build pass
- GTM JSON (`G-CB834F9YGR`, `gaawe` only, consent `NOT_SET`)
- Explore shell [Booking funnel](https://analytics.google.com/analytics/web/#/analysis/a378846450p517840919/edit/o-n_jeDASLSCu8j90WhzDg) (open funnel on; steps still need UI)
- Rollback: `scripts/booking-funnel-rollback.md`
