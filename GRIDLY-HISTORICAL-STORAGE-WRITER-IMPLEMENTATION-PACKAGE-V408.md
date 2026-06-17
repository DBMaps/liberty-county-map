# GRIDLY V408 — Historical Storage & Writer Implementation Package

## Mission

V408 is the authoritative implementation package for passive historical evidence storage and passive writer implementation. It removes ambiguity about how future storage, writing, idempotency, retention, monitoring, rollback, and validation should work while preserving the current disabled state.

Core rule:

> Capture Everything. Show Nothing. Depend On Nothing.

V408 is **implementation-package work only**. It does not deploy schema, execute migrations, enable capture, enable the writer, enable historical writes, enable historical reads, add history UI, or change production behavior.

## Current State

| Area | V408 status |
| --- | --- |
| Hooks installed | **Yes.** Phase 1A hook surfaces are already installed. |
| Capture enabled | **No.** Capture remains disabled. |
| Writer enabled | **No.** Writer remains disabled. |
| Historical writes | **No.** No evidence rows are written. |
| Historical reads | **No.** No read path is exposed. |
| History UI | **No.** No history UI is added or authorized. |
| Production activation | **No.** No production activation occurs. |

## 1. Executive Summary

V396 through V407 completed the passive historical capture readiness chain: sidecar foundation, validation tests, hook readiness audit, hook routing decisions, hook installation planning, authorization review, implementation review, authorization decision, hook installation, parity audit, activation readiness review, and storage/writer authorization review.

V408 converts the V407 authorization direction into an implementation package. The selected architecture remains:

- **Storage:** existing Supabase project with a dedicated `history_capture` schema.
- **Writer:** `historyCaptureWriter`, fail-open, no-throw, sidecar-only, non-authoritative, idempotent, maintainer-monitored, kill-switch controlled, and without client retry.
- **Retention:** 18 months for raw Phase 1A historical evidence events.
- **Scope:** Phase 1A only: crossing `report_created`, crossing `report_cleared`, road-hazard `report_created`, and road-hazard `report_cleared`.

No deployment occurs in V408. No SQL is created as an executable migration, deployed, or run. No production behavior is changed.

## 2. Storage Architecture

### Selected storage architecture

Future historical storage should use the existing Supabase project with a dedicated schema:

```text
history_capture
```

This keeps passive evidence isolated from live operational tables while reusing the existing project boundary, backup posture, environment management, and maintainer access model. The schema must be separate from live report, alert, awareness, marker, Route Watch, DriveTexas, and active incident tables.

### Schema-wide rules

All `history_capture` tables must remain:

- append-only from application writer behavior;
- non-authoritative;
- sidecar-owned;
- unavailable to ordinary production read paths;
- excluded from live report, alert, awareness, marker, Route Watch, DriveTexas, and UI decisions;
- governed by disabled-by-default activation gates.

### Proposed future tables

#### `history_capture.historical_events`

| Attribute | Contract |
| --- | --- |
| Purpose | Store append-only Phase 1A historical evidence envelopes. |
| Ownership | Historical capture sidecar and future `historyCaptureWriter`. |
| Authority level | Non-authoritative evidence only; never live operational truth. |
| Retention | 18 months for raw envelopes unless later governance changes it. |
| Write source | `historyCaptureWriter` only, after capture gate and writer gate pass. |
| Read status | No user-facing reads; maintainer-only inspection after separate approval. |

Minimum future column families should include:

- storage identity: `id`, `created_at`;
- envelope identity: `event_type`, `source_domain`, `event_timestamp`, `idempotency_key`, `payload_version`;
- source linkage: `source_record_id`, optional `source_table`, optional `source_action`;
- payload: canonical `payload` JSON, `payload_digest`;
- operational classification: `environment`, `capture_version`, `writer_version`;
- retention support: indexed timestamp used by retention deletion.

`historical_events` must have a unique constraint or unique index on `idempotency_key`. Duplicate conflicts are benign duplicate suppression, not writer failure.

#### `history_capture.writer_monitoring_events` optional

| Attribute | Contract |
| --- | --- |
| Purpose | Store maintainer-only writer and sidecar diagnostic events when safe. |
| Ownership | Historical capture sidecar and maintainer tooling. |
| Authority level | Non-authoritative diagnostics only. |
| Retention | 18 months maximum by default; shorter retention may be approved later. |
| Write source | Writer/sidecar monitoring path only. |
| Read status | Maintainer-only; no user-facing monitoring. |

This table is optional because some deployments may prefer external logging. If implemented in Supabase, it must not store sensitive payloads and must not become a user-facing activity feed.

#### `history_capture.retention_runs` optional

