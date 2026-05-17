# GRIDLY V141.5c — Route Audit Helper Exposure Trace

## Exact mismatch found
- **Observed callsite expected**: `window.gridlyRouteButtonSystemAudit()`.
- **Actual export in code before fix**: only `window.gridlyRouteSetupButtonAudit = function gridlyRouteSetupButtonAudit() { ... }`.
- Result: `window.gridlyRouteButtonSystemAudit` was undefined/non-function, causing `is not a function`.

## Exact global names restored
The same helper function is now attached to both names:
- `window.gridlyRouteButtonSystemAudit`
- `window.gridlyRouteSetupButtonAudit`

Also added smoke-check helper:
- `window.gridlyRouteAuditGlobalsCheck()` returning:
  - `routeButtonSystemAudit: typeof window.gridlyRouteButtonSystemAudit`
  - `routeSetupButtonAudit: typeof window.gridlyRouteSetupButtonAudit`

## Scope / branch / overwrite trace
- The export assignment lives inside the same route sheet/update flow where the helper was previously created.
- No additional later overwrite references were found for:
  - `gridlyRouteButtonSystemAudit`
  - `gridlyRouteSetupButtonAudit`
  - `RouteButtonSystemAudit`
  - `routeButtonSystemAudit`
  - `routeSetupButtonAudit`
- Core Route Watch logic was not changed.

## Validation checklist
- [x] Searched all required helper name variants in `js/app.js`.
- [x] Confirmed mismatch between expected global and actual exported global.
- [x] Attached helper to both required globals.
- [x] Added `window.gridlyRouteAuditGlobalsCheck` smoke helper.
- [x] Left route readiness, button gating, routing/scoring/map/hazard/report logic unchanged.
- [x] `node --check js/app.js` passes.

## Manual verification steps
1. Hard refresh the app.
2. Run:
   - `window.gridlyRouteAuditGlobalsCheck()`
3. Expect:
   - `{ routeButtonSystemAudit: "function", routeSetupButtonAudit: "function" }`
4. Run:
   - `window.gridlyRouteButtonSystemAudit()`
   - `window.gridlyRouteSetupButtonAudit()`
