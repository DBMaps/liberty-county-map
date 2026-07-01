# V386 — Passive Historical Capture File-Boundary Ratification and Implementation Authorization Decision

## 1. Program Summary

V386 is a documentation-only decision and authorization milestone for Phase 1 passive historical evidence capture. It determines whether Gridly should authorize implementation preparation after V385 concluded that the program was ready for implementation-planning review.

### V355–V385 outcomes

- **V355–V362 — Live-state stabilization and fixture groundwork:** Gridly stabilized the current live report and incident behavior, protected current production output as the baseline, and established fixture/parity expectations for future historical validation.
- **V363 — Live/History Implementation Readiness Gate:** Historical planning was allowed to proceed only as shadow/audit-only work. The live ownership chain remained protected: `reports → loadSharedReports() → activeHazards → getLiveHazardIncidents() → unifiedRoadIncidents → activeUnifiedIncidents → alerts → awareness → markers → Route Watch`.
- **V364–V368 — Historical Projection Program:** Shadow historical projection design, validation, fixture parity, runtime hardening, forced shadow enablement testing, and handoff were completed without historical reads, writes, UI, production dependencies, alert changes, awareness changes, marker changes, Route Watch changes, or DriveTexas changes.
- **V369–V376 — Historical Schema Governance Program:** Additive-only schema design, readiness review, migration draft review, SQL safety audit, dry-run planning, dry-run checklist review, dry-run execution readiness, and governance decision were completed. Migration artifacts remained reviewed planning artifacts only; no migration was applied and no Supabase state changed.
- **V377–V383 — Passive Historical Capture Activation and Design Program:** Minimal activation strategy, execution readiness, passive capture architecture, implementation readiness planning, implementation design, and implementation scope definition were completed under the principle: **Capture Everything. Show Nothing. Depend On Nothing.**
- **V384 — Implementation Plan and Acceptance Criteria:** Phase 1 acceptance criteria were defined for disabled-by-default controls, fail-open behavior, production isolation, no historical reads, no history UI, protected-system exclusions, capture correctness, validation, rollback, monitoring, activation prerequisites, and failure criteria.
- **V385 — Implementation Workplan and File Boundary Approval:** A staged future workplan and planning-level file boundary inventory were completed. V385 recommended V386 as the authorization decision point and explicitly did not approve implementation, activation, migration execution, Supabase deployment, historical reads, historical writes, history UI, production integration, or production behavior changes.

### Current state entering V386

- Migration applied: **NO**.
- Migration executed: **NO**.
- Supabase changed: **NO**.
- Historical reads: **NO**.
- Historical writes: **NO**.
- History UI: **NO**.
- Production integration: **NO**.
- Production behavior changes: **NO**.

## 2. Boundary Ratification Review

### In-scope future implementation areas

V386 ratifies the following areas as eligible for future implementation preparation only, subject to a later implementation milestone and the exact restrictions in this document:

- New sidecar-only passive capture documentation.
- New isolated `js/historical-capture/` modules for disabled-by-default flag evaluation, envelope construction, envelope validation, deterministic digest/idempotency helpers, duplicate metadata, append-only archive write adapter preparation, and maintainer-only monitoring.
- New tests, fixtures, or harnesses that validate disabled-state behavior, gate behavior, fail-open behavior, duplicate stability, envelope correctness, production parity, monitoring isolation, and rollback evidence.
- New non-production validation artifacts proving that capture preparation does not change production behavior.
- Planning documentation for migration prerequisites, archive ownership, privacy, retention, access, rollback, and operational runbooks, provided that no SQL is modified and no Supabase command is run.

The approved future implementation posture remains sidecar-only. Any future runtime implementation must be disabled by default, environment-gated, write-gated, source-gated, append-only, non-authoritative, fail-open, reversible, and invisible to users.

### Out-of-scope future implementation areas

V386 ratifies the following areas as out of scope for implementation preparation and future Phase 1 work unless a later milestone explicitly reopens a smaller named boundary:

- SQL changes, migration application, migration execution, Supabase deployment, Supabase commands, credential changes, or production archive provisioning.
- Historical reads, history UI, history panels, map layers, user-facing summaries, historical markers, analytics UI, recurrence scoring, duration scoring, predictive behavior, or route-facing historical output.
- Production read rewiring, production write rewiring, active incident authority changes, clear lifecycle changes, recently-cleared behavior changes, expiration changes, rehydration suppression changes, or backfills.
- Alert changes, awareness changes, marker changes, Route Watch changes, DriveTexas changes, and any user-visible behavior changes.
- Any implementation that makes historical capture success part of production success or historical capture failure part of production failure.

### Protected-system exclusions

V386 confirms that the following protected systems remain excluded from this milestone and from implementation preparation:

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

Any future capture call-site review must be separately approved and must prove the call is post-success, non-blocking, timeout-bounded, sidecar-only, fail-open, and unable to alter production state, return values, user-visible content, or live authority.

## 3. Production Risk Review

### Reporting risk

Reporting risk is acceptable for implementation preparation only if no production reporting flow is modified. Future sidecar preparation may define envelope contracts and tests, but it must not alter report validation, submission, update, clear, persistence, return values, latency expectations, or failure handling. Historical capture failure must never convert a successful report action into a failed report action.

### Alert risk

Alert risk is acceptable because V386 does not approve alert changes. Future capture preparation must not change alert eligibility, suppression, text, count, priority, timing, routing, or delivery. Monitoring for historical capture must not feed user-facing alerts.

### Awareness risk

Awareness risk is acceptable because awareness remains based only on current live inputs. Future capture preparation must not change awareness text, state, lifecycle, prioritization, timing, or display. Historical evidence must not become an awareness input.

### Marker risk

Marker risk is acceptable because V386 does not approve marker changes. Future capture preparation must not change marker count, ownership, labels, icons, clustering, click behavior, popup behavior, map layers, refresh behavior, or marker source authority.

### Route Watch risk

Route Watch risk is acceptable because V386 does not approve Route Watch changes. Future capture preparation must not change route matching, route relevance, route geometry, route cards, route alerts, route state, route notification behavior, or route-facing output. Route Watch must not read, wait on, or depend on historical capture.

### Operational risk

Operational risk is acceptable for preparation because no migration, Supabase deployment, historical write, production integration, or behavior change is authorized. Operational risk remains high for actual activation unless future milestones prove disablement, environment allowlisting, write gates, source gates, timeout limits, fail-open behavior, maintainer-only monitoring, privacy controls, and rollback evidence.

## 4. Architecture Compliance Review

V386 confirms that implementation preparation aligns with the required architecture only under the following interpretation:

- **Fail-open:** all future capture errors must be contained inside the capture boundary and must not block, delay beyond approved budgets, or alter production behavior.
- **Sidecar-only:** future capture modules may observe approved post-success evidence but must not own live authority, mutate protected systems, or change production return values.
- **Append-only:** future evidence persistence, if later approved, must append immutable evidence records and must not rewrite production state or serve active conditions.
- **Non-authoritative:** historical evidence must remain audit/analytics material only and must not decide active state, alerts, awareness, markers, Route Watch, or DriveTexas behavior.
- **No production dependency:** Gridly must continue to operate the same way if the historical capture system is absent, disabled, empty, misconfigured, unavailable, or failing.

## 5. Acceptance Package Review

V386 accepts the V384 and V385 acceptance package as the control set for any later implementation milestone. The acceptance package requires:

- Disabled-by-default global capture controls.
- Disabled-by-default historical write controls.
- Disabled-by-default source-level controls.
- Environment allowlisting that prevents accidental writes in unapproved environments.
- Emergency disablement that stops capture without code changes, SQL changes, migration rollback, data restore, cleanup scripts, protected-system edits, or UI changes.
- Fail-open handling for transform, validation, digest, idempotency, duplicate, write, timeout, monitoring, credential, permission, configuration, malformed payload, schema mismatch, network, and archive availability failures.
- No historical reads, no history UI, no intelligence generation, no production map layer, and no route-facing historical output.
- Production parity evidence for reports, active incident collections, alerts, awareness, markers, Route Watch, DriveTexas, and protected functions.
- Maintainer-only monitoring that does not create user-facing behavior.
- Privacy and retention review for envelope fields and diagnostics.
- Rollback evidence proving production independence from historical storage.

## 6. Authorization Decision Analysis

Gridly is ready to authorize implementation preparation because the program has reached the required documentation maturity:

- The live production ownership chain is known and protected.
- The passive capture principle is stable: **Capture Everything. Show Nothing. Depend On Nothing.**
- V384 defined acceptance and validation requirements.
- V385 defined planning-level file boundaries and protected exclusions.
- V386 ratifies that any future implementation must remain sidecar-only and disabled by default.
- No current requirement needs SQL changes, Supabase commands, app integration, historical reads, historical writes, UI, alert changes, awareness changes, marker changes, Route Watch changes, DriveTexas changes, or production behavior changes.

The remaining risks are controllable only if the next milestone is limited to implementation preparation and file-boundary-constrained sidecar scaffolding. The next milestone must not activate capture, deploy storage, write evidence, or integrate historical data into production behavior.

## 7. GO / NO-GO Decision

**Decision: A. Authorize Implementation Preparation**

### Rationale

Implementation preparation is authorized because V355–V385 established a sufficient governance chain, acceptance package, protected-system boundary, and file-boundary model for safe preparation work. The authorization is narrow: it allows preparation for future sidecar capture modules and validation artifacts, not activation or production integration.

This is a **GO** for implementation preparation only. It is not a GO for runtime capture, migration execution, Supabase deployment, historical reads, historical writes, history UI, production integration, or production behavior changes.

## 8. Authorized Scope

### If GO: implementation preparation may include

- Creating or updating documentation that specifies the Phase 1 sidecar implementation plan, validation plan, monitoring plan, rollback plan, privacy review, and operational runbook.
- Preparing new isolated sidecar files under a future `js/historical-capture/` boundary for disabled-by-default flag evaluation, envelope contract definitions, validation helpers, deterministic digest/idempotency helpers, duplicate metadata preparation, write-adapter interfaces, and maintainer-only monitoring interfaces.
- Preparing tests, fixtures, and harnesses that prove disabled-state behavior, gate behavior, fail-open behavior, duplicate stability, envelope field restrictions, parity expectations, monitoring isolation, and rollback expectations.
- Preparing non-production-only validation scripts that do not run migrations, do not call Supabase commands, do not modify SQL, and do not change production behavior.
- Drafting exact future call-site review requirements, provided that no protected call site is modified in this milestone.

### What remains prohibited

- Migration execution or migration application.
- Supabase deployment, Supabase commands, credential changes, or environment changes.
- SQL edits.
- Historical reads.
- Historical writes.
- History UI.
- Production integration.
- Production behavior changes.
- `js/app.js` edits.
- `index.html` edits.
- `css/styles.css` edits.
- Changes to `loadSharedReports()`, `activeHazards`, `getLiveHazardIncidents()`, `unifiedRoadIncidents`, `activeUnifiedIncidents`, alerts, awareness, markers, Route Watch, or DriveTexas.
- Backfills, cleanup jobs, retention jobs, intelligence generation, analytics output, recurrence scoring, duration scoring, predictive behavior, or route-facing historical output.
- Any dependency from production success to historical capture success.

## 9. Next Milestone Recommendation

The next milestone should be:

**V387 — Passive Historical Capture Implementation Preparation and Sidecar Scaffold Plan**

V387 should remain bounded to implementation preparation. It may define the exact sidecar file list, test file list, interface contracts, gate hierarchy, envelope contract, validation harness plan, monitoring interface plan, and rollback evidence checklist. V387 must not apply migrations, execute migrations, run Supabase commands, modify SQL, modify protected production files, add reads, add writes, add UI, or change production behavior.

## 10. Explicit Non-Approval Statement

V386 does **NOT** approve:

- migration execution;
- migration application;
- Supabase deployment;
- historical reads;
- historical writes;
- history UI;
- production integration;
- production behavior changes;
- SQL changes;
- `js/app.js` changes;
- `index.html` changes;
- `css/styles.css` changes;
- alert changes;
- awareness changes;
- marker changes;
- Route Watch changes;
- DriveTexas changes;
- protected-system changes;
- backfills;
- cleanup jobs;
- retention jobs;
- intelligence generation;
- analytics output;
- historical evidence as active production authority.

V386 approves only the decision to proceed with tightly bounded implementation preparation for future passive historical evidence capture under the ratified file boundaries and exclusions above.