| Attribute | Contract |
| --- | --- |
| Purpose | Record maintainer-only retention deletion or compaction run summaries. |
| Ownership | Maintainer retention job. |
| Authority level | Non-authoritative operational audit metadata. |
| Retention | 18 months for run records unless operational policy requires less. |
| Write source | Retention process only after separate approval. |
| Read status | Maintainer-only. |

This table is optional and should only summarize retention actions. It must not contain raw report payloads.

## 3. Historical Event Contract

### Required envelope fields

Every future event passed to `historyCaptureWriter` must include these exact required fields:

| Field | Required meaning |
| --- | --- |
| `event_type` | Canonical event type, limited in Phase 1A to `report_created` or `report_cleared`. |
| `source_domain` | Source domain, limited in Phase 1A to `crossing` or `road_hazard`. |
| `event_timestamp` | Timestamp of the successful production action, not the writer attempt when a source timestamp exists. |
| `idempotency_key` | Deterministic key used for duplicate suppression. |
| `payload_version` | Version of the payload contract. |

### Recommended additional fields

Future implementation should also include:

- `contract_version` for the event envelope contract;
- `capture_version` for the sidecar/capture package version;
- `writer_version` for writer implementation version;
- `source_record_id` for the live report or clear action source record;
- `source_action` for the protected action that emitted the event;
- `environment` from an allowlisted runtime/environment gate;
- `payload` containing approved, redacted, canonical evidence data;
- `payload_digest` computed over the canonical payload;
- `correlation_id` for maintainer tracing only;
- `captured_at` for the sidecar attempt time;
- `validation_warnings` for maintainer-only non-fatal warnings.

### Required invariants

- The envelope must be immutable once written.
- `event_type` plus `source_domain` must stay within the Phase 1A allowlist.
- `idempotency_key` must be deterministic for the same source event.
- `payload_version` must be explicit; implicit payload shape is not allowed.
- Historical capture must never mutate source report results.
- Historical capture must never create alerts, awareness, markers, Route Watch entries, DriveTexas records, or UI changes.
- Malformed envelopes must be suppressed and monitored; they must not throw into protected flows.
- Event payloads must be redacted to the minimum evidence needed for later recurrence/duration analysis.

## 4. Writer Architecture

### Future module

The future writer module should be named:

```text
historyCaptureWriter
```

### Responsibilities

`historyCaptureWriter` is responsible for:

1. validating the envelope contract;
2. enforcing source-domain and event-type allowlists;
3. enforcing capture and writer kill-switches;
4. enforcing idempotency through deterministic keys and storage conflict handling;
5. performing append-only writes to `history_capture.historical_events`;
6. classifying duplicate conflicts as duplicate suppression;
7. emitting maintainer-only monitoring where safe;
8. returning sidecar outcomes without throwing;
9. failing open so production behavior continues unchanged.

### Success path

1. Capture gate is enabled by future authorization.
2. Writer gate is enabled by future authorization.
3. Envelope validates.
4. Idempotency key is present and deterministic.
5. Append-only insert succeeds.
6. Writer returns a success outcome to the sidecar.
7. Production flow remains unaffected and does not wait on historical storage for user-visible success.

### Failure path

1. Writer attempts storage after gates and validation pass.
2. Storage is unavailable, times out, denies permission, or returns an unexpected error.
3. Writer classifies the failure and emits maintainer-only monitoring if possible.
4. Writer returns a failure-classified sidecar outcome.
5. Writer does not throw and does not alter production results.

### Disabled path

- If capture is disabled, envelope construction and writer calls should not occur.
- If writer is disabled, envelope may be classified as writer-disabled only where safe, but no storage write should occur.
- Disabled outcomes are maintainer-only and must not be user-visible.

### Malformed path

1. Envelope is missing required fields, uses unsupported values, or fails validation.
2. Writer suppresses the write.
3. Writer records a malformed classification where monitoring is available.
4. Writer returns a malformed outcome without throwing.
5. Production behavior continues unchanged.

## 5. Idempotency Strategy

### Key generation

The future deterministic `idempotency_key` should be generated before storage write attempts from stable source facts. Recommended format:

```text
history_capture:v1:{source_domain}:{event_type}:{source_record_id}:{event_timestamp_or_source_revision}
```

If the source has a canonical clear/create identifier, use that identifier instead of a wall-clock timestamp. The key must not include random values, browser session identifiers, or mutable UI state.

### Duplicate handling

- Storage must enforce uniqueness on `idempotency_key`.
- Duplicate insert conflicts must be classified as `duplicate_suppressed`.
- Duplicate suppression is a successful sidecar safety outcome, not a user-visible error.
- Duplicate monitoring must be maintainer-only.

### Write suppression behavior

The writer suppresses writes when:

- capture is disabled;
- writer is disabled;
- source domain is out of scope;
- event type is out of scope;
- envelope is malformed;
- idempotency key is absent or invalid;
- payload version is unsupported;
- duplicate conflict occurs.

