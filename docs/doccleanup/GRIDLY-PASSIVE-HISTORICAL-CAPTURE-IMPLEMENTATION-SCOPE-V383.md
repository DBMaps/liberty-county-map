# V383 — Passive Historical Capture Implementation Scope

## 1. Program Context

V383 is the first implementation-planning milestone for Gridly's passive historical evidence capture system. It defines the exact future implementation scope only. It does **not** implement capture, run migrations, apply migrations, deploy Supabase changes, add historical reads, add historical writes, add history UI, or change production behavior.

### Outcomes from V355–V382

- **V355–V362 — Live-state stabilization and fixture groundwork:** stabilized the current live-report and incident interpretation posture, protected current production counts, and established fixture/parity expectations needed before any historical planning could safely proceed.
- **V363 — Live/History Implementation Readiness Gate:** confirmed that historical planning may proceed only if current production behavior remains unchanged. It established the protected production ownership chain: `reports → loadSharedReports() → activeHazards → getLiveHazardIncidents() → unifiedRoadIncidents → activeUnifiedIncidents → alerts → awareness → markers → Route Watch`.
- **V364–V368 — Historical Projection Program:** created and validated a shadow historical projection foundation, validated fixture parity, hardened runtime isolation, tested shadow enablement, and locked the projection baseline without adding historical reads, writes, UI, production integration, or user-visible behavior.
- **V369–V376 — Historical Schema Governance Program:** designed, reviewed, and governed an additive-only future historical schema path. Draft migration artifacts were produced and audited, but no migration was applied, no Supabase state changed, and no production dependency was created.
- **V377–V382 — Historical Activation / Passive Capture Planning Program:** evaluated minimal activation strategy, execution readiness, architecture, readiness planning, and implementation design for passive capture. These milestones converged on the operating principle: **Capture Everything. Show Nothing. Depend On Nothing.**

### Current state entering V383

- Migration applied: **NO**.
- Supabase changed: **NO**.
- Historical reads: **NO**.
- Historical writes: **NO**.
- History UI: **NO**.
- Production integration: **NO**.
- Production behavior changes: **NO**.

## 2. Exact Scope Definition

### Passive historical capture would include

A future passive historical capture implementation would include only a best-effort, isolated, append-only archival path for historical evidence emitted after existing production actions have already completed.

Exact future scope:

1. **Capture envelope definition**
   - Define a versioned historical evidence envelope.
   - Include approved source, event, identifier, timestamp, lifecycle, digest, idempotency, and diagnostic fields.
   - Exclude fields not approved by privacy, retention, and governance review.
2. **Passive source observation**
   - Observe completed production events only after authoritative production behavior has succeeded.
   - Treat capture as a sidecar, not as part of production success criteria.
3. **Append-only archival writes**
   - Attempt writes to a future isolated evidence archive only when all required flags, environment gates, and write gates allow it.
   - Preserve immutability and duplicate handling through idempotency keys and payload hashes.
4. **Fail-open error handling**
   - Contain transform failures, write failures, timeouts, malformed envelopes, duplicate detection failures, monitoring failures, unavailable storage, and missing credentials inside the capture boundary.
5. **Feature flag and disablement controls**
   - Provide emergency disablement, environment allowlisting, global capture gating, write gating, and source-level gates.
6. **Monitoring hooks**
   - Record capture health, attempts, successes, failures, duplicate rates, latency, volume, schema version drift, and disablement state for maintainers only.
7. **Validation hooks**
   - Prove production isolation, parity, failure isolation, duplicate suppression, source coverage, latency safety, privacy conformance, rollback readiness, and disabled-state behavior before activation.
8. **Rollback and disablement documentation**
   - Define how to stop capture without migration rollback, data restore, cleanup scripts, protected-system edits, or user-visible changes.

### Passive historical capture would NOT include

A future passive historical capture implementation would not include:

- migration execution or migration application;
- Supabase production deployment;
- modification of existing SQL without a separately approved migration milestone;
- historical reads;
- history UI;
- analytics UI;
- production map layers;
- alert changes;
- awareness changes;
- marker changes;
- Route Watch changes;
- DriveTexas changes;
- changes to report validation rules;
- changes to report submit success criteria;
- changes to report update success criteria;
- changes to report clear behavior;
- changes to incident lifecycle decisions;
- historical evidence as an authority for active state;
- backfills;
- cleanup jobs;
- retention jobs;
- intelligence generation;
- recurrence scoring;
- duration scoring;
- user-facing history summaries;
- protected-system rewiring.

