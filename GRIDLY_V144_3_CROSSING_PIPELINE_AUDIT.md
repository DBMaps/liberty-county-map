# GRIDLY V144.3 — Crossing Report → Unified Incident Pipeline Audit

## Scope
Audit-only instrumentation for tracing crossing report flow without changing report save behavior, shared report logic, commute logic, or unified incident behavior.

## Traced Pipeline
1. Crossing report submit (`createSharedReport` / report persistence).
2. Shared report refresh (`loadSharedReports(reason)`).
3. Report normalization (`normalizeReports`).
4. Crossing report ingestion into active shared state (`activeReports`).
5. Unified rail incident merge (`getConsolidatedIncidents` → `getUnifiedIncidents`).
6. Commute intelligence read path (`getUnifiedIncidents` consumers).

## Instrumentation Added
A new audit state and helper were added:
- `crossingReportsLoadedCount`
- `crossingReportsNormalizedCount`
- `crossingReportsMergedIntoUnifiedCount`
- `unifiedIncidentSourceBreakdown`
- `droppedCrossingReports[]`
- `dropReason` per dropped report

These are exposed via:
- `window.gridlyCrossingPipelineAudit()`

## How Audit Counts Are Computed
- **crossingReportsLoadedCount**: Count of `activeReports` entries with `reportKind === "crossing"`.
- **crossingReportsNormalizedCount**: Loaded crossing reports that are not expired and produce a valid location key via `getReportLocationKey(report)`.
- **crossingReportsMergedIntoUnifiedCount**: Number of consolidated crossing incidents (`getConsolidatedIncidents().length`) that feed rail incidents.
- **unifiedIncidentSourceBreakdown**:
  - `railCommunity`: consolidated crossing incidents
  - `roadHazardCommunity`: clustered hazard incidents
  - `futureTxdot`: `futureTxdotIncidents().length`
  - `futureConstruction`: `futureTxdotConstruction().length`
  - `futureFlood`: `futureFloodAlerts().length`
  - `total`: sum of all above
- **droppedCrossingReports[]**:
  - `invalid_report_object`
  - `expired`
  - `missing_location_key`

## Manual Validation Procedure
1. Submit one crossing report.
2. Run:
   - `await loadSharedReports("manual_pipeline_test")`
3. Run:
   - `window.gridlyCrossingPipelineAudit()`
4. Inspect:
   - whether loaded > normalized > merged counts diverge
   - `droppedCrossingReports` and `dropReason`
   - source breakdown totals

## Expected Diagnostic Outcome
The first stage where counts diverge (or where dropped items appear) identifies the exact loss point in the crossing → unified incident path.
