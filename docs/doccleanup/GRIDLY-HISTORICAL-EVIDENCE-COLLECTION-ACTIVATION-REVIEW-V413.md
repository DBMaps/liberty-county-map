# Gridly Historical Evidence Collection Activation Review V413

Date: 2026-06-17

## Mission Boundary

Gridly remains **Awareness Platform First, Route Intelligence Second**.

DriveTexas remains designed, validated, governed, and paused. V413 does not modify or restart DriveTexas work.

V413 is a review/planning milestone for historical evidence collection activation only. It does not enable capture, enable the writer, add historical reads, add history UI, change awareness behavior, change alerts behavior, change markers, change Route Watch, change DriveTexas, alter Supabase production data, or run SQL.

## Current State

| Area | V413 finding |
| --- | --- |
| Production schema | Known production state says `history_capture` exists with `history_capture.historical_events`, `history_capture.writer_monitoring_events`, and `history_capture.retention_runs`. V413 did not query or mutate production. |
| Local schema artifact | The forward artifact creates the three expected tables and RLS-enables them. |
| Historical hooks | Installed for Phase 1A crossing and road-hazard create/clear events. |
| Historical writer | Implemented as an isolated fail-open sidecar writer. |
| Historical monitoring | Implemented as in-memory maintainer-only sidecar counters. The app code does not currently insert monitoring rows into `history_capture.writer_monitoring_events`. |
| Rollback | Rollback SQL artifact exists for dropping the V410 `history_capture` objects, but V413 does not execute it. |
| Capture | Off by default: `captureEnabled: false`. |
| Writer | Off by default in flags and also requires explicit per-call `writerEnabled: true` options inside the writer. Existing hook calls do not pass those options. |
| Historical reads | Disabled/not exposed: `historicalReadsExposed: false`; no history read path is approved. |
| History UI | Disabled/not exposed: `uiExposed: false`; no history UI is approved. |
| Historical writes expected now | None. Capture is off; writer enablement is not wired through current hook calls. |

## Flag Inventory

### Exact values currently present

The current sidecar flag module returns these default values:

| Control | Code value | Current effect |
| --- | --- | --- |
| Capture enablement | `captureEnabled: false` | `capturePhase1AEvent()` exits as a no-op before building/writing an envelope. |
| Writer enablement, flag layer | `writesEnabled: false` | Audit reports writer disabled by default. This value is not currently passed into `writePhase1AEnvelope()`. |
| Production hooks installed flag | `productionHooksInstalled: false` | Informational/default flag only; `auditSidecar()` separately reports `hooksInstalled: true`. |
| Historical reads | `historicalReadsExposed: false` | Audit reports no historical reads exposed. |
| History UI | `uiExposed: false` | Audit reports no UI exposed. |

### Important writer-specific gate

The writer has an additional exact runtime gate: `writePhase1AEnvelope(envelope, options)` only writes when `options.writerEnabled === true`. If that option is missing or false, it records a writer-disabled no-op and returns without storage insertion.

### Activation implication

Turning only `captureEnabled` to true is insufficient for database writes because the current `capturePhase1AEvent()` call into the writer passes only `{ idempotencyKey, hook }` and does not pass `writerEnabled: true` or a storage client. Therefore a future V414 activation cannot be a pure flag flip unless V414 also safely supplies the writer options outside protected production behavior. This is the main follow-up item.

## Writer Path Review

### What wakes up if `captureEnabled` is turned on

When a production hook calls `gridlyTryPassiveHistoryCapturePhase1A(eventInput)`, the helper looks for `window.gridlyPassiveHistoryCapturePhase1A.capturePhase1AEvent()` and invokes it fail-open without awaiting it.

If `captureEnabled` becomes true, `capturePhase1AEvent()` proceeds past the disabled-capture no-op and then:

1. Normalizes the event input.
2. Checks the event type against Phase 1A supported types.
3. Builds a `history_capture.phase_1a.v1` envelope.
4. Creates an idempotency key.
5. Calls `gridlyPassiveHistoryCaptureWriter.writePhase1AEnvelope(envelope, { idempotencyKey, hook })`.

