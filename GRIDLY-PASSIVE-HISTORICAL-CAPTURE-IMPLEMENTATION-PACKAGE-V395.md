# V395 — Passive Historical Capture Implementation Package

## 1. Executive Summary

V395 creates the concrete implementation package for Phase 1A passive historical evidence capture. This package is documentation-only and prepares a later implementation review; it does not implement capture, activate capture, add storage writes, add reads, add UI, modify SQL, run migrations, or change production behavior.

The Phase 1A implementation package is limited to two post-success report provenance observations:

- `report_created`
- `report_cleared`

The governing implementation principle remains:

> Capture Everything. Show Nothing. Depend On Nothing.

Any future implementation must be additive, sidecar-based, disabled by default, fail-open, non-authoritative, maintainer-only, and reversible without changing live production correctness.

Protected systems remain out of scope and must not become dependent on capture:

- `loadSharedReports()`
- `activeHazards`
- `getLiveHazardIncidents()`
- `unifiedRoadIncidents`
- `activeUnifiedIncidents`
- alerts
- awareness
- markers
- Route Watch
- DriveTexas

## 2. Phase 1A Implementation Scope

### Included in Phase 1A

Phase 1A may prepare a future additive sidecar implementation for only:

1. `report_created`
   - A passive observation emitted only after a report insert succeeds.
   - It must represent report provenance, not live report authority.
2. `report_cleared`
   - A passive observation emitted only after a cleared-report insert succeeds.
   - It must represent clear provenance, not lifecycle authority.

### Excluded from Phase 1A

Phase 1A must exclude:

- `report_updated`
- `incident_transitioned`
- `incident_closed`
- historical reads
- history UI
- production activation
- migration execution
- migration application
- Supabase deployment
- SQL changes
- production behavior changes
- changes to alerts
- changes to awareness
- changes to markers
- changes to Route Watch
- changes to DriveTexas

### Phase 1A Implementation Boundary

The future implementation must observe completed report actions after production success. It must not decide whether report submission succeeds, whether a clear succeeds, whether incidents are active or cleared, whether alerts fire, whether awareness changes, whether markers render, or whether Route Watch considers a hazard relevant.

## 3. Exact Proposed File List

The following files are proposed for a future implementation milestone. V395 defines them only and does not create them.

### Proposed sidecar module file(s)

- `js/history-capture/historyCaptureFlags.js`
  - Owns disabled-by-default flag evaluation, precedence, source-level gates, write gates, emergency disablement, and environment allowlisting.
- `js/history-capture/historyCaptureEnvelope.js`
  - Owns Phase 1A event envelope construction, canonicalization, redaction, payload digest generation, and schema-version stamping.
- `js/history-capture/historyCaptureIdempotency.js`
  - Owns idempotency key construction, duplicate classification, and duplicate-safe result normalization.
- `js/history-capture/historyCaptureWriter.js`
  - Owns fail-open write adapter boundaries, timeout handling, duplicate handling, credential-unavailable handling, and maintainer-only writer diagnostics.
- `js/history-capture/historyCaptureMonitoring.js`
  - Owns maintainer-only monitoring signals, counters, redaction, and local diagnostic snapshots.
- `js/history-capture/historyCapturePhase1A.js`
  - Owns the public Phase 1A sidecar orchestration API used by future post-success hooks.

### Proposed test file(s)

- `tests/history-capture/historyCaptureFlags.test.js`
- `tests/history-capture/historyCaptureEnvelope.phase1a.test.js`
- `tests/history-capture/historyCaptureIdempotency.test.js`
- `tests/history-capture/historyCaptureWriter.failOpen.test.js`
- `tests/history-capture/historyCapturePhase1A.hooks.test.js`
- `tests/history-capture/historyCaptureProtectedSystemsParity.test.js`

### Proposed fixture file(s)

