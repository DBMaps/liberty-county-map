# GRIDLY V407 — Historical Storage & Writer Authorization Review

## Mission

V407 is a consolidated authorization review for passive historical evidence storage and writer implementation. It replaces additional incremental V407+ planning milestones for storage architecture, passive writer behavior, storage contracts, retention contracts, monitoring contracts, and rollback contracts.

This is a **documentation-only review**. It does not change application code, deploy SQL, execute migrations, enable capture, enable the writer, add historical reads, add history UI, or activate production capture.

Core rule:

> Capture Everything. Show Nothing. Depend On Nothing.

## Current State

| Area | V407 finding |
| --- | --- |
| Hooks installed | **Yes.** Phase 1A hooks are installed from the V404 implementation and were accepted by V405/V406 as passive hook surfaces. |
| Capture enabled | **No.** Capture remains disabled. |
| Writer enabled | **No.** Writer behavior remains disabled/no-op. |
| Historical writes | **No.** No historical evidence is written. |
| Historical reads | **No.** No historical read path is exposed. |
| History UI | **No.** No user-facing history UI exists. |
| Production activation | **No.** No production evidence capture has been activated. |

## Reviewed Background

V407 relies on the completed review chain from V396 through V406:

- V396 Sidecar Foundation.
- V397 Validation Tests.
- V398 Hook Readiness Audit.
- V399 Routing Decisions.
- V400 Installation Plan.
- V401 Authorization Review.
- V402 Implementation Review.
- V403 Authorization Decision.
- V404 Hook Installation.
- V405 Parity Audit.
- V406 Activation Readiness Review.

Conclusion: the hook and sidecar posture is mature enough to authorize a disabled storage/writer implementation package, but not enough to authorize capture activation or production writes.

## 1. Storage Architecture Recommendation

### Options reviewed

| Option | Assessment | Recommendation |
| --- | --- | --- |
| Option A — existing Supabase project with dedicated `history_capture` schema | Best balance of isolation and operational simplicity. Keeps archive data separate from live tables while reusing the existing environment, backups, operational access, and source-record context. Supports schema-level grants, append-only constraints, idempotency indexes, retention jobs, and maintainer-only monitoring without creating a second operational platform. | **Recommend.** |
| Option B — separate Supabase project | Strongest infrastructure isolation, but adds credentials, secrets, network configuration, backup/restore procedures, monitoring, incident response, environment drift, and cross-project governance. This is disproportionate while capture and writer remain disabled and Phase 1A stores evidence about records already created in the existing Supabase environment. | Defer unless security review later requires stronger isolation. |
| Option C — alternative storage architecture | Object storage, client/local storage, or analytics-only storage are weaker primary evidence stores for Phase 1A. Object storage complicates idempotency and row governance; client/local storage is not durable archive evidence; analytics-only systems are monitoring surfaces, not governed archival storage. | Reject for Phase 1A primary storage. |

### Recommendation

Authorize implementation planning and code/schema preparation for **Option A: the existing Supabase project with a dedicated `history_capture` schema**.

Required storage boundaries:

- The schema must be separate from production live-report, alert, awareness, marker, Route Watch, DriveTexas, and active incident tables.
- Evidence tables must be append-only from the writer's perspective.
- Storage names must make historical capture ownership explicit, such as `history_capture.evidence_events` and `history_capture.capture_monitoring_events`.
- The storage layer must enforce a unique `idempotency_key` or equivalent deterministic key.
- Grants/RLS must prevent ordinary production read paths from depending on historical tables.
- No historical storage object may become live authority for Shared Reports, Alerts, Awareness, Markers, Hazard Lifecycle, Route Watch, or DriveTexas.

## 2. Evidence Storage Model

### Events to capture

The disabled implementation package should support only these Phase 1A evidence events:

| Evidence route | Authorization finding | Rationale |
| --- | --- | --- |
| Crossing `report_created` | **Authorize implementation while disabled.** | High-value start boundary for blocked-crossing recurrence and duration intelligence. |
| Crossing `report_cleared` | **Authorize implementation while disabled.** | High-value end boundary for blocked-crossing duration and resolution evidence. |
| Road-hazard `report_created` | **Authorize implementation while disabled.** | High-value start boundary for recurring road-condition intelligence. |
| Road-hazard `report_cleared` | **Authorize implementation while disabled and with strict route preservation.** | Valuable end boundary, but must remain attached only to the existing road-hazard clear-report success path. |