Protected systems that must remain out of scope:

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

## 3. Phase 1 Implementation Scope

The smallest possible future Phase 1 implementation is **passive evidence archive write preparation and fail-open append-only capture**, with no reads and no UI.

### Phase 1 would include

- A dedicated capture module or service boundary that can build evidence envelopes after approved completed events.
- A versioned evidence envelope contract.
- Append-only write attempts to a future approved archive target.
- Idempotency key and payload digest generation.
- Strict fail-open behavior for every capture step.
- Global capture flag evaluation.
- Separate write-gate evaluation.
- Source-level flag evaluation.
- Environment allowlist evaluation.
- Emergency disablement behavior.
- Monitoring hooks for maintainers only.
- Validation hooks and fixtures proving production parity.
- Documentation for disablement, credential revocation, and operational verification.

### Phase 1 would not include

- Historical reads.
- History UI.
- Intelligence generation.
- Recurrence analysis.
- Duration analysis.
- Production dependency on archive availability.
- Synchronous retries on user-visible paths.
- Backfill of existing reports.
- Production schema migration unless separately approved by a later milestone.
- Any change to `js/app.js`, `index.html`, or `css/styles.css` as part of V383.
- Any change to alerts, awareness, markers, Route Watch, DriveTexas, or incident authority.

## 4. Future Data Objects

Future passive capture should use explicit event types. These names are scope definitions only and are not implemented by V383.

### Required evidence types

1. `report_created`
   - Captures a completed report creation after successful production persistence.
   - Purpose: preserve initial raw provenance.
2. `report_updated`
   - Captures approved changed-field provenance after successful production update behavior.
   - Purpose: preserve how evidence changed over time.
3. `report_cleared`
   - Captures report resolution or clear provenance after successful production clear behavior.
   - Purpose: support future duration and closure analysis without changing clear behavior.
4. `incident_transitioned`
   - Captures a completed post-decision incident lifecycle transition.
   - Purpose: preserve normalized lifecycle evidence after the authoritative production decision.
5. `incident_closed`
   - Captures a completed incident closure outcome when lifecycle logic has already determined closure.
   - Purpose: support future closed-state validation and duration analysis.

### Optional future evidence types requiring separate approval

- `incident_reopened`
- `incident_merged`
- `incident_suppressed`
- `incident_expired`
- `shadow_projection_emitted`
- `capture_duplicate_detected`
- `capture_envelope_rejected`

### Minimum envelope fields for future design

- `schema_version`
- `capture_source`
- `event_type`
- `source_entity_type`
- `source_entity_id`
- `incident_id` when available
- `event_timestamp`
- `capture_timestamp`
- `previous_lifecycle_state` when available
- `next_lifecycle_state` when available
- `approved_location_reference` or approved coordinate bucket when available
- `approved_provenance_fields`
- `payload_digest`
- `idempotency_key`
- `duplicate_detection_hash`
- `capture_version`
- `environment`
- `redacted_diagnostic_metadata`

## 5. Future Capture Boundaries

### Primary capture source

**Post-decision incident lifecycle transitions** should be the primary future capture source.

Rationale:

- Lifecycle transitions occur after current production logic has made the authoritative decision.
- They provide the strongest normalized evidence for active, resolved, expired, suppressed, merged, reopened, and closed states.
- They avoid making historical storage responsible for live authority, alerts, awareness, markers, or Route Watch behavior.

### Supplemental capture sources

Supplemental future sources should be:

- report creation;
- report update;
- report clear;
- optional shadow projection outputs only after separate approval.

Rationale:

- Report events preserve raw provenance that lifecycle transitions may normalize away.
- Clear events preserve closure evidence for future duration review.
- Update events explain why lifecycle evidence changed.
- Shadow projection evidence is derived and should remain validation support, not authoritative capture input.

### Rejected capture sources

The following sources should be rejected for Phase 1:

- UI state.
- Map marker render state.
- Alert output state.
- Awareness output state.
- Route Watch output state.
- DriveTexas output state.
- Client-side presentation-only derived objects.
- Historical projection as primary truth.
- Backfilled old test data.
- Direct table triggers on protected production tables without separate governance approval.

Rationale:

- Presentation state is not stable evidence.
- Output state risks making historical capture dependent on user-facing behavior.
- Backfilled old rows are known to include testing artifacts and should not seed historical truth.
- Production-table triggers increase coupling and rollback risk.

