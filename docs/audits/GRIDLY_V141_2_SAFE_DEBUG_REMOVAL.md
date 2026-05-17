# Gridly V141.2 Safe Debug Removal

## What was removed

- Removed the old map click diagnostics bootstrap call from startup (`installMapClickDiagnostics();`).
- Removed the map click diagnostics listener implementation (`installMapClickDiagnostics`) that added a capture-phase document click listener and emitted map click trace payloads.
- Removed the no-op mutation tracing hook (`traceMobileModeMutation`) and its callsites, since it had no runtime behavior and only represented stale debug scaffolding.

## What was intentionally kept

Kept per instruction:
- `window.gridlyRefreshAudit()`
- `window.gridlyGeoAudit()`
- `window.gridlyActiveIncidentAudit()`
- `window.gridlyDevPurgeRecentRoadHazards()`

Also intentionally kept:
- Existing refresh/network/render audit state used by active helpers and diagnostics.
- Existing report/route diagnostics that may still be used for stabilization validation.

## Why uncertain items were left alone

- Network and render audit state were not removed because they are still consumed by active debug helpers and dedupe/triage paths.
- Console logging outside the removed systems was left untouched where it may still support active operational diagnosis.
- Any system tied to report submission, route flows, or refresh ownership was left intact to avoid behavior drift.

## Protected systems

No changes were made to:
- Supabase sync
- FRA crossing loading
- Liberty County GeoJSON
- routing engine
- Route Watch logic
- saved places
- map bootstrap behavior
- desktop layout
- landscape tactical architecture
- unified incident generation
- report submission flow
- refresh ownership chain
- Portrait V2 reporting behavior

## Validation checklist

- `node --check js/app.js` passed.
- Cleanup scope constrained to clearly debug-only removals.
- KEEP helpers remain present.
- No functional feature rewrites/refactors were performed.

Manual validation to run in browser:
- hard refresh
- no startup geolocation warning
- `window.gridlyRefreshAudit()` works
- `window.gridlyGeoAudit()` works
- `window.gridlyActiveIncidentAudit()` works
- Tap Map Location works
- Use My Location works
- Report submit works
- Crossing popup opens
- Route Watch still works
- Desktop untouched
- Landscape untouched
