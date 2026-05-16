# GRIDLY V141.2C — Route Watch Regression Rollback

## What was restored

- Restored `installMapClickDiagnostics()` and its startup invocation right after `initMap()`.
- Restored the capture-phase document click listener used by map click diagnostics.
- Restored no-op `traceMobileModeMutation()` plus previously removed callsites in mobile surface flow points:
  - `returnMobileToLiveMode`
  - `openMobileRouteQuickPanel`
  - `handleReportNearMe`
  - daily panel report and route-watch launch handlers

## Why rollback was chosen

Route Watch button responsiveness regressed immediately after V141.2/V141.2b while route setup still opened. That points to event-flow/timing/lifecycle coupling risk introduced by the V141.2 debug-removal sweep rather than Route Watch business logic internals. This rollback restores known-working scaffolding first to recover user-visible functionality quickly.

## What V141.2b did not fix

V141.2b added a scoped delegated route click handler on the V2 sheet body for route-watch and route-preview actions, but Open Route Watch/View Route remained non-responsive in observed behavior.

## What should be avoided next

- Avoid removing instrumentation hooks that are no-op by design when they are still part of timing/lifecycle seams.
- Avoid layering additional delegated click handlers when canonical per-button handlers already exist.
- Avoid changing event-capture behavior and adapter bridge invocation in the same patch without explicit interaction regression checks.

## Validation checklist

- [ ] Hard refresh
- [ ] Route Setup opens
- [ ] Open Route Watch responds
- [ ] View Route responds
- [ ] Tap Map Location works
- [ ] Use My Location works
- [ ] Report submit works
- [ ] Crossing popup opens
- [ ] No startup geolocation warning
