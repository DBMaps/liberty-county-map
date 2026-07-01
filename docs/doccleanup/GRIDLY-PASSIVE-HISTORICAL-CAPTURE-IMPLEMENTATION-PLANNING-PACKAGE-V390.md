# V390 — Passive Historical Capture Implementation Planning Package

## 1. Program Summary

V390 is a documentation-only implementation-planning package for Phase 1 passive historical evidence capture. It converts the V389 implementation-planning authorization into the exact artifact, sequencing, validation, rollback, monitoring, and approval requirements that must exist before any later implementation review may begin.

V390 does not implement capture, activate capture, apply migrations, execute migrations, run Supabase commands, modify SQL, modify production application files, add historical reads, add historical writes, add history UI, or change production behavior.

### V355–V389 outcomes

- **V355–V362 — Live-state stabilization and fixture groundwork:** Gridly stabilized live report and incident behavior, protected current production output as the baseline, and established fixture/parity expectations for any future historical work.
- **V363 — Live/history readiness gate:** Historical work was constrained to shadow/audit-only planning. The live authority chain remained protected: `reports → loadSharedReports() → activeHazards → getLiveHazardIncidents() → unifiedRoadIncidents() → activeUnifiedIncidents() → alerts → awareness → markers → Route Watch`.
- **V364–V368 — Shadow historical projection foundation:** Shadow historical projection design, validation, parity, runtime hardening, forced shadow testing, and handoff were completed without historical reads, historical writes, history UI, production dependencies, alert changes, awareness changes, marker changes, Route Watch changes, or DriveTexas changes.
- **V369–V376 — Historical schema governance and dry-run readiness:** Additive schema concepts, migration safety review, dry-run planning, and governance decisions were documented. No migration was applied, no migration was executed, and no Supabase state changed.
- **V377–V383 — Passive capture activation strategy, architecture, readiness, design, and scope:** Gridly established the governing principle: **Capture Everything. Show Nothing. Depend On Nothing.** Future capture must be passive, fail-open, non-authoritative, reversible, invisible to users, and independent of production behavior.
- **V384–V385 — Implementation plan, acceptance criteria, workplan, and file-boundary approval:** Gridly documented disabled-by-default controls, fail-open expectations, production parity obligations, validation requirements, rollback expectations, staged sequencing, and planning-level file boundaries.
- **V386 — File-boundary ratification and implementation-preparation authorization:** Gridly authorized implementation preparation only and ratified sidecar-only, disabled-by-default, non-production-safe preparation boundaries while preserving protected systems.
- **V387 — Implementation preparation package:** Gridly defined preparation artifacts needed before contract definition and concluded the program was ready for implementation contract definition only.
- **V388 — Passive historical capture contract definition:** Gridly defined the feature flag, capture event, source boundary, validation, monitoring, rollback, data minimization, activation prerequisite, prohibited dependency, and non-approval contracts.
- **V389 — Implementation planning authorization:** Gridly authorized implementation planning only and required a later planning package before implementation review could occur.

### Current state entering and exiting V390

- Migration applied: **NO**.
- Supabase changed: **NO**.
- Historical reads: **NO**.
- Historical writes: **NO**.
- History UI: **NO**.
- Production integration: **NO**.
- Production behavior changes: **NO**.

### Protected systems

V390 does not authorize changes to, dependencies on, reads from, writes to, or behavior changes in any protected system:

- `loadSharedReports()`
- `activeHazards`
- `getLiveHazardIncidents()`
- `unifiedRoadIncidents()`
- `activeUnifiedIncidents()`
- alerts
- awareness
- markers
- Route Watch
- DriveTexas

## 2. Phase 1 Implementation Objective

The exact future Phase 1 implementation objective is to prepare a disabled-by-default, sidecar-only passive evidence capture path that can observe already-successful live lifecycle events and, only when all approved gates are explicitly enabled in an approved environment, attempt non-blocking archive writes of contract-compliant historical evidence envelopes.

