# Gridly V310.3 Duplicate Blocked Crossing Marker Audit

## Quick summary

V310.3 classifies the observed duplicate blocked-crossing visual as **two different marker systems rendering simultaneously**, not duplicate ingestion, duplicate normalization, duplicate unified incident generation, crossing-coordinate drift, or a census-only counting bug.

One live crossing report can produce:

1. a **crossing ownership marker** in `crossingLayer`, created by `renderCrossings()` for the active crossing inventory row; and
2. a **hazard/unified incident marker** in `unifiedIncidentLayer`, created by `renderUnifiedIncidents()` after `getUnifiedIncidents()` converts the same consolidated rail incident into a production hazard marker.

The new audit-only helper `window.gridlyBlockedCrossingMarkerAudit()` records both marker owners without changing render behavior.

## Root-cause analysis

The live report pipeline is single-source through normalization and consolidation:

| Stage | Function / state | Evidence | Result |
| --- | --- | --- | --- |
| Source report | `loadSharedReports()` reads Supabase rows and calls `normalizeReports()` | Crossing rows become `activeReports` when `reportKind !== "hazard"`. | One active crossing report remains one active crossing report. |
| Normalization | `normalizeReports()` | Non-road-hazard reports receive `reportKind: "crossing"`, `crossingId`, `crossingName`, `lat`, `lng`, `type`, and freshness fields. | Blocked crossing report is normalized once. |
| Consolidation | `getConsolidatedIncidents()` | Groups non-expired `activeReports` by `getReportLocationKey(report)`. | One location key creates one consolidated rail incident. |
| Unified incident generation | `getUnifiedIncidents()` | Maps consolidated rail incidents into `normalizeUnifiedIncident()` records with `id: rail-${incident.crossingId}`, `type: mapRailReportType(latest.type)`, `report_type: latest.type`, and crossing coordinates. | Same report becomes one unified rail incident. |
| Crossing marker creation | `renderCrossings()` | Active crossing inventory rows render a marker with `crossingMarkerCategory = "rail_blockage_delay"` into `crossingLayer`. | One blocked-crossing marker is added to crossing ownership. |
| Unified marker creation | `renderUnifiedIncidents()` | Marker-eligible unified rail incidents render a production marker into `unifiedIncidentLayer`. | One blocked-crossing marker is also added to hazard/unified ownership. |

Because the crossing marker and unified marker are created by separate render functions and inserted into separate Leaflet layer groups, `crossingMarkers.size` and `gridlyCrossingRenderAudit().renderedCrossingMarkerCount` can correctly report `1` while `gridlyRenderedMapObjectCensus()` sees two Leaflet markers classified as blocked crossing.

## Marker ownership table

| Rendered marker | Source record | Crossing ID | Report ID | Marker type | Owning layer | Creation path | Interaction expectation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Crossing inventory active-delay marker | `activeReports` crossing report via `getLatestReportForCrossing(crossing.id)` | `report.crossingId` / crossing inventory ID | `report.id` | `blocked_crossing` / `rail_blockage_delay` | `crossingLayer` | `renderCrossings()` → `L.marker(...).addTo(crossingLayer)` → `crossingMarkers.set(crossing.id, marker)` | Crossing popup behavior; this is the marker users can interact with for crossing details. |
| Unified rail incident marker | `getConsolidatedIncidents()` rail incident from the same `activeReports` crossing report | `incident.crossingId` | latest report ID, available through the source `latestReport` | `blocked_crossing` / `rail_blockage_delay` | `unifiedIncidentLayer` | `getConsolidatedIncidents()` → `getUnifiedIncidents()` → `renderUnifiedIncidents()` → `L.marker(...).addTo(unifiedIncidentLayer)` | Unified incident popup behavior; may visually overlap the crossing marker. |

## Render-path table

