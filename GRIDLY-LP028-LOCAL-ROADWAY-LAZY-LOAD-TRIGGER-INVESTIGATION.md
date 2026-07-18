# LP028.5 Local Roadway Lazy-Load Trigger Investigation

Project: Gridly — Know Before You Go  
Branch: `LP028-REGIONAL-ROADWAY-RUNTIME-INTEGRATION`  
Merge status: **DO NOT MERGE**  
Scope: investigation only; no production behavior, CSS, protected-system, LP016, DriveTexas, LP023 presentation, or roadway GeoJSON changes.

## Executive finding

The observed browser state for Liberty, Montgomery, and San Jacinto after county selection alone is **defective for switched counties**, not expected lazy-loading behavior.

There is no consumer-driven lazy-load trigger in production. The only production invocation of `loadRoadwayDataset()` is the DOMContentLoaded startup stage named `roadway dataset loading`. Roadway-aware consumers such as `resolveNearestRoadName()`, `resolveNearbyRoadPair()`, LP023 canonical road-context resolution, road-hazard coordinate lookup, popup/report/alert rendering paths, and related normalization paths synchronously read the already-loaded `roadwaySegmentFeatures`; they do not call or await `loadRoadwayDataset()`.

Therefore:

- Initial app startup should load the active county roadway package if the active county is Liberty, Montgomery, or San Jacinto and the manifest is available.
- County selection alone currently does **not** load roadway geometry.
- Roadway-aware operations currently do **not** trigger a missing county package load.
- A local runtime county selected after startup can remain permanently unloaded for geometry-aware resolution until a manual `loadRoadwayDataset()` call or full app reload starts with that county active.
- Switching from a loaded local county to a pending or blocked county does **not** correctly clear stale roadway geometry unless `loadRoadwayDataset()` is invoked separately.

## Required answers

### 1. Exact lazy-load trigger function

There is no true lazy-load trigger tied to roadway consumers. The exact production function that invokes the loader is the DOMContentLoaded bootstrap stage:

```text
document.addEventListener("DOMContentLoaded", async () => { ... })
  -> runStartupStage("roadway dataset loading", ...)
  -> loadRoadwayDataset()
```

The exact invoked loader is:

```text
async function loadRoadwayDataset()
```

### 2. Exact call chain from consumer/runtime action to `loadRoadwayDataset()`

No inspected consumer/runtime action calls `loadRoadwayDataset()`.

The only production call chain found is startup:

```text
DOMContentLoaded application bootstrap
  -> runStartupStage("crossing package loading and initial marker rendering", loadCrossings)
  -> runStartupStage("roadway dataset loading", loadRoadwayDataset)
  -> loadRoadwayDataset()
  -> gridlyEnsureRoadwayRuntimeManifestLoaded()
  -> gridlyResolveRoadwayRuntimeSource(activeCounty)
  -> fetch(roadwaySource.url)
  -> roadwaySegmentFeatures = lineFeatures
  -> roadwayDatasetLoaded = true
  -> gridlyRoadwayPackageRuntimeState.loadedCounty/loadedUrl/loadedVersion populated
  -> gridlyResetRoadNameResolverRuntimeCache("roadway_dataset_loaded")
```

Roadway consumers read the loaded dataset but do not load it:

```text
LP023 canonical road-context resolution
  -> buildGridlyRoadHazardLocationContract(record, options)
  -> if coords and coordinate lookup is needed: resolveNearestRoadName(lat, lng)
  -> resolveNearestRoadName(...)
  -> findNearestRoadwaySegment(...)
  -> reads roadwayDatasetLoaded and roadwaySegmentFeatures
```

```text
LP023 canonical road-context resolution or direct road-pair lookup
  -> resolveNearbyRoadPair(lat, lng, primaryRoad)
  -> collectNearbyRoadCandidates(...)
  -> reads roadwayDatasetLoaded and roadwaySegmentFeatures
```

```text
Road-hazard coordinate context enrichment
  -> coordinateRoadLookupFor(coords, primaryRoad)
  -> resolveNearestRoadName(lat, lng)
  -> resolveNearbyRoadPair(lat, lng, primaryRoad)
  -> reads roadwayDatasetLoaded and roadwaySegmentFeatures
```

### 3. Whether current browser results are expected or defective

The results are **defective** if produced after switching to Liberty, Montgomery, or San Jacinto from another county without a full reload or manual loader invocation.

The results can be **temporarily expected** only before the startup roadway stage has completed, or after a load failure. Once the startup loader has completed successfully for a local runtime active county, the audit should not show `activeCountyPackageLoaded: false` for that active county.

### 4. Whether county selection should load roadway geometry

Given the current production code, county selection does **not** load roadway geometry. `gridlySetActiveCountyContext()` updates active county state, clears crossing inventory, resets crossing audit state, loads active county crossings, resyncs visible surfaces, renders boundary/identity UI, and fits the map. It does not call `loadRoadwayDataset()`, does not clear `roadwaySegmentFeatures`, and does not reset `gridlyRoadwayPackageRuntimeState`.

