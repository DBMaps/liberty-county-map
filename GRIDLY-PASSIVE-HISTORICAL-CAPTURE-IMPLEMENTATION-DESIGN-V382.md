# V382 — Passive Historical Capture Implementation Design

## 1. Files Reviewed

V382 reviewed the prior passive capture and historical schema planning chain. This milestone is implementation design only and makes no SQL, Supabase, application, UI, alert, awareness, marker, Route Watch, DriveTexas, historical read, historical write, or production behavior change.

Reviewed artifacts:

- `GRIDLY-PASSIVE-HISTORICAL-CAPTURE-ARCHITECTURE-V380.md`
  - Establishes the operating principle: **Capture Everything. Show Nothing. Depend On Nothing.**
  - Recommends an append-only passive evidence archive populated by fail-open sidecar writes.
  - Selects post-decision incident lifecycle transition events as the preferred primary source, supplemented by report creation, report update, and report clear provenance.
  - Requires capture to remain passive, non-authoritative, isolated, reversible, invisible, and independent of protected production systems.
- `GRIDLY-PASSIVE-HISTORICAL-CAPTURE-IMPLEMENTATION-READINESS-PLAN-V381.md`
  - Determines Gridly is ready for implementation-design planning only.
  - Confirms no migration has been applied, no Supabase deployment has been approved, no historical reads or writes exist, and no production integration is approved.
  - Identifies future blockers: exact evidence contract, feature flags, writer identity, credential model, source inventory, disablement controls, monitoring, retention, privacy field list, and failure-path validation.
- `GRIDLY-ADDITIVE-HISTORICAL-SCHEMA-MIGRATION-DRAFT-V371.md`
  - Confirms the historical schema migration artifacts are draft-only.
  - Confirms the draft is additive-schema-only and does not modify `js/app.js`, `index.html`, `css/styles.css`, production reads, production writes, lifecycle behavior, alerts, awareness, markers, Route Watch, or DriveTexas.
  - Preserves future review requirements for exact migration SQL, rollback SQL, RLS, service-role write paths, and post-migration inspection.
- `GRIDLY-HISTORICAL-SCHEMA-MIGRATION-REVIEW-AND-SQL-SAFETY-AUDIT-V372.md`
  - Confirms the V371 draft is additive-only, avoids production-table triggers, avoids production-table mutation, uses conservative RLS, and remains safe only as an unapplied draft.
  - Identifies remaining risks around premature application, future service-role writers, data quality, future dependency, and rollback timing.

Current state after V382 remains:

- Migration applied: **NO**.
- Supabase changed: **NO**.
- Historical reads: **NO**.
- Historical writes: **NO**.
- History UI: **NO**.
- Production integration: **NO**.
- Production behavior changes: **NO**.

## 2. Future Feature Flag Design

V382 does not implement feature flags. The following names are future design labels only and are not approved as runtime API until a later implementation milestone.

### Flag ownership

Future ownership should be split by responsibility:

- **Product / program owner:** approves whether passive capture is allowed to proceed beyond design.
- **Engineering owner:** implements flag evaluation, source boundaries, fail-open handling, and validation tests after a later approval.
- **Operations owner:** controls emergency disablement, environment allowlists, write-gate state, and runbook execution.
- **Security / data owner:** approves writer identity, credential scope, PII/data minimization, and retention-related gates.

### Flag hierarchy

The future flag hierarchy should be evaluated from broadest disablement to narrowest source enablement. Any disabled, missing, ambiguous, invalid, or unapproved state must resolve to **capture disabled**.

1. `GRIDLY_HISTORY_CAPTURE_EMERGENCY_DISABLE`
   - Highest-priority kill switch.
   - When enabled, all passive capture attempts and writes must stop regardless of every other flag.
   - Default: emergency disablement is treated as active if state cannot be confidently read.
2. `GRIDLY_HISTORY_CAPTURE_ENV_ALLOWLIST`
   - Explicit list of environments permitted to attempt capture.
   - Unknown, local, preview, forked, stale, or unlisted environments must not write historical evidence.
   - Default: empty allowlist.
3. `GRIDLY_ENABLE_PASSIVE_HISTORY_CAPTURE`
   - Global capture-attempt gate.
   - Controls whether any source may construct passive evidence envelopes.
   - Default: `false`.
