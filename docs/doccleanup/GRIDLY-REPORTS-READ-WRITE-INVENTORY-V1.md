# GRIDLY Reports Read/Write Inventory V1

Audit-only milestone for `V358-REPORTS-READ-WRITE-INVENTORY`.

This document is read-only. It does not modify production code, Supabase schema, migrations, report insertion, clearing behavior, alerts, markers, awareness, Route Watch, DriveTexas, or production data.

## 1. Executive Summary

Gridly currently uses the Supabase `reports` table as a shared live-event stream for two major families of records:

- **Road hazards**: rows whose `report_type` matches `HAZARD_TYPES`, plus `hazard_cleared` rows.
- **Rail/crossing reports**: rows whose `report_type` is not treated as a road-hazard type and therefore normalize to `reportKind: "crossing"`.

The main live read path is `loadSharedReports()`, which reads non-expired rows and recent `hazard_cleared` rows from `reports`, normalizes them, filters them by active county and development-cleanup suppression, then assigns `activeHazards`, `recentlyClearedRoadHazards`, and `activeReports`.

The main write path is `gridlyInsertWithCountyMetadataFallback()`, which inserts into `reports` and retries with a base legacy shape when Supabase rejects county metadata or missing columns.

Important current behavior for future live/history separation:

- Confirming a road hazard creates another hazard row through `createSharedHazardReport()` rather than updating an existing row.
- Clearing a road hazard creates a `hazard_cleared` row rather than updating or deleting the original hazard row.
- Clearing a rail/crossing issue creates a crossing row with `report_type: "cleared"` rather than updating or deleting the original blocked/heavy row.
- In-memory active truth is derived by selectors, lifecycle helpers, grouping helpers, and render caches rather than by a first-class incident table.

## 2. Reports Table Usage Overview

### Supabase readers

`loadSharedReports()` performs two reads:

1. Active/live rows: `from("reports").select("*").gt("expires_at", nowIso).order("created_at", { ascending: false }).limit(300)`.
2. Recent road-cleared rows: `from("reports").select("*").eq("report_type", "hazard_cleared").gte("created_at", recentRoadClearedCutoffIso).order(...).limit(100)`.

Audit and diagnostic helpers also read `reports`, including submit-health and cleared-hazard persistence audits.

### Supabase writers

All normal report writes use `gridlyInsertWithCountyMetadataFallback(supabaseClient, "reports", row)`:

- Road-hazard submit rows from `createSharedHazardReport()`.
- Road-hazard clear rows from `clearHazard()` with `report_type: "hazard_cleared"`.
- Rail/crossing submit rows from `createSharedReport()` with `report_type` such as `blocked`, `heavy`, `cleared`, or `other`.

Developer cleanup helpers can delete from `reports`, but those are confirm-gated/debug-only paths and are not user lifecycle behavior.

## 3. All Reports Readers

### Direct Supabase `reports` readers

- `loadSharedReports(reason)` is the primary runtime reader and source of live in-memory report arrays.
- `gridlyReadClearedHazardPersistenceSupabaseInventory(hours)` reads recent `reports` rows for cleared-hazard persistence diagnostics.
- Supabase submit-health audit reads exact rows by `crossing_id`, then replays the same live and recent-clear queries used by `loadSharedReports()`.
- Developer cleanup audit paths read candidate report rows before deleting test data.

### Consumers of loaded report arrays

- `normalizeReports(rows)` converts raw Supabase rows to normalized report objects with `reportKind` of `hazard` or `crossing`.
- `activeHazards` is the road-hazard active source array.
- `recentlyClearedRoadHazards` is the local recent-clear visibility/suppression array.
- `activeReports` is the rail/crossing source array.
- `getLiveHazardIncidents()` consumes `activeHazards` plus `recentlyClearedRoadHazards` and builds road incident clusters.
- `getUnifiedIncidents()` and `getActiveUnifiedIncidents()` consume live road incidents and active crossing reports for unified incident rendering, alerts, awareness, and Route Watch context.
- `renderUnifiedIncidents()` renders map markers from unified incidents, with `activeHazards` as a fallback if unified incidents have no valid coordinates.
- `renderAlerts()` consumes commute-consequence intelligence built from unified/report state and also shows recently-cleared unified incidents.
- Awareness helpers filter `activeHazards` and `activeReports` into selected-area inventories.
- Crossing rendering uses `getLatestReportForCrossing()`, `getIncidentLifecycleState()`, `activeReports`, and crossing inventory to decide active, recently-cleared, and infrastructure marker states.

## 4. All Reports Writers

### Shared insert helper

`gridlyInsertWithCountyMetadataFallback(client, tableName, row)` is the common insert helper. It first calls `client.from(tableName).insert(row)`. If Supabase rejects county metadata or missing-column shape, it retries with `GRIDLY_REPORTS_BASE_INSERT_KEYS` for `reports`.

### Production/user-facing writers

