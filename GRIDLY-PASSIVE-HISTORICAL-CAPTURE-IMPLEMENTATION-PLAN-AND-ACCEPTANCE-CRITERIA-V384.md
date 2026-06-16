# V384 — Passive Historical Capture Implementation Plan & Acceptance Criteria

## 1. Program Summary

V384 is the final implementation-planning package for Phase 1 passive historical evidence capture. It is documentation-only and does not approve implementation, migration execution, Supabase deployment, historical reads, historical writes, history UI, production integration, or production behavior changes.

### V355–V383 outcomes

- **V355–V362 — Live-state stabilization and fixture groundwork:** stabilized the current live incident/report behavior and established parity expectations so future historical work can be evaluated without changing current production output.
- **V363–V368 — Historical Projection Program:** completed the shadow historical projection foundation, validation, fixture parity, runtime hardening, forced shadow enablement testing, and merge baseline/handoff. The projection path remained shadow-only, in-memory, audit-oriented, and isolated from production reads, writes, UI, alerts, awareness, markers, Route Watch, and DriveTexas.
- **V369–V376 — Historical Schema Governance Program:** completed additive-only schema design, readiness review, migration draft review, SQL safety audit, dry-run planning, dry-run checklist review, dry-run execution gate, and governance decision. Migration artifacts were planned and reviewed only; no migration was applied and no Supabase state changed.
- **V377–V383 — Historical Activation Program:** completed activation strategy, execution readiness, passive capture architecture, implementation readiness planning, implementation design, and implementation scope definition. The accepted operating principle is: **Capture Everything. Show Nothing. Depend On Nothing.**

### Current state entering V384

- Migration applied: **NO**.
- Supabase changed: **NO**.
- Historical reads: **NO**.
- Historical writes: **NO**.
- History UI: **NO**.
- Production integration: **NO**.
- Production behavior changes: **NO**.

### Protected systems

The following systems remain protected and must not be modified by V384 or by any later Phase 1 implementation unless a separate approval milestone explicitly changes that restriction:

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

## 2. Phase 1 Objective

Phase 1 has one objective: create a disabled-by-default, fail-open, sidecar-only mechanism for passive historical evidence capture after approved production actions have already completed.

Phase 1 must capture evidence only. It must not read historical data, display historical data, generate intelligence, influence active incident authority, or become a dependency for any production user flow.

The Phase 1 implementation objective is therefore:

> Preserve approved post-event evidence for future historical analysis while keeping every current production read, write, alert, awareness, marker, Route Watch, and UI behavior unchanged.

## 3. Acceptance Criteria

Phase 1 implementation is acceptable only if every criterion below is satisfied.

### Default and activation controls

- Capture is disabled by default in every environment.
- Historical writes are disabled unless all required activation gates are explicitly enabled.
- Source-level capture remains disabled unless each approved source is explicitly enabled.
- Environment allowlisting prevents accidental activation in unapproved environments.
- Emergency disablement can stop capture without code changes, migrations, cleanup scripts, data restores, protected-system edits, or UI changes.

### Production isolation

- Production behavior is unchanged when capture is disabled.
- Production behavior is unchanged when capture is enabled.
- Existing production success criteria do not include historical capture success.
- Existing production failure criteria do not include historical capture failure.
- Existing production latency budgets are not dependent on historical archive availability.
- No user action waits on historical capture retries.
- Historical storage unavailability cannot block report creation, report updates, report clears, incident lifecycle behavior, alerts, awareness, markers, Route Watch, or DriveTexas behavior.

### Fail-open behavior

- Envelope construction failures are contained inside the capture boundary.
- Digest/idempotency failures are contained inside the capture boundary.
- Write failures are contained inside the capture boundary.
- Duplicate detection failures are contained inside the capture boundary.
- Timeout failures are contained inside the capture boundary.
- Monitoring failures are contained inside the capture boundary.
- Missing credentials, missing archive target, invalid configuration, schema mismatch, malformed payload, and unavailable network states are contained inside the capture boundary.

### Historical read and UI restrictions

- No historical reads are added.
- No history UI is added.
- No history panel, map layer, marker state, analytics surface, user-facing summary, or route-facing historical output is added.
- No intelligence generation is added.
- No recurrence scoring, duration scoring, closure analytics, or predictive behavior is added.

### Protected-system restrictions

- `loadSharedReports()` behavior is unchanged.
- `activeHazards` ownership is unchanged.
- `getLiveHazardIncidents()` behavior is unchanged.
- `unifiedRoadIncidents` behavior is unchanged.
- `activeUnifiedIncidents` behavior is unchanged.
- Alerts are unchanged.
- Awareness is unchanged.
- Markers are unchanged.
- Route Watch is unchanged.
- DriveTexas remains unchanged.

