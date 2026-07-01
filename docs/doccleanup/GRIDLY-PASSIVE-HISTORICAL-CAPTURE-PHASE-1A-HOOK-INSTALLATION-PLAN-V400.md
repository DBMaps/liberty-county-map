# GRIDLY Passive Historical Capture Phase 1A Hook Installation Plan V400

## 1. Executive Summary

V400 is the authoritative planning artifact for any future Phase 1A passive historical capture hook installation. It is planning-only and does not authorize implementation.

Current prerequisite status:

- V396 Sidecar Foundation is complete.
- V397 Validation Tests are complete.
- V398 Hook Readiness Audit is complete.
- V399 Routing Decision Package is complete.

Current Phase 1A status:

- Phase 1A remains disabled.
- No hooks are installed.
- No writes are enabled.
- No reads are enabled.
- No UI is enabled.
- No production behavior changes exist.

Core rule for all future work:

> Capture Everything. Show Nothing. Depend On Nothing.

## 2. Installation Scope

Future Phase 1A hook eligibility is limited to the following passive event hooks.

### Crossing

- `report_created`
- `report_cleared`

### Road Hazard

- `report_created`
- `report_cleared`

### Deferred

The following event types and systems remain outside Phase 1A hook installation scope:

- `report_updated`
- `incident_transitioned`
- `incident_closed`
- lifecycle adapter

No deferred item may be implemented, partially scaffolded, registered, invoked, or enabled under the Phase 1A hook installation plan unless a later milestone explicitly authorizes that expanded scope.

## 3. Future Installation Sequence

The recommended future installation order is intentionally narrow and staged so that parity can be verified after each hook is introduced. Each stage must be independently authorized, implemented, validated, monitored, and rollback-ready before the next stage begins.

### Stage 1 — Crossing `report_created`

- **Insertion point:** after the existing crossing report creation flow has completed successfully and the live report path has already accepted the report.
- **Routing source:** crossing report creation payload produced by the existing live reporting path.
- **Event type:** `report_created`.
- **Failure model:** fail-open; capture failures must be suppressed, must not throw, and must never block report creation.
- **Feature flag requirements:** hook registration and capture execution must both remain disabled by default; enabling must require an explicit maintainer-controlled flag.
- **Rollback path:** first disable feature flags, then disable hook registration, then remove the post-success invocation, then remove the hook implementation if necessary.

### Stage 2 — Crossing `report_cleared`

- **Insertion point:** after the existing crossing report clear flow has completed successfully and the live crossing state has already been updated by the current production path.
- **Routing source:** crossing report clear payload produced by the existing live clearing path.
- **Event type:** `report_cleared`.
- **Failure model:** fail-open; capture failures must be suppressed, must not throw, and must never block report clearing.
- **Feature flag requirements:** hook registration and capture execution must both remain disabled by default; enabling must require an explicit maintainer-controlled flag.
- **Rollback path:** first disable feature flags, then disable hook registration, then remove the post-success invocation, then remove the hook implementation if necessary.

### Stage 3 — Road-Hazard `report_created`

- **Insertion point:** after the existing road-hazard report creation flow has completed successfully and the live road-hazard report path has already accepted the report.
- **Routing source:** road-hazard report creation payload produced by the existing live reporting path.
- **Event type:** `report_created`.
- **Failure model:** fail-open; capture failures must be suppressed, must not throw, and must never block road-hazard report creation.
- **Feature flag requirements:** hook registration and capture execution must both remain disabled by default; enabling must require an explicit maintainer-controlled flag.
- **Rollback path:** first disable feature flags, then disable hook registration, then remove the post-success invocation, then remove the hook implementation if necessary.

### Stage 4 — Road-Hazard `report_cleared`

- **Insertion point:** after the existing road-hazard report clear flow has completed successfully and the live road-hazard state has already been updated by the current production path.
- **Routing source:** road-hazard report clear payload produced by the existing live clearing path.
- **Event type:** `report_cleared`.
- **Failure model:** fail-open; capture failures must be suppressed, must not throw, and must never block road-hazard report clearing.
- **Feature flag requirements:** hook registration and capture execution must both remain disabled by default; enabling must require an explicit maintainer-controlled flag.
- **Rollback path:** first disable feature flags, then disable hook registration, then remove the post-success invocation, then remove the hook implementation if necessary.

## 4. Hook Installation Requirements

Any future hook implementation must satisfy all of the following requirements before it can be considered valid:

- Hooks must run post-success only.
- Hooks must be fail-open only.
- Hooks must execute behind a no-throw wrapper.
- Hooks must preserve sidecar isolation.
- Production behavior must have no dependency on capture success.
- Writer functionality must be disabled by default.
- Feature flags must be disabled by default.
- No reads may be added or enabled.
- No UI may be added or enabled.
- Alerts must not be mutated.
- Awareness state must not be mutated.
- Markers must not be mutated.
- Incidents must not be mutated.
- Route Watch must not be impacted.
- DriveTexas must not be impacted.

Future implementations must not modify protected production systems except under explicit later authorization. Protected systems include `js/app.js`, `createSharedReport()`, `createSharedHazardReport()`, `loadSharedReports()`, `activeHazards`, `getLiveHazardIncidents()`, `unifiedRoadIncidents`, `activeUnifiedIncidents`, `alerts`, `awareness`, `markers`, Route Watch, and DriveTexas.

## 5. Validation Plan

Future hook installation must include parity validation, hook validation, and audit validation. Validation must be run before and after each stage.

### Parity Validation

Before and after hook installation, validate that the following remain unchanged except for the explicitly authorized passive capture sidecar state:

- active hazard counts
- alerts
- awareness
- markers
- incident generation
- Route Watch
- report submission behavior

Parity validation must prove that production live behavior is equivalent before and after hook installation.

### Hook Validation

Future hook validation must cover:

- `report_created` capture
- `report_cleared` capture
- malformed payload handling
- disabled flag handling
- disabled writer handling
- duplicate envelope handling
- no-throw validation

Hook validation must prove that capture is passive, non-blocking, no-throw, and isolated from production behavior.

### Audit Validation

The maintainer audit helper:

```js
window.gridlyPassiveHistoryCaptureSidecarAudit?.()
```

must continue reporting:

- sidecar available
- hooks installed status
- writes disabled
- reads disabled
- UI disabled
- supported event types

Audit validation must be maintainer-only and must not introduce any user-visible surface.

## 6. Monitoring Plan

Future monitoring must track passive capture behavior without exposing it to end users. Monitoring expectations include:

- capture attempts
- suppressed captures
- malformed payloads
- duplicate envelopes
- writer-disabled events
- sidecar failures

Monitoring must remain maintainer-only. Monitoring must not add user-visible surfaces, user-facing alerts, UI indicators, DOM output, map markers, incident records, awareness changes, Route Watch changes, or DriveTexas changes.

## 7. Rollback Plan

Rollback must be staged so that the safest and least invasive rollback is attempted first.

### Level 1 — Disable Feature Flags

Disable maintainer-controlled feature flags so hook registration and capture execution remain inactive.

### Level 2 — Disable Hook Registration

Disable or remove hook registration while leaving implementation code dormant and unreachable.

### Level 3 — Remove Hook Invocation

Remove the post-success invocation point so production flows no longer call any capture hook wrapper.

### Level 4 — Remove Hook Implementation

Remove the hook implementation if dormant code removal is required after Level 1 through Level 3 rollback steps.

Rollback must never require:

- data migration
- UI changes
- incident changes
- alert changes

## 8. Future Authorization Gates

A future implementation milestone may proceed only if all of the following remain true and are explicitly approved:

- V396 remains intact.
- V397 tests remain passing.
- V398 findings remain satisfied.
- V399 routing decisions remain satisfied.
- The parity validation plan is approved.
- The rollback plan is approved.

If any gate fails, hook implementation must remain unauthorized.

## 9. Explicit Non-Approvals

V400 does not authorize:

- hook installation
- historical writes
- historical reads
- Supabase schema deployment
- history UI
- lifecycle adapter
- incident transition capture
- `report_updated` capture
- production activation
- DriveTexas work

## 10. Recommended Next Milestone

Recommended next milestone:

**V401 — Phase 1A Hook Installation Authorization Review**

Purpose:

Determine whether actual hook installation should be authorized.

V401 should review prerequisite integrity, validation readiness, parity requirements, rollback readiness, and operational monitoring expectations before any implementation milestone is allowed to install hooks.

## Installation Sequence Summary

1. Crossing `report_created`.
2. Crossing `report_cleared`.
3. Road-hazard `report_created`.
4. Road-hazard `report_cleared`.

## Validation Sequence Summary

1. Run baseline parity validation before each stage.
2. Install only the authorized hook stage in a future implementation milestone.
3. Validate hook behavior for enabled, disabled, malformed, duplicate, writer-disabled, and no-throw cases.
4. Run post-stage parity validation.
5. Run maintainer-only sidecar audit validation.
6. Approve or roll back before moving to the next stage.

## Rollback Sequence Summary

1. Disable feature flags.
2. Disable hook registration.
3. Remove hook invocation.
4. Remove hook implementation.

Rollback must remain additive-safe and must not require data migration, UI changes, incident changes, or alert changes.