- `createSharedHazardReport(hazardType, lat, lng, confidence, locationName, originalTapCoords, options)` inserts road hazard rows with generated `crossing_id`, hazard `report_type`, severity, detail metadata, source, confidence, device ID, expiry, and county metadata.
- `clearHazard(hazardType, lat, lng)` inserts a road clear evidence row with `report_type: "hazard_cleared"`.
- `createSharedReport(crossing, reportType, confidence, buttonEl)` inserts rail/crossing rows with crossing ID/name, railroad, coordinates, `report_type`, severity, detail, source, confidence, device ID, expiry, and county metadata.

### Debug/audit writers

- Submit-health audit paths can call production submit helpers to test write visibility.
- Developer cleanup helpers delete test hazards/reports after confirmation. They are not normal lifecycle writes and should remain isolated from live/history separation work.

## 5. Road Hazard Submit Paths

### Tap Map

- User selects a hazard and arms map placement through `beginRoadHazardMapPlacement()`.
- `map.on("click", handleHazardPlacementMapClick)` receives the map click.
- The tap-map path snaps or preserves coordinates depending on road-aware placement rules.
- Final submit calls `createSharedHazardReport()` with confidence such as `tap map placement`.
- `createSharedHazardReport()` locks Tap Map payload lat/lng to the original user-selected coordinate when applicable, while retaining resolver coordinates as diagnostics.

### Use My Location

- `submitHazardNearMe()` requests geolocation.
- It snaps the GPS location to road-aware placement.
- On valid placement, it calls `createSharedHazardReport(selectedType, finalPlacement.lat, finalPlacement.lng, "gps hazard report", ...)`.

### Manual report mode

- `submitManualReport()` checks `activeReportMode`.
- In road-hazard mode, it calls `createSharedHazardReport(reportType, crossing.lat, crossing.lng, "manual road hazard", crossing.name)` using the selected crossing/location as the placement point.

### Confirmation-related road submit path

- `confirmHazardStillThere(hazardType, lat, lng)` calls `createSharedHazardReport(hazardType, lat, lng, "hazard confirmed still there")`.
- This means confirmation is a new row/evidence insert, not a mutation of an existing row.

### Audit/test submit paths and fallback inserts

- Supabase submit-health audit uses the production insert shape and then reads back the exact row.
- Insert fallback happens inside `gridlyInsertWithCountyMetadataFallback()` if county metadata or new columns are rejected by Supabase.

## 6. Rail/Crossing Submit Paths

### Blocked crossing / heavy delay / other issue

- Popup actions call `reportCrossingFromPopup(crossingId, reportType, buttonEl)`, which resolves the crossing and calls `createSharedReport(crossing, normalizedType || "other", "exact map marker", buttonEl)`.
- Manual rail mode calls `submitManualReport()`, which calls `createSharedReport(crossing, reportType, "manual fallback", els.manualReportBtn)`.
- Unified incident confirmation can map report types and call `createSharedReport()`.

### Clear crossing

- Popup clear actions call `reportCrossingFromPopup(..., "cleared", ...)` or unified action handling calls `createSharedReport(crossing, "cleared", "unified incident cleared")`.
- Quick-clear buttons call `createSharedReport(lastSubmittedCrossing, "cleared", ...)`.
- A crossing clear is represented as another row with `report_type: "cleared"`.

### Crossing-report writers

All normal rail/crossing rows are written by `createSharedReport()` through `gridlyInsertWithCountyMetadataFallback()`.

## 7. Clear/Resolved Paths

### Road hazards

- `clearHazard()` writes a new `hazard_cleared` row with short expiry.
- `loadSharedReports()` separately fetches recent `hazard_cleared` rows because they may not be part of the non-expired live query in all cases.
- `gridlyFilterRecentlyClearedRoadHazardsForVisibility()` extracts recent clear rows for cleared-only visibility.
- `gridlyFilterRoadHazardsByLatestLifecycle()` suppresses matching active hazard rows when a recent clear exists.
- No active road-hazard row is updated or deleted as part of normal user clearing.

### Rail/crossings

- Clearing a crossing writes a `cleared` crossing row.
- Lifecycle state is derived by latest report selection and `getIncidentLifecycleState()`.
- No blocked/heavy crossing row is updated or deleted as part of normal user clearing.

## 8. Confirmation Paths

### Road hazards

- `confirmHazardStillThere()` inserts a new hazard row with confidence `hazard confirmed still there`.
- Confirmation counts are computed by grouping/cluster helpers, not by incrementing a stored count on an existing row.
- Local event history captures evidence from normalized rows for historical intelligence.

### Rail/crossings

- Crossing confirmation uses `createSharedReport()` to insert another crossing row of the mapped report type.
- `gridlyCountCrossingConfirmations()` counts reports for a crossing ID from `activeReports`.
- `gridlyBuildCrossingEvent()` stores derived confirmation counts in local event history.

## 9. Lifecycle Helpers

