# V385 — Passive Historical Capture Implementation Workplan & File Boundary Approval

## 1. Program Summary

V385 is a documentation-only implementation workplan and file-boundary approval package for Phase 1 passive historical evidence capture. It does not implement capture, modify production application files, change SQL, apply or execute migrations, run Supabase commands, add historical reads, add historical writes, add history UI, or change production behavior.

### V355–V384 outcomes

- **V355–V362 — Live-state stabilization and fixture groundwork:** Current live incident/report behavior was stabilized, live-state parity expectations were established, and current production output was protected as the baseline for any future historical work.
- **V363 — Live/History Implementation Readiness Gate:** Historical planning was allowed to continue only under strict production-isolation rules. The protected live ownership chain remained: `reports → loadSharedReports() → activeHazards → getLiveHazardIncidents() → unifiedRoadIncidents → activeUnifiedIncidents → alerts → awareness → markers → Route Watch`.
- **V364–V368 — Historical Projection Program:** A shadow historical projection foundation was designed, validated, fixture-tested, runtime-hardened, force-enabled in shadow mode, and handed off without adding historical reads, writes, UI, production dependencies, alerts, awareness, marker changes, Route Watch changes, or DriveTexas changes.
- **V369–V376 — Historical Schema Governance Program:** Additive-only historical schema planning, migration draft review, SQL safety audit, dry-run planning, dry-run checklist review, execution readiness, and governance decision were completed. Migration artifacts remained planning artifacts only; no migration was applied and no Supabase state changed.
- **V377–V384 — Passive Historical Capture Activation and Implementation Planning:** Minimal activation strategy, execution readiness, architecture, implementation readiness planning, implementation design, implementation scope, implementation plan, and acceptance criteria were completed. The accepted principle is: **Capture Everything. Show Nothing. Depend On Nothing.**

### Current state entering V385

- Migration applied: **NO**.
- Migration executed: **NO**.
- Supabase changed: **NO**.
- Historical reads: **NO**.
- Historical writes: **NO**.
- History UI: **NO**.
- Production integration: **NO**.
- Production behavior changes: **NO**.

## 2. Phase 1 Implementation Workplan

The recommended future Phase 1 implementation sequence is intentionally staged so that file boundaries, validation, monitoring, and rollback controls are approved before any code or SQL changes occur.

### Step 1 — Confirm non-production implementation authority

- Reconfirm that Phase 1 is evidence capture only.
- Reconfirm that capture remains disabled by default.
- Reconfirm that no historical reads, UI, analytics, intelligence generation, or production dependency is approved.
- Reconfirm that no migration execution or Supabase deployment is included in the implementation milestone unless separately approved.

### Step 2 — Approve file boundaries before editing

- Approve only new sidecar capture files and documentation files for future implementation.
- Keep `js/app.js`, `index.html`, `css/styles.css`, existing SQL, and protected production systems out of scope unless a later milestone explicitly approves a smaller, named boundary.
- Require any future production hook to be separately reviewed as a post-success, non-blocking, fail-open call site with no behavioral authority.

### Step 3 — Define disabled-by-default feature flag hierarchy

- Define a global capture gate.
- Define a separate historical write gate.
- Define source-level gates for each approved event source.
- Define environment allowlisting.
- Define emergency disablement that can stop capture without code changes, SQL changes, cleanup, data restore, UI change, or protected-system edits.

### Step 4 — Define the evidence envelope contract

- Define a versioned envelope schema in a sidecar boundary.
- Include only approved fields: source, event type, source entity identifiers, lifecycle metadata when available, timestamps, digest, idempotency key, duplicate hash, capture version, environment, and redacted diagnostics.
- Exclude unapproved personal, device, precise-location, UI-state, alert-state, marker-state, Route Watch, and DriveTexas-derived fields.

### Step 5 — Implement isolated envelope construction in a future milestone

- Build envelopes after authoritative production actions have completed successfully.
- Ensure transform errors fail open.
- Ensure missing data produces a rejected capture attempt, not a production failure.
- Ensure envelope validation is sidecar-only and never becomes production acceptance logic.

