# GRIDLY Hazard Lineage Audit V1

## Quick summary

Read-only audit finding: approximately 11-12 unique active road-hazard locations become 5 visible hazards because raw Supabase hazard rows are not the user-facing unit. The pipeline first applies county/dev/lifecycle filters, then groups road hazards by `type + latitude + longitude rounded to 4 decimals`, then downstream alert/awareness surfaces apply the selected awareness-area filter and use the Alerts-surface active community report row set rather than raw `activeHazards` rows.

The currently reported counts reconcile as follows:

- 19 active Supabase hazard rows.
- One known duplicate cluster of 8 `other_hazard` rows at `30.0579, -94.7955` reduces those 8 rows to 1 generated road incident, suppressing 7 raw rows from user-facing incident count.
- With the supplied grouping facts, the arithmetic is **19 - 7 = 12 grouped road-hazard incidents**, not exactly 11. If production diagnostics show 11, one additional grouped pair or lifecycle/area suppression is occurring beyond the single 8-row cluster described in the prompt.
- The production UI's 5 active hazards match the Alerts/Awareness visible row set, not the raw row set or the grouped live-hazard incident set.
- The most likely difference between ~11-12 grouped locations and 5 visible hazards is selected-awareness-area filtering and/or alert-intelligence inclusion, not marker or alert-card dedupe. The visible titles listed by production correspond to 5 area-visible active hazard records/incidents: Flooding, Debris, Debris, Traffic Backup, Other Hazard.

## Merge recommendation

Merge this audit document only. It is read-only documentation and makes no production behavior changes. Do not modify alert logic, awareness logic, marker rendering, lifecycle filtering, Supabase reads/writes, DriveTexas, or crossing behavior as part of this milestone.

## Scope and non-goals

This audit intentionally does **not** change:

- production behavior
- alerts
- awareness
- markers
- lifecycle
- Supabase
- DriveTexas
- crossings

## Hazard inventory flow

### 1. Supabase rows to normalized shared reports

`loadSharedReports()` reads live rows from `reports` where `expires_at` is in the future, and separately reads recent `hazard_cleared` rows for the cleared-hazard window. It normalizes the merged read payload, filters to the active county, applies dev-cleanup suppression, then splits visible reports into `visibleHazards`, `recentlyClearedRoadHazards`, `activeHazards`, and non-hazard `activeReports`. 【F:js/app.js†L30983-L31063】

Key filters at this stage:

- Supabase active-row filter: `expires_at > now`.
- Active county filter: `gridlyReportMatchesActiveCounty(report, activeCountyId)`.
- Dev cleanup suppression: `!gridlyShouldSuppressSharedReportDuringDevCleanup(report, reason)`.
- Hazard split: `report.reportKind === "hazard"`.
- Road-hazard lifecycle filter: `gridlyFilterRoadHazardsByLatestLifecycle(...)`.

### 2. `activeHazards`

`activeHazards` is the active road-hazard source collection after county/dev/lifecycle filtering. The lifecycle helper excludes expired rows, road-cleared/recently-cleared rows, non-active lifecycle rows, lifecycle-classified inactive rows, rows whose latest lifecycle is cleared, and rows suppressed by a recent clear. 【F:js/app.js†L44609-L44618】

The latest-lifecycle filter also records rehydration-suppressed rows when a matching recent clear exists. 【F:js/app.js†L44626-L44642】

Given the prompt's current observations, `activeHazards` is expected to contain 19 active rows **if** all 19 are county-visible, not dev-suppressed, and lifecycle-active.

### 3. `getLiveHazardIncidents()`

`getLiveHazardIncidents()` builds generated road-hazard incidents from `activeHazards` plus `recentlyClearedRoadHazards`; for the active path, the builder filters each source through `gridlyIsActiveRoadHazardIncidentSource(...)`. 【F:js/app.js†L44652-L44656】【F:js/app.js†L44696-L44698】

This is the first exact road-hazard grouping point. The builder creates a `Map` keyed by `getHazardClusterKey(hazard)`, pushes all matching hazard rows into the same group, and returns one incident per group with `count`, `latestReport`, and all source `reports`. 【F:js/app.js†L44656-L44689】

The cluster key is `type-lat-lng`, where lat/lng are rounded to 4 decimals. 【F:js/app.js†L44706-L44714】

Implication for the supplied duplicate cluster:

- 8 `other_hazard` rows at `30.0579, -94.7955` share the same cluster key.
- They become 1 `getLiveHazardIncidents()` incident.
- That grouping suppresses 7 raw rows from the generated incident count.

### 4. `unifiedRoadIncidents`

