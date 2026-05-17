# GRIDLY V140.5 — Startup Geolocation Gesture Fix

## Root cause
The startup map bootstrap path called `centerMapOnUserIfAllowed()` from `initMap()`, and that function executed `navigator.geolocation.getCurrentPosition(...)` immediately during page initialization. That produced browser warnings because the request was not tied to an explicit user gesture.

## Startup request path (before fix)
`startup` → `initMap()` → `centerMapOnUserIfAllowed()` → `navigator.geolocation.getCurrentPosition(...)`

## Blocked startup path (after fix)
`startup` → `initMap()` → `centerMapOnUserIfAllowed()`

The startup function now performs no geolocation API call and records a blocked startup attempt in audit state.

## New allowed request sources
Geolocation requests are now tracked by source and currently allowed from explicit user actions such as:

- `hazard_use_my_location` (Use My Location / Report Near Me action flow)
- Existing user-triggered location actions (Center on Me, Report Near Me, Route/Home/Work actions) can be tracked by source when they call geolocation.

## Passive audit helper
A new passive helper is exposed:

- `window.gridlyGeoAudit()`

Returns:

```js
{
  startupRequestsBlocked,
  geolocationRequestsBySource,
  lastRequestSource,
  lastRequestTime,
  startupAutoRequestDetected
}
```

Notes:

- Passive only.
- No listeners.
- No polling.
- No mutation observers.

## Protected systems (unchanged)
This stabilization patch does **not** alter:

- Supabase sync
- FRA crossing loading
- Liberty County GeoJSON handling
- routing engine
- Route Watch logic
- saved places
- desktop layout
- landscape tactical architecture
- unified incident generation
- report submission flow
- refresh ownership chain
- map rendering behavior

## Validation checklist
- [ ] Hard refresh app.
- [ ] Confirm no startup geolocation violation appears in browser console.
- [ ] Run `window.gridlyGeoAudit()` and confirm startup blocked telemetry is present.
- [ ] Tap **Use My Location** and verify geolocation still works.
- [ ] Tap **Report Near Me** and verify geolocation still works.
- [ ] Use Route/Home/Work location actions and verify user-gesture-only behavior remains.
- [ ] Confirm map load remains normal.
- [ ] Confirm crossings load remains normal.
- [ ] Confirm Route Watch remains normal.
- [ ] Confirm desktop layout unchanged.
- [ ] Confirm landscape tactical layout unchanged.
