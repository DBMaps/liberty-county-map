# Gridly V140.1 Unified Incident Source Audit

## Executive Summary

The visible hazard system is not sourced directly from the raw `reports` array rendering path anymore for map hazard chips/cards. The dominant visible hazard path is:

`Supabase reports -> normalizeReports(...) -> activeHazards/activeReports -> getLiveHazardIncidents()/getConsolidatedIncidents() -> getUnifiedIncidents() -> renderUnifiedIncidents()/renderAlerts()/road hazard intelligence`

This confirms the known issue: zombie hazards can persist through the **generated unified road incident layer (`road-*`)** even when prior cleanup targeted only one report list or a legacy UI list.

Key findings:
- `road-*` incident IDs are generated in `getUnifiedIncidents()` from grouped hazard clusters, not from a persisted `road-*` table.
- The map hazard marker layer (`unifiedIncidentLayer`) is driven by `getUnifiedIncidents()`, not by `activeReports` directly.
- Alert cards are mixed-source but predominantly intelligence/unified-derived; they also explicitly include recently cleared unified incidents.
- Route Watch hazard scoring runs on combined normalized report state (`activeReports + activeHazards`) and is therefore parallel to unified generation (same roots, different path), not directly reading marker layer state.

## Confirmed Source Map

| UI/System Area | Current Source | Functions Involved | Notes/Risk |
|---|---|---|---|
| Raw reports | Supabase `reports` rows filtered by `expires_at > now` | `loadSharedReports()` -> `normalizeReports()` -> assigns `activeReports`/`activeHazards` | Raw source is canonical ingest; split into crossing vs hazard kinds during normalization. |
| Unified incidents | Derived aggregate array combining rail consolidated incidents + grouped road hazard incidents (+ future providers currently empty) | `getConsolidatedIncidents()`, `getLiveHazardIncidents()`, `getUnifiedIncidents()` | This is the true source for unified markers and cleared feed segment. |
| Generated `road-*` incidents | In-memory generated IDs from clustered active hazard groups | `getHazardClusterKey()` + `getLiveHazardIncidents()` + `getUnifiedIncidents()` (`id: road-${incident.key}`) | Not a DB row; regenerated every render cycle from `activeHazards`. Zombie effect can appear if hazard cluster source remains or is reloaded. |
| Alert cards/feed | Corridor intelligence + route impact + optional recently cleared unified incidents | `renderAlerts()` + `buildCommuteConsequenceIntelligence(...)` + `getUnifiedIncidents()` (cleared section) | Mixed-source feed; not pure raw reports list. |
| Map hazard markers | Unified incident array rendered into `unifiedIncidentLayer` | `renderUnifiedIncidents()` + `getUnifiedIncidents()` | Hazard map markers are unified-derived; dedupe logic can prefer certain candidates and keep cleared/active based on timestamps. |
| Route Watch hazard scoring | Combined normalized candidates (`activeReports` + `activeHazards`) near route geometry | `buildRouteHazardAssessment()` / `getRouteHazardAssessment()` | Separate path from `renderUnifiedIncidents()`, but same normalized roots. |
| Cleared/stale hazards | Lifecycle + expiry + hazard_cleared semantics in normalized and unified transforms | `getIncidentLifecycleState(...)`, `getLiveHazardIncidents()` filter, `renderAlerts()` cleared slice | `getLiveHazardIncidents()` excludes `hazard_cleared`; unified road status can still represent cleared depending on latest type mapping. |
| Post-submit refresh | Background live reload + full hazard/report rerender fanout | `runPostSubmitRefreshInBackground()` -> `loadSharedReports("post_submit_refresh")` -> `refreshReportHazardViews()` | Multiple render invocations exist; risk of duplicate render loops / redundant calls. |

## road-* Incident Findings

1. **Creation point**
   - `road-*` IDs are created at unified generation time:
     - `id: \`road-${incident.key}\`` in `getUnifiedIncidents()`.
   - `incident.key` comes from `getLiveHazardIncidents()` group keys.