With current code, that writer call still no-ops because it does not receive `writerEnabled: true`.

### What wakes up if `writerEnabled` is also supplied to the writer

If a future authorized activation supplies both a storage client and `writerEnabled: true` to `writePhase1AEnvelope()`, the writer path will:

1. Record a `capture_attempt` monitoring event in the in-memory sidecar monitor.
2. Validate the envelope shape, schema version, phase, supported event type, observed timestamp, and report object.
3. Resolve or compute an idempotency key.
4. Suppress same-runtime duplicate idempotency keys using an in-memory `Set`.
5. Insert one row into `history_capture.historical_events`.
6. Record in-memory success/failure/duplicate/malformed/writer-disabled monitoring counters.
7. Fail open on storage or validation errors by returning an `ok: true`, no-op result to avoid altering production reporting behavior.

### Current eligible event types

Only Phase 1A event types are eligible:

- `report_created`
- `report_cleared`

Installed Phase 1A hooks are:

- `crossing.report_created`
- `crossing.report_cleared`
- `road_hazard.report_created`
- `road_hazard.report_cleared`

No incident transition, report update, alert, awareness, marker, Route Watch, DriveTexas, UI, or historical-read events are eligible in V413.

## Data Written Review

### `history_capture.historical_events`

If future V414 safely supplies all writer gates, the writer inserts rows with:

| Column | Source |
| --- | --- |
| `schema_version` | Envelope `schemaVersion`, currently `history_capture.phase_1a.v1`. |
| `phase` | Envelope `phase`, currently `1A`. |
| `event_type` | Envelope `eventType`, one of `report_created` or `report_cleared`. |
| `source_kind` | `envelope.report.reportType` when present, else `null`. |
| `source_report_id` | `envelope.report.id`, `reportId`, or `uuid` when present, else `null`. |
| `idempotency_key` | Deterministic Phase 1A key created from schema version, event type, observed time, report id/type, and fallback report content. |
| `observed_at` | Envelope `observedAt`. |
| `received_at` | Database default `now()`. |
| `hook_name` | Hook option such as `crossing.report_created` or `road_hazard.report_cleared`. |
| `envelope` | Full envelope JSON. |
| `payload` | Envelope report snapshot. |
| `metadata` | Envelope metadata, currently `passive: true`, `writesDisabled: true`, and `runtimeIntegrated: false`. |
| `retained_until` | Database default `now() + interval '18 months'`. |

### `history_capture.writer_monitoring_events`

The local schema artifact defines this table for maintainer-only diagnostics with:

- `id`
- `event_type`
- `reason`
- `idempotency_key`
- `created_at`
- `detail`

However, current JavaScript monitoring is in-memory only. There is no current app insert path to `history_capture.writer_monitoring_events`. After activation, monitoring evidence should therefore be collected from the in-memory sidecar audit/counters unless a separate future milestone explicitly implements database monitoring writes.

## Monitoring Review

Current in-memory monitoring exposes:

- `sidecarAvailable`
- `maintainerOnly`
- `auditRequestedCount`
- `lastAuditAt`
- `captureAttemptCount`
- `disabledCaptureCount`
- `malformedPayloadCount`
- `duplicateSuppressionCount`
- `writeFailureCount`
- `writerDisabledCount`
- `sidecarFailureCount`
- `writeSuccessCount`
- `lastEventType`
- `lastEventAt`

### Monitoring evidence to check after future activation

After a future V414 activation, maintainers should check:

1. Sidecar audit still reports no historical reads and no UI exposed.
2. Capture attempts increase only after approved create/clear report flows.
3. Write successes increase only when both capture and writer are intentionally enabled.
4. Writer-disabled count is zero during a fully enabled test, or expected during staged capture-only testing.
5. Malformed payload count remains zero.
6. Write failure count remains zero or is immediately investigated.
7. Sidecar failure count remains zero.
8. Duplicate suppression appears only for intentionally duplicated same-runtime test inputs.
9. `history_capture.historical_events` row count increases by the expected number of test events.
10. `history_capture.writer_monitoring_events` should remain unchanged unless a future approved database monitoring writer exists.
11. Alerts, awareness, markers, Route Watch, live incidents, and DriveTexas show no behavior/count changes attributable to historical capture.