- `tests/fixtures/history-capture/report-created-crossing.fixture.json`
- `tests/fixtures/history-capture/report-created-road-hazard.fixture.json`
- `tests/fixtures/history-capture/report-cleared-crossing.fixture.json`
- `tests/fixtures/history-capture/report-cleared-road-hazard.fixture.json`
- `tests/fixtures/history-capture/history-capture-flags-disabled.fixture.json`
- `tests/fixtures/history-capture/history-capture-flags-enabled-nonprod.fixture.json`
- `tests/fixtures/history-capture/history-capture-duplicate-event.fixture.json`
- `tests/fixtures/history-capture/history-capture-malformed-event.fixture.json`

### Proposed documentation/runbook file(s)

- `docs/history-capture/PHASE-1A-HISTORY-CAPTURE-RUNBOOK.md`
- `docs/history-capture/PHASE-1A-HISTORY-CAPTURE-ROLLBACK.md`
- `docs/history-capture/PHASE-1A-HISTORY-CAPTURE-ACCEPTANCE-EVIDENCE.md`
- `docs/history-capture/PHASE-1A-HISTORY-CAPTURE-PRIVACY-FIELD-MATRIX.md`

## 4. Exact Proposed Exports

The future implementation should expose only sidecar APIs. No protected production system should import history state or depend on history outcomes.

### `js/history-capture/historyCaptureFlags.js`

- `evaluateHistoryCaptureGates(context = {})`
- `getHistoryCaptureFlagSnapshot(context = {})`
- `isHistoryCaptureEmergencyDisabled(context = {})`
- `resolveHistoryCaptureEnvironment(context = {})`

### `js/history-capture/historyCaptureEnvelope.js`

- `buildHistoryCaptureEnvelope(eventType, sourceRecord, context = {})`
- `canonicalizeHistoryCapturePayload(payload = {})`
- `redactHistoryCapturePayload(payload = {})`
- `calculateHistoryCapturePayloadDigest(payload = {})`
- `validateHistoryCaptureEnvelope(envelope = {})`

### `js/history-capture/historyCaptureIdempotency.js`

- `buildHistoryCaptureIdempotencyKey(envelope = {})`
- `classifyHistoryCaptureDuplicate(candidate = {}, existing = {})`
- `normalizeHistoryCaptureDuplicateResult(result = {})`

### `js/history-capture/historyCaptureWriter.js`

- `writeHistoryCaptureEventFailOpen(envelope = {}, context = {})`
- `withHistoryCaptureTimeout(operation, timeoutMs, context = {})`
- `normalizeHistoryCaptureWriteResult(result = {})`
- `normalizeHistoryCaptureWriteError(error = {})`

### `js/history-capture/historyCaptureMonitoring.js`

- `recordHistoryCaptureMonitoringSignal(signal = {}, context = {})`
- `getHistoryCaptureMonitoringSnapshot(context = {})`
- `resetHistoryCaptureMonitoringSnapshotForTests()`

### `js/history-capture/historyCapturePhase1A.js`

- `captureReportCreatedFailOpen(sourceRecord = {}, context = {})`
- `captureReportClearedFailOpen(sourceRecord = {}, context = {})`
- `capturePhase1AReportEventFailOpen(eventType, sourceRecord = {}, context = {})`

## 5. Exact Proposed Hook Candidates

The future hooks must be post-success only. They must be added only in a later implementation milestone and must not be added by V395.

### Hook candidate A — crossing `report_created`

- **File:** `js/app.js`
- **Owning function:** `createSharedReport(crossing, reportType, confidence, buttonEl = null)`
- **Success boundary:** immediately after `gridlyInsertWithCountyMetadataFallback(supabaseClient, "reports", row)` returns with no `error`, after `if (error) throw error;`, and before UI success lifecycle work.
- **Event mapping:** if `reportType` is not `cleared`, call future `captureReportCreatedFailOpen()` with a copy of the inserted row plus the locally generated created timestamp.
- **Why hook is safe:** the production insert has already succeeded; the capture result is not used to decide report success, local report normalization, UI confirmation, marker rendering, alerts, awareness, Route Watch, or DriveTexas.
- **Why hook is fail-open:** the hook must call only a `FailOpen` API that catches and normalizes all gate, validation, timeout, writer, duplicate, credential, and monitoring failures into maintainer-only diagnostics.

