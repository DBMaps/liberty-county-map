# V388 — Passive Historical Capture Contract Definition

## 1. Program Summary

V388 is a documentation-only contract-definition milestone for future passive historical evidence capture. It defines the exact contracts that any later implementation must obey before Gridly proceeds to implementation-planning review. V388 does not implement capture, activate capture, apply migrations, execute migrations, run Supabase commands, modify SQL, modify production application files, add historical reads, add historical writes, add history UI, or change production behavior.

### V355–V387 outcomes

- **V355–V362 — Live-state stabilization and fixture groundwork:** Gridly stabilized current live report and incident behavior, protected production output as the baseline, and established fixture/parity expectations for future historical work.
- **V363–V368 — Shadow historical projection foundation:** Historical projection concepts were evaluated as shadow-only, in-memory, audit-oriented artifacts. The projection work remained isolated from production reads, writes, UI, alerts, awareness, markers, Route Watch, DriveTexas, and active incident authority.
- **V369–V376 — Historical schema governance and dry-run readiness:** Additive-only schema concepts, readiness gates, SQL safety review, and dry-run governance were documented. No migration was applied, no migration was executed, and no Supabase state changed.
- **V377–V383 — Activation strategy and implementation scope:** Gridly defined the passive activation principle: **Capture Everything. Show Nothing. Depend On Nothing.** The program established that future historical evidence must be passive, non-authoritative, fail-open, reversible, invisible to users, and independent of production behavior.
- **V384–V385 — Acceptance criteria, workplan, and file-boundary approval:** The implementation acceptance package, validation expectations, staged workplan, and planning-level file-boundary model were documented without approving runtime changes.
- **V386 — File-boundary ratification and implementation-preparation authorization:** Gridly ratified that future preparation may be sidecar-only, disabled by default, and bounded away from protected systems. V386 did not approve implementation, activation, migration execution, Supabase deployment, historical reads, historical writes, history UI, production integration, or production behavior changes.
- **V387 — Implementation preparation package:** Gridly defined the preparation artifacts required before contract definition and concluded that the program is ready for implementation contract definition only.

### Current state entering and exiting V388

- Migration applied: **NO**.
- Supabase changed: **NO**.
- Historical reads: **NO**.
- Historical writes: **NO**.
- History UI: **NO**.
- Production integration: **NO**.
- Production behavior changes: **NO**.

### Protected systems

Any future implementation must preserve the following protected systems unless a later explicit approval milestone changes a named boundary:

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

## 2. Feature Flag Contract

Future passive historical capture must be governed by a layered feature flag contract. These requirements define the contract only; V388 does not implement any flag.

### Ownership

- Product/governance owns approval to enable capture for any environment.
- Engineering owns implementation of gates, default values, precedence, diagnostics, and fail-open behavior.
- Operations/maintainers own emergency disablement execution and post-disable verification.
- No user-facing setting may control historical capture.

### Required gates

1. **Global enablement gate**
   - Default: **disabled**.
   - Purpose: permits the capture subsystem to evaluate later gates.
   - Requirement: if disabled, no envelope construction, duplicate calculation, monitoring attempt, or archive write may be required for production success.

2. **Write enablement gate**
   - Default: **disabled**.
   - Purpose: permits archive write attempts after all other gates pass.
   - Requirement: if disabled, future implementation may construct local diagnostic envelopes only if doing so remains sidecar-only, fail-open, and invisible; it must not write historical records.

3. **Environment allowlist gate**
   - Default: **empty allowlist**.
   - Purpose: prevents accidental capture in unapproved environments.
   - Requirement: an environment not explicitly allowlisted must behave as capture-disabled for writes, even if every other gate is enabled.

4. **Emergency disablement gate**
   - Default: **available and authoritative**.
   - Purpose: immediately stops capture attempts without code changes, migrations, cleanup scripts, protected-system edits, data restores, UI changes, or application redeploy if the runtime configuration mechanism supports live config.
   - Requirement: emergency disablement takes precedence over every enablement gate.