### Capture correctness

- Approved event types are captured only after the authoritative production action has completed successfully.
- Captured envelopes use a versioned schema contract.
- Captured envelopes include approved source, event, identifier, timestamp, lifecycle, digest, idempotency, environment, and redacted diagnostic fields.
- Captured envelopes exclude unapproved, unnecessary, or sensitive fields.
- Duplicate suppression is deterministic and does not require production-state mutation.
- Append-only semantics are preserved.
- Capture does not backfill historical records unless a future milestone separately approves backfill.

## 4. Validation Criteria

Implementation must include validation evidence for each area below before activation is allowed.

### Production isolation validation

- Run current production smoke checks with capture disabled and verify identical behavior to the pre-implementation baseline.
- Run current production smoke checks with capture enabled in an approved non-production environment and verify identical user-visible behavior.
- Verify no historical archive result is used by active incident authority, alert output, awareness output, marker output, Route Watch output, or DriveTexas output.

### Duplicate suppression validation

- Submit or simulate repeated equivalent approved events and verify the idempotency key and duplicate hash are stable.
- Verify duplicate write attempts do not create multiple authoritative historical evidence records for the same event.
- Verify duplicate handling failures fail open and do not affect production flow completion.

### Fail-open validation

- Force envelope construction failure and verify production behavior still succeeds.
- Force digest/idempotency failure and verify production behavior still succeeds.
- Force archive write failure and verify production behavior still succeeds.
- Force archive timeout and verify production behavior still succeeds.
- Force monitoring sink failure and verify production behavior still succeeds.
- Force missing or invalid capture configuration and verify capture disables safely or fails open.

### Capture parity validation

- Verify enabling capture does not change active incident counts.
- Verify enabling capture does not change alert counts or alert text.
- Verify enabling capture does not change awareness text or awareness state.
- Verify enabling capture does not change marker count, marker ownership, marker labels, marker icons, or marker click behavior.
- Verify enabling capture does not change Route Watch state, route matching, route alerts, route geometry, or route card output.

### Write-gate validation

- Verify global capture disabled means no write attempts.
- Verify write gate disabled means no write attempts even if capture is otherwise enabled.
- Verify source-level disabled means no write attempts for that source.
- Verify non-allowlisted environments cannot write.
- Verify emergency disablement stops write attempts immediately.
- Verify write attempts occur only when every required gate is enabled.

### Privacy and governance validation

- Verify envelopes include only approved fields.
- Verify diagnostics are redacted.
- Verify no unapproved user, device, or precise-location detail is captured.
- Verify schema version and capture version are present on every envelope.
- Verify retention, access, and monitoring assumptions are documented before activation.

## 5. Activation Requirements

Activation is not allowed until all prerequisites below exist and are validated.

- A separately approved implementation milestone exists.
- A separately approved migration/deployment milestone exists if any archive storage requires schema or Supabase changes.
- Migration status and Supabase deployment status are explicitly known.
- Archive target, permissions, and credentials are available only for approved environments.
- Global capture gate exists and defaults to disabled.
- Write gate exists and defaults to disabled.
- Source-level gates exist and default to disabled.
- Environment allowlist exists and excludes production until separately approved.
- Emergency disablement path exists and is documented.
- Fail-open behavior is implemented for every capture step.
- Monitoring hooks exist for maintainers only.
- Validation fixtures or test harnesses exist for duplicate suppression, fail-open handling, capture parity, write gates, and production isolation.
- Privacy/governance review approves the envelope fields.
- Rollback procedure has been tested in a non-production environment.
- Go-live readiness review explicitly approves activation.

## 6. Rollback Requirements

Rollback is successful only if all criteria below are met.

- Capture can be disabled immediately through the emergency disablement control.
- Disabling capture stops new historical write attempts.
- Production report creation, report updates, report clears, incident lifecycle behavior, alerts, awareness, markers, Route Watch, and DriveTexas behavior continue without historical archive availability.
- No migration rollback is required to restore production behavior.
- No data restore is required to restore production behavior.
- No cleanup script is required to restore production behavior.
- No protected-system code edits are required to restore production behavior.
- No user-visible UI changes are required to restore production behavior.
- Existing historical records, if any were written in an approved environment, can remain inert and unread.
- Maintainer monitoring clearly indicates capture is disabled after rollback.

## 7. Monitoring Requirements

Monitoring is required for maintainers only. Monitoring must not create user-facing behavior, alerts, awareness text, marker output, Route Watch output, or history UI.

Required monitoring signals:

- Capture enabled/disabled state.
- Write gate enabled/disabled state.
- Source-level gate state.
- Environment allowlist decision.
- Capture attempts by source and event type.
- Capture successes by source and event type.
- Capture failures by source, event type, and failure class.
- Duplicate suppression counts.
- Envelope validation rejection counts.
- Archive write latency distribution.
- Timeout counts.
- Schema version and capture version distribution.
- Emergency disablement events.
- Configuration errors.
- Credential or permission errors.
- Archive availability errors.

Monitoring expectations:

- Monitoring failures fail open.
- Monitoring must not require historical reads by the application.
- Monitoring must not become a production dependency.
- Monitoring must provide enough information to decide whether to disable capture.
- Monitoring must support post-activation review without exposing unapproved sensitive data.

## 8. Failure Criteria

Implementation fails if any condition below occurs.

- Capture is enabled by default.
- Historical writes occur without all required gates enabled.
- Historical reads are introduced.
- History UI is introduced.
- Alerts, awareness, markers, Route Watch, DriveTexas, or active incident authority changes.
- `loadSharedReports()`, `activeHazards`, `getLiveHazardIncidents()`, `unifiedRoadIncidents`, or `activeUnifiedIncidents` behavior changes.
- Historical capture success becomes required for production success.
- Historical capture failure can block, delay beyond approved budgets, or alter production behavior.
- Archive storage availability becomes a production dependency.
- Duplicate suppression mutates protected production state.
- Envelope construction captures unapproved fields.
- Monitoring exposes unapproved sensitive data.
- Rollback requires migration rollback, data restore, cleanup scripts, protected-system edits, or user-visible changes.
- Production isolation validation, fail-open validation, capture parity validation, duplicate suppression validation, or write-gate validation fails.

## 9. Success Criteria

Implementation succeeds only if all conditions below are true.

- Capture remains disabled by default.
- No user-visible behavior changes are present.
- No historical reads are present.
- No history UI is present.
- No intelligence generation is present.
- Production systems continue to operate without dependency on historical archive availability.
- Approved evidence events can be captured in an approved environment only when all required gates are enabled.
- All capture failures fail open.
- Duplicate suppression is deterministic and validated.
- Capture parity validation confirms alerts, awareness, markers, Route Watch, active incident counts, and protected systems remain unchanged.
- Monitoring provides maintainer-only visibility into capture health.
- Rollback can disable capture without production data restoration, migration rollback, cleanup scripts, or user-visible changes.

## 10. Go-Live Readiness Requirements

Before any implementation milestone begins, the following readiness requirements must be satisfied:

- V384 is reviewed and accepted as the implementation-planning package.
- A next planning milestone confirms exact implementation boundaries, files allowed to change, files prohibited from changing, test commands, and review gates.
- Migration and Supabase deployment status remains explicitly documented as **not applied** unless separately approved.
- The planned implementation excludes `js/app.js`, `index.html`, `css/styles.css`, SQL changes, and protected production systems unless a later milestone explicitly permits a narrower change.
- Activation gates, write gates, source gates, environment allowlisting, and emergency disablement are specified before code changes.
- Validation fixtures and expected outputs are specified before code changes.
- Rollback and monitoring expectations are specified before code changes.
- Privacy/governance envelope-field approval is complete before capture can be enabled.
- No go-live occurs in production until a separate go-live approval milestone confirms all validation evidence.

## 11. Implementation Recommendation

**Recommendation: A. Ready for implementation planning package.**

Rationale:

- The historical projection program is complete and isolated.
- The historical schema governance program is complete as planning/governance only.
- The historical activation program has defined the Phase 1 principle and implementation scope.
- The Phase 1 objective is narrow: evidence capture only, no reads, no UI, no intelligence, no production dependency.
- Acceptance, validation, activation, rollback, monitoring, failure, and success criteria are now explicit enough to support a future implementation-planning milestone.

This recommendation does not approve code changes or activation. It approves only that the planning package is complete enough to proceed to the next non-code milestone.

## 12. Next Milestone Recommendation

Recommended next milestone before any code changes:

**V385 — Passive Historical Capture Implementation Workplan & File Boundary Approval**

V385 should remain planning-only and should define:

- exact files allowed to change;
- exact files prohibited from changing;
- module boundary and naming;
- feature flag names and default values;
- source event list for Phase 1;
- envelope contract reference;
- validation commands and expected outputs;
- rollback drill steps;
- monitoring sink expectations;
- reviewer checklist;
- explicit implementation non-approval until V385 is accepted.

## 13. Explicit Non-Approval Statement

V384 does **NOT** approve:

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
- alert changes;
- awareness changes;
- marker changes;
- Route Watch changes;
- DriveTexas changes.

V384 is documentation-only. It creates acceptance criteria and readiness requirements for future work while preserving the current state: no migration applied, no Supabase change, no historical reads, no historical writes, no history UI, no production integration, and no production behavior changes.