### Hook candidate B — crossing `report_cleared`

- **File:** `js/app.js`
- **Owning function:** `createSharedReport(crossing, reportType, confidence, buttonEl = null)`
- **Success boundary:** the same post-insert, no-error boundary used for crossing reports.
- **Event mapping:** if `reportType` is `cleared`, call future `captureReportClearedFailOpen()` with a copy of the inserted row plus the locally generated created timestamp.
- **Why hook is safe:** it observes only a successful clear report row; it does not decide active/cleared live state or change the current latest-report rule.
- **Why hook is fail-open:** all capture work is isolated inside the sidecar call and must not throw into `createSharedReport()` or alter the existing success lifecycle.

### Hook candidate C — road-hazard `report_created`

- **File:** `js/app.js`
- **Owning function:** `createSharedHazardReport(hazardType, lat, lng, confidence, locationName = "", originalTapCoords = null, options = {})`
- **Success boundary:** immediately after `gridlyInsertWithCountyMetadataFallback(supabaseClient, "reports", row)` returns with no `error`, after `if (error) throw error;`, and before local hazard mutation and UI success lifecycle work.
- **Event mapping:** if `hazardType` is not `hazard_cleared` and does not otherwise normalize to a cleared report, call future `captureReportCreatedFailOpen()`.
- **Why hook is safe:** the report insert has already succeeded; capture does not decide duplicate guards, active hazard membership, marker rendering, awareness, Route Watch, or UI reset behavior.
- **Why hook is fail-open:** capture must be best-effort, timeout-bound, and exception-swallowing through `writeHistoryCaptureEventFailOpen()`.

### Hook candidate D — road-hazard `report_cleared`

- **File:** `js/app.js`
- **Owning function:** `createSharedHazardReport(hazardType, lat, lng, confidence, locationName = "", originalTapCoords = null, options = {})`
- **Success boundary:** the same post-insert, no-error boundary used for road-hazard reports.
- **Event mapping:** if `hazardType` is `hazard_cleared` or the future canonical classifier resolves the row as a clear, call future `captureReportClearedFailOpen()`.
- **Why hook is safe:** it captures only evidence of a successful clear report insert and does not decide whether existing active hazards are suppressed or transitioned.
- **Why hook is fail-open:** no capture exception, timeout, duplicate, or unavailable archive result may escape into the production submit path.

## 6. Feature Flag Package

### Exact proposed flags

- `GRIDLY_HISTORY_CAPTURE_EMERGENCY_DISABLED`
  - Default: `true`
  - Meaning: global hard stop; when true, no envelope is built and no write is attempted.
- `GRIDLY_HISTORY_CAPTURE_ENABLED`
  - Default: `false`
  - Meaning: global capture gate; must be explicitly true after emergency disable is false.
- `GRIDLY_HISTORY_CAPTURE_WRITE_ENABLED`
  - Default: `false`
  - Meaning: write gate; when false, gate evaluation may produce diagnostics but no archive write is attempted.
- `GRIDLY_HISTORY_CAPTURE_ENV_ALLOWLIST`
  - Default: empty list
  - Meaning: only listed non-production environments may attempt writes.
- `GRIDLY_HISTORY_CAPTURE_SOURCE_REPORT_CREATED_ENABLED`
  - Default: `false`
  - Meaning: source-level gate for `report_created`.
- `GRIDLY_HISTORY_CAPTURE_SOURCE_REPORT_CLEARED_ENABLED`
  - Default: `false`
  - Meaning: source-level gate for `report_cleared`.