| Marker family | Production path capable of rendering it | Layer | Conditions | V310.3 duplicate relevance |
| --- | --- | --- | --- | --- |
| Blocked crossing marker, crossing ownership | `renderCrossings()` | `crossingLayer` | Crossing is visible for the active geo filter, in bounds, not smart-cluster hidden, and `getIncidentLifecycleState(report) === "active"`. | Yes. This is one of the two observed markers. |
| Crossing delay marker, crossing ownership | `renderCrossings()` | `crossingLayer` | Same crossing render path, with active report categories mapped to `rail_blockage_delay`; CSS state may distinguish blocked vs delay styling. | Yes, same layer family as blocked crossings. |
| Crossing infrastructure marker | `renderCrossings()` | `crossingLayer` | No active issue, crossing is visible, and infrastructure zoom/filter conditions pass. | Possible nearby visual confusion, but not the root cause when both census entries are `blocked_crossing`. |
| Blocked crossing marker, unified incident ownership | `getUnifiedIncidents()` + `renderUnifiedIncidents()` | `unifiedIncidentLayer` | Consolidated rail incident is marker-eligible and has finite coordinates. | Yes. This is the second marker system. |
| Road/community hazard markers | `getUnifiedIncidents()` + `renderUnifiedIncidents()` | `unifiedIncidentLayer` | Active road hazard or selected fallback hazard source is marker-eligible. | Not the blocked-crossing duplicate source unless the incident is a rail incident. |

## Evidence supporting conclusion

- `renderCrossings()` explicitly clears and repopulates `crossingLayer`, then stores one marker per crossing in `crossingMarkers`. That explains why `CrossingRenderAudit` can report one rendered crossing marker.
- `getUnifiedIncidents()` independently converts consolidated crossing reports into rail unified incidents. These are not suppressed just because crossing ownership already rendered the active crossing.
- `renderUnifiedIncidents()` independently clears and repopulates `unifiedIncidentLayer`, then creates Leaflet markers for marker-eligible unified incidents.
- The two markers use the same underlying report/crossing coordinates but different Leaflet owner layers, so visual overlap is expected.
- The census is not necessarily wrong: it counts Leaflet marker objects across layers. The narrower crossing render audit only counts `crossingMarkers` / `crossingLayer` ownership.
- V310.3 added `window.gridlyBlockedCrossingMarkerAudit()` as passive instrumentation. It returns marker records with source record, crossing ID, report ID, marker type, owning layer, creation path, Leaflet ID, coordinates, category, and visual style.

## Determination against requested possibilities

| Possibility | Determination | Rationale |
| --- | --- | --- |
| A. Duplicate marker creation | Partially no | Each render path creates one marker; the duplication is not repeated creation inside one path. |
| B. Two different marker systems rendering simultaneously | **Confirmed** | `crossingLayer` and `unifiedIncidentLayer` both render the same blocked-crossing event family. |
| C. Infrastructure + blocked-crossing markers occupying nearly the same location | Not primary | Infrastructure markers come from `renderCrossings()` only when there is no active issue; active blocked crossings use `rail_blockage_delay`. |
| D. Layer duplication | Not primary | Layers are distinct by design; the issue is ownership overlap across two valid layers, not duplicated insertion into one layer. |
| E. Audit misclassification | Secondary / no | The census is broader than the crossing render audit. A naming mismatch can make it look contradictory, but the census count of two Leaflet markers is plausible. |

## Recommended fix scope

Recommended follow-up scope: **ownership/layer arbitration for rail incidents**.

A production fix should be small and explicit, but it should not be implemented in this audit milestone. Candidate approaches for a future milestone:

1. Choose a single canonical renderer for active blocked-crossing reports.
2. If crossing ownership remains canonical, exclude rail crossing incidents from `unifiedIncidentLayer` marker rendering while preserving them in lists, counters, awareness copy, and route intelligence as needed.
3. If unified incidents become canonical, remove or demote active crossing markers in `crossingLayer` only after confirming crossing popup parity and route/crossing UX requirements.
4. Update audits so `CrossingRenderAudit` and `RenderedMapObjectCensus` distinguish `crossingLayer` markers from unified rail incident markers.

## Regression risk assessment

| Area | Risk if fixed later | Notes |
| --- | --- | --- |
| Crossing popup behavior | High | The user can currently interact with the crossing-owned marker; suppressing it could regress crossing-specific popup behavior. |
| Route Watch / awareness | Medium to high | Unified incidents may feed route relevance, counters, or awareness copy. Suppressing the wrong path could hide route-impact context. |
| Marker hierarchy / z-index | Medium | The two marker families participate in different ownership and visual-priority systems. |
| Audit reliability | Low to medium | Audit labels should be clarified so one-layer counts are not compared directly with all-layer census counts. |
| Data lifecycle / sync | Low | Root cause is render ownership, not ingestion, normalization, lifecycle, or Supabase sync. |

## Merge recommendation

Merge the V310.3 audit instrumentation and documentation. Do **not** merge a production rendering behavior change in this milestone. The evidence supports a follow-up production milestone focused narrowly on rail marker ownership arbitration and audit naming alignment.
