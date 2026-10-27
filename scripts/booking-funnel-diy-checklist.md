# Booking Funnel — status checklist

Updated: 2026-10-27 (GA4 intake + Explore)

## Done

### App / prod
- [x] Booking funnel `dataLayer` events on `main`
- [x] PR #25 merged → `app.guidemytable.fr`
- [x] Live smoke: dataLayer fires `booking_*`; with analytics consent granted, GA4 Realtime receives them
- [x] Consent bridge fix (CookieYes on app + `cookieyes-consent` / `wp_consent_*` sync) — ship via commit below

### GTM `GTM-W6XLJMD5`
- [x] Booking tags published (v17+)
- [x] **v23**: `DLV - booking.step_number_v2` (`dataLayerVersion=2`) wired into Step Viewed / Completed / Validation tags  
  (old `DLV - booking.step_number` had a broken compiled `dataLayerVersion`)

### GA4
- [x] Custom dimensions exist (Booking Step Number, etc.)
- [x] Explore **Booking Funnel** renamed; **closed funnel** (open funnel OFF)
- [x] Booking Step Number in Variables
- [x] Realtime verified: `booking_form_started`, `booking_step_view`, `booking_step_completed`, `booking_completed`
- [ ] Six Explore **steps** (step editor not automatable — see below)

Explore: https://analytics.google.com/analytics/web/#/analysis/a378846450p517840919/edit/o-n_jeDASLSCu8j90WhzDg

## Why events were missing from Explore

1. **Consent**: App defaulted `analytics_storage=denied` and only upgraded from `wp_consent_*` cookies. Those cookies are host-scoped to `guidemytable.fr`, so **`app.guidemytable.fr` never granted consent**. GTM processed dataLayer events, but GA4 Event tags did not send `en=booking_*` collect hits until consent was granted.
2. **Explore event picker** only lists events GA4 has already received. Until (1) was fixed, `booking_*` never appeared.
3. **Latency**: after first receipt, Explore may take minutes–hours to show new event names in the step editor (Realtime shows them immediately).

## Remaining (you — ~3 min in Explore UI)

The GA4 funnel **step editor** cannot be driven by browser automation (custom Material dialog; double-click / a11y clicks do not open the condition builder).

1. Open the Explore link above (closed funnel already set).
2. Double-click **First open/visit** → Event name = `booking_form_started`.
3. Add steps 2–6:
   - 2–5: `booking_step_view` + **Booking Step Number** exactly matches `2`/`3`/`4`/`5`
   - 6: `booking_completed`
4. Optional: remove Device category breakdown / unused segments.

## Safe E2E check (no real booking)

1. Accept cookies on `guidemytable.fr` **or** on `app.guidemytable.fr` (CookieYes after deploy).
2. Open `https://app.guidemytable.fr/book/julien`.
3. Confirm in DevTools → Network `g/collect` URLs contain `en=booking_form_started` with `gcs=G111`.
4. Confirm GA4 **Realtime** lists the booking events.
5. Do **not** submit the form (avoids chef/customer emails).