- `expires_at` is assigned on writes and used by `loadSharedReports()` to fetch active rows.
- `normalizeReports()` calculates `minutesAgo`, `expired`, `reportKind`, category/type, severity, title, detail, and source fields.
- `GRIDLY_HAZARD_LIFECYCLE_RULES` defines age/trust state buckets for hazard categories.
- `gridlyClassifyHazardLifecycleFrameworkRecord()` computes hazard lifecycle state from age, confirmations, source trust, reconfirmation, and manual-clear status.
- `gridlyFilterRecentlyClearedRoadHazardsForVisibility()` isolates recently cleared road hazard records.
- `gridlyFilterRoadHazardsByLatestLifecycle()` suppresses active hazards superseded by recent clears and updates the rehydration guard state.
- `getLiveHazardIncidents()` groups active and recently-cleared hazard source rows into road incident records.

## 10. Grouping Helpers

- **Road-hazard cluster key:** `getHazardClusterKey(hazard)` returns `type-lat-lng` using 4-decimal coordinate rounding.
- **Road-hazard incident grouping:** `gridlyBuildRoadHazardIncidentsFromReports()` groups source hazards by `getHazardClusterKey()` for active hazards and by a `hazard_cleared-...` key for clear rows.
- **Alert cluster key:** `getAlertClusterKey(alert)` builds `kind|type|corridor|locationCluster`.
- **Marker render key:** `renderUnifiedIncidents()` calls `getUnifiedIncidentRenderKey(incident)` and dedupes marker candidates by render key.
- **Crossing ownership suppression:** crossing rendering builds smart incident clusters, suppresses hidden crossing IDs, and uses lead counts to show a cluster badge.
- **Unified incident grouping:** `getUnifiedIncidents()` combines road incidents from `getLiveHazardIncidents()` with crossing incidents derived from `activeReports`, then active-only helpers filter downstream state.

## 11. Runtime Inventories

- `activeHazards`: active road-hazard source rows after county/dev/lifecycle filtering.
- `activeReports`: non-hazard/crossing report rows after normalization and county/dev filtering.
- `recentlyClearedRoadHazards`: recent `hazard_cleared` rows retained for visibility and suppression.
- `getLiveHazardIncidents()`: generated road incidents from `activeHazards` plus `recentlyClearedRoadHazards`.
- `unifiedRoadIncidents`: road incidents emitted into unified incident shape with `road-*` IDs.
- `activeUnifiedIncidents`: active subset of unified incidents for markers, alerts, Route Watch, and awareness.
- `latestAlertsForRender`: cached/render-ready alert state derived from active incidents, reports, route context, and alert grouping.
- Marker inventory: crossing markers from crossing inventory plus active report lifecycle; unified incident markers from unified incidents/fallback hazards.
- Awareness inventory: selected-area filters over `activeHazards`, `activeReports`, crossings, and community activity counts.

## 12. Risk Map

### High risk

- Any schema split that changes `reports` read shape can break `loadSharedReports()` and all live UI downstream.
- Moving clears out of `reports` without compatibility will break recent-clear suppression and recently-cleared visibility.
- Treating confirmations as updates instead of inserts would change confirmation counts, grouping, and event-history evidence.
- Changing cluster keys could alter active incident counts, markers, alerts, and duplicate suppression.

### Medium risk

- Introducing a live/history projection without preserving `activeHazards`, `activeReports`, and `recentlyClearedRoadHazards` semantics could cause count drift.
- County metadata changes may hit the insert fallback and silently drop metadata from persisted rows.
- Crossing lifecycle depends on latest report semantics; a split must preserve cleared-vs-active ordering.

### Low risk

- Documentation-only inventory and audit helper improvements are safe if they do not mutate runtime state.
- Read-only diagnostic queries are safe when they do not call submit or cleanup helpers.

## 13. Migration Dependency Map

Before future schema/runtime changes, protect these paths:

1. `loadSharedReports()` query contract and assignment to `activeHazards`, `activeReports`, and `recentlyClearedRoadHazards`.
2. `normalizeReports()` raw-row to runtime-shape contract.
3. `gridlyInsertWithCountyMetadataFallback()` compatibility and fallback behavior.
4. `createSharedHazardReport()`, `clearHazard()`, and `createSharedReport()` write semantics.
5. Recent-clear suppression helpers and rehydration guard state.
6. Road cluster and alert cluster key semantics.
7. `getLiveHazardIncidents()`, `getUnifiedIncidents()`, and active unified incident filters.
8. Alert, marker, awareness, and Route Watch readers of unified/report state.
9. Local event-history capture that currently treats report rows as historical evidence.
10. Debug cleanup helpers, which must remain confirm-gated and excluded from normal lifecycle migration.

## 14. Recommended Next Step

Create a read-only compatibility contract for a future live/history split:

- Define a stable runtime projection that preserves the existing `activeHazards`, `activeReports`, `recentlyClearedRoadHazards`, `getLiveHazardIncidents()`, and unified incident outputs.
- Add non-mutating parity checks comparing current `reports`-derived state against any future proposed live/history projection.
- Do not change schema, inserts, clearing, alerts, markers, awareness, Route Watch, DriveTexas, or production data until parity gates prove counts and lifecycle states remain stable.
