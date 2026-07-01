# Gridly Live / History Compatibility Contract V1

## 1. Executive Summary

This milestone is a design and audit deliverable only. It does not modify production code, Supabase schema, migrations, report insertion, clearing behavior, alerts, markers, awareness, Route Watch, DriveTexas, or production data.

Gridly currently treats the `reports` table as both the live operational feed and the historical evidence ledger. That coupling is intentional in the current product: reports appear on the map, create alert and awareness state, participate in lifecycle decisions, collect confirmations, record clear evidence, and supply recurring-pattern evidence for future historical intelligence.

If Gridly later separates **Live Reports** from **Historical Intelligence**, the split must preserve the user-visible behavior of the current integrated pipeline before any cutover. The required compatibility target is not raw-row equality; it is **behavioral parity** across the live arrays, unified incidents, alerts, awareness, markers, confirmations, clears, recently-cleared visibility, crossing lifecycle, and recurring-history evidence.

All hazards currently in `reports` should be assumed to be testing artifacts generated during local testing, phone testing, and validation after merge to `main`. This contract is not a cleanup plan and must not be used to delete, rewrite, migrate, or suppress data.

## 2. Current Behavioral Contracts

Users currently rely on these behaviors:

1. **A submitted road hazard appears as an active map/reporting signal** when it survives expiration, county, development-cleanup, and lifecycle filters.
2. **A submitted crossing report appears as a crossing incident signal** and remains tied to the reviewed crossing identity, crossing coordinates, and crossing popup/reporting surfaces.
3. **Active reports feed alert and awareness surfaces**, not just map markers.
4. **Clearing does not delete the original evidence row.** Road hazard clears are represented by a `hazard_cleared` row; crossing clears are represented by a crossing row whose `report_type` is `cleared`.
5. **A clear removes or suppresses an incident from the active view according to current lifecycle rules**, while still leaving recent-clear evidence available where current UI expects it.
6. **Recently-cleared road hazards remain visible or suppress rehydration during the current recent-clear window.** Future architecture must not accidentally resurrect an old active row immediately after a clear.
7. **Confirming a report adds evidence rather than mutating the original report.** Confirmation strength is derived from additional report rows and grouped evidence.
8. **Grouped hazards remain grouped.** Multiple source rows that currently collapse into one visible incident must continue to collapse into the same visible incident.
9. **Crossing behavior remains unchanged.** Blocking, heavy delay, other, and cleared crossing semantics must preserve current latest-report and event-lifecycle behavior.
10. **Marker ownership remains stable.** Road incidents own road hazard markers; crossing incidents own crossing incident markers; neutral infrastructure crossing markers remain distinct from active incident markers.
11. **Duplicate suppression remains stable.** A split must not create duplicate alert cards, duplicate markers, or duplicated awareness counts for the same logical incident.
12. **Route Watch and DriveTexas behavior are out of scope for modification** and must remain behaviorally unchanged by any future live/history split.

## 3. Reports Compatibility Contract

A future live/history architecture MUST preserve the current report-facing contract:

- Existing report submissions must continue to create the same effective live evidence for road hazards and crossings.
- Existing report reads must continue to expose equivalent normalized records to current consumers or a compatibility projection.
- `loadSharedReports()` behavior must be preserved at the projection level: active rows, recent road-clear rows, normalization, county filtering, development-cleanup suppression, lifecycle filtering, and assignment to live report collections must remain equivalent.
- `activeHazards` must continue to mean lifecycle-visible road-hazard source rows, excluding rows that current rules exclude and preserving rows that current rules include.
- `activeReports` must continue to mean active non-road-hazard crossing/report rows after normalization and filtering.
- `recentlyClearedRoadHazards` must continue to mean recent road clear evidence retained for current visibility and suppression logic.
- `getLiveHazardIncidents()` must produce equivalent incident IDs, grouping, representative locations, source report membership, lifecycle states, and cleared-only incident behavior.
- Unified incident readers must continue to see equivalent road and crossing incident collections.
- Active hazard visibility must match the old pipeline for map, alert, awareness, and route-context consumers.
- Crossing visibility must match the old pipeline for crossing markers, crossing popups, alerts, awareness, and lifecycle classification.
- Awareness counts must not drift because history rows moved tables.
- Marker ownership must not drift because the source table or projection name changed.
- Compatibility may be implemented with a view, materialized projection, API adapter, dual read, or code-level adapter, but the exposed behavior must remain equivalent before cutover.

