# Booking funnel analytics — rollback

Do **not** use this unless production tracking regresses after publish/deploy.

## GTM (container `GTM-W6XLJMD5`)

Workspace intended for this change: **Booking | Funnel Tracking** (or the workspace that received `scripts/gtm-booking-funnel-import.json`).

### Before publish (preferred)

1. Open the booking workspace.
2. Delete the five booking GA4 Event tags (`Booking | Form Started` … `Booking | Confirmed`), their custom-event triggers, and the `DLV - booking.*` variables — **or** discard the whole workspace.
3. Leave Default / live workspace and all Google Ads tags untouched.
4. Do not Publish.

### After publish

1. Tag Manager → **Versions** → select the version **immediately before** the booking-funnel publish.
2. **Publish** that previous version (or **Latest** known-good).
3. Confirm Ads conversion tags still fire in Preview/Tag Assistant.

Booking tags use `measurementIdOverride` `G-CB834F9YGR` and `consentStatus: NOT_SET` (inherit container consent). Rolling back the workspace/version restores prior tag set without editing Ads tags.

## Application (`feature/booking-funnel-analytics`)

### Before merge/deploy

1. Do not merge the branch.
2. Optionally `git revert ada5582` / revert the funnel commits on the feature branch if needed locally.

### After deploy

1. Redeploy the previous production commit/tag (Vercel → promote prior deployment, or `git revert` of the funnel merge commit on the production branch + redeploy).
2. Funnel code only pushes `window.dataLayer` events and loads existing GTM (`GTM-W6XLJMD5`). Reverting the app stops new `booking_*` pushes; published GTM tags become no-ops until GTM is also rolled back.

## Verification after rollback

- Booking form still submits / navigates to confirmation.
- GTM Preview: Google Ads tags unchanged; no `booking_*` GA4 Event tags firing (or tags absent).
- GA4 Explore “Booking funnel” can remain; it simply shows zeros without events.
