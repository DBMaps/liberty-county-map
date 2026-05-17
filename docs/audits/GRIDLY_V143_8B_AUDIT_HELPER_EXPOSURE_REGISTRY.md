# GRIDLY V143.8b Audit Helper Exposure Registry

## Root Cause Pattern
- Audit/debug helpers were being attached to `window` ad hoc in multiple distant sections of `js/app.js`.
- During repeated edits, some helpers were renamed, re-scoped, or reassigned without consistently restoring the expected global alias.
- Result: after hard refresh, specific audit helper globals intermittently disappeared (for example `window.gridlyCommuteIntelligenceAudit`).

## Registry Design
- Added centralized `exposeGridlyAuditHelper(name, fn, options)`.
- Responsibilities:
  - Validates `name` is a non-empty string.
  - Validates `fn` is a function.
  - Safely binds `fn` to `window[name]` (or `globalThis` fallback).
  - Refuses undefined/non-function payloads by returning `null`.
  - Stores lightweight exposure metadata in `window.__gridlyAuditHelperRegistry`.
  - Is idempotent/safe for repeated calls.
  - Catches internal errors and does not throw in production paths.

## Global Checker
- Added `window.gridlyAuditHelpersCheck()`.
- Returns `typeof` values for all active helpers in scope.
- Expected values are typically `"function"` or an intentional missing state where applicable.

## Helpers Covered
- `gridlyCommuteIntelligenceAudit`
- `gridlyRouteRelevanceAudit`
- `gridlyReflowAudit`
- `gridlyRefreshBreakdownAudit`
- `gridlyPortraitIntelligenceBreakdownAudit`
- `gridlyPostSubmitRefreshAudit`
- `gridlyRefreshAudit`
- `gridlyGeoAudit`
- `gridlyActiveIncidentAudit`
- `gridlyDevPurgeRecentRoadHazards`
- `gridlyRouteButtonSystemAudit`
- `gridlyRouteSetupButtonAudit`
- `gridlyRouteAuditGlobalsCheck`
- `gridlyPortraitV2LayerAudit`
- `gridlyCommuteAuditGlobalsCheck`

## Backward Compatibility Names
The patch preserves global access for:
- `window.gridlyCommuteIntelligenceAudit`
- `window.gridlyCommuteAuditGlobalsCheck`
- `window.gridlyRouteSetupButtonAudit`
- `window.gridlyRouteButtonSystemAudit`

## Validation Checklist
1. Run syntax check:
   - `node --check js/app.js`
2. Hard refresh app in browser.
3. In console, run:
   - `window.gridlyAuditHelpersCheck()`
   - `window.gridlyCommuteIntelligenceAudit()`
4. Confirm:
   - Listed helpers report `"function"` or intentional `"missing"`.
   - `gridlyCommuteIntelligenceAudit` reports as `"function"`.
   - No route/report/hazard behavior changes.