4. `GRIDLY_ENABLE_HISTORY_CAPTURE_WRITES`
   - Write gate, separate from envelope construction.
   - Allows dry diagnostic validation of capture attempt logic without archive persistence.
   - Default: `false`.
5. Source-level flags:
   - `GRIDLY_ENABLE_HISTORY_CAPTURE_REPORT_CREATED`
   - `GRIDLY_ENABLE_HISTORY_CAPTURE_REPORT_UPDATED`
   - `GRIDLY_ENABLE_HISTORY_CAPTURE_REPORT_CLEARED`
   - `GRIDLY_ENABLE_HISTORY_CAPTURE_LIFECYCLE_TRANSITION`
   - Optional future `GRIDLY_ENABLE_HISTORY_CAPTURE_SHADOW_PROJECTION`, only after separate approval.
   - Default for every source: `false`.

### Interaction rules

- Emergency disablement overrides all other configuration.
- Environment allowlist failure prevents writes and should prevent capture attempts unless a later diagnostic-only mode is explicitly approved.
- Global capture must be enabled before any source-level capture can occur.
- Write gate must be enabled before persistence can occur.
- Source-level enablement permits only that source and does not imply any other source is enabled.
- Write success, write failure, duplicate suppression, or archive availability must never affect production success or user-visible behavior.
- Historical read flags are intentionally absent from V382 because this milestone designs capture only and does not approve reads.

## 3. Future Capture Ownership Design

Future passive capture should have explicit ownership before any implementation begins.

### Capture ownership

- Owns source attachment after production actions have completed.
- Owns evidence envelope construction and idempotency key generation.
- Owns isolation from `loadSharedReports()`, `activeHazards`, `getLiveHazardIncidents()`, `unifiedRoadIncidents`, `activeUnifiedIncidents`, alerts, awareness, markers, Route Watch, and DriveTexas.
- Must prove capture does not mutate live report, incident, alert, awareness, marker, Route Watch, or DriveTexas state.

### Validation ownership

- Owns acceptance criteria for fail-open behavior, duplicate suppression, write-gate behavior, parity, production isolation, and source coverage.
- Owns regression tests or audit checks that compare production behavior with capture disabled versus enabled.
- Owns validation that no historical reads, history UI, or production dependency has been introduced.

### Monitoring ownership

- Owns metrics for attempts, successes, failures, duplicate events, malformed envelopes, timeout classes, latency, archive growth, and source-level volume.
- Owns alert thresholds for operators only; monitoring output must not become user-facing history or live incident input.
- Owns redaction standards for diagnostics.

### Disablement ownership

- Owns the emergency runbook and authority to disable capture immediately.
- Owns confirmation that writes stopped.
- Owns re-enable approval workflow.
- Owns credential revocation or writer disablement procedures that do not affect production behavior.

## 4. Future Capture Boundary Design

V382 designs future attachment points only. No attachment point is implemented.

### Evaluated attachment points

| Attachment point | Future role | Boundary requirement | Recommendation |
| --- | --- | --- | --- |
| Report creation | Raw provenance for newly created community evidence. | Observe only after current creation persistence succeeds. | Supplemental capture source. |
| Report update | Raw provenance for changed report attributes, status, notes, severity, or location fields if approved. | Observe only after current update succeeds; never alter validation or response. | Supplemental capture source. |
| Report clear | Raw provenance for resolution/clear evidence and future duration analysis. | Observe only after current clear behavior succeeds; never block clear. | Supplemental capture source. |
| Incident lifecycle transition | Normalized evidence for active, merged, resolved, expired, suppressed, reopened, or related post-decision lifecycle outcomes. | Observe only after current lifecycle logic has made the authoritative decision. | Primary capture source. |

### Primary capture source

The primary future source should be **post-decision incident lifecycle transition capture**.

Rationale:

- It observes the normalized lifecycle outcome after production logic has already completed the authoritative decision.
- It avoids making history responsible for determining active state, incident merging, resolving, expiring, suppressing, reopening, alerting, awareness, marker rendering, or Route Watch behavior.
- It provides the best future evidence for duration, recurrence, closure, and lifecycle analysis while preserving non-authoritative status.

### Supplemental capture sources

Supplemental future sources should be:

- report creation;
- report update;
- report clear;
- optional shadow projection evidence only after separate approval.

Rationale:

- Raw report events preserve provenance that lifecycle transitions may normalize away.
- Report clear events provide resolution context that supports later duration validation.
- Report update events help explain why a lifecycle transition changed, but they should not be the primary normalized historical truth.
- Shadow projections are derived and should remain secondary validation evidence, not primary capture triggers.