The objective is limited to passive capture infrastructure. It must not create historical reads, history UI, analytics output, user-facing behavior, alert influence, awareness influence, marker influence, Route Watch influence, DriveTexas influence, or production authority.

Phase 1 implementation must preserve these principles:

1. **Capture Everything:** preserve approved evidence envelopes for approved event families once all gates are explicitly enabled.
2. **Show Nothing:** expose no user-visible history, UI, alerts, awareness, marker changes, or Route Watch changes.
3. **Depend On Nothing:** production success must never wait on or depend on capture initialization, validation, digesting, duplicate checks, monitoring, credentials, networking, Supabase availability, or archive write success.
4. **Passive:** capture may only observe post-success facts and may never participate in live decision-making.
5. **Fail-open:** every capture failure must leave production behavior unchanged.
6. **Non-authoritative:** archived historical evidence must not become live incident authority.
7. **Reversible:** disabling or removing capture must not require production data restores, protected-system changes, UI changes, or behavior changes.
8. **Invisible to users:** capture diagnostics must remain maintainer-only.

## 3. Required Implementation Artifacts

Before implementation review may begin, the following planning artifacts must exist as documentation or review packages. These artifacts are required deliverables; V390 does not implement them in runtime code.

### 3.1 Feature flag package

The feature flag package must define:

- Global enablement gate, default **disabled**.
- Write enablement gate, default **disabled**.
- Environment allowlist gate, default **empty allowlist**.
- Emergency disablement gate with highest precedence.
- Source-level gates, default **disabled** for every source.
- Optional event-level gates only if explicitly approved by a later contract milestone.
- Gate precedence, malformed-config behavior, missing-config behavior, unreadable-config behavior, and unknown-key behavior.
- Proof that gate failures fail closed for historical writes and fail open for production behavior.

### 3.2 Capture event package

The capture event package must define:

- Event taxonomy limited to `report_created`, `report_updated`, `report_cleared`, `incident_transitioned`, and `incident_closed`.
- Canonical envelope field mapping for every event type.
- Contract version and schema version expectations.
- Source family identifiers and event eligibility rules.
- Timestamp rules, lifecycle state rules, and event metadata rules.
- Deterministic idempotency key and digest requirements.
- Duplicate handling metadata that does not mutate production state.
- Data minimization and redaction requirements.

### 3.3 Source boundary package

The source boundary package must define:

- Candidate post-success observation points.
- Proof that each candidate point is after production success has already occurred.
- Proof that each candidate point can call sidecar capture without changing return values, live state, alerts, awareness, markers, Route Watch, DriveTexas, or UI.
- Explicit exclusion of protected-system modifications.
- Explicit exclusion of historical reads and user-visible output.

### 3.4 Validation package

The validation package must define:

- Production parity validation before and after capture code is present but disabled.
- Disabled-by-default validation.
- Feature gate validation.
- Fail-open validation.
- Timeout validation.
- Duplicate/idempotency validation.
- Envelope validation.
- Data minimization validation.
- Monitoring isolation validation.
- Rollback validation.
- No historical read validation.
- No history UI validation.
- Protected-system non-impact validation.

### 3.5 Monitoring package

The monitoring package must define maintainer-only diagnostics for:

- Capture disabled state.
- Gate decisions.
- Envelope validation acceptance/rejection counts.
- Write-attempt counts when writes are explicitly enabled.
- Write success/failure counts when writes are explicitly enabled.
- Timeout counts.
- Duplicate suppression counts.
- Emergency-disable state.
- Redacted error categories.

Monitoring must not feed alerts, awareness, markers, Route Watch, DriveTexas, history UI, user notifications, or production authority.

### 3.6 Rollback package

The rollback package must define:

- Emergency disablement order.
- Source gate disablement order.
- Write gate disablement order.
- Global gate disablement order.
- Code rollback expectations if needed.
- Verification that production behavior remains unchanged with capture disabled, absent, failing, or removed.
- Verification that rollback does not require migration reversal, Supabase cleanup, protected-system edits, UI changes, or production data restores.

