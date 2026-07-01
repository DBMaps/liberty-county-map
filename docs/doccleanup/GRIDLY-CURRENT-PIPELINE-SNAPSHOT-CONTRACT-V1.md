# GRIDLY Current Pipeline Snapshot Contract V1

## 1. Executive Summary

This is a design/audit-only ownership contract for the current production runtime pipeline. It documents the objects the future parity harness must observe and preserve before any live/history split or projection migration. No production code, Supabase schema, migrations, report insertion, clearing behavior, alerts, markers, awareness, Route Watch, DriveTexas, or data are changed by this milestone.

The current pipeline is report-backed. `loadSharedReports()` reads `reports`, normalizes rows, applies county/development/lifecycle filters, and assigns three primary in-memory collections: `activeHazards`, `activeReports`, and `recentlyClearedRoadHazards`. Road hazards are then grouped by `getLiveHazardIncidents()`, converted to road unified incidents by `getUnifiedIncidents()`, filtered by `getActiveUnifiedIncidents()`, and consumed by alerts, awareness, and marker rendering. Crossing reports follow a separate crossing-owned marker path while still participating in unified incidents and alerts.

The most important parity rule is that future implementation must preserve user-facing runtime surfaces, not merely row counts. The parity target includes source collection membership, incident grouping, active/cleared lifecycle state, selected-area filtering, alert grouping, awareness counts, marker ownership, marker duplicate suppression, and recently-cleared rehydration suppression.

## 2. Pipeline Overview

Actual current flow:

```text
reports
↓
loadSharedReports()
↓
activeHazards
activeReports
recentlyClearedRoadHazards
↓
getLiveHazardIncidents()
↓
unifiedRoadIncidents
↓
activeUnifiedIncidents
↓
alerts
awareness
markers
```

### Actual ownership

- `reports` is the Supabase source of live community report rows and recent road-clear evidence.
- `loadSharedReports()` owns the read, normalization, county filtering, development-cleanup suppression, lifecycle split, and assignment of the live in-memory report collections.
- `activeHazards` owns lifecycle-visible active road-hazard source rows.
- `recentlyClearedRoadHazards` owns recent `hazard_cleared` road-clear evidence retained for visibility and suppression.
- `activeReports` owns non-road-hazard/crossing report rows after shared normalization/filtering.
- `getLiveHazardIncidents()` owns active road-hazard incident grouping from `activeHazards` plus recent clear context.
- `getUnifiedIncidents()` owns the unified incident projection, combining filtered crossing incidents, active road incidents, recently-cleared road incidents, and future placeholder feeds.
- `getActiveUnifiedIncidents()` owns the active-only unified incident subset.
- Alerts consume active unified incidents through commute/localized intelligence and alert-surface shaping.
- Awareness consumes both active source collections and the alert-surface active community rows, with selected-area filtering and top-awareness scoring.
- Markers have split ownership: road-hazard markers are owned by unified road incidents, while crossing markers are owned by the crossing inventory layer. Unified blocked-crossing markers are suppressed when crossing-layer ownership exists.

## 3. Runtime Object Inventory

### `activeHazards`

- **Owner:** `loadSharedReports()`.
- **Created By:** Filtering normalized visible hazard rows through `gridlyFilterRoadHazardsByLatestLifecycle()`.
- **Inputs:** Supabase `reports` rows with non-expired `expires_at`, recent road-cleared rows, normalization, active county filter, development cleanup suppression, road lifecycle helpers, recent clear index.
- **Outputs:** Active road-hazard source rows.
- **Consumers:** `getLiveHazardIncidents()`, marker fallback path, awareness helpers, audits, alert fallback signals.
- **Lifecycle:** Rebuilt on each successful shared report load; excludes expired, cleared, recently-cleared, inactive, historical/stale, latest-cleared, and recent-clear-suppressed rows.
- **Future Parity Importance:** Must match exactly for membership and lifecycle visibility unless a migration explicitly proves equivalent downstream surfaces.

### `activeReports`