- `GRIDLY_HISTORY_CAPTURE_TIMEOUT_MS`
  - Default: `750`
  - Meaning: maximum sidecar write/monitoring budget before fail-open timeout normalization.
- `GRIDLY_HISTORY_CAPTURE_MONITORING_ENABLED`
  - Default: `false`
  - Meaning: maintainer-only diagnostic signal emission; never user-visible.

### Precedence

Flags must be evaluated in this order:

1. Emergency disablement.
2. Environment allowlist.
3. Global capture enablement.
4. Source-level event enablement.
5. Write gate.
6. Monitoring gate.

Any missing, malformed, ambiguous, unsupported, or unrecognized value must resolve to the safest disabled state.

### Disabled behavior

When disabled, the future sidecar must:

- not build write-intended envelopes;
- not call Supabase history storage;
- not call migration-dependent objects;
- not perform historical reads;
- not alter production control flow;
- return a normalized skipped result such as `disabled_by_gate`;
- optionally record maintainer-only local diagnostics only when monitoring is separately enabled and safe.

## 7. Event Envelope Package

### Common Phase 1A envelope fields

Each future envelope must contain:

- `schema_version`: exact string, proposed initial value `history_capture.phase1a.v1`.
- `event_type`: `report_created` or `report_cleared`.
- `capture_mode`: `passive_fail_open`.
- `source_system`: `gridly_web_app`.
- `source_operation`: owning operation name such as `createSharedReport` or `createSharedHazardReport`.
- `source_table`: `reports`.
- `source_record_id`: copied from `crossing_id` or future approved report primary key when available.
- `report_id`: approved report identifier when available; otherwise `null`.
- `incident_id`: `null` for Phase 1A unless a preexisting approved incident identifier exists in the source record.
- `report_type`: canonical report type.
- `report_status`: `created` or `cleared`.
- `county_id`: approved county value when available.
- `location_ref`: redacted location reference object containing approved `crossing_id`, `crossing_name`, road name, and/or coarse coordinate fields only.
- `event_occurred_at`: production report timestamp when available.
- `captured_at`: sidecar capture timestamp.
- `environment`: resolved environment string.
- `feature_gate_snapshot`: redacted gate state.
- `idempotency_key`: value from the idempotency package.
- `payload_digest`: canonical digest over the approved redacted payload.
- `source_payload_redacted`: approved minimal source fields only.
- `diagnostic_context`: redacted maintainer-only context.

### `report_created` envelope

`report_created` must describe a successful non-clear report insert. It must not imply that a live incident is active, alert-worthy, route-relevant, or visible.

Required `source_payload_redacted` fields:

- `crossing_id` or approved road-hazard synthetic identifier
- `crossing_name` or approved road/location label
- `report_type`
- `severity`
- `source`
- `confidence`
- `county_id`
- `expires_at`
- approved coarse `lat`/`lng` or approved location reference after privacy review

### `report_cleared` envelope

`report_cleared` must describe a successful clear report insert. It must not imply incident closure, lifecycle transition, alert clearance, marker removal, awareness suppression, or Route Watch recomputation.

Required `source_payload_redacted` fields:

- `crossing_id` or approved road-hazard synthetic identifier
- `crossing_name` or approved road/location label
- canonical clear type: `cleared` or `hazard_cleared`
- `severity`
- `source`
- `confidence`
- `county_id`
- `expires_at`
- approved coarse `lat`/`lng` or approved location reference after privacy review

## 8. Idempotency Package

### Exact key format

The proposed idempotency key format is:

```text
history_capture:v1:{environment}:{event_type}:{source_system}:{source_operation}:{source_table}:{source_record_id}:{event_occurred_at}:{payload_digest}
```

Rules:

- All key components must be canonicalized with trim, lowercase where safe, stable ISO timestamps, and explicit `unknown` placeholders only when approved.
- `payload_digest` must be calculated from the redacted canonical payload, not raw unreviewed production objects.
- If `source_record_id` is missing, the event must be classified as `invalid_missing_source_record_id` and must fail open without writing unless a future review approves a fallback.
- If `event_occurred_at` is missing, `captured_at` may not silently replace it in the key without explicit test coverage and review approval.

### Duplicate handling

Duplicate writes must be treated as successful no-ops for production purposes:

- exact duplicate key + exact digest: return `duplicate_ignored`;
- exact duplicate key + different digest: return `duplicate_digest_mismatch_fail_open` and emit maintainer-only warning;
- writer unique-constraint duplicate: normalize to `duplicate_ignored`;
- duplicate classification failure: normalize to `duplicate_classification_failed_open`.

No duplicate outcome may throw into report submission or change user-visible behavior.

## 9. Validation Package

The future implementation milestone must provide all of the following evidence.

### Required audits

- Protected-system non-impact audit for:
  - `loadSharedReports()`
  - `activeHazards`
  - `getLiveHazardIncidents()`
  - `unifiedRoadIncidents`
  - `activeUnifiedIncidents`
  - alerts
  - awareness
  - markers
  - Route Watch
  - DriveTexas
- Static audit proving no historical reads were added.
- Static audit proving no SQL was modified.
- Static audit proving no migration was executed or applied.
- Static audit proving `js/app.js`, `index.html`, and `css/styles.css` are unchanged unless a later implementation milestone explicitly authorizes specific app hook edits.

### Required tests

- Flags default disabled.
- Emergency disabled takes precedence over all other flags.
- Environment not allowlisted prevents writes.
- Source-level disabled prevents writes for each event.
- Write gate disabled prevents archive writes while preserving normalized skip diagnostics.
- `report_created` envelope includes only approved fields.
- `report_cleared` envelope includes only approved fields.
- Payload canonicalization is stable.
- Payload digest is stable.
- Idempotency key is stable.
- Duplicate exact match is ignored.
- Duplicate digest mismatch fails open.
- Writer timeout fails open.
- Writer credential unavailable fails open.
- Writer exception fails open.
- Monitoring exception fails open.
- Hook tests prove production success return values are unchanged.
- Protected parity tests prove live report, alert, awareness, marker, Route Watch, and DriveTexas outputs are unchanged with capture disabled and with writer failure.

### Required fixtures

The fixture files listed in Section 3 must cover crossing-created, crossing-cleared, road-hazard-created, road-hazard-cleared, disabled flags, enabled non-production flags, duplicate events, and malformed events.

## 10. Monitoring Package

Monitoring must be maintainer-only and must not create user-facing history or production dependencies.

### Required monitoring outputs

- `history_capture_gate_skipped_total`
- `history_capture_envelope_built_total`
- `history_capture_validation_failed_total`
- `history_capture_write_attempted_total`
- `history_capture_write_succeeded_total`
- `history_capture_write_duplicate_total`
- `history_capture_write_failed_open_total`
- `history_capture_write_timeout_total`
- `history_capture_monitoring_failed_open_total`
- `history_capture_last_disable_reason`
- `history_capture_last_event_type`
- `history_capture_last_safe_error_code`

### Redaction rules

Monitoring must not include raw reporter identity, raw device identifiers, unapproved precise location trails, free-text detail beyond approved redacted fields, Supabase credentials, auth tokens, or full raw production rows.

### Maintainer-only destinations

Acceptable future destinations are limited to:

- local diagnostic snapshot exposed only through test/debug audit functions;
- console debug output only in non-production and only when explicitly enabled;
- future non-production maintainer telemetry after separate approval.

## 11. Rollback / Disablement Package

### Disablement steps

A future rollback runbook must require:

