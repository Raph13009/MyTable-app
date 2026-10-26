# GA4 Explore — Booking funnel (6 stages)

Property: **Guide MyTable** (`G-CB834F9YGR`)

## Event semantics

| Stage | Event | Filter |
|---|---|---|
| 1 | `booking_form_started` | *(none — fires once on form mount = step 1 entry)* |
| 2 | `booking_step_view` | Booking Step Number **exactly matches** `2` |
| 3 | `booking_step_view` | Booking Step Number **exactly matches** `3` |
| 4 | `booking_step_view` | Booking Step Number **exactly matches** `4` |
| 5 | `booking_step_view` | Booking Step Number **exactly matches** `5` |
| 6 | `booking_completed` | *(none)* |

### `step_number` type

- App / dataLayer: **JavaScript number** (`2`, not `"2"`).
- GA4 custom dimension **Booking Step Number** stores values as **strings**.
- In Explore funnel step filters, use **exactly matches** with value `2` / `3` / `4` / `5` (text). Do not use a numeric comparison operator.

### Why stage 1 is `booking_form_started` (not `booking_step_view` + step 1)

`booking_form_started` fires once when the booking form mounts (step 1). Using it as stage 1 avoids double-counting with `booking_step_view` for step 1 while still measuring entry into the funnel.

## Exploration (in progress)

Shell already created (auto-saves): [Booking funnel](https://analytics.google.com/analytics/web/#/analysis/a378846450p517840919/edit/o-n_jeDASLSCu8j90WhzDg)

- Name: `Booking funnel`
- Open funnel: **on**
- Steps: still need replacing — template leftovers cleared down to one placeholder (`First open/visit`). Finish the 6 stages below in the UI (step editor is not automatable via the browser tool).

### Finish steps in UI

1. Open the exploration link above.
2. Double-click the remaining step chip → set Event name = `booking_form_started` (no parameter filter). Rename step label if shown.
3. **Add step** ×5 for stages 2–6:
   - 2–5: Event = `booking_step_view`, **Add parameter** → **Booking Step Number** → **exactly matches** `2` / `3` / `4` / `5` (text).
   - 6: Event = `booking_completed` (no filter).
4. Remove any accidental Segment Comparisons (e.g. US) so the funnel is unfiltered.
5. Optional breakdown: Booking Funnel Name.

## Key event

Checked Admin → Events (2026-10-26): this property UI has **no “New key event”** control. Key events tab only lists `close_convert_lead` / `purchase` / `qualify_lead`. Recent events has no `booking_*` yet (only standard + `submit_lead_form`). Copy: “To mark an event as a key event, select the star next to the event name.”

**Action:** after GTM is live and `booking_completed` appears under Recent events → star it. Funnel Explore does not require key-event status.