### 3.7 Acceptance package

The acceptance package must define:

- Required evidence for implementation review.
- Required tests and manual checks.
- Required parity outputs.
- Required reviewer sign-offs.
- Required non-approval statements.
- Explicit criteria for rejecting implementation authorization.

### 3.8 Privacy and retention package

The privacy and retention package must define:

- Approved envelope fields.
- Prohibited fields.
- Redaction rules for diagnostics.
- Credential and secret exclusion.
- User/device identifier exclusion unless separately approved.
- Precise location handling requirements.
- Retention assumptions and deletion expectations for a later operational review.

### 3.9 Operational ownership package

The operational ownership package must define:

- Owner for gate configuration.
- Owner for emergency disablement.
- Owner for monitoring review.
- Owner for archive availability review.
- Owner for privacy review.
- Owner for implementation acceptance evidence.
- Escalation path if capture affects production behavior.

## 4. Implementation Sequence

Future implementation, if separately authorized, must occur in this order:

1. **Documentation baseline confirmation** — confirm V388, V389, and V390 boundaries remain current.
2. **Branch and file-boundary setup** — create implementation branch and sidecar-only file structure; do not modify protected systems unless a later milestone explicitly authorizes a named integration seam.
3. **Feature flags** — implement disabled-by-default gates with emergency disablement precedence and fail-open production behavior.
4. **Validation primitives** — implement envelope validation, data minimization checks, digest/idempotency helpers, and safe rejection behavior before any write adapter can be active.
5. **Capture event construction** — implement canonical envelope construction for approved event types only.
6. **Sidecar archive adapter boundary** — implement non-blocking, timeout-bounded archive write adapter behind disabled write gates.
7. **Capture hooks** — add only approved post-success observation hooks after validation proves they cannot alter production return values or state.
8. **Monitoring** — implement maintainer-only diagnostics isolated from user-facing systems.
9. **Disabled-state acceptance** — prove capture present but disabled has no production effect.
10. **Non-production gated write testing** — only in an approved non-production environment after all gates and validation packages pass.
11. **Rollback rehearsal** — prove emergency disablement and code rollback leave production behavior unchanged.
12. **Implementation acceptance package** — assemble evidence for a later authorization decision.

Compressed sequence view:

```text
Documentation Baseline
↓
Branch / File Boundaries
↓
Flags
↓
Validation Primitives
↓
Capture Event Construction
↓
Archive Adapter Boundary
↓
Capture Hooks
↓
Monitoring
↓
Disabled-State Acceptance
↓
Non-Production Gated Write Testing
↓
Rollback Rehearsal
↓
Implementation Acceptance Package
```

## 5. Validation Sequence

Future validation must occur in this exact order:

1. **Static boundary validation:** verify no prohibited files, SQL, migrations, Supabase commands, protected systems, historical reads, history UI, alert changes, awareness changes, marker changes, Route Watch changes, or DriveTexas changes are present.
2. **Default-disabled validation:** verify all gates default to disabled and no write attempts occur by default.
3. **Production parity validation:** compare live report, incident, alert, awareness, marker, Route Watch, and DriveTexas behavior with capture absent versus capture present but disabled.
4. **Gate precedence validation:** prove emergency disablement overrides every enablement gate and malformed configuration disables historical writes.
5. **Envelope validation:** prove only contract-approved event types and fields pass validation.
6. **Data minimization validation:** prove prohibited fields, secrets, credentials, unapproved identifiers, and unapproved precise-location data are rejected or redacted.
7. **Idempotency validation:** prove deterministic keys and digests are stable and duplicate handling does not mutate production state.
8. **Fail-open validation:** force validation, digest, duplicate, adapter, credential, network, timeout, schema, permission, and monitoring failures and prove production behavior remains unchanged.
9. **Monitoring isolation validation:** prove diagnostics are maintainer-only and do not feed UI or protected production systems.
10. **Rollback validation:** prove emergency disablement and removal paths leave production behavior unchanged.
11. **Approval evidence validation:** prove every required artifact, test result, and reviewer sign-off exists before implementation authorization is considered.