## 4. Alerts Compatibility Contract

Future architecture MUST preserve alert behavior:

- Alert generation must receive the same logical active incident set it receives today.
- Alert grouping must remain stable for road hazards, crossing incidents, and recently-cleared incidents currently shown by alerts.
- Alert visibility must remain stable across selected area, active county, lifecycle state, and incident type.
- Alert counts must match before and after migration for the same input rows and runtime state.
- Confirmation-derived trust indicators shown in alert contexts must remain equivalent.
- Cleared incidents must appear, disappear, or be suppressed in alerts exactly as they do under current lifecycle rules.
- Moving old evidence into history must not remove evidence required to explain active alerts.

## 5. Awareness Compatibility Contract

Future architecture MUST preserve awareness behavior:

- Awareness ownership must remain with the same logical incident/report entities currently counted by awareness helpers.
- Active counts must match the current pipeline for road hazards, crossings, and community activity.
- Selected-area filtering must be applied to the same normalized incident/report shapes, with equivalent coordinates and area membership.
- Route awareness behavior must not change as a side effect of live/history separation.
- Awareness must not double-count a report that exists in both a live projection and a historical ledger during transition.
- Awareness must not under-count active incidents because their source evidence was archived.
- Crossing awareness must preserve reviewed crossing identity, crossing coordinates, and current active/cleared interpretation.

## 6. Marker Compatibility Contract

Future architecture MUST preserve marker behavior:

- Road hazard markers must be generated from the same logical active road incidents, including current grouping and representative-coordinate rules.
- Crossing incident markers must remain owned by crossing incident state, not by raw history rows.
- Neutral crossing infrastructure markers must remain distinct from active crossing incident markers.
- Duplicate suppression must remain equivalent across road incidents, crossing incidents, hidden crossing IDs, cluster leads, and fallback marker paths.
- Clustering expectations must remain stable: grouped hazards that render as one incident today must render as one incident after migration.
- Fallback marker behavior must remain stable when unified incidents have no valid coordinates.
- A row existing in both live and history during migration must never create two markers for one logical incident.

## 7. Lifecycle Compatibility Contract

Future architecture MUST preserve lifecycle behavior:

- Expiration behavior must match current `expires_at` semantics for live reads.
- Road-hazard `hazard_cleared` behavior must remain an insert-only clear-evidence pattern unless a separate approved milestone changes it.
- Crossing `cleared` behavior must remain a crossing-report row and must preserve latest-report ordering semantics.
- Recently-cleared road-hazard behavior must preserve the current visibility/suppression window.
- Rehydration suppression must prevent old still-unexpired hazard evidence from returning to active view immediately after current clear logic would suppress it.
- Lifecycle classification must continue to consider age, confirmations, source trust, reconfirmation, manual-clear state, and current framework rules where applicable.
- Development cleanup suppression must remain isolated from normal lifecycle behavior.
- No migration may delete or mutate reports as a substitute for preserving lifecycle semantics.

## 8. Confirmation Compatibility Contract

Current confirmation behavior:

- Road hazard confirmation is additional evidence for a hazard location/type rather than an update to the original row.
- Crossing confirmation uses another crossing report row for the crossing and report type.
- Confirmation counts are derived from grouped active/report evidence.
- Confirmation strength influences trust, lifecycle, popups, alerts, awareness context, and historical event evidence.

Future architecture MUST preserve:

- Insert-as-evidence semantics for confirmations until explicitly changed by a separate approved milestone.
- Equivalent confirmation counts for a given logical incident/crossing.
- Equivalent grouping of confirming rows with the incident they currently strengthen.
- Equivalent source report membership and event-history evidence.
- No double-counting when a confirmation is visible in both live and history projections during migration.

