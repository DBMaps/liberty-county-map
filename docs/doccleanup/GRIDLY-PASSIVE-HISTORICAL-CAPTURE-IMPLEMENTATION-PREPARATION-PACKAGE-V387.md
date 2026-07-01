# V387 — Passive Historical Capture Implementation Preparation Package

## 1. Program Summary

V355 through V386 established a documentation-only governance chain for Phase 1 passive historical evidence capture. The program has progressively moved from live/history separation, compatibility, shadow validation, schema governance, and dry-run planning into passive capture architecture, readiness, workplan, file-boundary approval, and implementation-preparation authorization.

Key outcomes now carried forward into V387:

- Historical evidence remains separate from live production state.
- Historical projection and capture concepts remain non-authoritative.
- The approved architecture is **Capture Everything. Show Nothing. Depend On Nothing.**
- V371 through V376 kept schema work as draft, reviewed, dry-run-governed, and unapplied.
- V378 through V381 narrowed the acceptable future path to pre-beta, passive, fail-open evidence accumulation planning only.
- V382 through V385 established staged planning, file-boundary thinking, acceptance expectations, and implementation-workplan review.
- V386 authorized implementation preparation only, not implementation, activation, Supabase deployment, historical reads, historical writes, history UI, or production integration.

Current state remains unchanged:

| Area | State |
| --- | --- |
| Migration applied | **NO** |
| Supabase changed | **NO** |
| Historical reads | **NO** |
| Historical writes | **NO** |
| History UI | **NO** |
| Production integration | **NO** |
| Production behavior changes | **NO** |

Protected production systems remain outside the implementation-preparation boundary:

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

## 2. Authorized Objective

V387 is authorized to define the final implementation-preparation package required before any future implementation work can begin.

This milestone may:

- Define required future artifacts.
- Define contract requirements that future artifacts must satisfy.
- Define validation, monitoring, rollback, and approval package requirements.
- Define exit criteria for moving from implementation preparation into implementation contract definition.
- Assess whether Gridly is ready to create implementation contracts.
- Recommend the next milestone.

This milestone may not create runtime contracts, implement code, modify application files, modify SQL, run Supabase commands, apply migrations, add historical reads, add historical writes, add history UI, integrate production behavior, or change any user-visible behavior.

## 3. Required Future Artifacts

The following artifacts must exist before implementation work can begin. V387 defines these artifacts only; it does not create them.

### Feature Flag Contract

A future feature flag contract must define:

- Global capture enablement semantics.
- Source-level enablement semantics.
- Write-gate semantics.
- Environment allowlist behavior.
- Default-disabled behavior for missing, ambiguous, invalid, or unapproved configuration.
- Emergency disablement behavior.
- Observability requirements for current flag state and last disablement state.

### Capture Event Contract

A future capture event contract must define:

- Supported event types.
- Required envelope fields.
- Optional envelope fields.
- Field-level privacy constraints.
- Idempotency and duplicate-detection requirements.
- Schema versioning requirements.
- Timestamp requirements.
- Source provenance requirements.
- Failure metadata requirements.

### Capture Source Boundary Contract

A future capture source boundary contract must define:

- Which completed production actions may be observed.
- Where source observation is allowed in future implementation planning.
- Which protected systems are excluded.
- Which production values may be copied into passive envelopes.
- Which production values must not be copied.
- Proof that capture observes after authoritative production decisions complete.

### Validation Package

A future validation package must define all tests, harnesses, fixtures, manual review steps, and acceptance evidence required to prove that passive capture is disabled-by-default, fail-open, invisible, non-authoritative, reversible, and production-isolated.

### Monitoring Package

A future monitoring package must define all operational counters, dashboards, logs, redaction rules, alerting boundaries, audit procedures, and disablement verification signals needed to observe capture health without creating user-facing history or production dependencies.

### Rollback Package

A future rollback package must define the exact disablement, revert, credential removal, evidence preservation, and production-behavior verification steps needed to stop or remove capture safely.

### Approval Package

A future approval package must collect the evidence required for implementation approval, including contract review, validation-plan review, monitoring-plan review, rollback-plan review, protected-system non-impact review, privacy review, and explicit non-approval boundaries.

### Acceptance Package

A future acceptance package must define objective pass/fail criteria for any later implementation milestone. It must include evidence that production behavior is unchanged and that all historical capture behavior remains passive, invisible, non-authoritative, fail-open, and reversible.

## 4. Capture Event Contract Requirements

A future capture event contract must require an immutable, versioned evidence envelope. The contract must remain implementation-neutral in the preparation phase and must not authorize writes.

