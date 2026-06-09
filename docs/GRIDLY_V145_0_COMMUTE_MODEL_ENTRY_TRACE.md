# GRIDLY V145.0 — Commute Model Entry Trace

## Goal
Add audit-only tracing to identify where incidents are dropped across the commute intelligence entry path:

`getUnifiedIncidents() -> getActiveUnifiedIncidents() -> activeIncidents -> commute_model_build`

## What Was Added
- New `commuteModelEntryTrace` payload in `gridlyCommuteIntelligenceAuditState`.
- `window.gridlyCommuteIntelligenceAudit()` now returns `commuteModelEntryTrace` with:
  - `unifiedIncidentIds`
  - `activeIncidentIds`
  - `commuteModelInputIds`
  - `missingIds`
  - `missingIncidentDetails`

## Missing Incident Detail Schema
Each entry in `missingIncidentDetails` includes:
- `incidentId`
- `type`
- `source`
- `status`
- `lifecycle`
- `lastFunctionSeen`
- `nextExpectedFunction`
- `reasonDropped`

## Behavior Safety
- Audit-only instrumentation.
- No ranking/scoring/filtering behavior changes.
- No runtime optimization changes.

## Manual Validation Steps
1. `await loadSharedReports("manual_trace")`
2. `window.gridlyCommuteIntelligenceAudit()`
3. Verify there is no unexplained gap between:
   - `counts.unifiedIncidentCount`
   - `counts.incidentsProcessed`
   by using `commuteModelEntryTrace.missingIds` and `missingIncidentDetails`.