Do not include `report_updated`, `incident_transitioned`, `incident_closed`, lifecycle-adapter capture, DriveTexas capture, Route Watch capture, marker capture, alert capture, or awareness capture in this package.

### Event envelope requirements

Every storable event must use a canonical envelope that includes, at minimum:

- `contract_version`.
- `schema_version`.
- `capture_version`.
- `event_type` limited to the in-scope Phase 1A event types.
- `event_id` or deterministic event identifier.
- `source` and `source_record_id`.
- `occurred_at` from the successful production action when available.
- `captured_at` from the sidecar attempt.
- `environment` from the environment allowlist gate.
- `payload_digest` over canonical approved event content.
- `idempotency_key` used by both sidecar and storage.
- `capture_result_intent`, such as `append_evidence`.
- Minimal redacted `metadata` for maintainer-only diagnostics.

Optional fields may include county/jurisdiction, normalized road or crossing label, event reason, correlation ID, duplicate reference, and validation warnings only when redacted, approved, and non-authoritative.

### Idempotency requirements

The implementation package must enforce duplicate safety in two layers:

1. **Sidecar-level idempotency:** deterministic key generation before writer calls, duplicate classification, duplicate monitoring, and no production-side effects.
2. **Storage-level idempotency:** unique constraint or equivalent conflict handling on `idempotency_key`, with duplicate conflicts classified as benign duplicate suppression rather than writer failure.

Idempotency must never change the source report result, clear result, alert behavior, marker behavior, awareness behavior, hazard lifecycle behavior, Route Watch behavior, DriveTexas behavior, or UI behavior.

## 3. Writer Architecture Recommendation

Authorize implementation of a disabled passive evidence writer with the following contract:

| Writer area | Required contract |
| --- | --- |
| Write contract | The writer may attempt append-only inserts only after global capture gate, writer gate, environment gate, source gate, emergency gate, envelope validation, digest generation, and idempotency key generation all pass. |
| Failure handling | Malformed envelope, validation failure, missing credentials, storage unavailable, timeout, permission denial, duplicate conflict, and monitoring failure must be classified internally and returned as sidecar outcomes. |
| No-throw behavior | Writer and capture wrapper must catch/contain failures and must never throw into protected production flows. |
| Retry/no-retry behavior | Default should be **no client-side retry** for Phase 1A. Retrying from the browser risks making storage availability feel production-relevant and may amplify duplicates. Later server-side or job-based retry can be reviewed separately if needed. Duplicate conflicts are not retried. Validation/malformed payloads are not retried. Network/storage failures are counted and dropped for Phase 1A. |
| Idempotency enforcement | The writer must use deterministic idempotency keys and storage-level conflict handling. Duplicate outcomes are successful suppression, not user-visible errors. |
| Monitoring integration | The writer must emit maintainer-only monitoring for attempts, disabled outcomes, malformed payloads, duplicate suppression, write failures, writer-disabled outcomes, and sidecar failures. Monitoring failure must not affect writer return or production behavior. |
| Kill-switch behavior | Separate capture and writer gates must remain independently disableable. Writer-disabled must stop storage attempts even if capture code is present. Capture-disabled must stop envelope construction and writer calls. Emergency disablement must fail closed for historical writes and fail open for production behavior. |

Writer classification: **fail-open, non-authoritative, sidecar-only**.

## 4. Retention Recommendation

### Options reviewed

| Retention window | Assessment |
| --- | --- |
| 12 months | Lowest storage/privacy exposure, but weak for seasonal rail, weather, school-year, hurricane-season, construction, and annual recurrence analysis. |
| 18 months | Best Phase 1A balance. Covers a full year plus seasonal overlap, allows beta validation and delayed operational review, limits archive growth, and preserves evidence long enough to evaluate recurrence/duration intelligence before any history UI or reads are approved. |
| 24 months | Stronger long-horizon analysis, but higher privacy/storage/governance burden before Gridly has proven passive write volume, retention operations, and future read value. |

