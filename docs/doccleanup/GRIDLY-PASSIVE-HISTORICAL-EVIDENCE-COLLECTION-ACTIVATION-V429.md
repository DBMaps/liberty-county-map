# V429 — Passive Historical Evidence Collection Activation

## Quick Summary

V429 moves Phase 1A historical capture from validated canary mode into passive evidence collection mode for normal production operation. Capture and writer flags are enabled for the existing `report_created` and `report_cleared` event classes only. Historical evidence continues to target `history_capture.historical_events` through the existing sidecar writer.

No historical reads, historical UI, historical intelligence, dashboards, APIs, summaries, recurrence analysis, peak-time analysis, trend analysis, monitoring access, retention access, Route Watch changes, DriveTexas work, alert changes, awareness changes, hazard lifecycle changes, Shared Reports changes, or Supabase Sync changes are introduced.

## Exact Files Changed

- `js/history-capture/historyCaptureFlags.js` — changes the default sidecar state from canary-only disabled flags to passive evidence collection flags: `captureEnabled: true`, `writesEnabled: true`, `productionHooksInstalled: true`, `passiveEvidenceCollectionMode: true`, with historical reads and UI still false.
- `js/history-capture/historyCapturePhase1A.js` — allows the writer to run from the enabled passive writer flag, preserves the Phase 1A event allowlist, and updates audit output to report passive collection activation state.
- `js/app.js` — removes the canary-only writer dependency from the passive capture call path, adds passive collection readiness/status reporting, keeps canary runtime dormant, and reports validation fields required for activation review.
- `tests/history-capture/historyCaptureFlags.test.js` — updates flag assertions for passive evidence collection mode.
- `tests/history-capture/historyCapturePhase1A.test.js` — validates successful passive write activation against a schema-scoped fake `history_capture.historical_events` storage target.
- `tests/history-capture/historyCaptureCanaryControlsStatic.test.js` — verifies the writer follows passive collection flags instead of canary-only activation while the canary still does not auto-start.

## Activation Mechanism

The activation mechanism is intentionally narrow:

1. `gridlyPassiveHistoryCaptureFlags.getHistoryCaptureFlags()` now returns passive collection defaults with capture and writing enabled.
2. `gridlyTryPassiveHistoryCapturePhase1A()` continues to run only after existing production report success paths have completed and passes the normal passive writer flag into the sidecar.
3. `capturePhase1AEvent()` still rejects unsupported event types and only builds/writes envelopes for `report_created` and `report_cleared`.
4. `writePhase1AEnvelope()` continues using the existing insert-only writer path and schema-scoped storage access for `history_capture.historical_events`.
5. `gridlyHistoricalPassiveCollectionStatus()` provides maintainer validation fields without adding historical reads or UI.

## Validation Results

Static and unit validation confirm:

- `captureEnabled: true`
- `writerEnabled: true`
- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `protectedSystemsUnchanged: true`
- `eventsObserved` is exposed from sidecar monitoring capture-attempt counts.
- `eventsWritten` is exposed from writer success counts.
- `writerErrors` is exposed from writer failure counts.
- Test write validation produced a successful schema-scoped insert attempt with `noop: false` and `reason: passive_history_capture_write_accepted`.

## Protected-System Review

V429 does not modify the protected production systems listed below:

- Shared Reports behavior remains the same; the passive hook still runs after successful existing report persistence.
- Route Watch remains unchanged and does not read, depend on, or display historical data.
- Awareness Filtering remains unchanged.
- Hazard Lifecycle remains unchanged.
- Alert Generation remains unchanged.
- Supabase Sync remains unchanged except for the already-isolated historical writer sidecar targeting `history_capture.historical_events`.
- DriveTexas remains designed, validated, governed, and paused.

## Risk Assessment

Risk is acceptable for this first operational activation phase because the change only enables evidence accumulation through the existing isolated writer path. Historical capture remains fail-open and non-authoritative. Historical reads and UI remain disabled. The supported event surface is still restricted to `report_created` and `report_cleared`.

Primary operational risk is production writer/storage availability. That risk is mitigated by fail-open behavior, writer error counting, diagnostic preservation, and the absence of any dependency from consumer report success to historical write success.

## Merge Recommendation

Merge V429 as the first passive evidence collection activation milestone. The activation begins accumulating a meaningful production historical dataset while preserving Gridly as an Awareness Platform First product and leaving Route Intelligence second, dormant, and non-expanded.