## Protected-System Impact Review

V413 makes no runtime change. Based on the current code paths:

| Protected system | Impact finding |
| --- | --- |
| `loadSharedReports()` | No historical read dependency or historical write dependency is introduced by V413. |
| `activeHazards` | Existing road-hazard report flow calls the passive sidecar after local report creation/clear evidence is available; capture remains fail-open and disabled. |
| `getLiveHazardIncidents()` | Not part of the capture writer path. |
| `unifiedRoadIncidents` | Not read from or written to by the history sidecar. |
| `activeUnifiedIncidents` | Not read from or written to by the history sidecar. |
| Alerts | No alert behavior is controlled by capture success/failure. |
| Awareness | No awareness behavior is controlled by capture success/failure. |
| Markers | No marker behavior is controlled by capture success/failure. |
| Route Watch | No Route Watch behavior is controlled by capture success/failure. |
| DriveTexas | No DriveTexas code is modified or restarted; DriveTexas remains paused. |

## Safest Activation Sequence for Future V414

V414 should be narrowly scoped and reversible:

1. **Preflight static checks**
   - Confirm no DriveTexas changes.
   - Confirm no history UI/read code is present.
   - Confirm only `report_created` and `report_cleared` are eligible.
   - Confirm no changes to alerts, awareness, markers, Route Watch, or live incident authority.

2. **Preflight runtime audit with all gates off**
   - Run `gridlyPassiveHistoryCaptureSidecarAudit()`.
   - Confirm `gatesDefaultDisabled === true`, `writesDisabled === true`, `noHistoricalReadsExposed === true`, and `noUiExposed === true`.

3. **Capture-only canary if supported safely**
   - Enable capture only in the approved activation mechanism.
   - Keep writer disabled.
   - Submit one approved test event.
   - Confirm `captureAttemptCount` and `writerDisabledCount` reflect the canary and no database row is written.
   - Confirm production behavior is unchanged.

4. **Writer canary**
   - Supply the writer with explicit `writerEnabled: true` and the approved storage client through an isolated sidecar activation path.
   - Submit one crossing event and one road-hazard event in the approved environment.
   - Confirm exactly expected `historical_events` inserts.
   - Confirm no historical reads/UI appear.

5. **Short observation window**
   - Keep the activation limited.
   - Monitor write failures, malformed payloads, sidecar failures, duplicate suppression, row count, and production parity.

6. **Proceed/hold decision**
   - Proceed only if monitoring is clean and protected-system parity is unchanged.
   - Hold or roll back immediately on unexpected writes, failures, production behavior changes, or protected-system drift.

## Fastest Rollback Sequence

Fast rollback must prefer runtime disablement before schema changes:

1. Disable writer first so no more `historical_events` inserts are possible.
2. Disable capture so envelopes and writer calls stop.
3. Verify via sidecar audit that capture/writer are disabled and no reads/UI are exposed.
4. Verify no new `history_capture.historical_events` rows arrive after the disable timestamp.
5. Leave the schema in place unless there is a separate approved data/schema incident response.
6. If a severe schema-level issue exists and explicit approval is granted, use the existing rollback artifact only after export/backup and production impact review.
7. Do not use rollback to alter alerts, awareness, markers, Route Watch, DriveTexas, or live incident authority.

## Beta Purge/Reset Strategy Before Beta Launch

Before beta launch, historical evidence collected during canary/internal activation should be treated as disposable unless explicitly approved for retention.

Recommended strategy:

1. Freeze capture and writer by disabling writer, then disabling capture.
2. Export count and timestamp evidence for audit records.
3. Decide whether beta should start with an empty `history_capture.historical_events` table or a clearly tagged internal-canary partition/set.
4. Preferred beta reset: purge only pre-beta historical evidence rows by an approved timestamp/idempotency-key window, not by broad unreviewed destructive SQL.
5. Preserve schema and indexes unless a separate schema rollback is approved.
6. Record before/after counts for `historical_events`, `writer_monitoring_events`, and `retention_runs`.
7. Re-run disabled-state audit after purge.
8. Do not purge or modify `public.reports`, alerts, awareness, markers, Route Watch data, DriveTexas artifacts, or any production incident authority.