### Recommendation

Recommend **18 months** for raw Phase 1A event envelopes, subject to later privacy/legal governance and separate implementation of retention deletion/compaction jobs.

Retention contract:

- Retention implementation may be included in the package as disabled/scheduled-off infrastructure until separately approved.
- Deletion/compaction must be maintainer-controlled and auditable.
- Legal hold/export/deletion exceptions require a separate governance decision.
- No retention job may affect live reports, active incidents, alerts, awareness, markers, Route Watch, or DriveTexas.

## 5. Monitoring Recommendation

Authorize maintainer-only monitoring implementation for these signals:

- Capture attempts.
- Disabled captures.
- Malformed payloads.
- Duplicate suppression.
- Write failures.
- Writer-disabled events.
- Sidecar failures.

Monitoring requirements:

- Maintainer-only; no user-facing UI, DOM output, public alerts, map markers, awareness changes, history panels, or user messaging.
- Monitoring must be non-authoritative and must not feed production decisions.
- Monitoring emission must be fail-open and no-throw.
- Monitoring must be scoped by environment, source, event type, and failure class where safe and redacted.
- Monitoring must support rollback verification by making writer-disabled and capture-disabled outcomes visible to maintainers without writing evidence rows when gates deny writes.

## 6. Rollback Strategy Review

Rollback remains acceptable if implemented and tested at four levels:

| Level | Action | V407 assessment |
| --- | --- | --- |
| Level 1 | Disable writer | **Acceptable.** Immediate first response for storage instability, credential issues, duplicate spikes, or write failures. Capture may still classify disabled outcomes locally/monitor-only if safe. |
| Level 2 | Disable capture | **Acceptable.** Stops envelope construction and writer calls. Required if sidecar failures, malformed payloads, or monitoring noise appear. |
| Level 3 | Remove hooks | **Acceptable.** Returns production code to pre-hook invocation posture if disabled gates are insufficient or hook placement becomes suspect. |
| Level 4 | Remove implementation | **Acceptable.** Removes sidecar/writer/storage-support code after severe defects, governance reversal, or scope cancellation. |

Rollback constraints:

- Rollback must not require live data migration.
- Rollback must not require UI, alert, awareness, marker, incident, Route Watch, or DriveTexas changes.
- Writer credential revocation/rotation must be part of Level 1/Level 2 operational playbooks.
- Schema removal should be a separate later cleanup action and must not be required for emergency production safety.

## 7. Risk Review

Risk assumes the implementation package is added while **capture disabled, writer disabled, reads disabled, UI disabled, and production activation disabled**.

| Area | Risk | Assessment |
| --- | --- | --- |
| Shared Reports | **Low** | Hooks are already installed and remain post-success. Disabled writer/capture gates preserve source report behavior. |
| Alerts | **None to Low** | No alert reads/writes or alert decision dependency are authorized. |
| Awareness | **None to Low** | No awareness mutation or dependency is authorized. |
| Markers | **None to Low** | No marker creation, removal, styling, refresh, or dependency is authorized. |
| Hazard Lifecycle | **Low to Moderate** | Road-hazard clear remains the highest-scrutiny route. Risk is low if existing clear-report success routing is preserved; moderate if implementation drifts into lifecycle adapter behavior. |
| Route Watch | **None to Low** | No Route Watch read/write/refresh/scoring dependency is authorized. |
| DriveTexas | **None to Low** | No DriveTexas restart, polling, storage, display, or dependency is authorized. |
| Supabase stability | **Moderate** | New schema/writer preparation introduces future storage, grants, indexes, retention, and write-volume considerations. Risk remains moderate until schema and writer are tested with disabled defaults and no production writes. |
| Beta readiness | **Low to Moderate** | Safe if invisible, disabled, reversible, and no-read/no-UI. Moderate if rushed into activation before monitoring and rollback validation. |

Overall risk: **acceptable for disabled implementation preparation; not acceptable for activation without a separate later approval**.

## 8. Authorization Recommendation

Decision: **B. Authorized With Conditions**.

