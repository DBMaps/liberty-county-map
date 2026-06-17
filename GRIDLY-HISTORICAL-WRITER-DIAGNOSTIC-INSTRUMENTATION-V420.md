# GRIDLY Historical Writer Diagnostic Instrumentation V420

## Summary

V420 adds read-only diagnostic preservation for the passive historical writer fail-open path. The milestone does not fix writer storage targeting, does not alter Supabase schema access, and does not start or enable the historical canary. Its purpose is to preserve the original writer/storage exception so a future manually approved canary can reveal the exact failure behind `passive_history_capture_sidecar_writer_fail_open`.

## Files changed

- `js/history-capture/historyCaptureWriter.js`
  - Preserves the most recent writer failure diagnostic in memory.
  - Returns the diagnostic alongside the existing fail-open writer result.
  - Adds `getLastFailureDiagnostic()` as a read-only writer helper.
- `js/app.js`
  - Adds `window.gridlyHistoricalWriterDiagnostic?.()`.
  - Adds `writerDiagnostic` to `window.gridlyHistoricalCanaryStatus?.()`.
  - Copies writer diagnostics into canary runtime state when a canary writer failure is observed.
- `tests/history-capture/historyCaptureWriter.test.js`
  - Verifies that a simulated storage exception preserves message, code, details, hint, status, exception name, stages, and stop reason.

## Diagnostic additions

When the writer fail-open path is reached, the writer now preserves these safe fields when available:

- `available`
- `lastFailureAt`
- `writerStage`
- `storageStage`
- `errorMessage`
- `errorCode`
- `errorDetails`
- `errorHint`
- `errorStatus`
- `exceptionName`
- `exceptionStack`
- `canaryStopReason`
- `safeForFixAnalysis`

String diagnostic values are capped before exposure. No credentials, Supabase keys, connection strings, request headers, or environment values are collected.

## New audit/helper behavior

### `window.gridlyHistoricalCanaryStatus?.()`

The existing status helper remains read-only. It now includes a `writerDiagnostic` object. If no writer failure has occurred, the diagnostic reports `available: false`. After a writer failure, it exposes the most recent sanitized failure fields in memory.

### `window.gridlyHistoricalWriterDiagnostic?.()`

A new read-only helper returns only the most recent writer failure details. It does not start capture, does not enable the writer, does not query Supabase, and does not write to storage.

## Expected canary output

After a future manually approved canary writer failure, the expected shape is:

```js
window.gridlyHistoricalCanaryStatus?.().writerDiagnostic
// {
//   available: true,
//   lastFailureAt: "2026-...",
//   writerStage: "write_attempt",
//   storageStage: "historical_events_insert",
//   errorMessage: "... original storage exception message ...",
//   errorCode: "... optional Supabase/PostgREST code ...",
//   errorDetails: "... optional details ...",
//   errorHint: "... optional hint ...",
//   errorStatus: "... optional status ...",
//   exceptionName: "... optional exception name ...",
//   exceptionStack: "... optional stack ...",
//   canaryStopReason: "writer_error",
//   safeForFixAnalysis: true
// }
```

The same details should be available through:

```js
window.gridlyHistoricalWriterDiagnostic?.()
```

## Protected-system review

V420 does not modify the protected live-awareness paths or user-facing systems:

- `loadSharedReports()` unchanged.
- `activeHazards` unchanged.
- `getLiveHazardIncidents()` unchanged.
- `unifiedRoadIncidents` unchanged.
- `activeUnifiedIncidents` unchanged.
- Alerts unchanged.
- Awareness unchanged.
- Markers unchanged.
- Route Watch unchanged.
- DriveTexas unchanged and not referenced as implementation work.

## Explicit non-approvals

V420 explicitly does not approve or perform:

- Automatic canary execution.
- Historical capture activation.
- Historical writer activation.
- Historical writes.
- Historical reads.
- History UI exposure.
- Supabase schema changes.
- SQL migrations.
- Storage targeting changes or writer fixes.
- Alert, marker, awareness, Route Watch, or protected-system changes.

## Testing performed

- `git status --short`
- `git diff --check`
- `node --check js/app.js js/history-capture/historyCaptureWriter.js tests/history-capture/historyCaptureWriter.test.js`
- `node tests/history-capture/historyCaptureWriter.test.js`

## Recommended next milestone

Run one separately approved, manually initiated canary and inspect `window.gridlyHistoricalCanaryStatus?.().writerDiagnostic` or `window.gridlyHistoricalWriterDiagnostic?.()` after failure. Use the captured original Supabase/storage exception to decide the next fix milestone without changing activation, read, UI, schema, or protected-system boundaries in V420.