### Collision expectations

Collisions are expected only for true repeated attempts of the same source event. Any collision across different source events is a defect and must be diagnosable through maintainer-only monitoring, payload digest comparison, and source identifiers. The system must still fail open and avoid production impact.

## 6. Monitoring Architecture

Monitoring remains maintainer-only. No user-facing monitoring, history panels, map indicators, DOM messaging, alerting surfaces, awareness changes, Route Watch output, or DriveTexas output are authorized.

Required future monitoring signals:

| Signal | Purpose |
| --- | --- |
| Capture attempts | Count envelope construction or write-attempt opportunities after capture is authorized. |
| Disabled captures | Confirm capture-disabled gates are suppressing historical work. |
| Malformed payloads | Detect invalid envelopes and contract drift. |
| Duplicate suppression | Confirm idempotency is working and identify duplicate spikes. |
| Write failures | Detect storage, permission, timeout, or unexpected writer failures. |
| Writer-disabled events | Confirm writer kill-switch behavior. |
| Sidecar failures | Detect unexpected sidecar exceptions or monitoring failures. |

Monitoring must be redacted, non-authoritative, no-throw, and fail-open. Monitoring failures must not change writer outcomes or production outcomes.

## 7. Retention Architecture

The recommended retention window is **18 months** for raw Phase 1A historical event envelopes.

### Deletion strategy

Future retention implementation should delete raw `historical_events` rows older than the approved retention cutoff using a maintainer-controlled job. The deletion job must be separately authorized, tested, and monitored before activation.

### Compaction strategy

Compaction is deferred. A future package may propose aggregate or redacted summary tables, but those summaries must remain non-authoritative and must not feed production behavior without separate historical-read authorization.

### Archival assumptions

No long-term archive is authorized in V408. If legal, analytics, or operations later require archival beyond 18 months, that must be reviewed separately with privacy, access, retention, and deletion rules.

Retention must not affect reports, alerts, awareness, Route Watch, DriveTexas, markers, incident lifecycle behavior, or UI behavior.

## 8. Rollback Architecture

| Level | Action | Expected effect |
| --- | --- | --- |
| Level 1 | Disable writer | Stops storage writes while preserving capture hook surfaces and production behavior. |
| Level 2 | Disable capture | Stops envelope construction and writer calls. |
| Level 3 | Remove hook invocation | Returns protected production routes to pre-hook-invocation posture. |
| Level 4 | Remove storage implementation | Removes writer/storage support code and future schema assets after cancellation or severe defect. |

Rollback must not require live data migration, UI changes, alert changes, awareness changes, marker changes, Route Watch changes, DriveTexas changes, or source report behavior changes. Credential revocation and writer secret rotation belong in Level 1 or Level 2 operational playbooks.

## 9. Future File Inventory

These files are identified for future implementation. V408 creates none of them.

| Future file | Purpose |
| --- | --- |
| `supabase/migrations/YYYYMMDDHHMMSS_create_history_capture_schema.sql` | Create `history_capture` schema and grants/RLS boundaries. |
| `supabase/migrations/YYYYMMDDHHMMSS_create_history_capture_historical_events.sql` | Create append-only `historical_events` table and idempotency constraint. |
| `supabase/migrations/YYYYMMDDHHMMSS_create_history_capture_monitoring_events.sql` | Optional maintainer-only writer monitoring table. |
| `supabase/migrations/YYYYMMDDHHMMSS_create_history_capture_retention_support.sql` | Optional retention indexes and run-summary support. |
| `supabase/migrations/rollback/YYYYMMDDHHMMSS_drop_history_capture_retention_support.sql` | Roll back retention-support objects only. |
| `supabase/migrations/rollback/YYYYMMDDHHMMSS_drop_history_capture_monitoring_events.sql` | Roll back optional monitoring table only. |
| `supabase/migrations/rollback/YYYYMMDDHHMMSS_drop_history_capture_historical_events.sql` | Roll back `historical_events` after explicit approval. |
| `supabase/migrations/rollback/YYYYMMDDHHMMSS_drop_history_capture_schema.sql` | Roll back empty `history_capture` schema after explicit approval. |
| `js/history-capture/historyCaptureWriter.js` | Future fail-open, no-throw writer implementation. |
| `js/history-capture/historyCaptureEnvelope.js` | Future envelope validation and canonicalization helpers. |
| `js/history-capture/historyCaptureIdempotency.js` | Future deterministic key generation and duplicate classification helpers. |
| `js/history-capture/historyCaptureMonitoring.js` | Future maintainer-only monitoring emission helpers. |
| `js/history-capture/historyCaptureConfig.js` | Future capture and writer gates, environment allowlists, and kill-switch config. |
| `tests/history-capture/historyCaptureWriter.test.js` | Writer success, disabled, malformed, duplicate, and failure tests. |
| `tests/history-capture/historyCaptureEnvelope.test.js` | Envelope contract validation tests. |
| `tests/history-capture/historyCaptureIdempotency.test.js` | Deterministic key and duplicate behavior tests. |
| `tests/history-capture/historyCaptureMonitoring.test.js` | Maintainer-only monitoring classification tests. |
| `tests/history-capture/historyCaptureRollback.test.js` | Writer-disable and capture-disable rollback tests. |
| `docs/history-capture/HISTORY_CAPTURE_OPERATIONS.md` | Future maintainer operations runbook. |