## 5. Future Write Path Design

Future write flow should be:

`source → capture event → transformation → passive archive → monitoring`

### Source

The source must be an already-completed production operation or post-decision lifecycle transition. Production success must be established before capture begins.

### Capture event

A future capture event should be an internal, best-effort, sidecar observation that contains only the data needed to build a passive evidence envelope. It must not be a production command and must not be required for production completion.

### Transformation

Transformation should create a versioned, immutable envelope with approved fields such as:

- capture schema version;
- source name;
- source operation type;
- source entity identifiers;
- incident identifiers when available;
- event timestamp;
- capture timestamp;
- lifecycle previous/next state when available;
- approved location reference or coordinate bucket when available;
- approved provenance fields;
- payload digest;
- idempotency key;
- duplicate-detection hash;
- capture implementation version;
- redacted diagnostic metadata.

Transformation must be pure and non-mutating.

### Passive archive

The passive archive should be append-only, isolated from production reads, and governed by an approved migration and writer design in a later milestone. Duplicate suppression may avoid repeated archive rows, but duplicate handling must not affect production behavior.

### Monitoring

Monitoring should record capture health and operational facts without surfacing history to users or feeding live production logic.

### Fail-open requirements

- Transformation failure must not block the source action.
- Archive write failure must not block the source action.
- Timeout must not block the source action.
- Duplicate detection failure must not block the source action.
- Monitoring failure must not block the source action.
- Missing historical storage must not block the source action.
- Revoked writer credentials must not block the source action.

## 6. Future Validation Hook Design

Future implementation must include validation hooks before writes are enabled.

- **Production isolation validation:** verifies no historical reads, historical UI, or capture result branches exist in protected systems.
- **Duplicate suppression validation:** verifies idempotency keys and payload hashes detect repeated events without affecting production behavior.
- **Fail-open validation:** simulates transform failure, write failure, timeout, storage unavailable, malformed envelope, disabled flag, environment deny, and credential revocation while confirming production actions still succeed.
- **Capture parity validation:** compares production behavior with capture disabled versus enabled and requires identical user-visible outcomes.
- **Write-gate validation:** proves capture attempts can be disabled independently from writes and writes can be disabled independently from source operation success.
- **Source coverage validation:** verifies every approved future source emits expected attempts and every unapproved source remains silent.
- **Schema envelope validation:** verifies the envelope contains only approved fields and versions.
- **Privacy/data minimization validation:** verifies free-form, device, user, and location-sensitive fields are either excluded, redacted, bucketed, hashed, or separately approved.
- **Latency validation:** verifies capture does not add user-visible latency to reports, lifecycle transitions, alerts, awareness, markers, Route Watch, or DriveTexas behavior.

## 7. Future Monitoring Hook Design

Future monitoring should be designed as operator-only observability and must not become history UI or live incident input.

Required monitoring points:

- capture attempts by environment, source, event type, and capture version;
- capture successes by environment, source, event type, and archive target;
- capture failures by failure class, source, event type, capture version, and redacted reason;
- duplicate event detections by idempotency key class and source;
- duplicate suppression outcomes;
- malformed envelope counts;
- timeout counts and capture-side latency distribution;
- write-gate blocked attempts;
- emergency-disable blocked attempts;
- environment-denied attempts;
- source-disabled attempts;
- writer credential failures;
- archive write latency and error rate;
- archive growth by day, source, and schema version;
- schema-version distribution;
- payload-size distribution and redacted sample audit results;
- last disablement and re-enablement action with runbook reference.

Monitoring must not change alerts, awareness, markers, Route Watch, DriveTexas, incident lifecycle state, or report behavior.

## 8. Future Emergency Disablement Design

Future disablement should use a layered kill-switch hierarchy.

1. **Global emergency disable**
   - Stops all capture attempts and writes immediately.
   - Highest precedence.
   - Safe default if configuration cannot be read.
2. **Write disable**
   - Stops archive persistence while optionally allowing approved diagnostics of capture attempts.
   - Must not require schema rollback or app rollback.
3. **Environment disable**
   - Prevents unapproved environments from writing or attempting capture.
   - Unknown environments are disabled.
4. **Source disable**
   - Disables individual future sources such as report created, report updated, report cleared, lifecycle transition, or shadow projection.