`getUnifiedIncidents()` converts each live road-hazard incident into a road unified incident with id `road-${incident.key}`, active status, the latest report's coordinates, `reports_count`, subtype metadata, and `clusteringApplied: incident.count > 1`. 【F:js/app.js†L49368-L49424】

The road unified incidents therefore preserve grouping metadata, but they remain one unified incident per live hazard cluster.

### 5. `activeUnifiedIncidents`

`getActiveUnifiedIncidents()` returns only unified incidents with `status === "active"`. 【F:js/app.js†L49431-L49433】

For road hazards, active unified road incidents should match the active generated road-hazard incident count unless additional non-road active incidents are present or cleared/recently-cleared road incidents are included in `getUnifiedIncidents()` but excluded by active status.

### 6. Alerts snapshot

`getAlertsSurfaceSnapshot()` normalizes alert items from unified/localized intelligence or from incident/fallback hazard records, then applies `gridlyFilterAlertRecordsBySelectedAwarenessArea(...)` and sorts by priority. 【F:js/app.js†L73426-L73439】

The alert area filter returns all records only in county mode; otherwise it calls `isGridlyRecordInAwarenessArea(record, filter.area)` and records every filtered-out item. 【F:js/app.js†L26251-L26276】

This is the main visibility filter that can reduce ~11-12 grouped road-hazard locations to the 5 visible hazards in the selected production UI area.

### 7. Alerts panel render

`buildAlertsSurfaceHtml()` takes the snapshot alerts, applies the same selected-awareness-area filter again, groups alert rows by `getAlertClusterKey(alert)`, picks the highest-severity/freshest lead alert per group, then limits rendered detail cards to 3. 【F:js/app.js†L73480-L73523】

Important distinction:

- The snapshot/count can report 5 active hazards.
- The detail-card renderer may show only the first 3 cards plus “more” rows because `detailCardLimit = 3`.
- The production observation listing 5 alert items appears to describe the visible alert inventory/count, not necessarily the low-level HTML detail-card limit.

Alert cluster key differs from road-hazard cluster key. It is `kind|type|corridor|locationCluster`, not rounded lat/lng. 【F:js/app.js†L73234-L73239】

### 8. Awareness inventory

Community awareness uses user-facing active road-hazard incidents when available; only if none exist does it fall back to lifecycle-active raw hazards. It then filters hazards and reports by the selected awareness area. 【F:js/app.js†L26442-L26462】

The awareness source breakdown explicitly reports whether the hazard source was `activeUnifiedRoadIncidents` or `activeHazards`, total available, user-facing incident count, active considered, matched in area, and missing-coordinate records. 【F:js/app.js†L26491-L26496】

A reconciliation audit helper documents that location/route awareness count the same Alerts-surface active community report rows used by the Alerts panel header, rather than raw `activeHazards` rows or grouped live hazard incidents. 【F:js/app.js†L48740-L48756】

### 9. Marker inventory

`renderUnifiedIncidents()` renders from `getUnifiedIncidents()` unless there are no valid unified coordinates and valid `activeHazards` coordinates exist, in which case it falls back to `activeHazards`. It records selected source counts and coordinate-valid counts. 【F:js/app.js†L43864-L43890】

Marker rendering dedupes incidents by `getUnifiedIncidentRenderKey(...)`, then filters marker-eligible incidents. 【F:js/app.js†L43893-L43919】

Marker eligibility suppresses cleared, `hazard_cleared`, and recently-cleared records. 【F:js/app.js†L43616-L43623】

There is also crossing-specific suppression for duplicate unified blocked-crossing markers when crossing-layer ownership exists. That suppression preserves data in unified incidents while avoiding duplicate crossing markers. 【F:js/app.js†L43919-L43933】

For road hazards in the current scope, marker count should generally follow active unified road incidents after lifecycle/cluster/area effects, unless coordinates are missing/invalid or marker render dedupe collapses identical render keys.

## Exact grouping points

| Grouping point | Group key | Effect |
| --- | --- | --- |
| Supabase merge in `loadSharedReports()` | `id:${row.id}` or synthetic row key | De-dupes duplicate rows across live and recent-cleared reads before normalization. 【F:js/app.js†L31046-L31051】 |
| Road hazard incident grouping | `getHazardClusterKey(hazard)` = type + lat/lng rounded to 4 decimals | Converts many active hazard rows at same type/location into one live hazard incident. 【F:js/app.js†L44656-L44689】【F:js/app.js†L44706-L44714】 |
| Unified road incident identity | `road-${incident.key}` | Carries one grouped live hazard incident into one unified road incident. 【F:js/app.js†L49377-L49381】 |
| Marker render dedupe | `getUnifiedIncidentRenderKey(incident)` | Collapses duplicate render candidates before markers are created. 【F:js/app.js†L43893-L43908】 |
| Alert panel grouping | `kind|type|corridor|locationCluster` | Chooses one lead alert per alert cluster for detail-card rendering. 【F:js/app.js†L73234-L73239】【F:js/app.js†L73493-L73513】 |