## 6. Future Feature Flag Inventory

These are future planning names only. V383 does not implement them.

| Flag | Owner | Default | Purpose |
| --- | --- | --- | --- |
| `GRIDLY_HISTORY_CAPTURE_EMERGENCY_DISABLE` | Operations | enabled / safe-disabled | Highest-priority kill switch; stops all capture attempts and writes. |
| `GRIDLY_HISTORY_CAPTURE_ENV_ALLOWLIST` | Operations + Engineering | empty | Limits capture to explicitly approved environments. |
| `GRIDLY_ENABLE_PASSIVE_HISTORY_CAPTURE` | Product + Engineering | `false` | Allows envelope construction attempts when approved. |
| `GRIDLY_ENABLE_HISTORY_CAPTURE_WRITES` | Engineering + Operations | `false` | Allows persistence after capture is otherwise enabled. |
| `GRIDLY_ENABLE_HISTORY_CAPTURE_REPORT_CREATED` | Engineering | `false` | Allows `report_created` capture. |
| `GRIDLY_ENABLE_HISTORY_CAPTURE_REPORT_UPDATED` | Engineering | `false` | Allows `report_updated` capture. |
| `GRIDLY_ENABLE_HISTORY_CAPTURE_REPORT_CLEARED` | Engineering | `false` | Allows `report_cleared` capture. |
| `GRIDLY_ENABLE_HISTORY_CAPTURE_LIFECYCLE_TRANSITION` | Engineering | `false` | Allows `incident_transitioned` and approved lifecycle event capture. |
| `GRIDLY_ENABLE_HISTORY_CAPTURE_SHADOW_PROJECTION` | Product + Engineering | `false` | Optional later derived projection evidence gate; not Phase 1 by default. |
| `GRIDLY_HISTORY_CAPTURE_MONITORING_ENABLED` | Operations | `false` until approved | Enables capture-health telemetry for maintainers only. |

Flag rules:

- Missing, invalid, ambiguous, or unapproved flag state must resolve to disabled.
- Emergency disablement overrides all other flags.
- Environment allowlist failure prevents writes.
- Write gate must be separate from capture-attempt gate.
- Source-level flags never imply global enablement.
- No historical read or history UI flag is part of Phase 1 capture scope.

## 7. Future Validation Inventory

Required validation before any activation:

1. **Production isolation validation**
   - Prove no historical reads are introduced.
   - Prove protected systems do not branch on capture success, failure, or archive availability.
2. **Parity validation**
   - Compare production behavior with capture disabled and capture enabled.
   - Require identical user-visible reporting, alerts, awareness, markers, Route Watch, DriveTexas, and lifecycle outcomes.
3. **Fail-open validation**
   - Simulate transform failure, archive write failure, timeout, storage unavailable, malformed envelope, duplicate event, disabled flag, environment deny, monitoring failure, and credential revocation.
   - Confirm originating production operations still succeed.
4. **Duplicate validation**
   - Verify idempotency keys and payload hashes suppress or classify duplicates only inside the capture boundary.
5. **Source coverage validation**
   - Verify approved sources emit expected attempts.
   - Verify rejected sources remain silent.
6. **Schema envelope validation**
   - Verify only approved fields are present.
   - Verify schema versioning and digest generation are stable.
7. **Privacy validation**
   - Confirm free-form content, personal identifiers, device metadata, and precise location details are minimized or governed.
8. **Latency validation**
   - Confirm capture does not add user-visible latency.
9. **Flag validation**
   - Confirm missing, malformed, disabled, and conflicting flag states fail safe.
10. **Rollback validation**
    - Confirm capture can be stopped without application rollback, migration rollback, data restore, cleanup scripts, or protected-system edits.
11. **Operational validation**
    - Confirm operators can observe attempts, failures, duplicate rates, volume, and disablement state.

## 8. Future Monitoring Inventory

Future monitoring must be maintainer-facing only and must not become history UI or production input.

Required metrics:

- capture attempt count by source and event type;
- capture success count by source and event type;
- capture failure count by failure class;
- archive write success count;
- archive write failure count;
- duplicate event count;
- malformed envelope count;
- timeout count;
- skipped-by-flag count;
- skipped-by-environment count;
- skipped-by-write-gate count;
- credential failure count;
- latency distribution;
- archive growth rate;
- schema version distribution;
- source-level volume anomalies;
- emergency disablement state;
- last successful write timestamp by source;
- last failure timestamp by source.

