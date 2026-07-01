# GRIDLY Historical Writer Schema Target Fix V421

## Summary
V421 fixes the passive historical writer storage target so accepted canary writes address the custom Supabase schema table `history_capture.historical_events` through schema-scoped access instead of treating `history_capture.historical_events` as a default-schema table name.

Gridly remains Awareness Platform First, Route Intelligence Second. The writer remains dormant until the existing manual canary explicitly enables capture and writing.

## Files changed
- `js/history-capture/historyCaptureWriter.js` — adds schema-scoped `history_capture` table resolution and inserts into `historical_events` from that scoped client.
- `tests/history-capture/historyCaptureWriter.test.js` — updates writer storage tests to require `schema('history_capture').from('historical_events')`, preserve fail-open diagnostics, and verify disabled writer behavior.
- `tests/history-capture/historyCaptureCanaryControlsStatic.test.js` — adds a static canary-control guard proving the canary runtime remains inactive by default and the writer is tied to manual canary activity.
- `GRIDLY-HISTORICAL-WRITER-SCHEMA-TARGET-FIX-V421.md` — this implementation and validation note.

## Root cause
The V420/V420.1 diagnostic error showed the writer attempted to access:

```text
public.history_capture.historical_events
```

The actual storage table is:

```text
history_capture.historical_events
```

The previous writer used `.from('history_capture.historical_events')`, which Supabase/PostgREST resolved as a table identifier under the default exposed schema instead of as a custom-schema table target.

## Fix implemented
The writer now resolves the table through a dedicated helper that requires schema-scoped Supabase access:

```js
storageClient.schema('history_capture').from('historical_events')
```

The insert row shape, idempotency handling, monitoring events, writer gates, and fail-open return behavior remain unchanged.

## Supabase schema targeting approach
V421 uses the preferred Supabase custom-schema pattern:

```js
supabase.schema('history_capture').from('historical_events')
```

This avoids `.from('history_capture.historical_events')`, which the canary proved can resolve incorrectly as `public.history_capture.historical_events`.

If a runtime client does not expose `schema()`, the writer fails open with a diagnostic error instead of attempting a default-schema write.

## Diagnostics retained
The writer still preserves failure diagnostics, including:
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

If storage insert still fails after deploy, the diagnostic will preserve the new exact Supabase/PostgREST error for fix analysis.

## Dormant defaults retained
Dormant defaults remain intact:
- Capture is not enabled by default.
- Writer is not enabled by default.
- Historical reads are not added.
- History UI is not added.
- Canary does not start automatically.
- Writes require `writerEnabled === true`, which current app wiring supplies only while the manual canary is active.

## Protected-system review
No protected awareness or live operational paths were intentionally changed:
- `loadSharedReports()` unchanged.
- `activeHazards` unchanged.
- `getLiveHazardIncidents()` unchanged.
- `unifiedRoadIncidents` unchanged.
- `activeUnifiedIncidents` unchanged.
- Alerts unchanged.
- Awareness unchanged.
- Markers unchanged.
- Route Watch unchanged.
- DriveTexas not modified.

## Explicit non-approvals
V421 does not approve or implement:
- Automatic canary startup.
- Default capture enablement.
- Default writer enablement.
- Automatic historical writes outside manual canary conditions.
- Historical reads.
- History UI.
- Supabase schema changes.
- SQL migrations.
- Destructive SQL.
- Protected-system behavior changes.
- DriveTexas implementation work.

## Testing performed
- `git status --short`
- `git diff --check`
- `node --check js/history-capture/historyCaptureWriter.js`
- `node --check tests/history-capture/historyCaptureWriter.test.js`
- `node --check tests/history-capture/historyCaptureCanaryControlsStatic.test.js`
- `node --check tests/history-capture/historyCaptureFlags.test.js`
- `node tests/history-capture/historyCaptureWriter.test.js`
- `node tests/history-capture/historyCaptureCanaryControlsStatic.test.js`
- Relevant history-capture suite: `for test_file in tests/history-capture/*.test.js; do node "$test_file"; done`

## Runtime validation steps
After deploy, validate manually in the browser console:

1. Confirm diagnostics are available:
   ```js
   window.gridlyHistoricalWriterDiagnostic?.()
   ```
2. Confirm canary is ready:
   ```js
   window.gridlyHistoricalCanaryAudit?.()
   ```
3. Start canary manually:
   ```js
   window.gridlyStartHistoricalCanary?.()
   ```
4. Create exactly one normal report.
5. Inspect status and diagnostics:
   ```js
   window.gridlyHistoricalCanaryStatus?.()
   window.gridlyHistoricalWriterDiagnostic?.()
   ```

Expected fixed result:
- `eventsObserved: 1`
- `eventsWritten: 1`
- `writerErrors: 0`
- `protectedSystemsUnchanged: true`

If still failing:
- Canary auto-stops.
- `writerDiagnostic` contains the exact new error.

## Recommended next milestone
After deployment, run the single-report manual canary validation above and capture the canary status plus writer diagnostic output. If the write succeeds, proceed to a small evidence review milestone before expanding any canary volume. If it fails, use the preserved exact diagnostic to address Supabase schema exposure or permission issues without changing protected systems.