### Required event types

The future contract must define, at minimum:

- `report_created`
- `report_updated`
- `report_cleared`
- `incident_transitioned`
- `incident_closed`

Additional event types may be proposed only if a later milestone proves they remain passive, fail-open, invisible, non-authoritative, and independent of production behavior.

### Required envelope expectations

Each future event envelope must define expectations for:

- Envelope schema version.
- Event type.
- Source system name.
- Source operation name.
- Source entity identifier or identifiers.
- Incident identifier when available and approved.
- Report identifier when available and approved.
- Event timestamp from the originating production action when available.
- Capture timestamp generated by the capture boundary.
- Idempotency key.
- Payload digest or duplicate-detection hash.
- Capture client or module version.
- Environment identity.
- Source-level feature gate state.
- Write-gate state.
- Redacted diagnostic metadata for capture-only failures.

### Required lifecycle expectations

Lifecycle-oriented events must define expectations for:

- Previous lifecycle state when available.
- Next lifecycle state when available.
- Transition reason when available and approved.
- Closed or resolved timestamp when available.
- Source report references when approved.
- Proof that lifecycle decisions were made before capture observation.

### Required privacy expectations

The future contract must define:

- Which fields are permitted.
- Which fields are prohibited.
- Which fields require hashing, truncation, redaction, or omission.
- Handling for free-form text.
- Handling for precise location and provenance data.
- Handling for user, device, credential, or operator identifiers.

### Required failure expectations

The future contract must define how capture-only failures are represented for monitoring without affecting production flows. Failure metadata must never become user-facing and must never change live incident, alert, awareness, marker, Route Watch, or DriveTexas behavior.

## 5. Validation Package Requirements

The future validation package must include all artifacts needed to prove production isolation and passive behavior before implementation approval.

Required validation artifacts:

- Validation matrix covering every supported event type.
- Protected-system non-impact checklist.
- Disabled-by-default tests.
- Global kill-switch tests.
- Source-level disablement tests.
- Write-gate disabled tests.
- Environment allowlist tests.
- Fail-open tests for storage unavailability, write rejection, malformed envelopes, credential removal, timeout, duplicate event, and configuration ambiguity.
- Parity tests proving identical user-visible behavior with capture disabled and enabled.
- No historical read tests for protected production systems.
- No production dependency tests proving live behavior does not branch on capture success or failure.
- Latency tests or measurements proving capture does not add user-visible delay.
- Duplicate/idempotency tests.
- Schema-version validation tests.
- Payload redaction and privacy validation tests.
- Fixture package for representative report creation, report update, report clear, incident transition, and incident closure cases.
- Manual review checklist for app files, SQL files, configuration, monitoring, and documentation.
- Evidence template for recording results.

Validation must explicitly cover that no changes occur to alerts, awareness, markers, Route Watch, DriveTexas, active hazard calculation, unified incidents, or shared report loading.

## 6. Monitoring Package Requirements

The future monitoring package must define operational visibility without creating production dependencies or user-facing history.

Required monitoring artifacts:

- Capture enabled/disabled state by environment.
- Source-level gate state by event type.
- Write-gate state.
- Capture attempt count by source and event type.
- Capture success count by source and event type.
- Capture failure count by source, event type, failure class, and schema version.
- Timeout count and timeout distribution.
- Capture latency distribution outside user-visible paths.
- Duplicate/idempotency detection count.
- Malformed envelope count.
- Payload redaction failure count.
- Storage or persistence error count.
- Daily event volume by source and event type.
- Volume anomaly detection definition.
- Schema-version distribution.
- Last disablement action and verification timestamp.
- Redacted sample audit procedure.
- Secret-handling and credential-observability rules.
- Runbook references for disablement, investigation, and recovery.

Monitoring must remain operational only. It must not affect alerts, awareness, markers, Route Watch, DriveTexas, live lifecycle decisions, or public map state.

## 7. Rollback Package Requirements

The future rollback package must make capture stoppable and reversible without affecting production behavior.

Required rollback artifacts:

- Global disablement procedure.
- Source-level disablement procedure.
- Write-gate disablement procedure.
- Environment allowlist removal procedure.
- Writer credential revocation procedure.
- Verification steps proving capture attempts stopped.
- Verification steps proving production reports still create, update, and clear normally.
- Verification steps proving alerts, awareness, markers, Route Watch, DriveTexas, active hazards, and unified incidents remain unchanged.
- Procedure for preserving or ignoring already captured evidence.
- Procedure for retaining diagnostics without exposing sensitive data.
- Procedure for reverting future code changes if needed.
- Procedure for backing out future configuration changes.
- Explicit statement that rollback must not require dropping production tables, deleting live reports, modifying protected systems, or changing user-facing behavior.

