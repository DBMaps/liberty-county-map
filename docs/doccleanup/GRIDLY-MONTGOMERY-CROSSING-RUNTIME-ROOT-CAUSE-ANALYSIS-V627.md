# GRIDLY Montgomery Crossing Runtime Root Cause Analysis V627

## Executive summary

Montgomery crossings disappear at the **county source selection / crossing source availability gate**, before marker creation, render, and click binding can occur. The runtime registry marks Montgomery as operational and selectable, but the Montgomery runtime crossing source fields are still `null` and the availability flag for crossings is `missing`. Consequently, `fetchFraCrossingsWithRetry()` returns an empty in-memory GeoJSON feature collection when Montgomery is active, `loadCrossings()` normalizes zero crossings, and `renderCrossings()` exits because `crossings.length` is zero.

This is not a marker-layer, click-handler, zoom, popup, or visual asset failure. It is also not a Liberty fallback contamination at the active Montgomery runtime path. The current code fails closed for Montgomery crossings because the active county runtime source registry has no Montgomery crossing source even though a Montgomery crossing asset exists in the package under `assets/county-implementation/montgomery/runtime-assets/montgomery-county-rail-crossings.geojson`.

## Protected-boundary statement

This audit is documentation-only. It does not implement runtime behavior changes, county activation changes, crossing implementation changes, asset changes, registry changes, Supabase changes, historical reads, history UI, DriveTexas, Transportation Intelligence, framework changes, or UI redesign.

## 1. County source selection

### Functions involved

| Question | Runtime answer |
| --- | --- |
| Which function determines `crossingSourceCounty`? | `gridlyGetCountyRuntimeSources(countyId = gridlyGetActiveCountyId())` resolves the normalized active county to an entry in `GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY`; runtime ownership audits expose this as `crossingSourceCounty: sources?.countyId || activeCounty`. |
| Which function determines crossing asset path? | `GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY` builds `crossingSource` from `config.localCrossingsPath || config.crossingsPath || null`, and startup constants read `LOCAL_CROSSINGS_URL = gridlyGetActiveCountyRuntimeSources().crossingSource` and `FRA_URL = gridlyGetActiveCountyRuntimeSources().remoteCrossingSource`. |
| Which function determines active crossing source? | `fetchFraCrossingsWithRetry()` decides whether to fetch remote FRA, local fallback, or return an empty feature collection based on `gridlyCountyRuntimeSourceAvailable("crossings")`, `FRA_URL`, and `LOCAL_CROSSINGS_URL`. |
| Does Montgomery resolve to Montgomery-owned crossing assets? | No. It resolves to the Montgomery runtime source registry entry, but that entry has `crossingSource: null` and `remoteCrossingSource: null`. |
| Does it fall back to Liberty? | No for this path. `gridlyNormalizeCountyId("montgomery-tx")` remains Montgomery because Montgomery is known and operational; the source registry lookup returns Montgomery rather than defaulting to Liberty. |
| Does it fall back to FRA? | No. Montgomery has `crossingsPath: null`, so `FRA_URL` is null. Additionally, the availability gate short-circuits before fetch attempts. |
| Does it fail closed? | Yes. `fetchFraCrossingsWithRetry()` returns an empty GeoJSON response when `gridlyCountyRuntimeSourceAvailable("crossings")` is false. |

### Source selected / expected / available / missing

| Field | Finding |
| --- | --- |
| Source selected | `montgomery-tx` runtime source entry with no crossing URL. |
| Source expected | Montgomery-owned package crossing asset: `assets/county-implementation/montgomery/runtime-assets/montgomery-county-rail-crossings.geojson`. |
| Source available | The asset exists and contains 239 GeoJSON features by source inspection. |
| Source missing | The runtime registry entry does not point to the available Montgomery crossing asset, and its crossing availability remains `missing`. |

## 2. Crossing asset availability

| Asset | Status |
| --- | --- |
| Path | `assets/county-implementation/montgomery/runtime-assets/montgomery-county-rail-crossings.geojson` |
| Exists | Yes |
| Record count | 239 GeoJSON features |
| Registered in active runtime | No. `GRIDLY_COUNTY_REGISTRY["montgomery-tx"].localCrossingsPath` and `crossingsPath` are both `null`. |
| Loadable if referenced | Likely yes as static GeoJSON; this audit did not change runtime to fetch it. |
| Normalized | Not by current runtime, because it is never loaded. The file is parseable as GeoJSON via source inspection. |
| Parseable | Yes; JSON parsing and feature count inspection succeeded locally. |

