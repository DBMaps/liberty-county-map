# GRIDLY Historical Writer Diagnostic Runtime Fix V420.1

## Summary
V420.1 fixes the runtime wiring for the passive historical writer diagnostic helper so the diagnostic source reports available before any canary run, write attempt, capture activation, historical read, or UI exposure.

## Files changed
- `js/history-capture/historyCaptureWriter.js`
- `js/app.js`
- `tests/history-capture/historyCaptureWriter.test.js`
- `GRIDLY-HISTORICAL-WRITER-DIAGNOSTIC-RUNTIME-FIX-V420.1.md`

## Root cause
The writer sidecar exposed `getLastFailureDiagnostic()`, but the no-failure baseline returned `available: false`. `js/app.js` treated only diagnostics with `available: true` as usable, so production runtime reported the app helper as safe for fix analysis but unavailable when no writer failure had been recorded.

## Runtime fix
The writer sidecar now exposes a read-only `getWriterDiagnostic()` getter. When no failure has occurred, it returns a safe baseline diagnostic with `available: true`, `lastFailureAt: null`, `canaryStopReason: null`, and `safeForFixAnalysis: true`. `getLastFailureDiagnostic()` remains as a compatibility alias to the same read-only diagnostic result. `js/app.js` now reads `getWriterDiagnostic()` first and falls back to the legacy getter.

## Expected console output
After deploy and refresh, before starting any new canary:

```js
window.gridlyHistoricalWriterDiagnostic?.()
```

Expected minimum result:

```js
{
  available: true,
  lastFailureAt: null,
  canaryStopReason: null,
  safeForFixAnalysis: true
}
```

Additional writer fields may be present as `null` in the app-level wrapper.

## Protected-system review
No changes were made to live report loading, active hazards, unified incidents, alerts, awareness behavior, markers, Route Watch, DriveTexas, Supabase schema, SQL, historical reads, history UI, writer storage targeting, or activation defaults.

## Explicit non-approvals
This change does not approve or perform canary start, capture enablement, writer enablement, historical writes, historical reads, schema changes, SQL execution, UI changes, DriveTexas work, or a fix for the historical write failure itself.

## Testing performed
- `git status --short`
- `git diff --check`
- `node --check js/app.js`
- `node --check js/history-capture/historyCaptureWriter.js`
- `node --check tests/history-capture/historyCaptureWriter.test.js`
- `node tests/history-capture/historyCaptureWriter.test.js`
- `node tests/history-capture/historyCapturePhase1A.test.js`

## Recommended next milestone
After deployment validation confirms `window.gridlyHistoricalWriterDiagnostic?.()` reports `available: true` before canary execution, use the diagnostic output to plan the next milestone for historical write failure analysis without enabling new behavior outside the approved canary process.