1. Set `GRIDLY_HISTORY_CAPTURE_EMERGENCY_DISABLED=true`.
2. Set `GRIDLY_HISTORY_CAPTURE_ENABLED=false`.
3. Set `GRIDLY_HISTORY_CAPTURE_WRITE_ENABLED=false`.
4. Set `GRIDLY_HISTORY_CAPTURE_SOURCE_REPORT_CREATED_ENABLED=false`.
5. Set `GRIDLY_HISTORY_CAPTURE_SOURCE_REPORT_CLEARED_ENABLED=false`.
6. Remove the current environment from `GRIDLY_HISTORY_CAPTURE_ENV_ALLOWLIST`.
7. Remove or disable any non-production writer credentials if applicable.
8. Redeploy only configuration when possible.
9. If code rollback is required, revert only the additive sidecar/hook commit from the future implementation milestone.

### Verification

Rollback verification must prove:

- gate snapshot resolves disabled;
- no history write attempts occur;
- report submission still succeeds or fails exactly as before based on production insert result;
- clear report submission still succeeds or fails exactly as before based on production insert result;
- live report inventory is unchanged by disabling capture;
- alerts are unchanged;
- awareness is unchanged;
- markers are unchanged;
- Route Watch is unchanged;
- DriveTexas is unchanged;
- no history UI appears;
- no historical reads occur.

Rollback must not require migrations, data cleanup, data restore, protected-system edits, UI changes, or production behavior changes.

## 12. Acceptance Evidence Package

Before a future Phase 1A implementation can merge, reviewers must receive exactly this evidence package:

1. Changed-file list proving only approved future implementation files, tests, fixtures, docs, and separately approved hook edits were changed.
2. Static search output proving no SQL changes and no migration execution artifacts.
3. Static search output proving no historical read path was introduced.
4. Static search output proving no history UI was introduced.
5. Test output for all history-capture unit tests.
6. Test output for protected-system parity tests.
7. Fixture diff showing redacted envelope payloads for `report_created` and `report_cleared`.
8. Fail-open evidence for writer exception, timeout, duplicate, credential unavailable, malformed envelope, and monitoring failure.
9. Flag matrix evidence for default disabled, emergency disabled, environment-denied, source-disabled, write-disabled, and non-production enabled states.
10. Maintainer-only monitoring sample proving redaction.
11. Rollback drill evidence proving disablement stops write attempts without production behavior changes.
12. Manual review statement confirming no changes to alerts, awareness, markers, Route Watch, DriveTexas, historical reads, history UI, or production activation.
13. Privacy field-matrix approval for every retained field in `source_payload_redacted`.
14. Explicit reviewer sign-off that production correctness does not depend on capture success.

## 13. Explicit Phase 1B Deferral

V395 confirms the following are deferred and not approved for Phase 1A implementation:

- `incident_transitioned` is deferred.
- `incident_closed` is deferred.
- lifecycle adapter design and implementation are deferred.
- `report_updated` is deferred.

Phase 1B must not begin until a later milestone approves a post-decision lifecycle adapter that receives already-decided facts and does not mutate or govern protected live incident collections.

## 14. GO / NO-GO Recommendation

**Recommendation: GO for a future implementation milestone package review, NO-GO for activation.**

This package is sufficient to support a future Phase 1A implementation milestone because it defines exact proposed files, exports, hook candidates, flags, envelope contracts, idempotency rules, validation evidence, monitoring outputs, rollback steps, and acceptance evidence.

The future implementation milestone must still remain disabled by default and must separately prove that any hook edits are post-success, fail-open, and production-isolated before merge.

## 15. Explicit Non-Approval Statement

V395 does **NOT** approve:

- migration execution;
- migration application;
- Supabase deployment;
- historical reads;
- historical writes;
- history UI;
- production activation;
- production behavior changes.

V395 also does **NOT** approve SQL changes, Supabase changes, `js/app.js` changes, `index.html` changes, `css/styles.css` changes, alert changes, awareness changes, marker changes, Route Watch changes, DriveTexas changes, lifecycle adapter implementation, Phase 1B implementation, or any dependency from live production correctness to passive historical capture.