- **Owner:** `loadSharedReports()`.
- **Created By:** Filtering normalized visible rows where `reportKind !== "hazard"`.
- **Inputs:** Same normalized/county/dev-filtered report set as `activeHazards`.
- **Outputs:** Non-hazard/crossing report source rows.
- **Consumers:** Crossing incident consolidation, crossing markers through latest-report lookup, awareness active report inventory, confirmation counts, alerts through unified rail incidents.
- **Lifecycle:** Rebuilt on shared report load; uses normalization and shared visibility filters, then downstream crossing lifecycle decides active/recently-cleared marker state.
- **Future Parity Importance:** Must match exactly for crossing/report membership because crossings, awareness, alerts, and confirmation semantics depend on it.

### `recentlyClearedRoadHazards`

- **Owner:** `loadSharedReports()`.
- **Created By:** Filtering visible hazard rows with `gridlyFilterRecentlyClearedRoadHazardsForVisibility()`.
- **Inputs:** Recent `hazard_cleared` rows from `reports`, live rows, normalization, county/dev filters.
- **Outputs:** Recent road-clear evidence rows.
- **Consumers:** `getRecentlyClearedRoadHazardIncidents()`, `getLiveHazardIncidents()` input context, road lifecycle suppression, unified cleared road incidents, alerts/awareness lifecycle audits.
- **Lifecycle:** Rebuilt each load; bounded by `RECENTLY_CLEARED_WINDOW_MINUTES`; road clears can suppress rehydrated active hazards.
- **Future Parity Importance:** Must match exactly; this object protects cleared visibility and rehydration suppression.

### `getLiveHazardIncidents()` output

- **Owner:** Road-hazard incident builder.
- **Created By:** `gridlyBuildRoadHazardIncidentsFromReports([...activeHazards, ...recentlyClearedRoadHazards])`.
- **Inputs:** Active hazards plus recent road-clear evidence.
- **Outputs:** Grouped road-hazard incident records containing key, count, latest report, reports, coordinate reason, oldest/newest minutes.
- **Consumers:** `getUnifiedIncidents()`, user-facing road hazard awareness, active hazard reconciliation audits.
- **Lifecycle:** Computed on demand; active path filters through active-road-hazard lifecycle rules and groups by hazard type plus tight coordinate bucket.
- **Future Parity Importance:** Must match exactly for grouping keys, representative rows, counts, and source report membership.

### `unifiedRoadIncidents`

- **Owner:** `getUnifiedIncidents()` road projection.
- **Created By:** Mapping `getLiveHazardIncidents()` through `buildRoadUnifiedIncident(..., "active")` with IDs of `road-${incident.key}`.
- **Inputs:** Live hazard incidents and latest report metadata/coordinates.
- **Outputs:** Normalized active road unified incidents.
- **Consumers:** `getActiveUnifiedIncidents()`, alerts, awareness, road-hazard marker rendering, Route Watch context.
- **Lifecycle:** Computed on demand; sorted with all unified incidents by update timestamp.
- **Future Parity Importance:** Must match exactly for IDs, status, type mapping, coordinate fields, report counts, and raw/latest report lineage.

### `activeUnifiedIncidents`

- **Owner:** `getActiveUnifiedIncidents()`.
- **Created By:** Filtering `getUnifiedIncidents()` where `status` lowercases to `active`.
- **Inputs:** Unified incidents, including rail, active road, recently-cleared road, and future placeholder feeds.
- **Outputs:** Active-only unified incident array.
- **Consumers:** Alerts, awareness, road marker rendering, Route Watch/localized intelligence.
- **Lifecycle:** Computed on demand; active status is the inclusion gate.
- **Future Parity Importance:** Must match exactly for active membership and downstream user-facing surfaces.

### Alerts surface snapshot

- **Owner:** `getAlertsSurfaceSnapshot()`.
- **Created By:** Route/preferences state plus `buildUnifiedLocalizedCommuteIntelligence()`, active unified incidents, active hazard fallback signals, and selected-area alert filtering.
- **Inputs:** Active unified incidents, localized intelligence items, alert preference state, Route Watch state, active hazard source counts, selected awareness-area filter.
- **Outputs:** Snapshot with `alerts`, `normalizedAlertItems`, active counts, summaries, route state, top status, commute impact headline, and route impact counts.
- **Consumers:** `buildAlertsSurfaceHtml()`, mobile alerts dock, awareness active community row helpers, audits.
- **Lifecycle:** Computed on demand; alert rows are filtered by selected awareness area and sorted by incident priority.
- **Future Parity Importance:** Must match exactly for alert rows and active counts; text may normalize only if semantics and grouping remain stable.