## Exact suppression points

| Suppression point | What can be excluded | Evidence |
| --- | --- | --- |
| Supabase active read | Expired rows | `expires_at > now` read condition. 【F:js/app.js†L31016-L31025】 |
| County visibility | Rows outside active county | `gridlyReportMatchesActiveCounty(...)`. 【F:js/app.js†L31053-L31057】 |
| Dev cleanup | Shared reports intentionally suppressed during cleanup state | `gridlyShouldSuppressSharedReportDuringDevCleanup(...)`. 【F:js/app.js†L31055-L31057】 |
| Lifecycle active hazard filter | Expired, cleared, recently cleared, inactive lifecycle, latest-cleared, recent-clear-suppressed hazards | `gridlyIsActiveRoadHazardIncidentSource(...)`. 【F:js/app.js†L44609-L44618】 |
| Rehydration guard | Active-looking rows matched by recent clears | `gridlyFilterRoadHazardsByLatestLifecycle(...)`. 【F:js/app.js†L44626-L44642】 |
| Alert selected area filter | Alerts outside selected awareness area | `gridlyFilterAlertRecordsBySelectedAwarenessArea(...)`. 【F:js/app.js†L26251-L26276】 |
| Awareness selected area filter | Hazards/reports outside selected awareness area | `activeHazardItems.filter(...isGridlyRecordInAwarenessArea...)`. 【F:js/app.js†L26451-L26462】 |
| Marker lifecycle eligibility | Cleared/recently-cleared/hazard-cleared marker candidates | `gridlyIncidentEligibleForMapMarker(...)`. 【F:js/app.js†L43616-L43623】 |
| Crossing marker ownership | Duplicate unified blocked-crossing marker when crossing layer owns it | `gridlyGetUnifiedBlockedCrossingMarkerSuppression(...)`. 【F:js/app.js†L43919-L43933】 |

## Exact visibility filters

1. **County visibility** before `activeHazards`: active county filter in `loadSharedReports()`. 【F:js/app.js†L31053-L31057】
2. **Lifecycle visibility** before `activeHazards` and again before generated incidents: active road-hazard source predicate. 【F:js/app.js†L44609-L44618】
3. **Selected alert/awareness area visibility** before alerts snapshot output and alerts HTML rendering. 【F:js/app.js†L26251-L26276】【F:js/app.js†L73438-L73439】
4. **Selected awareness area visibility** before awareness card inventory. 【F:js/app.js†L26451-L26462】
5. **Marker coordinate and eligibility visibility** during marker rendering: finite coordinates, lifecycle marker eligibility, crossing duplicate-marker ownership. 【F:js/app.js†L43864-L43919】

## Known lifecycle filters

Lifecycle active rows must pass all of the following checks:

- record exists and is not expired
- not a road-cleared hazard record
- not recently cleared
- `getIncidentLifecycleState(...) === "active"`
- if lifecycle classifier is available, state is `ACTIVE`, `NEEDS_CONFIRMATION`, or `CONFIRMED`
- latest road-hazard lifecycle state is not `cleared`
- not suppressed by a recent clear 【F:js/app.js†L44609-L44618】

## Marker suppression rules

Markers are suppressed when:

- unified incident layer is unavailable
- no valid coordinates exist
- incident is cleared, hazard-cleared, or recently-cleared
- blocked-crossing unified marker duplicates an existing crossing-layer marker
- marker render throws an exception

The render audit initializes skip buckets for missing coordinates, invalid coordinates, filtered out, cleared/recently cleared, duplicate unified blocked crossing marker, missing marker layer, and render exception. 【F:js/app.js†L43879-L43882】

## Alert suppression rules

Alerts are suppressed or reduced by:

- selected-awareness-area filtering outside county mode
- alert cluster grouping in HTML detail-card rendering
- detail-card limit of 3 in `buildAlertsSurfaceHtml()`

The alert snapshot itself applies selected-area filtering before returning `alerts`/`normalizedAlertItems`. 【F:js/app.js†L73431-L73439】 The HTML renderer then applies area filtering again, groups by alert cluster key, and slices visible cards to `detailCardLimit`. 【F:js/app.js†L73480-L73523】

## Awareness suppression rules

Awareness is reduced by:

- preferring user-facing active road-hazard incidents over raw `activeHazards`
- selected-awareness-area filtering
- missing coordinate/text matching limitations, which are counted in `missingCoordinateRecords`