## 10. Future Migration Inventory

V408 does not create, execute, or deploy migrations. The future migration set should be:

| Future migration name | Purpose | Future rollback name | Rollback purpose |
| --- | --- | --- | --- |
| `create_history_capture_schema` | Create dedicated schema and access boundaries. | `drop_history_capture_schema` | Drop the empty schema after all dependent objects are removed. |
| `create_history_capture_historical_events` | Create append-only evidence table, retention timestamp index, and idempotency uniqueness. | `drop_history_capture_historical_events` | Drop evidence table only after explicit approval and backup/export review. |
| `create_history_capture_writer_monitoring_events` | Optionally create maintainer-only monitoring table. | `drop_history_capture_writer_monitoring_events` | Remove optional monitoring table. |
| `create_history_capture_retention_support` | Optionally create retention indexes, helper function, or run-summary table. | `drop_history_capture_retention_support` | Remove retention-support objects without touching live systems. |
| `grant_history_capture_writer_access` | Grant minimal writer insert access to approved writer identity. | `revoke_history_capture_writer_access` | Revoke writer access as part of rollback or credential response. |

No migration may be run until a later milestone explicitly authorizes migration execution.

## 11. Future Validation Plan

### Writer validation

- Validate success, writer-disabled, capture-disabled, malformed, duplicate, storage failure, timeout, permission failure, and monitoring failure paths.
- Confirm all paths return sidecar outcomes and never throw into protected flows.

### Storage validation

- Validate schema isolation, append-only behavior, idempotency uniqueness, grants/RLS, and retention indexes in a non-production or dry-run context before any deployment.

### Parity validation

- Re-run protected-flow parity checks for crossing create/clear and road-hazard create/clear.
- Confirm source reports, alerts, awareness, markers, Route Watch, DriveTexas, and UI behavior remain unchanged.

### Rollback validation

- Validate Level 1 writer disable.
- Validate Level 2 capture disable.
- Validate Level 3 hook invocation removal plan.
- Validate Level 4 implementation removal plan.

### Monitoring validation

- Confirm maintainer-only signals for attempts, disabled captures, malformed payloads, duplicate suppression, write failures, writer-disabled events, and sidecar failures.
- Confirm monitoring failure does not affect writer return or protected production behavior.

## 12. Implementation Sequence

Future implementation should occur in this order:

1. **Schema package:** draft migrations for `history_capture` schema, `historical_events`, idempotency, grants/RLS, and optional monitoring/retention support. Do not deploy without separate authorization.
2. **Writer implementation:** add disabled-by-default `historyCaptureWriter`, envelope validation, idempotency helpers, and no-throw outcomes.
3. **Monitoring implementation:** add maintainer-only monitoring signals with no UI or production dependencies.
4. **Validation:** run writer, storage, parity, rollback, and monitoring validation.
5. **Authorization review:** review exact diff, validation results, migration safety, credentials, and rollback readiness.
6. **Optional activation review:** only after authorization review, consider whether capture or writer activation should be separately approved.

## 13. Explicit Non-Approvals

V408 does **not** authorize:

- schema deployment;
- migration execution;
- writer enablement;
- capture enablement;
- historical writes;
- historical reads;
- history UI;
- production activation;
- lifecycle adapter;
- incident transition capture;
- `report_updated` capture;
- DriveTexas work;
- Route Watch work;
- alert changes;
- awareness changes;
- marker changes;
- source report behavior changes.

## 14. Recommended Next Milestone

Recommended next milestone:

```text
V409 — Storage & Writer Implementation Authorization
```

Rationale: V408 is intentionally documentation-only and does not create migrations or writer code. The safest next step is an authorization milestone that approves the exact implementation boundaries, future file list, migration names, credential scope, disabled defaults, and validation requirements before code or SQL assets are introduced. Naming V409 as implementation rather than authorization would risk implying approval to create or run storage/writer behavior before governance has reviewed the package.

## V408 Confirmation

V408 created only this documentation package:

```text
GRIDLY-HISTORICAL-STORAGE-WRITER-IMPLEMENTATION-PACKAGE-V408.md
```

No deployment, activation, migration execution, writer enablement, capture enablement, historical writes, historical reads, history UI, DriveTexas work, Route Watch work, or UI changes occurred.