5. **Source-level enablement gates**
   - Default: **disabled for every source**.
   - Purpose: permits capture only for explicitly approved source/event families.
   - Requirement: if a source is disabled, no write attempt for that source may occur even when global, write, and environment gates pass.

### Precedence rules

Future implementation must evaluate gates in this effective order:

1. Emergency disablement.
2. Environment allowlist.
3. Global enablement.
4. Write enablement.
5. Source-level enablement.
6. Event-level eligibility, if a later approved milestone adds event-level gates.

The most restrictive applicable decision wins. Any missing, malformed, unknown, or unreadable gate value must resolve to the safest disabled state for writes.

### Failure behavior

- Gate evaluation failures must fail closed for historical writes and fail open for production behavior.
- Gate diagnostics must be maintainer-only and must not feed user alerts, awareness, markers, Route Watch, DriveTexas, or UI.
- A disabled or failed gate must not change production report creation, report updates, report clears, incident lifecycle behavior, active incident authority, alerting, awareness, markers, Route Watch, or DriveTexas.

## 3. Capture Event Contract

Future passive capture must use a canonical event envelope. V388 defines the envelope contract only; it does not implement envelope construction or storage.

### Supported event types

The initial approved event taxonomy is limited to:

- `report_created`
- `report_updated`
- `report_cleared`
- `incident_transitioned`
- `incident_closed`

No other event type may be captured unless a later contract milestone adds it explicitly.

### Canonical envelope

Every future envelope must include these required fields:

- `contract_version`: stable version of this capture contract, initially expected to reference `V388` or a later compatible contract.
- `schema_version`: storage/envelope schema version.
- `capture_version`: implementation version that constructed the envelope.
- `event_type`: one of the approved event types.
- `event_id`: deterministic event identifier or deterministic idempotency key.
- `source`: approved authoritative source name.
- `source_record_id`: stable identifier from the authoritative source when available.
- `incident_id`: stable incident identifier when the event belongs to an incident lifecycle.
- `occurred_at`: event time from the authoritative production action when available.
- `captured_at`: capture attempt time.
- `environment`: normalized environment label used by the allowlist gate.
- `lifecycle_state_before`: prior lifecycle state when known and approved.
- `lifecycle_state_after`: resulting lifecycle state when known and approved.
- `payload_digest`: deterministic digest over approved canonical event content.
- `idempotency_key`: deterministic key used for duplicate suppression.
- `capture_result_intent`: intended passive archive action, such as `append_evidence` or a later approved inert value.
- `metadata`: redacted diagnostic object following the metadata rules below.

### Optional fields

Optional fields may be included only when approved, non-sensitive, and useful for future evidence review:

- `county` or normalized jurisdiction.
- `road_name` or normalized location label.
- `event_reason` for lifecycle transitions.
- `source_updated_at` from the authoritative source.
- `correlation_id` for maintainer-only tracing.
- `duplicate_of` when duplicate suppression identifies an existing evidence key.
- `validation_warnings` containing redacted, non-user-facing warnings.

Optional fields must not become production dependencies and must not be required by alerts, awareness, markers, Route Watch, DriveTexas, or active incident authority.

### Metadata rules

- Metadata must be minimal, redacted, and maintainer-only.
- Metadata must not include unnecessary user identifiers, precise device identifiers, credentials, secrets, raw request bodies, unapproved free text, or unapproved precise-location detail.
- Metadata must identify gate decisions and capture diagnostics only at the level needed for validation and operations.
- Metadata must tolerate absence: missing metadata must not block production behavior.

### Versioning and compatibility

- Envelopes must be backward compatible within the approved schema version or explicitly versioned when the contract changes.
- New required fields require a later contract milestone.
- Unknown optional fields must be ignored by future readers until a future read milestone approves historical reads.
- Archive data must remain append-only evidence and must not become authoritative for live production behavior.

## 4. Source Boundary Contract

### Authoritative sources

