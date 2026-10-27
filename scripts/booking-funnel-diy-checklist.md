# Booking Funnel — status checklist

Updated: 2026-10-27 (agent session after Raphael Admin grant)

## Done

### App / branch
- [x] Booking funnel `dataLayer` events implemented on `feature/booking-funnel-analytics`
- [x] Unit tests + production build green
- [x] Rollback doc: `scripts/booking-funnel-rollback.md`
- [x] Branch pushed to origin (open PR via GitHub UI if `gh` broken locally)

### GTM `GTM-W6XLJMD5`
- [x] `raphaellevy027@gmail.com` elevated: Account **Administrator** + Container **Edit**
- [x] Workspace **`Booking | Funnel Tracking`** created (workspace id `8`)
- [x] 6 DLVs, 5 Custom Event triggers, 5 GA4 Event tags (`gaawe` → `G-CB834F9YGR`) created via authenticated GTM internal API
- [x] Existing Google Ads tags **untouched** (still present alongside booking tags)
- [x] **Not published** (awaiting explicit approval)

Workspace inventory (pending changes, Added only):
- Triggers: `Booking | CE - Form Started|Step Viewed|Step Completed|Validation Error|Confirmed`
- Tags: `Booking | Form Started|Step Viewed|Step Completed|Validation Error|Confirmed`
- Variables: `DLV - booking.{step_number,step_name,funnel_name,error_type,service_type,chef_slug}`

Open: https://tagmanager.google.com/#/container/accounts/6306689374/containers/226464832/workspaces/8

### GA4 property `517840919`
- [x] Custom dimensions exist (Event scope): Booking Step Number → `step_number`, Step Name, Funnel Name, Error Type
- [x] Explore renamed to **Booking Funnel**; Open Funnel **ON**
- [x] Booking Step Number added to Explore Variables (for step filters)
- [ ] Six funnel steps still need manual step editor (automation cannot drive it)

Explore: https://analytics.google.com/analytics/web/#/analysis/a378846450p517840919/edit/o-n_jeDASLSCu8j90WhzDg

## Remaining (human gates)

1. **GTM Preview** — click **Preview** in workspace `Booking | Funnel Tracking`, connect to a build that includes the feature branch (prod does not emit `booking_*` yet).
2. **Explore steps** (open funnel):
   1. `booking_form_started`
   2–5. `booking_step_view` + Booking Step Number exactly matches `2`/`3`/`4`/`5`
   6. `booking_completed`
3. **Approve GTM Publish** when Preview looks good (do not publish without OK).
4. **Merge PR + deploy** so prod fires `booking_*` (then DebugView).
5. Optional: create PR via https://github.com/Raph13009/MyTable-app/pull/new/feature/booking-funnel-analytics

## Risks to existing tracking
- Workspace-only changes; live container unchanged until Publish.
- Ads tags not modified.
- Rollback: discard workspace 8 or revert published version per `booking-funnel-rollback.md`.
