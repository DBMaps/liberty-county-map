# V629 — Liberty Regression + Cross-County Surface Containment Root Cause Analysis

## Scope and protected boundaries

This is an audit-only root-cause report. No production fix is implemented here.

Protected boundaries remain unchanged:

- `historicalReadsEnabled`: false
- `historyUiEnabled`: false
- DriveTexas paused
- Transportation Intelligence disabled
- no Supabase schema changes
- no framework introduction
- no UI redesign

## Executive findings

1. **V628 did cause the Liberty/Dayton crossing regression after county switching.** The dynamic county runtime source registry correctly resolves Liberty's local fallback path and Montgomery's local county runtime path, but the crossing inventory is only loaded on bootstrap or manual refresh failure. Awareness-area switching updates county context and rerenders the existing `crossings` array; it does not reload the crossing asset when the active county changes. After Montgomery crossings have been loaded, returning to Liberty/Dayton can leave Montgomery inventory in memory, so Dayton filtering/rendering has no Liberty crossings to draw.
2. **Dayton crossings are not rendering because the in-memory crossing inventory is stale for the previous county, not because Liberty's registered local fallback path is missing.** Liberty still has `localCrossingsPath: "data/liberty-county-rail-crossings.geojson"`, and the runtime registry still chooses `localCrossingsPath || crossingsPath` for `crossingSource`.
3. **The cleared flooding header is a lifecycle/data-source stale-state issue, with DOM staleness as the visible symptom.** `clearHazard()` inserts a `hazard_cleared` row and calls `runPostSubmitRefresh()`. The header model then reads active awareness from active hazards/user-facing incidents and can reuse alert summary text. If the clear row does not suppress/remove the matching active hazard or alert-source candidate before the header model rebuilds, the top header legitimately re-renders from stale incident/alert model state; it is not merely old DOM text.
4. **Historical panel containment is not enforced.** Historical Intelligence reads the global `GRIDLY_EVENT_HISTORY_STORAGE_KEY`, not a county-scoped key, and `gridlyBuildHistoricalIntelligenceFindings()` groups all `crossingEvents` and `hazardEvents` without filtering by `activeCounty` or active town/area. The sheet renderer is callable/renderable even while governance audits say protected history UI flags remain false.
5. **Historical panel should be hidden or neutralized under protected flags.** With `historicalReadsEnabled=false` and `historyUiEnabled=false`, user-visible historical rows should not be rendered from storage/demo history. At minimum, the sheet builder should return a neutral disabled/empty state when those flags are false; better, the history dock/sheet entry should be suppressed until a future authorized history UI milestone.
6. **Road/location wording is produced by multiple functions, but the non-compliant flooding headline path is `buildGridlyLightweightActiveAwareness()` → `buildGridlyTopAwarenessSpecificHeadlineSelection()` / cached road-name lookup → `buildRoadHazardDisplay()`, with fallback headline construction also available through `buildGridlyLightweightActiveHeadline()`.** The coordinate resolver feeding these labels is `resolveNearestRoadName()`, which can return a paired road string (`roadA & roadB`) from nearest-road or crossing fallback. That pair format can conflict with approved location templates that require `on {road} near {reference}` or `between {referenceA} and {referenceB}`.
7. **The regressions are partly connected and partly separate.** Crossing disappearance and some road-name misresolution are connected by county-switch refresh order because the road resolver can fall back to the stale `crossings` array. Cleared-hazard header persistence is a separate lifecycle/awareness refresh failure. Historical cross-county leakage is a separate unscoped storage/read/UI exposure failure.

## Evidence trace

### 1. V628 crossing source handling

The county registry still contains Liberty's remote FRA URL plus Liberty's local crossing fallback, and Montgomery's local county runtime crossing asset. The runtime source registry chooses `config.localCrossingsPath || config.crossingsPath` for `crossingSource`, while preserving `remoteCrossingSource` separately.

`fetchFraCrossingsWithRetry()` first attempts the active county's `remoteCrossingSource` when present, then fetches the active county's `crossingSource`. If a remote URL exists, a local response is labeled `local_fallback`; if no remote URL exists, a local response is labeled `county_runtime_source`.

Therefore, the **registered Liberty local fallback path is not broken**. The regression is that changing the active awareness area/county does not force a crossing reload from the newly active county source.

