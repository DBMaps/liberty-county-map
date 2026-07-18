# LP028.1 Runtime Roadway Registry Investigation

## Executive summary

Only three counties participate in roadway resolution because the browser runtime has exactly one loadable roadway slot for the active county, and only Liberty, Montgomery, and San Jacinto have non-null `.geojson` `roadSegmentsPath` values in `GRIDLY_COUNTY_REGISTRY`. The other 25 covered counties are present in the county registry and package registry, and their `Community-Packages/*/package-manifest.json` files say `roads: true`, but runtime visibility is not derived from those package manifests. It is derived from `js/app.js` registry fields.

This was an investigation-only milestone. No runtime behavior was changed, no county was registered, and no roadway path was added.

## Exact runtime roadway loading architecture

1. `GRIDLY_COUNTY_REGISTRY` in `js/app.js` is the controlling county registry.
2. `GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY` is derived from that registry at startup. For roads it copies only `config.roadSegmentsPath` values that pass `gridlyIsLoadableGeoJsonSource()`, which only accepts `.geojson` paths.
3. `loadRoadwayDataset()` is the roadway loader entry point. It reads `gridlyGetActiveCountyRuntimeSources()`, then fetches only `activeRoadSources.roadSource` when `roadSourceLoadable` and `gridlyCountyRuntimeSourceAvailable("roads")` are both truthy.
4. Loaded road features are stored in the single global cache `roadwaySegmentFeatures`; load state is held by `roadwayDatasetLoaded`, `roadwayDatasetLoadError`, and `gridlyRoadwayDatasetRevision`.
5. `resolveNearestRoadName()` and `findNearestRoadwaySegment()` scan only `roadwaySegmentFeatures` for roadway resolution; there is no multi-county roadway package map in the resolver.
6. LP023 road context reaches canonical location contracts through `resolveGridlyRoadHazardAuthoritativeLocationLabel()` / `buildGridlyRoadHazardLocationContract()` callers that use `resolveNearestRoadName()` when coordinates require roadway context.

## Exact registry / manifest locations

- Runtime county registry: `js/app.js`, `GRIDLY_COUNTY_REGISTRY`.
- Derived runtime source registry: `js/app.js`, `GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY`.
- Community package metadata registry: `js/gridlyPackageRegistry.js`, `initialPackageMetadata` and `createGridlyPackageRegistry()`.
- Package inventory manifests: `Community-Packages/county-manifest.json` and per-county `Community-Packages/<county>/package-manifest.json`.

The runtime road loader does not read `Community-Packages/county-manifest.json`, per-county package manifests, or `js/gridlyPackageRegistry.js` to choose road GeoJSON.

## Exact loader entry point

The loader entry point is `loadRoadwayDataset()` in `js/app.js`. It is invoked during application startup in the "roadway dataset loading" startup stage after crossing package loading. It is active-county aware, not bulk-package aware.

## Runtime loading sequence

```text
GRIDLY_COUNTY_REGISTRY[countyId].roadSegmentsPath
  -> gridlyIsLoadableGeoJsonSource(path)
  -> GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY[countyId].roadSource / roadSourceLoadable
  -> gridlyGetActiveCountyRuntimeSources()
  -> loadRoadwayDataset()
  -> fetch(active roadSource)
  -> roadwaySegmentFeatures global cache
  -> findNearestRoadwaySegment()
  -> resolveNearestRoadName()
  -> LP023 canonical location / road-context callers
```

The model is active-county, demand-at-startup / county-switch loaded, cached in one global feature array, and resolver-consumed. It is not an always-loaded 28-county roadway registry.

## Root cause

The root cause is a partial runtime migration: all 28 counties are registered as counties, but roadway runtime participation is controlled by a hardcoded `roadSegmentsPath` field. Only three counties have loadable `.geojson` values in that field. The other 25 counties keep `roadSegmentsPath: null` and only retain `roadSegmentsPathPrevious` source shapefile references, so the derived source registry marks their `roadSource` as `null` and `roadSourceLoadable` as `false`.

Package manifests proving `roads: true` do not make roads loadable because the runtime loader never resolves package-manifest roadway inventory into `roadSegmentsPath`.