Rollback must be possible even if historical storage is unavailable, credentials are revoked, or capture configuration is invalid.

## 8. Approval Package Requirements

Before implementation approval, a future approval package must include evidence for all of the following:

- Feature flag contract reviewed and accepted.
- Capture event contract reviewed and accepted.
- Source boundary contract reviewed and accepted.
- Validation package reviewed and accepted.
- Monitoring package reviewed and accepted.
- Rollback package reviewed and accepted.
- Acceptance package reviewed and accepted.
- Privacy and field-minimization review completed.
- Protected-system non-impact review completed.
- File-boundary review completed.
- SQL and Supabase non-execution boundary acknowledged.
- Historical read prohibition acknowledged.
- Historical write prohibition acknowledged until a later explicit write-activation milestone.
- History UI prohibition acknowledged.
- Production integration prohibition acknowledged until separately approved.
- Explicit owner or reviewer assigned for contracts, validation, monitoring, rollback, privacy, and final approval.

Approval evidence must be recorded before any implementation planning milestone can authorize code changes.

## 9. Implementation Preparation Exit Criteria

Implementation preparation is complete only when all of the following are true:

1. Required future artifacts are named, scoped, and assigned to later milestones.
2. Capture event contract requirements are fully defined at the preparation level.
3. Validation package requirements are complete enough to produce test plans and acceptance evidence.
4. Monitoring package requirements are complete enough to produce operational runbooks and dashboards.
5. Rollback package requirements are complete enough to prove immediate disablement and reversibility.
6. Approval package requirements are complete enough to govern future implementation approval.
7. Protected systems remain explicitly excluded.
8. No SQL has been changed.
9. No Supabase command has been run.
10. No migration has been applied or executed.
11. No `js/app.js`, `index.html`, or `css/styles.css` changes have been made.
12. No historical reads have been added.
13. No historical writes have been added.
14. No history UI has been added.
15. No alerts, awareness, markers, Route Watch, DriveTexas, or production behavior changes have been made.

Only after these criteria are satisfied may Gridly proceed to implementation contract definition.

## 10. Readiness Assessment

Gridly is ready to create implementation contracts for Phase 1 passive historical evidence capture.

Rationale:

- The architectural posture is stable: **Capture Everything. Show Nothing. Depend On Nothing.**
- V386 authorized implementation preparation, and V387 defines the package needed to translate preparation into future contracts.
- The required future artifacts are now identified.
- The contract, validation, monitoring, rollback, approval, and acceptance expectations are defined at the preparation level.
- The current milestone remains documentation-only and does not disturb production systems.

Remaining risk is controlled by requiring future implementation contract definition before implementation planning, and by preserving explicit non-approval for migrations, Supabase deployment, historical reads, historical writes, UI, integration, and production behavior changes.

## 11. GO / NO-GO Recommendation

**Recommendation: A. Ready For Implementation Contract Definition**

V387 is a **GO** for implementation contract definition only.

Rationale:

- Gridly has enough preparation detail to define precise future contracts.
- The required artifacts are identified without being prematurely created.
- The protected-system boundary is preserved.
- The fail-open, non-authoritative, invisible, reversible, and independent posture is maintained.
- No implementation, activation, migration, Supabase deployment, historical reads, historical writes, history UI, or production behavior changes are approved by this recommendation.

## 12. Next Milestone Recommendation

Recommended next milestone:

**V388 — Passive Historical Capture Implementation Contract Definition**

V388 should define the future feature flag contract, capture event envelope contract, source boundary contract, validation evidence templates, monitoring interface contract, rollback checklist, and acceptance criteria. V388 should remain documentation-only unless explicitly authorized otherwise, and it should not implement runtime code, apply migrations, run Supabase commands, add historical reads, add historical writes, add UI, or change production behavior.

## 13. Explicit Non-Approval Statement

V387 does **NOT** approve:

- migration execution
- migration application
- Supabase deployment
- historical reads
- historical writes
- history UI
- production integration
- production behavior changes

V387 also does **NOT** approve SQL changes, Supabase commands, `js/app.js` changes, `index.html` changes, `css/styles.css` changes, alert changes, awareness changes, marker changes, Route Watch changes, DriveTexas changes, active hazard changes, unified incident changes, or any user-visible behavior change.