### 2. Dayton crossing render failure after returning to Liberty/Dayton

At bootstrap, the app calls `loadCrossings()` once before loading roadways and shared reports. `loadCrossings()` populates global `crossings`, updates the awareness context, and schedules `renderCrossings()`.

When the user changes awareness area, `saveGridlyHomeTownPreference()` updates the active county context and calls `applyGridlyHomeTownAwarenessContext()` plus `scheduleRenderCrossings()`. It does **not** clear/reload `crossings` when the selected area's county differs from the loaded crossing inventory's source county. As a result, returning to Liberty/Dayton after Montgomery can render/filter Montgomery inventory against a Dayton anchor.

The render path confirms that `renderCrossings()` consumes the current global `crossings` array and exits if the array is empty or if no filtered visible crossings remain. It does not verify that the crossing inventory belongs to the current active county before rendering.

### 3. Cleared-hazard lifecycle and top Awareness header

The clear workflow creates a `hazard_cleared` row with a short expiration, captures history, and calls `runPostSubmitRefresh()`. That refresh should remove the matching active hazard from active inventory, incident generation, alert rows, and then awareness header inputs.

The header model uses active hazards and active reports to build `activeItems`. It also queries user-facing active road hazard incidents and alert-surface active community report rows. It can select a top detail and set `headline` from specific-location selection, reused alert summary text, or category/location fallback. Therefore, stale `"Flooding on Liberty"` is most likely entering from one of these model inputs before DOM update:

- stale `activeHazards` / `getGridlyUserFacingActiveRoadHazardIncidents()` output after the clear;
- stale alert-source rows or `window.__gridlyLatestAlertsForRender`, because the awareness model can reuse alert summary text;
- stale cached road/location lookup text used to construct the flooding headline.

Because `renderGridlyCommunityPulse()` overwrites DOM text from the model each render, the issue is **not best classified as stale DOM only**. DOM text can remain wrong if the model does not rerender, but the primary root is stale incident/alert/model lifecycle state.

### 4. Historical panel containment

`gridlyReadHistoricalIntelligenceStorageSnapshot()` reads `GRIDLY_EVENT_HISTORY_STORAGE_KEY` directly. It does not include active county in the key and does not filter parsed `crossingEvents` or `hazardEvents` by `county_id`, `countyId`, selected area, or town.

`gridlyBuildHistoricalIntelligenceFindings()` immediately groups all crossing events and hazard events from that snapshot. The sheet HTML builder uses the unscoped findings model and renders rows whenever ranked findings exist. This explains Conroe/Montgomery records appearing while Liberty/Dayton is active.

### 5. Road/location naming path

`resolveNearestRoadName()` first scans loaded road segments, then falls back to the loaded `crossings` array. When it can pair roads, it returns a string in the form `${roadA} & ${roadB}`. That is useful for lookup but does not match the approved display wording templates (`on`, `near`, `between`).

Top awareness flooding language is assembled downstream. The active-awareness builder selects a top active detail, passes it into specific-headline selection, can reuse alert summaries, and otherwise falls back to category/location headline construction. A related top-status helper explicitly returns `Flooding on ${localSpot}` for flood incidents. If `localSpot` is a county/town label (`Liberty`) or an ampersand pair, the output becomes non-compliant.

## Answers to required questions

### 1. Did V628 county_runtime_source handling break Liberty's local_fallback or FRA/local crossing path?

**No for path registration; yes for switch-time behavior.** Liberty's runtime source still points to the Liberty local fallback, and `fetchFraCrossingsWithRetry()` still supports remote FRA followed by local fallback. V628's dynamic county-runtime-source model exposed a missing reload boundary: the app does not reload crossings when active county changes after the initial load.

### 2. Why are Dayton crossings not rendering after returning to Liberty/Dayton?

Because the app rerenders the existing global `crossings` inventory instead of reloading Liberty crossings. If Montgomery inventory was loaded before the return to Liberty/Dayton, the Dayton area filter has no Liberty/Dayton crossing records to render.

### 3. Why does cleared flooding remain in the top Awareness header?

Because the awareness header rebuilds from active hazard/incident/alert model inputs, and the clear lifecycle does not reliably remove or suppress the matching active flooding input before the header model chooses its top headline.