5. **Credential disable**
   - Revokes or disables writer access without affecting production report or lifecycle behavior.
6. **Worker / job disable**
   - Stops sidecar workers, queue consumers, scheduled jobs, or edge functions if a later architecture uses them.

Disablement verification should confirm:

- no new archive writes are occurring;
- capture failures are not surfacing to users;
- protected systems remain unchanged;
- re-enablement requires explicit review and audit trail.

## 9. Future Activation Prerequisites

Before any implementation milestone can begin, Gridly must have:

- approved exact implementation scope and source list;
- approved exact evidence envelope contract;
- approved feature flag names, hierarchy, defaults, and operational ownership;
- approved emergency disablement runbook;
- approved writer identity, credential scope, and secret-handling plan;
- approved environment allowlist policy;
- approved monitoring metrics, dashboards, thresholds, and redaction rules;
- approved validation plan and acceptance criteria;
- approved privacy and data minimization field list;
- approved retention and archive growth assumptions;
- approved source inventory and source ownership;
- approved failure-path test matrix;
- approved duplicate/idempotency strategy;
- approved latency budget;
- approved additive migration execution plan if storage is required;
- approved rollback/data preservation plan for any future real writes;
- confirmed no historical reads or UI are included;
- confirmed protected systems remain untouched;
- explicit authorization for implementation from a later milestone.

## 10. Implementation Design Recommendation

Recommended future implementation structure:

1. **Configuration boundary**
   - Centralize future capture flag evaluation in one capture-specific module or service boundary.
   - Default disabled for missing, ambiguous, invalid, or unapproved configuration.
2. **Source adapters**
   - Add small future sidecar adapters only at approved post-success or post-decision boundaries.
   - Each adapter emits a capture event and never mutates production state.
3. **Evidence transformer**
   - Convert capture events into versioned envelopes.
   - Perform schema, field, privacy, digest, and idempotency preparation.
4. **Write dispatcher**
   - Check write gate and environment allowlist before persistence.
   - Attempt append-only persistence only after production success.
   - Swallow capture-side failures into monitoring, not production flows.
5. **Archive writer**
   - Own only passive historical writes to approved storage.
   - Never expose historical reads to production.
6. **Monitoring sink**
   - Record attempts, successes, failures, duplicates, disablement, latency, and growth.
   - Keep operational telemetry separate from user-visible behavior.
7. **Validation harness**
   - Prove production parity, fail-open behavior, source coverage, duplicate suppression, write-gate enforcement, and no protected-system dependency before activation.

Recommended sequencing:

- First: finalize feature flags, envelope contract, source inventory, monitoring contract, and runbook.
- Second: approve storage/migration execution separately if still needed.
- Third: implement capture disabled by default.
- Fourth: validate with writes disabled.
- Fifth: enable writes only in an explicitly approved environment.

## 11. Next Milestone Recommendation

Next recommended milestone: **V383 — Passive Historical Capture Contract and Validation Plan**.

V383 should still be documentation-only and should define:

- exact evidence envelope fields;
- idempotency key format;
- approved source event contracts;
- privacy/data minimization rules;
- feature flag final names and defaults;
- validation matrix;
- monitoring metric names;
- emergency disablement runbook;
- implementation acceptance criteria.

V383 should not modify SQL, run migrations, execute Supabase commands, modify `js/app.js`, modify `index.html`, modify `css/styles.css`, add historical reads, add historical writes, add history UI, or change production behavior.

## 12. Explicit Non-Approval Statement

V382 does **NOT** approve:

- migration execution;
- migration application;
- Supabase deployment;
- historical reads;
- historical writes;
- history UI;
- production integration;
- production behavior changes;
- SQL changes;
- changes to `js/app.js`;
- changes to `index.html`;
- changes to `css/styles.css`;
- changes to alerts;
- changes to awareness;
- changes to markers;
- changes to Route Watch;
- changes to DriveTexas;
- changes to `loadSharedReports()`;
- changes to `activeHazards`;
- changes to `getLiveHazardIncidents()`;
- changes to `unifiedRoadIncidents`;
- changes to `activeUnifiedIncidents`.

V382 is documentation only. Current state remains:

- Migration applied: **NO**.
- Supabase changed: **NO**.
- Historical reads: **NO**.
- Historical writes: **NO**.
- History UI: **NO**.
- Production integration: **NO**.
- Production behavior changes: **NO**.