## 9. Historical Intelligence Compatibility Contract

Future historical intelligence systems must preserve the evidence needed to reason about recurring local conditions without altering live behavior:

- Recurring crossing issues by crossing ID, crossing name, railroad, location, report type, and time window.
- Recurring flooding and other road hazards by hazard type, normalized location, road/corridor label, and time window.
- Duration evidence from first report through clear/expiration/latest lifecycle state where current rows support it.
- Frequency evidence by report type, location cluster, crossing ID, selected area, and county.
- Confirmation evidence as separate reinforcing rows, not just a final aggregate.
- Clear evidence for both road hazards and crossings.
- Source, confidence, device, created time, expiry time, county metadata, and detail fields currently needed by audits and diagnostics.
- The ability to reconstruct the old live projection for parity validation.
- Historical tables or projections must not become a second live source unless duplicate suppression and parity gates prove safe.

## 10. Parity Validation Plan

Before any live/history cutover, migration work must prove **old behavior = new behavior** for representative snapshots.

Required validation approach:

1. Capture an immutable input snapshot of relevant `reports` rows for one or more test windows.
2. Run the current live pipeline against the snapshot and record outputs for:
   - normalized reports;
   - active road hazards;
   - active crossing reports;
   - recently-cleared road hazards;
   - live road hazard incidents;
   - unified incidents;
   - active unified incidents;
   - alert cards/counts/groups;
   - awareness counts and selected-area membership;
   - marker inventory and marker coordinates;
   - crossing lifecycle state;
   - confirmation counts;
   - clear/recent-clear state.
3. Run the proposed live/history projection against the same snapshot.
4. Diff logical outputs, not raw table names.
5. Require documented zero-drift or explicitly approved, product-reviewed exceptions before cutover.
6. Include edge-case fixtures for:
   - active road hazard with no clear;
   - active road hazard with confirmation rows;
   - road hazard with recent `hazard_cleared` evidence;
   - expired road hazard;
   - active blocked crossing;
   - crossing with heavy/blocked confirmations;
   - crossing with latest `cleared` row;
   - grouped duplicate road hazards;
   - overlapping road and crossing incidents near the same location;
   - selected-area boundary filtering;
   - fallback marker coordinates;
   - development-cleanup-suppressed test rows.
7. Validate in read-only shadow mode before any write-path or schema cutover.

## 11. Migration Stop Conditions

Halt migration immediately if any of the following occur:

- `activeHazards` count or membership differs without approved explanation.
- `activeReports` count or membership differs without approved explanation.
- `recentlyClearedRoadHazards` count, membership, or window behavior differs.
- `getLiveHazardIncidents()` grouping, IDs, coordinates, lifecycle state, or source membership differs.
- Unified incident output differs in a way that changes markers, alerts, awareness, or Route Watch context.
- Alert count, grouping, ordering, visibility, or trust display differs.
- Awareness count, selected-area membership, or route-awareness behavior differs.
- Marker count, marker ownership, marker coordinate, clustering, or duplicate suppression differs.
- Crossing latest-report, active/cleared state, popup behavior, or marker behavior differs.
- Confirmation counts or confirming-source membership differ.
- Clear behavior, recently-cleared visibility, or rehydration suppression differs.
- Any production write path changes before an approved write-path milestone.
- Any Supabase schema/migration change is proposed under a design-only milestone.
- Any data deletion or cleanup is proposed as part of compatibility work.

## 12. Recommended Next Step

Recommended next audit: **V360 — Live Projection Parity Harness Design**.

The safest next step is not a schema split. It is a read-only design for a parity harness that defines snapshot inputs, expected output artifacts, comparison keys, edge-case fixtures, and acceptable-drift rules for the current `reports`-backed live projection. That audit should remain documentation/prototype-only and should not modify production code, Supabase schema, report insertion, clearing behavior, alerts, markers, awareness, Route Watch, DriveTexas, or data.
