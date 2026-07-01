# GRIDLY V144.2 — Commute Audit Return Object Sanitizer Fix

## Goal
Apply the empty-cycle sanitizer to the final object returned by `window.gridlyCommuteIntelligenceAudit()` so stale helper profiling data cannot leak into empty incident cycles.

## What changed
- Added `sanitizeEmptyCommuteAuditPayload(payload)` to sanitize the final audit payload object.
- Updated `gridlyCommuteIntelligenceAudit()` to:
  - Build a local `result` object.
  - Return `sanitizeEmptyCommuteAuditPayload(result)` immediately before returning.
- Added `emptyCycleSanitized` flag on the final returned payload:
  - `true` when `counts.incidentsProcessed === 0` OR `counts.unifiedIncidentCount === 0`
  - `false` otherwise.

## Empty-cycle sanitization fields
When an empty cycle is detected, the final returned payload now enforces:

- `labelHelperInternalSections = {}`
- `labelHelperCallStats = {}`
- `labelHelperSlowestCall = null`

- `localizedLabelLookupSections = {}`
- `localizedLabelPerIncidentLookupTimings = []`
- `localizedLabelSlowestLookupStep = null`

- `sharedCacheRetrievalSections = {}`
- `sharedCachePerIncidentTimings = []`
- `sharedCacheSlowestStep = null`

- `payloadShapingSections = {}`
- `payloadShapingPerIncidentTimings = []`
- `payloadShapingSlowestStep = null`

## Validation
- Syntax check:
  - `node --check js/app.js`

## Manual verification
1. Hard refresh the app.
2. Run `window.gridlyCommuteIntelligenceAudit()` in the console.
3. If `incidentsProcessed = 0`:
   - `emptyCycleSanitized === true`
   - `labelHelperSlowestCall === null`
   - `payloadShapingSlowestStep === null`
   - `sharedCacheSlowestStep === null`
   - `localizedLabelSlowestLookupStep === null`