### 4. Is the header reading stale cached incident state, stale cluster state, or stale DOM text?

Most likely **stale incident/alert model state**, possibly including reused alert summary text. The DOM is a symptom. The available code shows the header/pulse render path writes model output back to DOM, so persistent wrong text means the model still sees or reuses a flooding candidate, or the model was not rebuilt after inventory/alert removal.

### 5. Why is historical content not contained to active county/area while history flags are protected?

Because history reads use a global localStorage key and the finding builder groups every stored history event without active-county or active-area filtering. Separately, the sheet renderer does not enforce `historicalReadsEnabled=false` / `historyUiEnabled=false` before producing user-visible historical rows.

### 6. Which road naming function is producing non-compliant location wording?

The coordinate resolver is `resolveNearestRoadName()`, which can return paired labels using `&`. The visible non-compliant flooding headline is assembled downstream by top-awareness headline functions, especially `buildGridlyLightweightActiveAwareness()` through `buildGridlyTopAwarenessSpecificHeadlineSelection()`/`buildRoadHazardDisplay()` or its category/location fallback. The explicit flood headline helper path also contains `Flooding on ${localSpot}`.

### 7. Are these regressions connected through county switching refresh order, or separate failures?

They are **mixed**:

- connected: Liberty crossing disappearance and road-name resolver contamination can both result from stale county crossing inventory after switching;
- separate: cleared flooding persistence is lifecycle/active-awareness/alert-state stale data;
- separate: Historical Intelligence leakage is global history storage/read/rendering without protected-flag enforcement.

## Minimal fix plan proposal

Only after approval to implement fixes:

1. **County switch crossing reload guard**
   - Track `loadedCrossingSourceCounty` / `loadedCrossingSourcePath` when `loadCrossings()` succeeds.
   - On awareness-area county change, if active county differs from loaded crossing source county, clear crossing markers and reload crossings before scheduling render.
   - Keep Liberty remote→local fallback and Montgomery local-only `county_runtime_source` labels unchanged.

2. **Cleared hazard lifecycle containment**
   - In the clear path and `loadSharedReports()` lifecycle filter, ensure `hazard_cleared` rows suppress matching active hazards by stable lifecycle keys before `activeHazards`, live incidents, unified incidents, alerts, and awareness are rebuilt.
   - After refresh, force alerts snapshot and active-awareness/pulse/header rebuild from the post-clear inventory.
   - Add an audit proving the cleared hazard is absent from `activeHazards`, live hazard incidents, unified incidents, alert rows, active awareness selected detail, and rendered header text.

3. **History protected-flag neutralization**
   - While `historicalReadsEnabled=false` and `historyUiEnabled=false`, do not render historical rows from storage/demo data.
   - Prefer hiding the history sheet entry or returning a neutral disabled state.
   - If future audit-only reads remain needed, make them maintainer-only and explicitly county-scoped.

4. **Road naming display compliance**
   - Keep `resolveNearestRoadName()` as a resolver, but do not directly display paired `A & B` output in awareness/alert/popup copy.
   - Add a presentation formatter that converts primary/reference data into approved templates: `on {road}`, `on {road} near {reference}`, or `on {road} between {referenceA} and {referenceB}`.
   - Ensure county/town labels such as `Liberty` are rejected as road labels for flooding headlines.

## Audits to add or extend after approval

- `gridlyLibertyCrossingRegressionAudit?.()` should report active county, selected town, loaded crossing source county/path, expected source path, crossing inventory count, Dayton filtered count, rendered marker count, and whether reload is required.
- `gridlyClearedHazardAwarenessRegressionAudit?.()` should trace report created → active hazard → cleared row → active inventory removal → alert removal → awareness selected detail → header DOM text.
- `gridlyHistoricalPanelContainmentAudit?.()` should report active county/town, history flags, storage key(s), unfiltered history counts, out-of-county rows, rendered panel rows, and whether UI is neutralized under protected flags.
- `gridlyRoadNamingResolutionAudit?.()` should trace coordinate → resolver debug source → raw resolver output → display formatter output → awareness/alert/popup strings, with compliance status.

## Merge recommendation

Do **not** merge a behavioral fix until the above minimal fix plan is implemented and verified. This RCA-only milestone is safe to merge as documentation because it changes no runtime code and preserves all protected boundaries.
