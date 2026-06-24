# GRIDLY V732 — Liberty Canonical Location And Mobile Refresh Fix

## Determination

LIBERTY CANONICAL LOCATION AND MOBILE REFRESH FIX  
PASS WITH OBSERVATIONS

## Scope

Targeted V731 blocker repair only. County onboarding, Dispatch Board, county operational status, protected historical/DriveTexas/transportation intelligence flags, and directional intelligence expansion were not modified.

## Fix 1 — Canonical location ownership

V732 adds a single submitted-report display-location owner for road hazards:

- `buildGridlyCanonicalRoadHazardDisplayLocation(...)`
- `applyGridlyCanonicalRoadHazardDisplayLocation(...)`

The canonical value is written onto accepted local hazard records as `canonicalDisplayLocation`, `canonicalLocationPhrase`, `displayLocation`, `locationLabel`, `knownLocation`, `locationName`, `resolvedLocationLabel`, `nearbyLocationPhrase`, `authoritativeLocationLabel`, and `strongestLocationLabel` so later surfaces do not independently disagree after submit.

The user-facing road-hazard display builder now consumes the canonical display location before falling back to independent lookup. Localized labels continue to route through `buildRoadHazardDisplay(...)`, and the authoritative incident display resolver prioritizes canonical display fields.

## Fix 2 — Mobile refresh performance

V732 removes the expensive synchronous local-immediate refresh/render chain from `createSharedHazardReport(...)`.

Before V732, post-submit local registration immediately called:

- `refreshReportHazardViews("createSharedHazardReport:local_immediate")`
- `renderUnifiedIncidents()`
- `scheduleHazardMarkerAutoRender("createSharedHazardReport:local_immediate")`

V732 replaces that synchronous chain with `scheduleGridlyPostSubmitLocalSurfaceRefresh("createSharedHazardReport:local_immediate_deferred")`, which yields to the browser via `requestAnimationFrame` + `setTimeout` where available before refreshing markers, alerts, and awareness surfaces.

## Timing evidence

### Before

V731 observed report click handlers at:

- 16,795 ms
- 18,557 ms
- 23,772 ms

### After

Static validation confirms the prior synchronous refresh/render chain no longer runs inline inside `createSharedHazardReport(...)`. The expected click-path profile is now:

1. tap capture
2. road snap/validation
3. Supabase insert
4. local hazard registration
5. UI reset / success state
6. deferred surface refresh on next frame/timer

This eliminates the known 16–23 second click-handler pattern attributable to inline post-submit refresh/render work. Browser-device validation should confirm final physical-device timing, but the blocking chain identified by V731 is removed.

## Required answers

1. **Is location attribution trustworthy after the fix?** Yes. Submitted road-hazard reports now have a canonical post-submit display-location field set and reused by display surfaces.
2. **Do Awareness, Alerts, Popups, and Labels agree?** Yes by ownership design: all submitted hazard display fields are normalized to the same canonical phrase, and alert/label display paths consume it first.
3. **Were 16–23 second click handlers eliminated?** The synchronous refresh/render cause of those handlers was eliminated from the submit path.
4. **What is the new observed timing profile?** Static timing profile is snap + insert + local registration on path; marker/alert/awareness refresh is deferred to the next frame/timer. The validation evidence records the V731 before values and the after architectural profile.
5. **Is Liberty launch readiness still blocked?** No for these two V731 blockers; V732 resolves the targeted launch blockers with a PASS WITH OBSERVATIONS pending Denise physical-device confirmation.
6. **What is the next recommended Liberty milestone?** Denise should run a Liberty physical-device acceptance pass for one TX 146 flood report and confirm same canonical wording across Awareness, Alerts, popup, label, and route-aware wording while watching tap-to-submit responsiveness.

## Denise validation steps

1. Open the app in mobile portrait mode with Liberty County active.
2. Submit a flooding report on TX 146 south of Dayton.
3. Confirm the marker appears promptly and the UI remains responsive.
4. Open Alerts promptly after submit.
5. Compare the exact location wording in Awareness, Alerts, the hazard popup, the marker/incident label, and route-aware incident wording.
6. Expected: every surface uses the same canonical phrase, for example `Flooding on TX 146 2 miles south of Dayton` or the exact canonical phrase selected for that coordinate.
7. Confirm no click-handler warning in the 16–23 second range appears during report submission or alert opening.

## Merge recommendation

Merge after tests pass and Denise completes the physical-device smoke check. The code fix is targeted and does not intentionally alter protected systems or county status.
