# Booking funnel — what only you can finish

Do these in order. Agent cannot Publish / merge / deploy (needs your OK) and hit the blockers below.

## 1. GTM — import or paste tags (blocked for agent)

**Blocker:** your agent session saw *“You do not have permission to import a container.”*  
**Also:** Tag Manager API token lacks `tagmanager.edit.containers` scopes.

### Preferred (Admin / Publish access)

1. Open [GTM-W6XLJMD5](https://tagmanager.google.com/#/container/accounts/6306689374/containers/226464832/workspaces).
2. Create workspace **Booking | Funnel Tracking** (or use a clean dedicated workspace).
3. Admin → **Import Container** → choose `scripts/gtm-booking-funnel-import.json`.
4. Choose **Merge** → **Overwrite conflicting tags…** only if names collide with booking tags; never **Overwrite** the whole container.
5. Confirm no Google Ads tags were touched.
6. **Preview** → open `https://app.guidemytable.fr/book/chef-demo` (or staging) → walk steps → confirm tags:
   - `Booking | Form Started` → `booking_form_started`
   - `Booking | Step Viewed` → `booking_step_view` (+ `step_number` / `step_name`)
   - `Booking | Confirmed` → `booking_completed`
7. Reply here when Preview looks good → **you approve Publish**.

### If Import stays denied

Grant yourself **Admin** (or at least Import) on container `GTM-W6XLJMD5`, then repeat Preferred.  
Or ask the account owner to import that JSON into workspace **Booking | Funnel Tracking**.

## 2. GA4 Explore — six stages (UI only)

Open [Booking funnel](https://analytics.google.com/analytics/web/#/analysis/a378846450p517840919/edit/o-n_jeDASLSCu8j90WhzDg).

Replace the placeholder step with:

| # | Event | Filter |
|---|---|---|
| 1 | `booking_form_started` | none |
| 2 | `booking_step_view` | Booking Step Number **exactly matches** `2` |
| 3 | `booking_step_view` | exactly matches `3` |
| 4 | `booking_step_view` | exactly matches `4` |
| 5 | `booking_step_view` | exactly matches `5` |
| 6 | `booking_completed` | none |

Keep **Open funnel** on. Details: `scripts/ga4-booking-funnel-explore.md`.

## 3. After live traffic

Admin → Events → Recent → star **`booking_completed`** as key event (no “New key event” in this property UI).

## 4. App release (needs your OK)

Branch `feature/booking-funnel-analytics` is ready (tests + build green). When you approve:

1. Merge PR / merge to production branch  
2. Deploy  
3. Rollback doc: `scripts/booking-funnel-rollback.md`

## Already done by agent (no action)

- App dataLayer events + mount `booking_form_started`  
- Unit tests, production build  
- GTM import JSON validated (`G-CB834F9YGR`, no Ads tags)  
- Consent defaults (denied until WP cookies)  
- Explore shell named **Booking funnel**, open funnel on  
- Rollback procedure written  