## 3. Crossing load stage

Pipeline:

```text
active county = montgomery-tx
→ gridlyGetActiveCountyRuntimeSources()
→ crossingSource = null, remoteCrossingSource = null, availability.crossings = "missing"
→ loadCrossings()
→ fetchFraCrossingsWithRetry()
→ availability gate returns empty FeatureCollection
→ data.features.length = 0
→ rawCrossings.length = 0
→ crossings.length = 0
→ scheduleRenderCrossings("state-change", { force: true })
```

Findings:

- `loadCrossings()` is executed during app bootstrap.
- Montgomery does not load successfully in the sense of loading Montgomery inventory; it receives an intentional empty feature collection from the missing-source gate.
- Normalization itself does not throw; it normalizes zero records.
- Loaded crossing count: `0` under current Montgomery runtime source selection.
- Discarded count: not materially applicable at normalization, because no Montgomery features enter the normalization loop.
- Drop reason: **source unavailable before fetch** (`runtimeSourceAvailability.crossings = "missing"` and crossing URLs are null).

## 4. Active county crossing filtering

The current crossing inventory path does not contain a dedicated active-county filter after normalization. The active-county decision happens before loading, through the county runtime source registry and source availability gate.

Findings:

- Montgomery crossings are not filtered out after load; they never enter `crossings`.
- No evidence of county ownership mismatch at the marker filtering stage, because marker filtering receives zero crossings.
- Liberty fallback does not contaminate Montgomery crossing inventory in the active path; Montgomery fails closed rather than borrowing Liberty.
- Missing county metadata in normalized crossing objects is still a future risk: `loadCrossings()` stamps normalized crossing rows with `LOCATION_DEFAULTS.county`, not a source-county or active-county field. That issue does not cause the current disappearance because no Montgomery rows are normalized.

## 5. Marker creation stage

Pipeline:

```text
crossings = []
→ scheduleRenderCrossings(...)
→ renderCrossings(...)
→ if (!crossingLayer || !crossings.length) return
```

Findings:

- Crossing markers are not created for Montgomery.
- Marker count is `0` because `crossings.length` is `0`.
- Rejection logic inside marker creation is not reached.
- Smart clustering, hidden-id suppression, marker assets, popup binding, and click guard logic are not reached.

## 6. Marker render stage

Findings:

- Markers are not created and therefore are not rendered.
- They are not rendered off-screen; there are no marker objects to position.
- They are not hidden by marker visibility rules; render exits before visibility rules can produce candidates.
- They are not blocked by layer state if `crossingLayer` exists; the blocker is empty crossing inventory.
- Zoom thresholds are not the primary cause. Zoom gates can hide distant inactive crossings later, but Montgomery has zero inventory before zoom filtering.

## 7. Click binding stage

Findings:

- Click handlers are not attached for Montgomery crossing inventory because markers are never created.
- Popups are not attached because `L.marker(...).bindPopup(...)` is never executed for Montgomery rows.
- Interactions are unavailable because the pipeline fails before marker creation, not because interactions are disabled.

## 8. Crossing audit review

### `window.gridlyCrossingRenderAudit?.()`

This audit can prove:

- Whether `renderCrossings()` has run.
- Whether the crossing layer exists and is attached.
- The last render calls and visible count.
- Current marker counts across the marker map, Leaflet layer, and DOM.
- Which source was last reported by the crossing fallback audit state.

This audit does not fully prove:

- Which county source should have been selected.
- Whether an unregistered package asset exists on disk.
- Whether the zero count came from missing county availability versus a parse failure versus a post-load county filter.
- The expected county-owned source path for Montgomery.
- A formal drop stage / drop reason classification.

### `window.gridlyCrossingPipelineAudit?.()`

This audit can prove:

- Crossing report counts in the live reports pipeline.
- Normalized active crossing report counts.
- Dropped crossing reports and report drop reasons.
- In-memory `crossings.length` and coordinate-valid count.
- Fetch/fallback audit state merged into the pipeline output.

This audit does not fully prove:

- Crossing inventory activation readiness end-to-end.
- Source registry miswiring when an asset exists but is not referenced.
- Marker creation count versus rendered count versus click-binding count as separate activation gates.
- County-owned asset availability and registration status.