## County traces

### Liberty

- Runtime registration: `liberty-tx` in `GRIDLY_COUNTY_REGISTRY`.
- Road package loaded: `data/liberty-county-road-segments.geojson`.
- Runtime path is loadable because it is a non-null `.geojson` `roadSegmentsPath`.
- `loadRoadwayDataset()` fetches that path when Liberty is active, stores LineString/MultiLineString features in `roadwaySegmentFeatures`, and resets road-name resolver caches.
- `resolveNearestRoadName()` scans those cached features and can resolve Dayton / US 90 / Waco Street context.

### Montgomery

- Runtime registration: `montgomery-tx` in `GRIDLY_COUNTY_REGISTRY`.
- Road package loaded when Montgomery is active: `assets/county-implementation/montgomery/runtime-assets/montgomery-roads-raw.geojson`.
- The package registry labels Montgomery as `operational-maintenance` / inactive implementation, but the runtime county registry still contains a loadable `roadSegmentsPath`.
- This appears to be legacy/operational-maintenance runtime integration, not a generalized 28-county migration.

### San Jacinto

- Runtime registration: `san-jacinto-tx` in `GRIDLY_COUNTY_REGISTRY`.
- Road package loaded when San Jacinto is active: `assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson`.
- It also retains `roadSegmentsPathPrevious` pointing at a 2025 shapefile source.
- Like Montgomery, this is an operational-maintenance / controlled activation path, not generalized package discovery.

### Polk

- Runtime registration exists: `polk-tx` in `GRIDLY_COUNTY_REGISTRY`.
- Package manifest exists: `Community-Packages/polk/package-manifest.json`, with `roads: true` and `roadFeatureCount: 7318`.
- Runtime stop point: `GRIDLY_COUNTY_REGISTRY["polk-tx"].roadSegmentsPath` is `null`; only `roadSegmentsPathPrevious` points at `assets/county-implementation/polk/runtime-assets/source/tl_2025_48373_roads.shp`.
- Because `gridlyIsLoadableGeoJsonSource(null)` is false and shapefile previous paths are not loadable road sources, `GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY["polk-tx"].roadSource` is `null`; `loadRoadwayDataset()` returns `roadway_dataset_unavailable`.

### Harris

- Runtime registration exists: `harris-tx` in `GRIDLY_COUNTY_REGISTRY`.
- Package manifest exists: `Community-Packages/harris/package-manifest.json`, with `roads: true`, `roadFeatureCount: 470275`, and a note that it is selected portions only.
- Runtime stop point: `GRIDLY_COUNTY_REGISTRY["harris-tx"].roadSegmentsPath` is `null`; only `roadSegmentsPathPrevious` points at `assets/county-implementation/harris/runtime-assets/source/tl_2025_48201_roads.shp`.
- As with Polk, the runtime source registry derives no loadable road source, so Harris does not participate in roadway resolution despite the package manifest inventory.

## Covered-county roadway runtime inventory