### Latest alerts for render

- **Owner:** Mobile/alerts render path.
- **Created By:** Alerts surface opening/render code assigns `window.__gridlyLatestAlertsForRender` after applying selected-area alert filtering to snapshot alerts.
- **Inputs:** `getAlertsSurfaceSnapshot().alerts` and selected awareness-area alert filter.
- **Outputs:** Render-cache array used by alert, awareness, and audit fallbacks.
- **Consumers:** Alert render cache readers, awareness row fallback, audits, mobile surfaces.
- **Lifecycle:** Updated when alerts surface render/open path runs; fallback source when snapshot rows are unavailable.
- **Future Parity Importance:** Migration sensitive; must not diverge from snapshot rows in a way that changes visible alerts or awareness counts.

### Awareness inventory

- **Owner:** `buildGridlyLightweightActiveAwareness()` plus alert-surface active community row helper.
- **Created By:** Combining user-facing road hazard incidents, lifecycle-active reports, selected crossing-area filters, deduped active items, priority scoring, and alert-surface row counts.
- **Inputs:** `activeHazards`, `activeReports`, user-facing road incidents, selected-area filters, alert-surface rows, rendered marker count.
- **Outputs:** Active awareness details, active hazard/report counts, top category/corridor/headline candidates, active samples, selected location data.
- **Consumers:** Location awareness, route/destination awareness, community pulse, audits.
- **Lifecycle:** Computed on demand; selected-area filtering applies before active report inventory, and top-awareness scoring can demote aging/expired candidates without changing map, alerts, or data.
- **Future Parity Importance:** Must match visible counts, selected-area membership, top-awareness source choice, and alert-surface row count ownership.

### Marker inventory

- **Owner:** Split between `renderUnifiedIncidents()` and `renderCrossings()`.
- **Created By:** Unified incident marker rendering for road hazards; crossing inventory rendering for crossing infrastructure and active rail delay markers.
- **Inputs:** `getUnifiedIncidents()`, `activeHazards` fallback, crossing inventory, latest crossing reports, lifecycle state, smart crossing clusters, route state.
- **Outputs:** Leaflet markers in unified incident layer and crossing layer; marker audits and rendered marker counts.
- **Consumers:** Map, popups, awareness rendered marker counts, audits.
- **Lifecycle:** Re-rendered on source or map/filter changes; unified markers are deduped by render key and filtered for eligibility; crossing markers clear/rebuild from visible prioritized crossings.
- **Future Parity Importance:** Must match exactly for marker ownership, IDs/render keys, coordinates, eligibility, duplicate suppression, and layer ownership.

## 4. Reports Contract

A report today is a normalized community row from the `reports` table, optionally carrying road-hazard, crossing, lifecycle, coordinate, confidence, detail, source, expiry, and clear-evidence fields. The table currently acts as both live source and historical evidence ledger.

Reports become incidents as follows:

- Road-hazard reports enter `activeHazards` if they survive shared visibility and lifecycle filters.
- Recent `hazard_cleared` reports enter `recentlyClearedRoadHazards` and may become cleared road incidents or suppress older rehydrated active hazards.
- Active road hazards are grouped by `getHazardClusterKey()`, which uses hazard type plus latitude/longitude rounded to four decimals.
- Non-hazard crossing reports enter `activeReports`, then crossing consolidation produces rail incidents keyed by crossing ID.

Reports become alerts through unified incidents and localized commute intelligence. Active unified incidents are shaped into alert items, filtered by selected awareness area, prioritized, grouped by alert cluster key during render, and cached for render.

Reports become awareness through two paths: active source inventory (`activeHazards`/`activeReports`) and the alert-surface active community report rows used for visible count parity between alerts and awareness.

## 5. Incident Contract