V407 authorizes a single future implementation package for historical storage architecture, passive evidence writer, storage contracts, retention contracts, monitoring contracts, and rollback contracts only if all conditions below are met:

1. Capture remains disabled by default and after implementation.
2. Writer remains disabled by default and after implementation.
3. Historical reads remain absent.
4. History UI remains absent.
5. No production activation occurs.
6. No SQL migration is deployed or executed without separate explicit approval.
7. Writer remains fail-open, no-throw, sidecar-only, and non-authoritative.
8. Storage uses a dedicated `history_capture` schema in the existing Supabase project unless a later security review overrides that direction.
9. In-scope events are limited to crossing `report_created`, crossing `report_cleared`, road-hazard `report_created`, and road-hazard `report_cleared`.
10. Monitoring remains maintainer-only and non-user-facing.
11. Rollback levels 1 through 4 are implemented or documented with validation checks.
12. Protected systems do not read, wait on, or depend on storage, writer, monitoring, or retention behavior.

Rationale: the V396-V406 chain has resolved hook placement and disabled sidecar readiness. The remaining blocker is a concrete storage/writer implementation package that can be reviewed and tested while all runtime activation gates remain off.

## 9. Explicit Non-Approvals

V407 does **not** authorize:

- enabling capture;
- enabling writer;
- historical writes;
- historical reads;
- history UI;
- production activation;
- SQL deployment;
- migration execution;
- lifecycle adapter work;
- `report_updated` capture;
- `incident_transitioned` capture;
- `incident_closed` capture;
- DriveTexas changes;
- Route Watch changes;
- alert, awareness, marker, Shared Reports, or Hazard Lifecycle behavior changes.

## 10. Blockers Before Any Later Activation

The following remain blockers to enabling capture or writer behavior:

- Approved and reviewed SQL/schema deployment plan for `history_capture`.
- Approved writer identity, credential scope, secret handling, rotation, and revocation model.
- Storage-level idempotency constraint validated.
- Retention job/deletion strategy validated.
- Maintainer-only monitoring validated for all required signals.
- Rollback drills completed for writer-disable, capture-disable, hook removal, and implementation removal.
- Parity tests rerun against exact implementation diff.
- Failure injection proves malformed payloads, duplicate conflicts, write failures, credential failures, timeouts, and monitoring failures do not alter production flows.
- Separate explicit activation authorization.

## 11. Recommended Implementation Package Scope

If Gridly proceeds, the next implementation package should include exactly one disabled preparation package:

1. **Storage schema package**
   - Draft `history_capture` schema objects for evidence events, monitoring events, idempotency constraints, indexes, grants/RLS, and retention support.
   - Keep SQL undeployed unless a separate migration/deployment approval is granted.

2. **Writer implementation package**
   - Sidecar-only writer module.
   - Deterministic envelope validation, digest, idempotency, and conflict classification.
   - No-throw/fail-open outcome model.
   - Capture-disabled and writer-disabled defaults.

3. **Monitoring implementation package**
   - Maintainer-only counters/events for attempts, disabled captures, malformed payloads, duplicates, writer-disabled events, write failures, and sidecar failures.
   - No UI, DOM, marker, alert, awareness, Route Watch, or DriveTexas output.

4. **Rollback implementation package**
   - Operational kill switches for writer-disable and capture-disable.
   - Documented hook-removal and implementation-removal steps.
   - Tests proving rollback leaves protected systems unchanged.

Required package posture:

- Capture disabled.
- Writer disabled.
- Reads disabled.
- UI disabled.
- No production activation.

## 12. V407 Final Finding

Gridly should authorize disabled implementation preparation for passive historical storage and writer support under **Decision B: Authorized With Conditions**.

Recommended storage: **existing Supabase project with a dedicated `history_capture` schema**.

Recommended retention: **18 months** for raw Phase 1A event envelopes, subject to later governance and retention-job validation.

Recommended writer: **fail-open, no-throw, sidecar-only, non-authoritative, disabled by default, no client-side retry in Phase 1A, idempotent at sidecar and storage layers**.

The implementation package must continue to obey the governing rule:

> Capture Everything. Show Nothing. Depend On Nothing.