2. **Grouping key mechanics**
   - `getHazardClusterKey(hazard)` returns `${hazard.type}-${lat.toFixed(3)}-${lng.toFixed(3)}`.
   - This means nearby reports at same rounded coordinate + type collapse into one generated road incident.

3. **Storage and visibility path**
   - No persistent `road-*` storage table found.
   - Storage is transient in computed arrays from `activeHazards`.
   - Visibility occurs when `renderUnifiedIncidents()` iterates `getUnifiedIncidents()` and paints to `unifiedIncidentLayer`.

4. **Clear/expire behavior**
   - Hazard rows are initially filtered by Supabase query `expires_at > now` during `loadSharedReports()`.
   - Additional filtering in `getLiveHazardIncidents()` excludes `hazard_cleared` and `expired` hazards.
   - Clearing behavior can still surface in unified/alerts via status mapping and separate cleared sections, creating perceived persistence if stale source rows remain valid by expiry time or lifecycle logic.

## Zombie Hazard Root Cause

Most likely root cause is cleanup targeting only one surface (e.g., report arrays or UI list) while visible hazards are regenerated from `activeHazards` into `getLiveHazardIncidents()` and then `getUnifiedIncidents()`.

In short: if underlying hazard rows remain in the synced normalized hazard set (or are reintroduced by refresh/realtime), `road-*` unified incidents reappear automatically, even after local list cleanup.

## Correct Cleanup Target

For V140.2 (not implemented here), cleanup should target the **authoritative hazard source feeding unified generation**:

- Primary: Supabase `reports` hazard rows (especially road hazard types without `crossing_id`, and any stale user-source hazard rows), plus any lifecycle/expiry gating rules that still classify them as active.
- Secondary: in-memory normalized state reset must include both `activeHazards` and `activeReports`, followed by a single canonical refresh path.

Critically, deleting only rendered cards or only crossing-report views will not prevent `road-*` regeneration.

## Duplicate Refresh / Render Risk

Observed duplicate or overlapping refresh behavior:

- `refreshReportHazardViews()` already calls:
  - `renderAlerts()`
  - `renderRoadHazards()`
  - `renderTrendingCrossings()`
  - `renderUnifiedIncidents()`
  - plus route/intelligence updates.

- In dev purge flow, after `refreshReportHazardViews()` and `loadSharedReports(...)`, additional explicit calls occur:
  - `refreshReportHazardViews()` again
  - `renderUnifiedIncidents()` again
  - `renderRoadHazards()` again

- Post-submit background refresh also calls `loadSharedReports("post_submit_refresh")`, which itself calls `refreshReportHazardViews()`, then `.then()` calls `refreshReportHazardViews()` again.

Risk: repeated render loops can amplify perception of flicker/reappearance and complicate debugging of zombie incident persistence.

## Protected Systems Confirmed Untouched

This audit did not change or refactor:
- Supabase sync architecture
- FRA crossing loading
- Liberty County GeoJSON loading
- Routing engine
- Route Watch logic behavior
- Saved places
- Map bootstrap
- Desktop layout
- Landscape tactical architecture

No app behavior changes were made.

## Recommended Next Patch

**V140.2 (proposed only, not implemented):**

1. Establish one canonical cleanup function for zombie road hazards that operates at source-of-truth level (Supabase hazard rows + normalized in-memory caches).
2. Add scoped cleanup predicate specifically for generated-road inputs:
   - hazard report types (`flooding`, `ice`, `debris`, `crash`, `construction`, `road_closed`, `disabled_vehicle`, `other_hazard`, optionally `wreck` alias)
   - road-only records (empty `crossing_id`) unless intentionally retaining rail-related hazards.
3. Ensure cleanup executes before any unified recomputation and then trigger exactly one refresh chain.
4. Add short-lived audit logging around:
   - source rows deleted
   - resulting `activeHazards.length`
   - resulting `getLiveHazardIncidents().length`
   - resulting `getUnifiedIncidents().length`
5. De-duplicate post-submit/dev-purge rerender fanout to avoid repeat render passes and reduce false-positive “zombie” visual rebounds during refresh windows.