### Step 6 — Implement deterministic duplicate controls in a future milestone

- Generate idempotency keys and payload digests deterministically.
- Keep duplicate suppression independent of production-state mutation.
- Treat duplicate detection failures as capture failures only.

### Step 7 — Implement append-only archive write adapter in a future milestone

- Attempt writes only when every required gate is enabled.
- Keep writes best-effort, timeout-bounded, non-blocking, and fail-open.
- Keep archive unavailability from affecting report creation, report update, report clear, incident lifecycle behavior, alerts, awareness, markers, Route Watch, or DriveTexas.

### Step 8 — Implement maintainer-only monitoring in a future milestone

- Emit capture health, gate decisions, attempts, successes, failures, duplicate suppression, validation rejections, latency, timeout, schema-version, configuration, permission, and emergency-disablement signals.
- Do not create user-facing UI, alerts, awareness output, marker output, Route Watch output, or history surfaces.

### Step 9 — Validate disabled, enabled, failure, and rollback states

- Validate that disabled capture performs zero write attempts.
- Validate that enabled capture does not change user-visible behavior.
- Validate every failure class fails open.
- Validate emergency disablement stops new write attempts immediately.
- Validate rollback does not require migration rollback, data restore, cleanup scripts, protected-system edits, or UI changes.

### Step 10 — Produce implementation acceptance evidence

- Produce a file-boundary diff report.
- Produce test and validation logs.
- Produce monitoring evidence.
- Produce rollback evidence.
- Produce explicit proof that no reads, UI, intelligence generation, protected-system behavior change, or production dependency was introduced.

## 3. File Boundary Inventory

This inventory approves planning boundaries only. It does not approve file edits, implementation, migration execution, Supabase deployment, historical reads, historical writes, UI, or production behavior changes.

### Potential future files in scope

| Potential file or directory | Status | Rationale |
| --- | --- | --- |
| `docs/` historical capture documentation | Future in scope | Documentation may describe gates, validation, monitoring, rollback, and operational evidence without changing runtime behavior. |
| New `js/historical-capture/` sidecar module directory | Future conditionally in scope | A new isolated module could own envelope construction, validation, duplicate metadata, write-adapter coordination, and fail-open behavior without owning active production state. |
| New `js/historical-capture/envelope*` files | Future conditionally in scope | Envelope contract and validation should live outside protected production systems and should not read or render historical data. |
| New `js/historical-capture/flags*` files | Future conditionally in scope | Feature flag evaluation should be centralized, disabled by default, and independent from UI or production authority. |
| New `js/historical-capture/archive-writer*` files | Future conditionally in scope | Append-only write attempts should be isolated from production success criteria and guarded by all required gates. |
| New `js/historical-capture/monitoring*` files | Future conditionally in scope | Maintainer-only telemetry should be sidecar-only and should not create user-facing behavior. |
| New `js/historical-capture/__tests__/` or equivalent tests | Future conditionally in scope | Validation should prove disabled-state behavior, fail-open behavior, duplicate stability, and production parity. |
| New non-production fixtures for capture validation | Future conditionally in scope | Fixtures may prove capture envelope correctness and parity without affecting production behavior. |
| New migration documentation or dry-run notes | Future conditionally in scope | Documentation may describe prerequisites, but actual SQL changes and Supabase deployment remain separately governed. |

### Potential future files out of scope

| File or system | Status | Rationale |
| --- | --- | --- |
| `js/app.js` | Out of scope for V385 and not approved for Phase 1 implementation without a separate file-boundary milestone | It owns live production behavior and contains protected systems and user-visible flows. Any future hook requires separate approval and must be post-success, fail-open, and behavior-neutral. |
| `index.html` | Out of scope | Phase 1 adds no history UI, panels, scripts, user-facing controls, or production integration. |
| `css/styles.css` | Out of scope | Phase 1 adds no UI and therefore needs no styling changes. |
| Existing SQL files and migrations | Out of scope | V385 does not approve SQL edits, migration application, migration execution, or Supabase deployment. |
| Supabase configuration or deployment files | Out of scope | Phase 1 planning does not approve Supabase commands, deployment, credentials, or environment changes. |
| Alert code | Out of scope | Historical capture must not change alert content, counts, timing, authority, or display. |
| Awareness code | Out of scope | Historical capture must not change awareness text, state, lifecycle, or display. |
| Marker code and marker assets | Out of scope | Historical capture must not change marker count, ownership, labels, icons, click behavior, or map layers. |
| Route Watch code | Out of scope | Historical capture must not change route matching, route cards, route alerts, route state, or route geometry. |
| DriveTexas integration | Out of scope | Historical capture must not change DriveTexas polling, interpretation, display, or authority. |
| Existing production incident authority files or functions | Out of scope unless separately approved | Active authority must not depend on archive availability, historical reads, capture success, or duplicate handling. |

