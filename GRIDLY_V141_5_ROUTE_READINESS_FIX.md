# GRIDLY V141.5 — Route Readiness / Manage Places Gating Fix

## Root Cause
Route Setup button states were driven by coarse preconditions (`routeReady`, `hasSavedPlaces`) that incorrectly disabled **Manage Places** in missing-setup states. This created a dead-end when Home/Work were missing and no saved places existed.

## Readiness Rules (Implemented)

### Manage Places
Always remains actionable for setup and edits.

- Enabled when Home/Work are missing.
- Enabled when saved place count is zero.
- Enabled when saved places already exist.
- Must map to a valid route handler bridge.

### Open Route Watch
Enabled only when route prerequisites are satisfied.

- Requires route readiness state (`start` + `destination` selected).
- Disabled reasons are explicit:
  - `Add Home and Work first.`
  - `Select a destination.`

### View Route
Enabled only when route is viewable.

- Enabled if route preview exists **or** active route/selection exists.
- Disabled reasons are explicit:
  - `Add Home and Work first.`
  - `No route preview available.`

## State Refresh Flow
Immediate button-state refresh is now triggered after place persistence events:

- Save Home / Save Work / Save Favorite (`saveRoute` flow).
- Programmatic saved place writes (`savePlaceType`).
- Refresh helper exposed as `window.gridlyRefreshRouteButtonStates(source)`.
- If Route sheet is active, refresh rebinds action gating without requiring modal close/reopen.

## Exact Fix Locations
- `js/app.js`
  - Enhanced route snapshot metadata (`hasHome`, `hasWork`, `hasRoutePreview`, route activity flags).
  - Expanded precondition model to separate `routeWatch`, `viewRoute`, and `managePlaces` gates.
  - Added `refreshRouteButtonStates` lifecycle helper + debug tracking.
  - Updated button-disable gating in `bindV2SheetActions()`.
  - Expanded route audit helper (`gridlyRouteSetupButtonAudit`) with:
    - `effectiveReadinessReason`
    - `stateRefreshDetected`
    - `savedPlaceSlots`
    - explicit `disabledReason`
  - Added Manage Places route-handler mapping in audit.

## Validation Checklist
- [ ] Hard refresh app.
- [ ] Open Route Setup.
- [ ] Run `window.gridlyRouteButtonSystemAudit()` (and `window.gridlyRouteSetupButtonAudit()` if needed).
- [ ] With no Home/Work:
  - [ ] Manage Places enabled.
  - [ ] Manage Places matchedHandler `true`.
  - [ ] Manage Places clickTargetReady `true`.
  - [ ] Open Route Watch disabled with explicit reason.
  - [ ] View Route disabled with explicit reason.
- [ ] Save Home and Work.
- [ ] Re-run audit.
  - [ ] Open Route Watch enabled.
  - [ ] Manage Places enabled.
  - [ ] View Route enabled once preview/active route exists.
- [ ] Confirm button states update immediately after saves/edits.