From the runtime contract implied by county-aware roadway packages, county selection should either:

1. invoke `loadRoadwayDataset()` for a local/external runtime county, or
2. clear the current roadway dataset and arm a consumer-triggered lazy loader that every roadway-aware resolver awaits before geometry use.

Neither path exists today.

### 5. Expected audit after intended trigger

After `loadRoadwayDataset()` legitimately runs and succeeds for Liberty, Montgomery, or San Jacinto, the passive audit should report:

```js
activeCountyPackageLoaded: true
loadedRoadwayCounty: "<active local county id>"
loadedRoadwayUrl: "<active county roadway GeoJSON URL>"
loadedRoadwayVersion: "legacy"
currentPackageCacheKey: "<county>::legacy::<url>"
lastPackageLoadError: null
```

For pending or blocked counties, a loader invocation should reset in-memory geometry and then fail closed with no package loaded because the resolved roadway source has no loadable URL.

### 6. Permanently unloaded local-runtime paths

Yes. A local runtime county can remain permanently unloaded after a roadway-aware operation requires geometry when the user switches to that county after startup. The roadway-aware operations inspect the existing `roadwayDatasetLoaded` and `roadwaySegmentFeatures` state; they return fallback/no-road results when the dataset is absent. They do not call or await `loadRoadwayDataset()`.

Specific examples:

- `findNearestRoadwaySegment()` immediately returns `null` when `roadwayDatasetLoaded` is false or `roadwaySegmentFeatures` is empty.
- `collectNearbyRoadCandidates()` immediately returns an empty array when `roadwayDatasetLoaded` is false or `roadwaySegmentFeatures` is empty.
- `resolveNearestRoadName()` reports `roadway_dataset_unavailable` in debug state and falls back to crossings if possible.
- `resolveNearbyRoadPair()` reports `roadway_dataset_unavailable` when no nearby roadway candidates exist because the dataset is unloaded.

### 7. Did LP028.4 clear or bypass the original trigger?

No evidence was found that LP028.4 cleared or bypassed a previous consumer lazy-load trigger. Static search found only one production call to `loadRoadwayDataset()`, the existing startup call. LP028.4 added manifest resolution inside the loader and the passive audit, but it did not add a county-switch invocation or consumer invocation.

The root defect is the gap between LP028.4's county-aware manifest/source resolver and the existing one-time startup loader model.

### 8. Stale geometry clearing when moving to pending/blocked counties

Stale geometry clearing works only when `loadRoadwayDataset()` is invoked after the county changes. The loader resets `roadwayDatasetLoaded`, `roadwaySegmentFeatures`, loaded package metadata, and resolver caches before checking source availability.

However, `gridlySetActiveCountyContext()` does not invoke the loader and does not clear roadway state itself. Therefore switching from a loaded local county to Polk/Chambers/Harris can leave stale roadway geometry in memory. The LP028 audit may show `activeCountyPackageLoaded: false` because `loadedCounty !== activeCounty`, but `loadedRoadwayCounty`/`loadedRoadwayUrl` can still identify the prior county, and synchronous roadway resolvers can still scan stale `roadwaySegmentFeatures`.

### 9. Switching back to a local runtime county

Switching back to a local runtime county correctly changes the active county identity and manifest/source resolution would select that county if the loader ran. But switching back does not itself call `loadRoadwayDataset()`. Therefore the package will not reload solely from county selection or from later roadway-aware synchronous operations.

Manual `await loadRoadwayDataset()` or reloading the app while that county is active should allow Liberty, Montgomery, and San Jacinto package loading because all three have loadable GeoJSON sources in the runtime registry/manifest.

### 10. Manifest timing and race assessment

No manifest-vs-loader timing race was found inside the only production loader path. `loadRoadwayDataset()` begins with:

```text
await gridlyEnsureRoadwayRuntimeManifestLoaded()
```

Then it resolves the active roadway source. `gridlyEnsureRoadwayRuntimeManifestLoaded()` memoizes the fetch promise, so duplicate callers would share the same manifest load. The passive LP028 audit does not fetch or await the manifest, and that is correct per the passive audit requirement.

The timing problem is not a race where geometry loading runs before the manifest is available. The problem is missing invocation after county changes and before roadway-aware geometry consumers run.

## Local package compatibility

Liberty, Montgomery, and San Jacinto remain compatible with the loader path:

- The manifest marks all three as `local_runtime`.
- The registry derives loadable `roadSource` values from each county's `roadSegmentsPath`.
- `gridlyResolveRoadwayRuntimeSource()` prefers a validated registry road source and returns status `local_runtime`, version `legacy`, and a cache key based on county/version/URL.
- `loadRoadwayDataset()` fetches that URL, accepts `FeatureCollection` GeoJSON, filters `LineString`/`MultiLineString` features, stores them in `roadwaySegmentFeatures`, and populates package runtime metadata.

## Browser action to force a legitimate local roadway load

There is no ordinary roadway-aware UI action that currently forces a missing local roadway package to load after county selection. The legitimate production-supported load happens during app startup.