## 4. Protected System Boundary Review

The protected systems remain isolated by the following rules:

- `loadSharedReports()` must not be modified by Phase 1 planning or implementation unless separately approved.
- `activeHazards` remains the live report/hazard authority and must not ingest historical archive state.
- `getLiveHazardIncidents()` remains live-state interpretation only and must not read historical evidence.
- `unifiedRoadIncidents` and `activeUnifiedIncidents` remain active production collections and must not depend on capture success or archive availability.
- Alerts remain generated from current approved live inputs only.
- Awareness remains generated from current approved live inputs only.
- Markers remain generated from current approved live inputs only.
- Route Watch remains generated from current approved route/live incident inputs only.
- DriveTexas remains unchanged and must not be coupled to passive historical capture.

Any future capture call site must be post-success, sidecar-only, fail-open, timeout-bounded, and unable to alter production state, return values, user-visible content, or live authority.

## 5. Future Feature Flag Boundary Review

Future feature flag ownership should remain inside a dedicated passive capture boundary and should follow this hierarchy:

1. **Emergency disablement:** highest-priority kill switch; when disabled, no capture or write attempt may proceed.
2. **Environment allowlist:** only explicitly approved environments may attempt writes.
3. **Global capture gate:** defaults to disabled; when disabled, no envelope construction or capture attempt should proceed except inert diagnostics if separately approved.
4. **Write gate:** defaults to disabled; when disabled, envelope construction may be validated in controlled tests only, but no archive write attempt may occur.
5. **Source-level gates:** default to disabled for each approved source, such as `report_created`, `report_updated`, `report_cleared`, `incident_transitioned`, and `incident_closed`.
6. **Adapter availability checks:** credentials, archive target, and permissions must be present before write attempts.

Feature flags must not be owned by UI code, alert code, awareness code, marker code, Route Watch code, DriveTexas code, or active incident authority. Flag evaluation failures must disable or fail open inside the capture boundary.

## 6. Future Validation Boundary Review

Before implementation approval or activation, validation must prove all of the following:

- Capture disabled by default causes zero archive write attempts.
- Write gate disabled causes zero archive write attempts even when global capture is enabled.
- Source-level disabled state prevents writes for that source.
- Non-allowlisted environments cannot write.
- Emergency disablement stops new capture/write attempts immediately.
- Enabling capture in an approved non-production environment does not change report creation, report update, report clear, incident lifecycle behavior, alerts, awareness, markers, Route Watch, or DriveTexas behavior.
- Envelope construction failures fail open.
- Validation failures fail open.
- Digest and idempotency failures fail open.
- Archive write failures fail open.
- Duplicate detection failures fail open.
- Monitoring failures fail open.
- Timeout and network failures fail open.
- Idempotency keys and duplicate hashes are stable for equivalent events.
- Captured envelopes contain only approved fields and redact diagnostics.
- No historical reads, UI, intelligence generation, analytics output, production map layer, or route-facing historical output exists.

## 7. Future Monitoring Boundary Review

Monitoring should be maintainer-only and should not create user-facing behavior. Required future monitoring signals include:

- Capture enabled/disabled state.
- Emergency disablement state.
- Environment allowlist decisions.
- Global gate, write gate, and source-level gate decisions.
- Capture attempts by source and event type.
- Capture successes by source and event type.
- Capture failures by source, event type, and failure class.
- Envelope validation rejections.
- Digest and idempotency generation failures.
- Duplicate suppression counts.
- Archive write latency distribution.
- Timeout counts.
- Archive availability errors.
- Credential and permission errors.
- Schema version and capture version distribution.
- Configuration errors.

