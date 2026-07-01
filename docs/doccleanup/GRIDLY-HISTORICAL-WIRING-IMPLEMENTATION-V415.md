# Gridly Historical Wiring Implementation V415

## Summary
V415 implements the minimum dormant runtime wiring for the passive historical capture stack. The sidecar scripts now load in the production page, the existing historical writer can receive the existing Supabase storage client only through the passive capture runtime path, and a read-only wiring audit helper reports readiness without enabling capture, enabling writes, reading history, showing history UI, or mutating production state.

Gridly remains Awareness Platform First, Route Intelligence Second. This milestone does not alter live awareness, alerts, markers, Route Watch, report loading, or historical storage schema.

## Files changed
- `index.html` — loads the existing historical capture sidecar scripts before `js/app.js` so the production runtime can see the dormant stack.
- `js/history-capture/historyCapturePhase1A.js` — forwards a provided storage client and explicit `writerEnabled` option to the writer when the capture path is activated in a future milestone.
- `js/app.js` — exposes a read-only storage-client resolver, passes the existing Supabase client into the dormant capture path with `writerEnabled: false`, and adds `window.gridlyHistoricalCaptureWiringAudit?.()`.
- `GRIDLY-HISTORICAL-WIRING-IMPLEMENTATION-V415.md` — records this implementation and validation plan.

## Runtime wiring implemented
- Production HTML now loads:
  - `js/history-capture/historyCaptureFlags.js`
  - `js/history-capture/historyCaptureEnvelope.js`
  - `js/history-capture/historyCaptureIdempotency.js`
  - `js/history-capture/historyCaptureMonitoring.js`
  - `js/history-capture/historyCaptureWriter.js`
  - `js/history-capture/historyCapturePhase1A.js`
- The runtime storage client resolver returns the existing initialized Supabase client only when it is already available and has the expected `.from()` interface.
- The passive capture hook wrapper supplies that storage client to the sidecar event input while forcing `writerEnabled: false`.
- The Phase 1A sidecar passes `storageClient` and `writerEnabled` through to the writer options.

## Dormant defaults confirmed
- Capture remains disabled by default because `historyCaptureFlags.js` returns `captureEnabled: false`.
- Writer remains disabled by default because the app wrapper passes `writerEnabled: false`, and the writer still requires `options.writerEnabled === true` before attempting any insert.
- Historical reads remain disabled because the flag snapshot reports `historicalReadsExposed: false` and no read path was added.
- History UI remains disabled because the flag snapshot reports `uiExposed: false` and no UI was added.
- No historical writes occur while disabled because the Phase 1A capture sidecar exits before writer invocation unless capture is explicitly enabled.

## Audit helper details
`window.gridlyHistoricalCaptureWiringAudit?.()` is read-only and reports:
- `available`
- `sidecarsLoaded`
- `captureEnabled`
- `writerEnabled`
- `historicalReadsEnabled`
- `historyUiEnabled`
- `storageClientAvailable`
- `writerAvailable`
- `monitoringAvailable`
- `canWriteIfEnabled`
- `currentlyDormant`
- `writesBlockedByDefault`
- `protectedSystemsUnchanged`
- `blockers`
- `safeForCanaryActivation`

The audit does not write data, enable capture, enable the writer, read historical tables, expose UI, or record monitoring/audit counters.

## Protected-system review
V415 intentionally avoids changing the protected systems listed in the milestone. The only runtime app change is isolated to the existing passive historical capture wrapper and a read-only wiring audit helper. The following remain behaviorally unchanged:
- `loadSharedReports()`
- `activeHazards`
- `getLiveHazardIncidents()`
- `unifiedRoadIncidents`
- `activeUnifiedIncidents`
- alerts
- awareness
- markers
- Route Watch

## Explicit non-approvals
V415 does not approve or implement:
- capture activation
- writer activation
- historical writes
- historical reads
- history UI
- schema changes
- SQL execution
- backfills
- protected-system behavior changes
- new frameworks or rewrites

## Testing performed
- `git status --short`
- `git diff --check`
- `node --check js/app.js`
- `node --check js/history-capture/historyCapturePhase1A.js`
- `cat package.json` to confirm no package scripts were available; no package-script test command was run

## Post-implementation validation
Open the app after Supabase live sync initializes and run:

```js
window.gridlyHistoricalCaptureWiringAudit?.()
```

Expected result:
- `available: true`
- `sidecarsLoaded: true`
- `captureEnabled: false`
- `writerEnabled: false`
- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `storageClientAvailable: true`
- `writerAvailable: true`
- `monitoringAvailable: true`
- `currentlyDormant: true`
- `writesBlockedByDefault: true`
- `safeForCanaryActivation: true`, unless Supabase initialization fails and `historical_capture_storage_client_unavailable` appears as a real blocker

## Recommended next milestone
V416 should be validation-only: open the deployed app, run the wiring audit, verify the dormant stack is available with no historical writes or reads, and capture evidence that protected live behavior remains unchanged before any future canary activation planning.