The summary uses active unified road incidents when available, filters them by selected awareness area, and reports source breakdown counts. 【F:js/app.js†L26442-L26462】【F:js/app.js†L26491-L26496】

## Most important lineage table

| Stage | Input Count | Output Count | Reason For Difference |
| --- | ---: | ---: | --- |
| Supabase active hazard rows | 19 | 19 | Prompt-supplied active rows: `other_hazard = 15`, `debris = 2`, `flooding = 1`, `traffic_backup = 1`. Code would read rows where `expires_at > now`; this audit did not re-query Supabase. 【F:js/app.js†L31016-L31025】 |
| Normalized county-visible hazard rows | 19 assumed | 19 assumed | Rows can be removed by active county or dev-cleanup suppression. Prompt implies these 19 are current active rows; no production re-read was performed. 【F:js/app.js†L31053-L31059】 |
| `activeHazards` | 19 assumed | 19 assumed | Rows can be removed by lifecycle/recent-clear filters. The prompt calls them active, so this audit assumes all 19 survive unless runtime diagnostics say otherwise. 【F:js/app.js†L31059-L31063】【F:js/app.js†L44609-L44618】 |
| Known unique hazard clusters | 19 | 12 by supplied arithmetic | The 8-row `other_hazard` duplicate cluster becomes 1 cluster, removing 7 raw rows from the incident count. 19 - 7 = 12. The prompt's “≈11” is approximate or implies one additional unlisted grouping/filter. Road grouping uses type + 4-decimal lat/lng. 【F:js/app.js†L44656-L44689】【F:js/app.js†L44706-L44714】 |
| `getLiveHazardIncidents()` | 19 active hazards plus recent-cleared collection | ~12 expected from supplied facts | Active rows are filtered again by active road-hazard lifecycle and grouped by hazard cluster key. Recent-cleared rows are passed into the builder but excluded from active generated incidents unless they pass active source logic, which cleared rows should not. 【F:js/app.js†L44652-L44656】【F:js/app.js†L44696-L44698】 |
| `unifiedRoadIncidents` | ~12 live hazard incidents | ~12 active road unified incidents | Each live hazard incident maps to one `road-${incident.key}` unified road incident. 【F:js/app.js†L49368-L49424】 |
| `activeUnifiedIncidents` | All unified incidents | ~12 road hazards plus any active non-road unified incidents | Filters unified incidents by `status === "active"`. 【F:js/app.js†L49431-L49433】 |
| Alerts snapshot | Active unified/localized incidents | 5 reported visible active hazards | Snapshot normalizes alert items, then applies selected-awareness-area filtering. The 5 visible hazards are therefore the area-visible alert inventory, not all grouped road-hazard clusters. 【F:js/app.js†L73431-L73439】【F:js/app.js†L26251-L26276】 |
| Alerts panel | 5 snapshot alert rows | 5 reported inventory; up to 3 detail cards plus “more” in this renderer | Alert HTML groups by alert cluster and limits detail cards to 3. The production “5 active hazards” count can still reconcile with a 5-row alert inventory. 【F:js/app.js†L73493-L73523】 |
| Awareness inventory | Alert-surface active community report rows / active unified road incidents | 5 reported | Awareness now aligns to the Alerts-surface active community report row set rather than raw `activeHazards` or grouped live incidents. 【F:js/app.js†L48740-L48756】 |
| Marker inventory | Unified incidents, normally | 5 reported | Markers render from unified incidents with lifecycle, coordinate, render-dedupe, and crossing ownership suppression. For current road hazards, the observed 5 markers align with the same visible area-scoped active inventory. 【F:js/app.js†L43864-L43919】 |

## Direct answer

Approximately 11-12 unique active road-hazard locations become 5 visible hazards because **visibility is based on the selected Alerts/Awareness active community report row set, not on raw Supabase rows or all grouped road-hazard clusters**. The known 8-row duplicate cluster explains the first reduction from 19 raw rows to about 12 grouped road incidents. The remaining reduction to 5 is produced downstream by selected-awareness-area/user-facing alert filtering and the Alerts/Awareness inventory contract. The code explicitly applies the selected-area filter to alerts and awareness, and the reconciliation helper states that location/route awareness count the same Alerts-surface active community report rows rather than raw `activeHazards` rows or grouped live hazard incidents. 【F:js/app.js†L26251-L26276】【F:js/app.js†L73431-L73439】【F:js/app.js†L48740-L48756】

## Exact testing performed

- Read-only source inspection with ripgrep and line-numbered excerpts.
- Created this Markdown audit report only.
- No production JavaScript, alert logic, awareness logic, marker logic, lifecycle logic, Supabase logic, DriveTexas logic, or crossing logic was modified.
- No live Supabase query was performed from this environment.