Monitoring requirements:

- Monitoring failure must not affect production behavior.
- Monitoring must redact sensitive payload content.
- Monitoring must not expose evidence to users.
- Monitoring must not feed alerts, awareness, markers, Route Watch, or active incident decisions.

## 9. Future Rollback Inventory

Rollback and disablement requirements:

- A single emergency disablement path must stop all capture attempts.
- A separate write gate must stop archive writes while allowing capture code to remain deployed.
- Source-level flags must disable individual sources independently.
- Environment allowlist removal must stop writes from that environment.
- Credential revocation must stop writes without affecting production report or incident behavior.
- Capture code must tolerate missing archive storage.
- Historical evidence can be ignored without changing production behavior.
- No rollback path may require modifying `loadSharedReports()`, `activeHazards`, `getLiveHazardIncidents()`, `unifiedRoadIncidents`, `activeUnifiedIncidents`, alerts, awareness, markers, Route Watch, or DriveTexas.
- Rollback must not require data restore, cleanup scripts, user-facing communication, map changes, or history UI changes.

## 10. Estimated Implementation Effort

Estimated complexity: **Medium**.

Rationale:

- The narrow Phase 1 scope is conceptually simple because it is append-only, write-only, invisible, and non-authoritative.
- Complexity comes from proving isolation, validating fail-open behavior, designing exact envelope fields, controlling flags safely, and monitoring without production dependency.
- The largest engineering risk is not the archival write itself; it is guaranteeing capture cannot affect report submission, clearing, lifecycle transitions, alerts, awareness, markers, Route Watch, or DriveTexas behavior.

Estimated effort bands for a later approved implementation milestone:

- Envelope contract and capture module: **Small to Medium**.
- Feature flag and disablement framework: **Small to Medium**.
- Append-only writer integration: **Medium**.
- Monitoring hooks: **Medium**.
- Validation and parity tests: **Medium to Large**.
- Operational runbook and rollback evidence: **Small to Medium**.

## 11. Risk Assessment

### Production risk

Assessment: **Low if the V383 scope is followed; High if boundaries are violated.**

Passive capture is safe only when production completes first and capture is best-effort. Any dependency from production behavior to capture success, storage availability, historical reads, or monitoring output would violate the architecture and increase production risk.

### Operational risk

Assessment: **Medium.**

New write paths, credentials, monitoring, environment gates, and disablement controls require operational ownership. The risk is manageable only if emergency disablement and write-gate behavior are validated before activation.

### Maintenance risk

Assessment: **Medium.**

Append-only evidence creates long-term schema, retention, duplicate, monitoring, and data-quality ownership. This risk is lower than a user-facing historical system because no reads or UI are included, but it is not zero.

### Beta risk

Assessment: **Low to Medium.**

Beta risk remains low if capture is invisible, fail-open, disabled by default, and independent of production behavior. It becomes medium or high if capture introduces latency, user-visible errors, accidental reads, or incomplete history expectations.

## 12. Implementation Recommendation

Recommendation: **A. Proceed to implementation planning.**

Rationale:

- V363–V382 established sufficient architecture, governance, isolation principles, and readiness planning to define a narrow implementation plan.
- The safest next step is not implementation; it is a more detailed implementation-planning milestone that converts this scope into exact file boundaries, test requirements, envelope schema, flag evaluation rules, and rollback proof.
- Additional broad design is not required before planning, but detailed implementation specifications are required before any code, SQL, Supabase, or production integration change.

## 13. Next Milestone Recommendation

Recommended next milestone:

**V384 — Passive Historical Capture Implementation Plan and Acceptance Criteria**

V384 should define, before any code changes:

- exact files that may be changed in a future implementation milestone;
- exact files that remain forbidden;
- exact envelope schema contract;
- exact feature flag evaluation order;
- exact capture source attachment points;
- exact tests required for fail-open behavior;
- exact monitoring event names;
- exact rollback runbook;
- exact acceptance criteria for enabling writes in a non-production environment;
- explicit confirmation that migrations, Supabase deployment, historical reads, history UI, and production behavior changes remain unapproved.

## 14. Explicit Non-Approval Statement

V383 does **NOT** approve:

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

V383 is documentation only. It defines future implementation scope and preserves the current state:

- Migration applied: **NO**.
- Supabase changed: **NO**.
- Historical reads: **NO**.
- Historical writes: **NO**.
- History UI: **NO**.
- Production integration: **NO**.
- Production behavior changes: **NO**.