An incident today is a user-facing grouping/projection of one or more reports. Road incidents are not raw rows; they are grouped report clusters with a latest report, source report membership, count, and representative coordinate reason. Crossing incidents are crossing-owned projections keyed by crossing ID and latest crossing report.

Incidents are grouped as follows:

- Road hazard incidents group by type plus tight coordinate bucket (`0.0001` degrees).
- Cleared road incidents use `hazard_cleared`, lifecycle match type, and clear/rounded coordinate keys.
- Rail/crossing incidents are keyed as `rail-${crossingId}`.
- Road unified incidents are keyed as `road-${incident.key}`.

Incidents differ from reports because incidents define the user-facing unit for alerts, awareness, Route Watch, and road-hazard markers. A report is source evidence; an incident is the grouped/normalized runtime object.

## 6. Alert Contract

- **Ownership:** `getAlertsSurfaceSnapshot()` owns snapshot creation; render paths own latest render cache; `buildAlertsSurfaceHtml()` owns card grouping and visible-card limits.
- **Generation:** Alerts are generated from localized commute intelligence and active unified incidents, with active hazard fallback signals in county mode.
- **Grouping:** Render groups alert rows by `getAlertClusterKey()`, selects the highest-severity/freshest lead, sorts by priority, and limits visible detail cards.
- **Consumers:** Desktop alerts panel, mobile alerts surface, awareness active community row helper, audits, route/commute summaries.
- **Parity Rule:** Future alerts must preserve row membership, grouping keys, selected-area filtering, active counts, and fallback semantics.

## 7. Awareness Contract

- **Ownership:** `buildGridlyLightweightActiveAwareness()` owns active awareness inventory and top-awareness selection; `getGridlyAlertsSurfaceActiveCommunityReportRows()` owns the alert-surface row set used for visible active hazard counts.
- **Selected-area filtering:** Crossing reports are filtered through crossing report area filters; alert rows are filtered by selected awareness area before alert-surface counts and render.
- **Count ownership:** Visible active hazard count prefers alert-surface active community rows when available; otherwise it falls back to user-facing active hazard source count.
- **Top-awareness ownership:** Top awareness is selected from priority-ordered active item details after lifecycle scoring and mobility/category filtering.
- **Parity Rule:** Future projections must preserve selected-area membership, active count source precedence, and top-awareness source selection.

## 8. Marker Contract

- **Road hazard ownership:** Road-hazard markers are owned by unified incidents rendered by `renderUnifiedIncidents()`; fallback to `activeHazards` only occurs when unified incidents have no valid coordinates and active hazards do.
- **Crossing ownership:** Crossing markers are owned by `renderCrossings()` and the crossing inventory layer, with marker owner metadata set to `crossing_inventory`.
- **Duplicate suppression:** Unified blocked-crossing markers are suppressed when crossing-layer ownership keys show an active crossing marker already exists; data remains available in unified incidents.
- **Marker eligibility:** Unified incident markers are deduped by render key, filtered by marker eligibility, rejected for cleared/recently-cleared states where appropriate, and skipped for invalid/missing coordinates.
- **Parity Rule:** Future migration must not create duplicate road/crossing markers for the same logical incident and must preserve marker owner/layer assignment.

## 9. Lifecycle Contract

- **Expiration:** `loadSharedReports()` reads rows where `expires_at` is greater than current time; lifecycle helpers still guard against expired/inactive states downstream.
- **Recently-cleared:** Recent road clears are separately queried by `report_type = hazard_cleared` and `created_at` within the recent-clear window.
- **`hazard_cleared` behavior:** Road clear rows are retained in `recentlyClearedRoadHazards`, can produce cleared road incidents, and can suppress older active road hazards for the same lifecycle target.
- **Rehydration suppression:** `gridlyFilterRoadHazardsByLatestLifecycle()` records and excludes non-clear hazard rows that match recent clears, preventing cleared hazards from reappearing as active.
- **Active determination:** Active road hazard source rows must be non-expired, not cleared/recently-cleared, lifecycle active, classifier-active/needs-confirmation/confirmed, not latest-cleared, and not suppressed by recent clear. Unified active incidents are those with `status === "active"`.