Because V413 is documentation-only, it does not execute or provide destructive SQL. A future beta purge milestone must include exact SQL, target environment confirmation, backup/export evidence, row-count evidence, and approval.

## Tests and Audits Before and After V414 Activation

### Before V414

- `git status --short`
- `git diff --check`
- `node --check js/app.js`
- `for f in js/history-capture/*.js; do node --check "$f"; done`
- `for f in tests/history-capture/*.test.js; do node "$f"; done`
- `rg -n "captureEnabled:\\s*true|writerEnabled:\\s*true|writesEnabled\\s*=\\s*true" js/app.js js/history-capture tests/history-capture`
- `rg -n "history_capture\\.historical_events|history_capture\\.writer_monitoring_events|select\\(" js/app.js js/history-capture tests/history-capture supabase/migrations`
- Browser console audit: `gridlyPassiveHistoryCaptureSidecarAudit()`.
- Browser console audit: `gridlyPassiveHistoryCaptureMonitoring.getHistoryCaptureMonitoringState()`.
- Protected-system parity audit for alerts, awareness, markers, Route Watch, active hazards, unified incidents, and DriveTexas paused state.

### After V414

- Repeat all static checks.
- Confirm expected `historical_events` inserts for canary events only.
- Confirm no unexpected rows in `writer_monitoring_events` unless a DB monitoring writer is separately approved.
- Confirm monitoring counters match expected attempts/successes/failures.
- Confirm malformed, write-failure, and sidecar-failure counters remain zero.
- Confirm duplicate suppression only occurs in intentional duplicate tests.
- Confirm no historical reads or UI are exposed.
- Confirm no production behavior changes in awareness, alerts, markers, Route Watch, live incident collections, or DriveTexas.

## Exact Recommended V414 Scope

Recommended V414 scope is **controlled activation preparation plus a tiny canary only if the missing writer-option wiring is explicitly and safely resolved**.

V414 should include only:

1. A narrowly scoped activation mechanism for `captureEnabled` that remains disabled by default.
2. A narrowly scoped activation mechanism that passes `writerEnabled: true` and an approved storage client to the writer without modifying protected production behavior.
3. Canary-only activation for Phase 1A `report_created` and `report_cleared` events.
4. Monitoring/audit evidence collection.
5. Immediate rollback verification.
6. Documentation of exact rows written and exact protected-system parity results.

V414 should not include historical reads, history UI, new event classes, incident transition capture, report update capture, retention jobs, beta purge execution, DriveTexas work, Route Watch changes, marker changes, alert changes, awareness changes, or live incident authority changes.

## Explicit Non-Approvals

V413 does **not** approve:

- Capture activation.
- Writer activation.
- Historical reads.
- History UI.
- Historical data display.
- New event types beyond Phase 1A `report_created` and `report_cleared`.
- Retention job execution.
- Beta purge execution.
- Destructive SQL.
- Supabase production data mutation.
- Changes to `loadSharedReports()`.
- Changes to `activeHazards` authority.
- Changes to `getLiveHazardIncidents()`.
- Changes to `unifiedRoadIncidents` or `activeUnifiedIncidents` authority.
- Changes to alerts, awareness, or markers.
- Changes to Route Watch.
- DriveTexas restart, polling, display, alerting, awareness, routing, or activation.
- Major rewrites or new frameworks.

## Final Recommendation

**Final recommendation: needs follow-up before V414 activation.**

V414 appears conceptually safe only if it remains Phase 1A-only, canary-limited, disabled by default, fail-open, and isolated from protected systems. However, activation is not yet a simple safe flag flip because the current writer requires explicit `options.writerEnabled === true` and a storage client, while the current `capturePhase1AEvent()` writer call does not pass either. V414 should first define and review that minimal activation wiring before enabling production evidence collection.

If that follow-up is resolved with no protected-system impact, the safest V414 can proceed as a small canary activation. Until then, full activation is **blocked by missing explicit writer activation/storage-client wiring**, not by schema presence.
