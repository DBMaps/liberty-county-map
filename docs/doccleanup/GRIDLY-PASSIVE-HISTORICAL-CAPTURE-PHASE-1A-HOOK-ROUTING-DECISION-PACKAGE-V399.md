# GRIDLY Passive Historical Capture Phase 1A Hook Routing Decision Package V399

## Core Rule

**Capture Everything. Show Nothing. Depend On Nothing.**

V399 is a documentation-only routing decision package for future Phase 1A passive historical capture hooks. It records where future hooks should attach, what boundaries must be preserved, and what is not authorized by this milestone.

## 1. Scope and Non-Goals

### Scope

V399 documents future routing decisions for Phase 1A passive historical capture hooks for:

1. Crossing `report_created` routing
2. Crossing `report_cleared` routing
3. Road-hazard `report_created` routing
4. Road-hazard `report_cleared` routing

### Required Routing Principles

Any future Phase 1A hook installation must remain governed by these principles:

- **Post-success only**: capture may only be attempted after the live report operation has already succeeded.
- **Fail-open only**: capture failure must never block, rollback, alter, or surface against the live operation.
- **Sidecar-only**: capture must remain outside existing production incident, alert, marker, awareness, Route Watch, and DriveTexas flows.
- **Feature-flag disabled by default**: passive history capture must remain default-disabled unless a later milestone explicitly authorizes activation.
- **Writer disabled by default**: historical writes must remain disabled unless separately authorized.
- **No dependency on capture success**: live application behavior must not depend on historical capture returning success.
- **No UI feedback**: users must receive no success, failure, loading, toast, banner, marker, or awareness change related to capture.
- **No historical reads**: hooks must not add reads from historical stores.
- **No incident mutation**: hooks must not modify live incident objects or lifecycle state.
- **No alert/awareness/marker mutation**: hooks must not alter alerts, awareness state, map markers, or marker metadata.
- **No production behavior changes**: current live reporting behavior must remain unchanged.

### Non-Goals / Not Authorized By V399

V399 does **not** authorize:

- Hook installation
- Historical writes
- Supabase schema changes
- Lifecycle adapter implementation
- Incident transition capture
- `report_updated` capture
- History UI
- Production activation
- DriveTexas restart

## 2. Recommended Routing Model

### Crossing `report_created`

- Future route: `createSharedReport()`
- Hook boundary: post-success only
- Event type: `report_created`
- Source domain: `crossing_report`
- Capture behavior: passive, fail-open, sidecar-only, default-disabled
- Production constraint: no changes to current crossing report creation behavior

### Crossing `report_cleared`

- Future route: `createSharedReport()`
- Hook boundary: post-success only
- Event type: `report_cleared`
- Source domain: `crossing_report`
- Eligibility condition: only when `reportType` resolves to `cleared` or `clear`
- Capture behavior: passive, fail-open, sidecar-only, default-disabled
- Production constraint: no changes to current crossing clear behavior

### Road-Hazard `report_created`

- Future route: `createSharedHazardReport()`
- Hook boundary: post-success only
- Event type: `report_created`
- Source domain: `road_hazard_report`
- Ordering preference: capture should occur before or independent from local hazard UI, incident, and marker mutation if possible
- Capture behavior: passive, fail-open, sidecar-only, default-disabled
- Production constraint: no changes to current road-hazard creation behavior

### Road-Hazard `report_cleared`

- Future route: existing road-hazard clear-report success path
- Explicit routing caveat: do **not** force road-hazard clear capture into `createSharedHazardReport()` if current clear behavior is separate
- Hook boundary: post-success only
- Event type: `report_cleared`
- Source domain: `road_hazard_report`
- Lifecycle constraint: must preserve current clear lifecycle behavior
- Capture behavior: passive, fail-open, sidecar-only, default-disabled
- Production constraint: no changes to current road-hazard clear behavior

## 3. Road-Hazard Clear Decision

V399 explicitly decides that road-hazard clear capture should attach to the existing clear-report path, not be artificially routed through creation-only code.

If the existing clear-report path is not stable enough to provide a clean post-success hook boundary, road-hazard clear hook installation must be deferred until that path is stable. Capture must not be used as a reason to restructure, reroute, or broaden the road-hazard lifecycle.