Monitoring must not feed alerts, awareness, markers, Route Watch, DriveTexas, active incident authority, UI, historical reads, or production success criteria.

## 8. Future Rollback Boundary Review

Rollback expectations for future Phase 1 implementation are:

- Emergency disablement stops new capture and write attempts immediately.
- Capture can be disabled without code deployment.
- Capture can be disabled without migration rollback.
- Capture can be disabled without data restore.
- Capture can be disabled without cleanup scripts.
- Capture can be disabled without protected-system edits.
- Capture can be disabled without UI changes.
- Production report creation, report update, report clear, incident lifecycle behavior, alerts, awareness, markers, Route Watch, and DriveTexas continue without archive availability.
- Existing inert evidence records, if any are written in an approved environment, can remain unread and unused.
- Maintainer monitoring confirms the disabled state after rollback.

Rollback is not allowed to depend on historical reads, UI controls, user action, Supabase migration rollback, or production behavior changes.

## 9. Future Acceptance Package

Before implementation approval, the acceptance package must include:

- Final file-boundary approval naming every file to be created or modified.
- Confirmation that no SQL changes, migration execution, migration application, or Supabase deployment is included unless separately approved.
- Feature flag hierarchy documentation.
- Evidence envelope contract with approved fields and excluded fields.
- Privacy and retention review for envelope fields and diagnostics.
- Disabled-state validation logs.
- Write-gate validation logs.
- Source-gate validation logs.
- Environment allowlist validation logs.
- Fail-open validation logs for transform, validation, digest, idempotency, duplicate, write, timeout, monitoring, credential, permission, and configuration failures.
- Production parity validation logs proving no changes to alerts, awareness, markers, Route Watch, DriveTexas, active incident collections, or report behavior.
- Monitoring evidence proving maintainer-only visibility.
- Rollback evidence proving disablement without code, SQL, migration rollback, data restore, cleanup, protected-system edits, or UI changes.
- Explicit confirmation that no historical reads, history UI, intelligence generation, analytics output, production map layer, or route-facing historical output was added.

## 10. Readiness Assessment

Gridly is ready for implementation-planning review because the program has completed the necessary preconditions for a bounded Phase 1 discussion:

- The current production live-state chain has been identified and protected.
- Historical projection planning was completed as shadow-only and non-authoritative.
- Historical schema work remains governed and unapplied.
- Passive capture scope is limited to evidence only.
- Acceptance criteria require disabled-by-default, fail-open, sidecar-only behavior.
- File boundaries can now be reviewed before implementation begins.

Gridly is **not** ready for implementation, activation, migration execution, Supabase deployment, historical reads, historical writes, history UI, or production integration based on V385 alone.

## 11. GO / NO-GO Recommendation

**Recommendation: A. Ready For Implementation Planning Review**

Rationale:

- The proposed Phase 1 implementation workplan is bounded to planning and future sidecar capture.
- Protected systems remain explicitly isolated.
- Future file boundaries are defined before code changes.
- Required validation, monitoring, rollback, and acceptance evidence is defined.
- V385 does not approve implementation or activation.

## 12. Next Milestone Recommendation

The next milestone should be:

**V386 — Passive Historical Capture File-Boundary Ratification and Implementation Authorization Decision**

V386 should occur before any code changes. It should approve or reject the exact future implementation file list, allowed call-site strategy, feature flag ownership, validation harness ownership, monitoring ownership, and rollback evidence requirements. If V386 approves implementation, a later milestone may then create code under the approved boundaries. If V386 does not approve implementation, no runtime files should be modified.

## 13. Explicit Non-Approval Statement

V385 does **NOT** approve:

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
- intelligence generation;
- backfills;
- cleanup jobs;
- retention jobs;
- historical evidence as active production authority.

V385 approves documentation-only implementation-planning review readiness and file-boundary discussion readiness. It does not approve any runtime, database, Supabase, UI, or production behavior change.