## 6. Rollback Sequence

Future rollback must occur in this order:

1. **Emergency disablement:** activate the highest-precedence emergency disablement gate.
2. **Source gates off:** disable all source-level gates.
3. **Write gate off:** disable historical write enablement.
4. **Global gate off:** disable global capture enablement.
5. **Environment allowlist empty:** remove all environments from the allowlist.
6. **Monitoring verification:** confirm only maintainer diagnostics changed and no user-facing systems changed.
7. **Production parity check:** confirm reports, active incidents, alerts, awareness, markers, Route Watch, DriveTexas, and protected functions match expected production behavior.
8. **Code rollback if required:** revert sidecar capture code and any approved hook changes from the implementation branch or deployment.
9. **Post-rollback evidence:** document that production behavior is unchanged and no migration reversal, Supabase cleanup, protected-system edits, UI changes, or production data restores were required.

Rollback success requires all of the following:

- No historical write attempts continue after disablement.
- No historical reads are introduced.
- No history UI appears.
- Production reports and incident collections remain authoritative and unchanged.
- Alerts, awareness, markers, Route Watch, and DriveTexas remain unchanged.
- Maintainer-only diagnostics confirm disabled state without user-visible output.
- Rollback can be completed without migration reversal or Supabase cleanup.

## 7. Monitoring Sequence

Future monitoring must be deployed in this order:

1. **Monitoring contract review:** confirm every metric/log is maintainer-only and redacted.
2. **Disabled-state diagnostics:** add diagnostics that confirm capture is disabled without constructing or writing historical records.
3. **Gate-decision diagnostics:** add redacted diagnostics for gate decisions and emergency disablement state.
4. **Validation diagnostics:** add counts for accepted/rejected envelopes without exposing sensitive payloads.
5. **Adapter diagnostics:** add write-attempt, write-success, write-failure, timeout, and duplicate counts only behind write gates.
6. **Failure categorization:** add redacted error categories for configuration, validation, duplicate, network, credential, permission, schema, timeout, and archive availability failures.
7. **Monitoring isolation validation:** prove diagnostics do not feed alerts, awareness, markers, Route Watch, DriveTexas, UI, or production authority.
8. **Operational review:** assign monitoring ownership and review cadence before any non-production write testing.

## 8. Approval Package Requirements

Before implementation approval can be considered, the approval package must include:

- Completed feature flag package.
- Completed capture event package.
- Completed source boundary package.
- Completed validation package.
- Completed monitoring package.
- Completed rollback package.
- Completed acceptance package.
- Completed privacy and retention package.
- Completed operational ownership package.
- Protected-system impact analysis.
- Candidate hook eligibility analysis.
- Production parity evidence with capture absent and capture present but disabled.
- Disabled-by-default evidence.
- Fail-open evidence for all required failure classes.
- Gate precedence evidence.
- Envelope validation evidence.
- Duplicate/idempotency evidence.
- Data minimization evidence.
- Monitoring isolation evidence.
- Rollback rehearsal evidence.
- Non-production gating evidence, if any write test is proposed.
- Reviewer sign-offs from engineering, product/governance, operations/maintainers, and privacy/data review.
- Explicit non-approval checklist confirming that planning completion does not approve deployment or activation.

## 9. Implementation Review Entry Criteria

Implementation review may begin only when all of the following exist:

1. V390 is merged or otherwise accepted as the governing planning package.
2. Every artifact listed in Section 3 has a complete draft ready for review.
3. The protected-system impact analysis identifies no required protected-system modification.
4. The source boundary package identifies only post-success, non-blocking, sidecar-only observation candidates.
5. The feature flag package proves default-disabled behavior and emergency disablement precedence.
6. The validation package includes exact tests for disabled-state parity, fail-open behavior, monitoring isolation, and rollback.
7. The rollback package proves production behavior does not depend on capture being present.
8. The privacy and retention package lists approved and prohibited fields.
9. The approval package contains an explicit non-approval statement.
10. No SQL, migration, Supabase, `js/app.js`, `index.html`, or `css/styles.css` changes have been made as part of V390.

## 10. Implementation Review Exit Criteria

Implementation review may exit with implementation authorization only if reviewers prove all of the following:

1. Future implementation remains sidecar-only except for explicitly approved post-success observation hooks.
2. All gates are default-disabled and historical writes are impossible unless every approved gate passes.
3. Emergency disablement has highest precedence and can stop capture without production behavior changes.
4. Production behavior is unchanged when capture is absent, disabled, misconfigured, unavailable, timing out, or failing.
5. No historical reads are required or introduced.
6. No history UI is required or introduced.
7. Alerts, awareness, markers, Route Watch, DriveTexas, and protected systems remain unchanged.
8. Envelope validation and data minimization reject unapproved events and fields.
9. Duplicate/idempotency behavior does not mutate production state.
10. Monitoring remains maintainer-only and invisible to users.
11. Rollback does not require migration reversal, Supabase cleanup, protected-system edits, UI changes, or production data restores.
12. Implementation can be rejected or deferred without losing any production capability.

If any item cannot be proven, implementation authorization must be denied or deferred.

## 11. Readiness Assessment

Gridly is ready for implementation review preparation, not implementation.

The program has enough documented architecture, contracts, constraints, and non-approval boundaries to prepare the required implementation review artifacts. V388 defined the core contracts, V389 authorized planning, and V390 defines the required package and review gates.

Gridly is not ready to execute migrations, apply migrations, deploy Supabase changes, add historical reads, add historical writes, add history UI, integrate capture into production behavior, or modify protected systems. Those actions remain prohibited until a later milestone explicitly authorizes them after implementation review exit criteria are satisfied.

## 12. GO / NO-GO Recommendation

**Recommendation: A. Ready For Implementation Review Preparation.**

### Rationale

Gridly has completed enough planning milestones to begin preparing implementation review materials. The required boundaries are clear: capture must be disabled by default, passive, fail-open, non-authoritative, reversible, invisible to users, and independent of production behavior. The required artifact set is now explicit, and review entry/exit criteria are defined.

This is not a recommendation to implement. It is a recommendation to prepare the evidence package that a later implementation review would evaluate.

## 13. Next Milestone Recommendation

Recommended next milestone:

**V391 — Passive Historical Capture Implementation Review Preparation Package**

V391 should remain documentation-only unless separately authorized otherwise. It should assemble the concrete review-preparation artifacts required by V390, including feature flag planning, event mapping, source boundary analysis, validation matrices, monitoring plan, rollback plan, privacy review, operational ownership, and approval evidence checklist.

V391 should not approve implementation, activation, migration execution, migration application, Supabase deployment, historical reads, historical writes, history UI, production integration, protected-system changes, or production behavior changes.

## 14. Explicit Non-Approval Statement

V390 does **NOT** approve:

- Migration execution.
- Migration application.
- Supabase deployment.
- Supabase commands.
- SQL modification.
- Historical reads.
- Historical writes.
- History UI.
- Production integration.
- Production behavior changes.
- `js/app.js` modification.
- `index.html` modification.
- `css/styles.css` modification.
- Alert changes.
- Awareness changes.
- Marker changes.
- Route Watch changes.
- DriveTexas changes.
- Protected-system changes.
- Capture activation.
- Runtime feature flag implementation.
- Runtime archive adapter implementation.
- Runtime monitoring implementation.

Planning completion must not be treated as implicit approval to deploy, activate, write, read, or surface historical capture behavior.