| County | Runtime registration found | Registration source | Roadway package path / evidence | Package file exists | Runtime loadable | Lazy-load capable | Currently referenced | Currently unused |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Liberty | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `data/liberty-county-road-segments.geojson` | yes | yes | yes | yes | no |
| Montgomery | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `assets/county-implementation/montgomery/runtime-assets/montgomery-roads-raw.geojson` | yes | yes | yes | yes | no |
| San Jacinto | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson` | yes | yes | yes | yes | no |
| Chambers | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/chambers/package-manifest.json` roads=true | yes | no | no | no | yes |
| Jefferson | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/jefferson/package-manifest.json` roads=true | yes | no | no | no | yes |
| Hardin | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/hardin/package-manifest.json` roads=true | yes | no | no | no | yes |
| Polk | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/polk/package-manifest.json` roads=true, 7318 features | yes | no | no | no | yes |
| Walker | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/walker/package-manifest.json` roads=true | yes | no | no | no | yes |
| Harris | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/harris/package-manifest.json` roads=true, 470275 features | yes | no | no | no | yes |
| Orange | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/orange/package-manifest.json` roads=true | yes | no | no | no | yes |
| Jasper | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/jasper/package-manifest.json` roads=true | yes | no | no | no | yes |
| Newton | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/newton/package-manifest.json` roads=true | yes | no | no | no | yes |
| Tyler | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/tyler/package-manifest.json` roads=true | yes | no | no | no | yes |
| Galveston | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/galveston/package-manifest.json` roads=true, 40453 features | yes | no | no | no | yes |
| Brazoria | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/brazoria/package-manifest.json` roads=true | yes | no | no | no | yes |
| Fort Bend | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/fort-bend/package-manifest.json` roads=true, 93182 features | yes | no | no | no | yes |
| Waller | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/waller/package-manifest.json` roads=true | yes | no | no | no | yes |
| Austin | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/austin/package-manifest.json` roads=true | yes | no | no | no | yes |
| Washington | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/washington/package-manifest.json` roads=true | yes | no | no | no | yes |
| Brazos | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/brazos/package-manifest.json` roads=true | yes | no | no | no | yes |
| Grimes | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/grimes/package-manifest.json` roads=true | yes | no | no | no | yes |
| Wharton | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/wharton/package-manifest.json` roads=true | yes | no | no | no | yes |
| Colorado | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/colorado/package-manifest.json` roads=true | yes | no | no | no | yes |
| Fayette | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/fayette/package-manifest.json` roads=true | yes | no | no | no | yes |
| Lavaca | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/lavaca/package-manifest.json` roads=true | yes | no | no | no | yes |
| Jackson | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/jackson/package-manifest.json` roads=true | yes | no | no | no | yes |
| Matagorda | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/matagorda/package-manifest.json` roads=true | yes | no | no | no | yes |
| Calhoun | yes | `js/app.js GRIDLY_COUNTY_REGISTRY` | `Community-Packages/calhoun/package-manifest.json` roads=true | yes | no | no | no | yes |

## DriveTexas relationship

Roadway runtime registration affects official road context and official canonical locations only where those paths call `resolveNearestRoadName()` or LP023 road-context helpers. If no county roadway dataset is loaded, official items can still render from their own explicit fields, but coordinate-only enrichment cannot use local roadway geometry and may fall back to crossings or no roadway label. DriveTexas was not restored or modified.

## LP016 awareness-area relationship

`loadRoadwayDataset()` itself does not perform awareness-area resolution. It only resets roadway state, derives active county road source, fetches GeoJSON, filters line features, and resets road-name resolver caches. Awareness-area lookups appear elsewhere in road evaluation context building and presentation logic, not during package loading.

## Whether architecture already supports all 28 counties

The architecture supports 28 county registry entries, active-county selection, and one active county roadway dataset at a time. It does not currently support loading all 28 roadway packages from package manifests without code/config changes because package manifests are not connected to the runtime roadway source registry.

## Smallest architectural change required for LP028.2

The smallest repair is to make each covered county's canonical runtime GeoJSON path visible to `GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY` while preserving the active-county, single-dataset loading model. That could be done by adding/deriving loadable `.geojson` `roadSegmentsPath` values for the 25 unused counties or by introducing a manifest-to-runtime road source resolver. This should be done in LP028.2, not this investigation.

## Files inspected

- `js/app.js`
- `js/gridlyPackageRegistry.js`
- `Community-Packages/county-manifest.json`
- `Community-Packages/*/package-manifest.json`
- `scripts/v820-regional-runtime-certification.mjs`
- `scripts/v811-county-expansion-framework.mjs`
- `scripts/v818-bulk-county-promotion-guarded.mjs`

## Passive audit added

No runtime passive audit was added. The only repository change is this investigation document. Temporary local shell/Node probes were run outside the application and did not load packages in browser, invoke renderers, invoke awareness resolution, or change runtime state.

## Browser validation steps

No browser validation was required for this documentation-only investigation. If validated later, use a passive browser inspection sequence: select Liberty and inspect `window.gridlyRoadNameResolverDebug?.()` after normal startup; then select Polk/Harris and confirm `roadway_dataset_unavailable` without invoking report submission or DriveTexas restoration.

## Merge recommendation

Do not merge as a runtime repair. This branch may be reviewed/merged only as investigation documentation. LP028.2 should implement the smallest approved roadway source registration/resolver change after review.