## 10. Dependency Map

### Depends on `activeHazards`

- `getLiveHazardIncidents()`
- `getGridlyUserFacingActiveRoadHazardIncidents()` fallback and source inventory
- `renderUnifiedIncidents()` fallback marker source
- `buildGridlyLightweightActiveAwareness()` hazard inventory
- Alerts snapshot fallback signals
- Active hazard reconciliation and placement audits

### Depends on live incidents

- `getUnifiedIncidents()` road projection
- User-facing active road hazard incidents
- Awareness source precedence
- Road-hazard alert/intelligence lineage audits

### Depends on unified incidents

- `getActiveUnifiedIncidents()`
- Alerts surface snapshot and localized commute intelligence
- Unified road marker rendering
- Route Watch/route-impact summaries
- Awareness user-facing road hazard fallback
- Active hazard reconciliation audits

## 11. Critical Ownership Rules

1. Crossings own crossing markers.
2. Road hazards own road-hazard markers through unified road incidents.
3. Unified rail incidents may exist as data, but crossing-layer ownership suppresses duplicate blocked-crossing markers.
4. Alerts consume unified incidents and selected-area-filtered alert rows.
5. Awareness visible active hazard counts consume alert-surface active community report rows when available.
6. `activeHazards`, `activeReports`, and `recentlyClearedRoadHazards` are owned by `loadSharedReports()`, not by alert or marker renderers.
7. `hazard_cleared` rows are lifecycle evidence, not active road-hazard rows.
8. Road incident grouping is type plus tight rounded coordinate bucket; subtype is not part of the default cluster key unless encoded in type.
9. Marker fallback to `activeHazards` is exceptional and only used when unified incidents lack valid coordinates.
10. Selected-area filtering is part of visible alert/awareness contracts, not an optional display-only concern.

## 12. Future Migration Protection

| Runtime object | Classification | Protection requirement |
| --- | --- | --- |
| `activeHazards` | Must Match Exactly; Migration Sensitive | Preserve membership, lifecycle state, IDs, coordinates, and recent-clear suppression. |
| `activeReports` | Must Match Exactly; Migration Sensitive | Preserve non-hazard/crossing membership and latest-report behavior. |
| `recentlyClearedRoadHazards` | Must Match Exactly; Migration Sensitive | Preserve clear evidence window and suppression behavior. |
| `getLiveHazardIncidents()` output | Must Match Exactly; Migration Sensitive | Preserve grouping keys, counts, latest report, report IDs, and coordinates. |
| `unifiedRoadIncidents` | Must Match Exactly; Migration Sensitive | Preserve `road-*` IDs, status, type mapping, coordinate lineage, and raw report lineage. |
| `activeUnifiedIncidents` | Must Match Exactly; Migration Sensitive | Preserve active membership consumed by alerts/markers/awareness. |
| Alerts surface snapshot | Must Match Exactly; May Normalize text only | Preserve row membership, counts, priority order, selected-area filter, and grouping inputs. |
| Latest alerts for render | Migration Sensitive; May Normalize cache mechanics | Preserve rendered rows and fallback equivalence with snapshot alerts. |
| Awareness inventory | Must Match visible outputs; May Normalize internals | Preserve counts, selected-area membership, top-awareness choice, and alert-surface count precedence. |
| Marker inventory | Must Match Exactly; Migration Sensitive | Preserve owner, layer, render key, coordinate, eligibility, and duplicate suppression. |

No listed runtime object is historical-only today. Historical evidence exists inside `reports`, but these runtime objects are live user-facing contracts.

## 13. Recommended Next Step

Implementation should not begin yet. The next safe step is another read-only milestone that turns this contract into parity harness fixture definitions and snapshot comparison keys, without changing production code. The harness design should define deterministic capture points for each object above, allowed text normalization, exact membership keys, and fail conditions for lifecycle, alert, awareness, and marker drift.

Merge recommendation: merge this documentation-only contract. Do not implement the live/history split, new projections, schema changes, migrations, report insertion changes, clearing changes, alert changes, awareness changes, marker changes, Route Watch changes, DriveTexas changes, or data deletion as part of this milestone.