Recommended browser reproduction to force a legitimate load without patching production behavior:

1. Select Liberty, Montgomery, or San Jacinto as the active county.
2. Perform a full page reload while that county remains the active startup county.
3. Wait for the startup stage `roadway dataset loading` to complete.
4. Then perform a roadway-aware action, such as tapping/reporting a map location or opening a hazard/report/popup path with coordinates that requires canonical road-context resolution.

If active county selection is not persisted across reload in the test browser, the only direct verification method is a console loader call, which is not passive and should be used only as a manual diagnostic:

```js
await loadRoadwayDataset()
```

## Console validation commands

Before legitimate loader invocation, for a selected local runtime county:

```js
window.gridlyLp028RegionalRoadwayRuntimeAudit?.()
```

Expected defective switched-county evidence:

```js
{
  activeCountyAssetStatus: "local_runtime",
  activeCountyPackageLoaded: false,
  loadedRoadwayCounty: null, // or a stale previous county if one was already loaded
  loadedRoadwayUrl: null,    // or a stale previous URL if one was already loaded
  currentPackageCacheKey: null // or stale previous key if one was already loaded
}
```

After full reload with Liberty/Montgomery/San Jacinto active, or after the manual diagnostic `await loadRoadwayDataset()`:

```js
await loadRoadwayDataset();
window.gridlyLp028RegionalRoadwayRuntimeAudit?.();
```

Expected loaded evidence:

```js
{
  activeCountyAssetStatus: "local_runtime",
  activeCountyPackageLoaded: true,
  loadedRoadwayCounty: "liberty-tx" | "montgomery-tx" | "san-jacinto-tx",
  loadedRoadwayUrl: "<active county GeoJSON URL>",
  loadedRoadwayVersion: "legacy",
  currentPackageCacheKey: "<active county>::legacy::<active URL>",
  lastPackageLoadError: null
}
```

To verify the synchronous road consumer after load:

```js
resolveNearestRoadName(<lat>, <lng>);
resolveNearestRoadName.lastDebug;
```

Expected: `roadwayDatasetLoaded: true`, positive `roadwayFeatureCount`, and `roadwayLookupSource: "roadway_dataset"` when the coordinate is within resolver radius of a valid named roadway segment.

## Root-cause location if repaired later

Primary root-cause location:

```text
js/app.js
  gridlySetActiveCountyContext(countyId)
```

This county-switch path does not clear or reload roadway geometry.

Secondary design gap:

```text
js/app.js
  resolveNearestRoadName(lat, lng)
  resolveNearbyRoadPair(lat, lng, primaryRoad)
  collectNearbyRoadCandidates(...)
  findNearestRoadwaySegment(...)
  buildGridlyRoadHazardLocationContract(...)
  road-hazard coordinateRoadLookupFor(...)
```

These are synchronous consumers of already-loaded geometry. They do not contain an async lazy-load handoff and therefore cannot recover if the active county package is missing after county selection.

## Tests and checks run

Required checks:

```bash
node --check js/app.js
node tests/lp028-4-external-roadway-asset-contract.test.js
```

Focused roadway/runtime checks:

```bash
node tests/county-runtime/sanJacintoRoadGeometryRuntimeWiringV650R10.test.js
node tests/county-runtime/montgomeryRoadResolverIncidentLocationV596.test.js
node tests/county-runtime/sanJacintoRoadResolutionValidationV650R12.test.js
node tests/county-runtime/lp016RoadEvaluationOperationContext.test.js
node tests/county-runtime/lp016DriveTexasAwarenessOperationScope.test.js
node tests/lp023-consumer-location-adapters.test.js
node tests/lp027-canonical-road-context-restoration.test.js
node tests/county-runtime/v947RoadCandidateAwarenessHoist.test.js
```

Results:

- `node --check js/app.js`: passed.
- `node tests/lp028-4-external-roadway-asset-contract.test.js`: passed.
- `node tests/county-runtime/sanJacintoRoadGeometryRuntimeWiringV650R10.test.js`: failed on an existing expectation that Montgomery road path remains `null`; actual is `assets/county-implementation/montgomery/runtime-assets/montgomery-roads-raw.geojson`.
- `node tests/county-runtime/montgomeryRoadResolverIncidentLocationV596.test.js`: failed with `ReferenceError: gridlySelectedAwarenessAreaResolutionCache is not defined` in the isolated VM fixture.
- `node tests/county-runtime/sanJacintoRoadResolutionValidationV650R12.test.js`: passed.
- `node tests/county-runtime/lp016RoadEvaluationOperationContext.test.js`: passed.
- `node tests/county-runtime/lp016DriveTexasAwarenessOperationScope.test.js`: passed.
- `node tests/lp023-consumer-location-adapters.test.js`: passed.
- `node tests/lp027-canonical-road-context-restoration.test.js`: passed.
- `node tests/county-runtime/v947RoadCandidateAwarenessHoist.test.js`: passed.

No failing expectations were altered.

## Merge recommendation

**DO NOT MERGE**