Do **not** refactor hazard lifecycle behavior just to support passive historical capture. The capture hook is subordinate to the existing live lifecycle, not the other way around.

## 4. Future Hook Eligibility Matrix

| Candidate event | Candidate path | Event type | Eligible for Phase 1A | Hook allowed now? | Required future milestone | Notes |
|---|---|---|---|---|---|---|
| Crossing report created | `createSharedReport()` post-success path | `report_created` | Yes | No | Future explicit hook installation milestone | Source domain `crossing_report`; must remain post-success, fail-open, sidecar-only, default-disabled. |
| Crossing report cleared | `createSharedReport()` post-success path | `report_cleared` | Yes | No | Future explicit hook installation milestone | Source domain `crossing_report`; only when `reportType` resolves to `cleared` or `clear`. |
| Road-hazard report created | `createSharedHazardReport()` post-success path | `report_created` | Yes | No | Future explicit hook installation milestone | Source domain `road_hazard_report`; should occur before or independent from local hazard UI/incident/marker mutation if possible. |
| Road-hazard report cleared | Existing road-hazard clear-report success path | `report_cleared` | Yes, with routing caveat | No | Future explicit hook installation milestone after clear path is stable | Source domain `road_hazard_report`; do not force into creation-only code; preserve current clear lifecycle behavior. |
| Report updated | No Phase 1A path | `report_updated` | Deferred | No | Later update-capture authorization milestone | Not authorized by V399; not part of Phase 1A hook installation scope. |
| Incident transitioned | Lifecycle adapter path | `incident_transitioned` | Phase 1B / requires lifecycle adapter | No | Phase 1B lifecycle adapter milestone | Not authorized by V399; requires adapter design and explicit authorization. |
| Incident closed | Lifecycle adapter path | `incident_closed` | Phase 1B / requires lifecycle adapter | No | Phase 1B lifecycle adapter milestone | Not authorized by V399; requires adapter design and explicit authorization. |

## 5. Future Acceptance Criteria For Hook Installation

A future hook milestone may proceed only if all of the following are true:

- V396 sidecar foundation remains default-disabled.
- V397 validation tests remain passing.
- Hooks are post-success only.
- All capture calls are wrapped in a no-throw guard.
- Writer remains disabled unless separately authorized.
- No historical reads are added.
- No UI changes are added.
- Parity checks show no production behavior change.
- Audit helper reports hooks installed only after a future hook milestone explicitly authorizes installation.

## 6. Recommended Next Milestone

Recommended next milestone:

**V400 — Passive Historical Capture Phase 1A Hook Installation Plan**

V400 should still be a planning milestone unless explicitly authorized otherwise. No hook installation should occur unless a future prompt explicitly says to install hooks.

## Protected Systems Confirmation

V399 makes no changes to and does not authorize changes to:

- `js/app.js`
- `createSharedReport()`
- `createSharedHazardReport()`
- `loadSharedReports()`
- `activeHazards`
- `getLiveHazardIncidents()`
- `unifiedRoadIncidents`
- `activeUnifiedIncidents`
- `alerts`
- `awareness`
- `markers`
- Route Watch
- DriveTexas

## V399 Routing Decision Summary

- Crossing `report_created` should later attach to the `createSharedReport()` post-success boundary as `report_created` with source domain `crossing_report`.
- Crossing `report_cleared` should later attach to the `createSharedReport()` post-success boundary as `report_cleared` with source domain `crossing_report`, only when `reportType` resolves to `cleared` or `clear`.
- Road-hazard `report_created` should later attach to the `createSharedHazardReport()` post-success boundary as `report_created` with source domain `road_hazard_report`, preferably before or independent from local hazard UI/incident/marker mutation.
- Road-hazard `report_cleared` should later attach to the existing road-hazard clear-report success path as `report_cleared` with source domain `road_hazard_report`; it must not be artificially routed through creation-only code.

## V399 Implementation Confirmation

V399 is documentation-only. It adds no hooks, no writes, no reads, no UI, no SQL, no migrations, no lifecycle adapter, no report update capture, no incident transition capture, no production activation, and no DriveTexas restart.