Future capture may only observe events after approved production actions complete successfully. Authoritative sources are limited to future-approved live report and incident lifecycle sources that already own the production action being observed.

Permitted future source categories, subject to later implementation approval, are:

- Approved community report creation/update/clear completion points.
- Approved incident lifecycle transition/closure completion points.
- Approved sidecar event adapters that receive post-success copies of authoritative event facts.

### Prohibited sources

Future capture must not treat any of the following as authoritative for historical evidence:

- Historical archive records.
- Derived historical projections.
- UI state.
- Marker state.
- Alert state.
- Awareness state.
- Route Watch state.
- DriveTexas output.
- Debug logs, console output, or monitoring-only counters.
- Failed or pending production actions.
- Any source not explicitly enabled by source-level gates.

### Ownership boundaries

- Production systems own production decisions.
- Passive capture owns only sidecar envelope construction, duplicate suppression, archive write attempts, and maintainer-only diagnostics.
- Capture must never own incident authority, active hazard state, unified incident state, marker output, alert output, awareness output, Route Watch output, DriveTexas output, or UI state.

## 5. Validation Contract

Future implementation must provide validation evidence before activation. Required validation obligations include:

- **Production isolation:** prove production behavior is unchanged with capture disabled and with capture enabled in an approved non-production environment.
- **Duplicate suppression:** prove deterministic idempotency keys and payload digests suppress duplicate evidence without mutating production state.
- **Fail-open verification:** force envelope, digest, validation, write, timeout, monitoring, configuration, and credential failures and prove production flows still complete normally.
- **Parity verification:** prove active incident counts, alert counts/text, awareness state/text, marker count/labels/icons/click behavior, Route Watch output, and DriveTexas behavior are unchanged.
- **Write-gate verification:** prove no write attempts occur when global, write, environment, emergency, or source gates deny capture.
- **Privacy validation:** prove approved fields only, redacted diagnostics, no secrets, no credentials, and no unapproved user/device/precise-location details.
- **Compatibility validation:** prove protected systems do not read, wait on, or depend on capture results.

## 6. Monitoring Contract

Future implementation must provide maintainer-only monitoring that remains invisible to users and independent of production behavior.

Required monitoring signals:

- Capture attempts by source and event type.
- Capture successes by source and event type.
- Capture failures by source, event type, and failure class.
- Duplicate detections and duplicate suppression decisions.
- Archive growth by approved environment and schema version.
- Gate states and gate denial reasons.
- Environment allowlist decisions.
- Envelope validation rejection counts.
- Archive write latency and timeout counts.
- Schema version and capture version distribution.
- Emergency disablement activation and confirmation.
- Configuration, credential, permission, and archive availability errors.

Monitoring must not create user-facing alerts, awareness messages, markers, Route Watch output, DriveTexas output, history UI, or production behavior changes.

## 7. Rollback Contract

Future implementation must be reversible by configuration first and must not require production data restoration to protect current behavior.

Rollback obligations:

- Emergency disablement must stop new capture attempts or writes immediately according to the approved runtime configuration model.
- Production report creation, report updates, report clears, incident transitions, incident closures, alerts, awareness, markers, Route Watch, and DriveTexas must continue without archive availability.
- No migration rollback may be required to restore production behavior.
- No historical data delete may be required to restore production behavior.
- No protected-system code edit may be required to restore production behavior.
- Existing archived evidence, if any was written in a later approved environment, must remain inert and unread.
- Maintainer monitoring must prove capture is disabled after rollback.

Rollback success criteria:

- No new write attempts occur after disablement.
- User-visible behavior matches the pre-capture baseline.
- Protected-system parity remains intact.
- Capture failures stop affecting only capture diagnostics and never production behavior.

## 8. Acceptance Contract

A future implementation is acceptable only when it proves all of the following:

- Capture is disabled by default.
- Writes are disabled by default.
- Source-level gates are disabled by default.
- Environment allowlist excludes every unapproved environment.
- Emergency disablement overrides all allow decisions.
- Capture occurs only after authoritative production success.
- Capture failures cannot fail production actions.
- Capture does not add historical reads.
- Capture does not add history UI.
- Capture does not alter alerts, awareness, markers, Route Watch, DriveTexas, active hazards, unified incidents, or production incident lifecycle authority.
- Envelope fields match the V388 contract or a later approved compatible contract.
- Duplicate suppression is deterministic and sidecar-only.
- Monitoring is maintainer-only.
- Rollback is proven and documented.

## 9. Compatibility Contract

Future capture must remain compatible with protected production systems as follows:

- **Alerts:** no change to alert eligibility, suppression, count, text, priority, timing, routing, or delivery.
- **Awareness:** no change to awareness eligibility, copy, state, priority, persistence, or display.
- **Markers:** no change to marker count, ownership, icon, label, popup, clustering, refresh behavior, map layer, or click behavior.
- **Route Watch:** no change to route matching, geometry, relevance, route cards, route alerts, state, notification behavior, or route-facing output.
- **DriveTexas:** no change to DriveTexas fetch, interpretation, storage, presentation, authority, or fallback behavior.
- **Production incident lifecycle:** no change to incident creation, update, transition, closure, clearing, authority, active status, deduplication, or projection used by live systems.

Historical capture must not read from, write into, wait on, or become an input to these systems.

## 10. Contract Compliance Requirements

Every future milestone that claims compliance with V388 must provide:

- A checklist mapping each V388 section to implementation evidence or a documented non-applicability rationale.
- Exact file boundaries and proof that protected files and systems were not modified unless separately approved.
- Gate configuration evidence showing defaults, precedence, deny behavior, and emergency disablement.
- Envelope examples for each approved event type.
- Validation output for production isolation, duplicate suppression, fail-open behavior, parity, write gates, monitoring, privacy, rollback, and compatibility.
- Explicit confirmation that no historical reads, history UI, user-facing behavior, or production dependencies were introduced.
- A rollback evidence record showing capture can be disabled without data restore, migration rollback, protected-system edits, or UI changes.

## 11. Readiness Assessment

Gridly is ready for implementation-planning review because V355–V387 established the governance chain, protected-system boundaries, schema non-deployment posture, activation principles, acceptance criteria, file-boundary planning, implementation-preparation package, and current contract requirements needed for a safe planning review.

Gridly is not ready for code implementation, migration execution, Supabase deployment, historical reads, historical writes, history UI, production integration, or production behavior changes based on V388 alone.

## 12. GO / NO-GO Recommendation

**Recommendation: A. Ready For Implementation Planning Review.**

Rationale:

- The passive capture principle is stable: **Capture Everything. Show Nothing. Depend On Nothing.**
- The feature flag, event envelope, source boundary, validation, monitoring, rollback, acceptance, compatibility, and compliance contracts are now defined.
- The current state remains documentation-only with no migration application, no Supabase change, no historical reads, no historical writes, no history UI, no production integration, and no production behavior changes.
- Future work still requires a separate implementation-planning review before any code changes.

## 13. Next Milestone Recommendation

Recommended next milestone:

**V389 — Passive Historical Capture Implementation Planning Review**

V389 should remain documentation-only and should review whether a future code milestone may be proposed. It should validate the intended implementation sequence, exact file boundaries, test plan, rollback evidence plan, gate configuration model, source ownership model, monitoring plan, and PR acceptance checklist before any code changes occur.

## 14. Explicit Non-Approval Statement

V388 does **NOT** approve:

- migration execution
- migration application
- Supabase deployment
- historical reads
- historical writes
- history UI
- production integration
- production behavior changes

V388 also does **NOT** approve SQL changes, Supabase commands, `js/app.js` changes, `index.html` changes, `css/styles.css` changes, alert changes, awareness changes, marker changes, Route Watch changes, DriveTexas changes, active hazard changes, unified incident changes, protected-system changes, or any user-visible behavior change.