### Missing audit coverage

A future audit helper should explicitly join source selection, asset registration, load, normalization, filtering, marker creation, render, and click binding into one activation-readiness result.

## 9. Crossing readiness classification

Exact classification: **A. Crossings missing**.

More precise sub-classification: **crossings missing from active runtime source selection, despite Montgomery crossing assets existing in the package**.

Not selected as primary classification:

- **B. Crossings loaded but filtered** — false; Montgomery crossings are not loaded.
- **C. Crossings normalized but not rendered** — false; zero Montgomery rows are normalized.
- **D. Crossings rendered but not interactive** — false; no Montgomery crossing markers are rendered.
- **E. Multiple failures** — not required for the observed symptom. There are future risks around county metadata and zoom visibility, but the exact disappearance stage is the missing runtime crossing source gate.

## 10. Activation Gate impact

V626's `BLOCKED` interpretation remains correct. The primary active blocker is crossing runtime source registration/availability, not marker click behavior.

If crossings are fixed by correctly wiring Montgomery-owned crossing assets and proving marker/click readiness, Montgomery would likely move from **BLOCKED** to **PASS WITH OBSERVATIONS**, assuming the already-noted residual observations remain non-blocking:

- road naming / roadway dataset maturity still needs observation because Montgomery road segment source is marked missing in the current runtime registry;
- historical containment should remain observed/protected because historical reads and history UI remain disabled;
- DriveTexas and Transportation Intelligence remain paused/disabled by protected boundary.

If a future gate treats the missing Montgomery road segment source as a hard blocker rather than an observation, Montgomery would remain **BLOCKED** after crossings are fixed. Based on the current V626 context supplied for this audit, crossings are the primary blocker preventing pass.

## Required future audit helper — documentation only

Do not implement in V627. A future read-only browser helper should be defined as:

```js
window.gridlyCrossingActivationReadinessAudit?.()
```

Expected shape:

```js
{
  countyId,
  crossingSourceCounty,
  sourceAvailable,
  assetLoaded,
  normalizedCount,
  filteredCount,
  markerCount,
  renderedCount,
  clickBindingCount,
  dropStage,
  dropReason,
  readinessClassification,
  safeForActivation
}
```

Recommended semantics:

| Field | Meaning |
| --- | --- |
| `countyId` | Active county ID from `gridlyGetActiveCountyId()`. |
| `crossingSourceCounty` | County owning the selected crossing source from `gridlyGetActiveCountyRuntimeSources()` / source registry. |
| `sourceAvailable` | Boolean derived from source availability and a non-empty crossing source path. |
| `assetLoaded` | Boolean proving fetch/read succeeded and produced a GeoJSON object. |
| `normalizedCount` | Count after coordinate and field normalization. |
| `filteredCount` | Count after active-county, viewport, active-delay, route, and zoom filters, separated where possible. |
| `markerCount` | Count of Leaflet marker objects created. |
| `renderedCount` | Count from marker map, crossing layer, and DOM reconciliation. |
| `clickBindingCount` | Count of rendered crossing markers with click/popup bindings attached. |
| `dropStage` | First stage where expected Montgomery inventory reached zero or failed. |
| `dropReason` | Machine-readable reason, e.g. `source_unavailable`, `asset_fetch_failed`, `normalized_zero`, `filtered_by_county`, `hidden_by_zoom`, `marker_creation_failed`. |
| `readinessClassification` | One of A/B/C/D/E from this document. |
| `safeForActivation` | True only when county-owned source is available, loaded, normalized, rendered, and interactive without cross-county fallback. |

## Recommended next milestone

V628 should be a narrowly scoped crossing activation remediation milestone, not a broad county activation milestone. It should:

1. Wire Montgomery runtime crossing source selection to the existing Montgomery-owned package asset.
2. Mark crossing availability consistently only after source registration is present.
3. Preserve fail-closed behavior for counties without crossing assets.
4. Add or implement the documented crossing activation readiness audit.
5. Prove Montgomery marker creation, render counts, and click/popup binding in-browser.
6. Re-run the V626 activation gate after crossing-specific proof is available.

## Merge recommendation

Merge V627 as a documentation-only root cause analysis. It identifies the exact disappearance stage and does not alter runtime behavior or activation state.
