# LP032.1 Harris Roadway Partitioning Investigation

## 1. Executive conclusion

Harris County should remain one logical Gridly county and remain `blocked_partition_required` until a partitioned roadway package system is built and validated. The safest production architecture is a hybrid model: deterministic adaptive spatial packages sized by observed serialized bytes and feature density, plus a `communityToPackageIds` index for startup selection and a bounds-driven package loader for panning, alert focus, destination focus, and edge cases.

This LP032.1 change is investigation-only. It does not activate Harris, does not add Harris URLs, does not modify the LP031 runtime loader, does not upload to Supabase, and does not commit generated Harris GeoJSON packages.

## 2. Source-data availability

Repository discovery found Harris source-side assets under `assets/county-implementation/harris/`, including canonical boundary GeoJSON, crossing assets, and TIGER/Line road shapefile components. Prior Harris verification recorded `tl_2025_48201_roads.shp` at 18,694,052 bytes, `tl_2025_48201_roads.dbf` at 12,188,082 bytes, and `tl_2025_48201_roads.shx` at 755,940 bytes. The current runtime manifest also records Harris `featureCount` and `lineGeometryCount` as 470,275, but keeps Harris blocked with no URL.

A full Harris roadway GeoJSON package is not committed in this checkout. That is intentional for this milestone: the new analysis tool can inventory the shapefile component sizes without conversion, and can run full fixed-grid measurements after Denise converts or supplies a local Harris GeoJSON outside Git.

Relevant existing assets and contracts:

- `assets/county-implementation/harris/runtime-assets/source/tl_2025_48201_roads.*` — Harris TIGER/Line source components.
- `assets/county-implementation/harris/boundary/harris-county-boundary.geojson` — Harris boundary asset.
- `Community-Packages/harris/package-manifest.json` — legacy community package marker, not a production partition manifest.
- `data/roadway-runtime-manifest.json` — LP028.4/LP031 runtime roadway manifest, where Harris remains blocked.
- `docs/doccleanup/GRIDLY-HARRIS-ROAD-ASSET-REMEDIATION-VERIFICATION-V601.6C.md` — earlier source component verification.

## 3. Current runtime ownership

The LP028-LP031 runtime contract is single-package and active-county scoped:

- The app fetches `data/roadway-runtime-manifest.json` with `cache: "no-store"` and installs sanitized county entries.
- Allowed statuses are `local_runtime`, `external_runtime`, `pending_external_upload`, `blocked_partition_required`, `blocked_missing_asset`, and `disabled`.
- `gridlyResolveRoadwayRuntimeSource()` owns the roadway source decision. Registry road sources win first and behave as local runtime; otherwise `external_runtime` manifest URLs are accepted when they are HTTPS `.geojson` URLs.
- The cache key is `countyId::version::url`, so the current runtime can only distinguish one package per county/version/url.
- `gridlyActivateRoadwayDatasetForActiveCounty()` increments an activation sequence per active county unless it can reuse the current in-flight package promise.
- `loadRoadwayDataset()` resets `roadwaySegmentFeatures`, fetches one GeoJSON FeatureCollection, filters to LineString/MultiLineString features, and installs one merged active array.
- In-flight request handling is single-promise and cache-key based through `gridlyRoadwayPackageRuntimeState.currentLoadPromise` and `currentPackageCacheKey`.
- Stale request protection checks both active county and activation sequence before installing fetched geometry. Late responses increment `staleCompletionIgnoredCount` and do not mutate `roadwaySegmentFeatures`.
- Local runtime uses a registry GeoJSON source with `fetchCacheMode: "no-store"`.
- External runtime uses a manifest GeoJSON URL with `fetchCacheMode: "force-cache"`.
- Harris blocked behavior resolves to no URL, `resolvedSourceType = unavailable`, no loaded county, zero features, and `loadStatus = blocked`.

What must change later:

1. Resolve one logical county to multiple package descriptors, not one URL.
2. Extend cache keys from `countyId::version::url` to include `packageId` and package hash/version.
3. Replace one current in-flight promise with package-indexed in-flight tracking.
4. Preserve county/sequence stale protection at the batch and package level.
5. Replace one `roadwaySegmentFeatures` owner with immutable package caches plus a derived active view and dedupe map.
6. Add bounds/community selection without all-Harris startup download.
7. Preserve existing single-package counties as the default path.

## 4. Harris source profile

Available committed evidence:

| Metric | Current evidence |
| --- | ---: |
| Runtime manifest feature count | 470,275 |
| Runtime manifest line geometry count | 470,275 |
| Shapefile `.shp` byte length from prior verification | 18,694,052 |
| Shapefile `.dbf` byte length from prior verification | 12,188,082 |
| Shapefile `.shx` byte length from prior verification | 755,940 |
| Runtime URL | `null` |
| Runtime classification | `blocked_partition_required` |

Full GeoJSON-only measurements such as serialized byte density by geography, property inventory, road-name field availability, bounding box, largest serialized features, duplicate indicators, and boundary crossing counts require a local Harris GeoJSON export. The new script `scripts/Analyze-HarrisRoadwayPartitioning.ps1` performs those measurements without modifying the source and writes a compact JSON result.

## 5. Partition strategies compared

| Strategy | Strengths | Weaknesses | Determination |
| --- | --- | --- | --- |
| A. Fixed geographic grid tiles | Simple, deterministic, easy map-bounds lookup, easy to explain. | Package sizes can vary wildly in Houston core versus rural edges; can create many empty or tiny tiles; boundary crossings increase. | Useful as baseline measurement, not final by itself. |
| B. Community-based packages | Good initial selected-community mental model. | Houston is too large; communities overlap; boundaries do not match roads; panning across community edges is brittle. | Do not use as physical partitioning. Use only as an index onto spatial packages. |
| C. Named regional zones | Human-readable; fewer packages. | Manual naming can hide size imbalance; regional edges are arbitrary; large zones risk Fort Bend-sized or larger downloads. | Acceptable only as labels over generated spatial packages. |
| D. Quadtree/adaptive spatial tiles | Best size consistency; deterministic if thresholds and ordering are fixed; scalable to Texas. | More complex builder and manifest; less human-readable. | Strong candidate for physical package generation. |
| E. Major-corridor packages | Preserves corridor continuity for highways. | Local-road nearest-road lookup is area based, not corridor based; overlapping corridors create duplicate and missing-local-road risks. | Not suitable as the primary roadway package model. |
| F. Hybrid adaptive spatial packages plus community-to-package index | Balances runtime selection, size consistency, map bounds, and community startup; scalable and deterministic. | Requires package manifest, dedupe policy, package-indexed caches, and LP032.4 loader work. | Recommended. |

## 6. Recommended partition strategy

Use deterministic adaptive spatial packages based on serialized byte length and feature count, with package bounds and buffered bounds. Build a community-to-package index separately from physical package generation. Houston should map to many package IDs; smaller Harris communities should generally map to one to three initial packages plus neighboring edge packages when needed.

Adaptive split rules should be deterministic: start with Harris county bounds, recursively split the longest axis until every leaf is under maximum byte and feature thresholds, stop splitting empty leaves, and assign stable package IDs from a sorted Morton/quadtree path or normalized tile coordinate path.

## 7. Recommended target and maximum package sizes

Observed Gridly evidence shows Jefferson at approximately 10 MB and 24,971 loaded features succeeds, while Fort Bend at approximately 39.8 MB and 93,180 features also succeeds and completed browser request/load in approximately 2.9 seconds during validation. Harris has 470,275 manifest-recorded line features, about 5.0x Fort Bend and 18.8x Jefferson by feature count.

Recommended LP032 targets are estimates until the local GeoJSON analysis result is produced:

| Target candidate | Tradeoff |
| --- | --- |
| ~5 MB | Best mobile parse safety; more packages and more manifest entries. |
| ~10 MB | Matches Jefferson evidence; likely safe per package; reasonable package count. |
| ~15 MB | Fewer requests but more mobile memory/parse risk. |
| ~20 MB | Still below Fort Bend evidence, but edge-case communities could activate too much geometry. |

Recommendation: target 10-15 MB serialized GeoJSON per package, with a hard maximum of 20 MB and a target of roughly 20k-35k features per package. Maximum feature count should be 45k per package unless mobile validation proves higher is safe. Expected Harris package count is roughly 16-32 depending on serialized GeoJSON size and downtown density. A selected community should usually need 1-4 packages, while visible map bounds should usually need 1-6 packages, with Houston allowed to resolve more only as the map bounds demand it.

## 8. Boundary and deduplication policy

Boundary options:

- Clip geometry at boundaries: reduces package bytes but risks broken nearest-road resolution and unstable intersections unless topology is rebuilt.
- Assign complete feature to one package: simple and avoids duplicate geometry, but edge lookups can miss a nearby road whose owner package has not loaded.
- Duplicate boundary-crossing features: robust edge coverage but creates duplicate consumer road candidates unless deterministic IDs are enforced.
- Buffered tile overlap: best runtime correctness if duplicates are suppressed after merge.

Recommendation: assign every feature a deterministic canonical owner package using feature midpoint/centroid and stable tie-breakers, then include boundary-buffer duplicates in neighboring packages for lookup coverage. Every feature must carry `stableSegmentId` derived from source identity when available (`LINEARID` preferred) plus normalized geometry hash fallback. The runtime should dedupe by `stableSegmentId`, prefer canonical-owner copies in the active view, and suppress duplicate candidates before nearest-road or intersection presentation.

## 9. Community-to-package strategy

Future Harris package metadata should include `communityToPackageIds` for Houston, Pasadena, Baytown, Humble, Katy, Cypress, Spring, Tomball, Channelview, Deer Park, La Porte, and Crosby. This index should be generated from community points or polygons intersected with buffered package bounds, not from consumer-facing subcounty identities.

The package manifest should include package bounds, centroid, neighboring package IDs, buffered coverage bounds, feature count, byte length, SHA-256, version, public URL, and package ID. Houston must be modeled as a broad community selection that starts with packages around the selected community focus and then relies on map-bounds loading for the rest of the city.

## 10. Map-bounds loading strategy

Initial selection:

1. On selected Harris community, load the community seed package IDs plus immediate neighbors if the focus lies within the configured edge buffer.
2. On alert, destination, or report focus, resolve packages whose buffered bounds contain the focus point before road lookup.
3. On map startup with no specific focus, load only the selected community seed set, never all Harris packages.

Runtime expansion:

- On map pan/zoom, debounce package resolution by 300-500 ms.
- Use current map bounds expanded by a prefetch buffer approximately equal to the nearest-road search radius plus a screen-edge margin.
- At low zoom, cap loading to packages intersecting visible bounds and defer distant detail; do not download all Harris because the county is visible.
- Limit active Harris packages initially to 8 until mobile measurements justify more.
- Evict least-recently-used package active views when over the cap, but keep immutable decoded package caches by version/hash while memory allows.
- On package failure, mark only that package failed, keep already loaded packages, and surface a degraded roadway status without falling back to Liberty.

## 11. Runtime ownership recommendation

Recommended owner model: immutable package caches plus a derived active view.

- Package cache: `Map<countyId, Map<packageId, packageRecord>>` keyed by county, package ID, version, hash, and URL.
- Active package set: selected package IDs for the current county and viewport.
- Derived active view: deduped feature array or spatial index rebuilt from active package records.
- Legacy compatibility: single-package counties populate one package record and expose the same derived array to existing resolver code.

This preserves active-county isolation, stale-request protection, LP016 performance constraints, nearest-road lookup, intersection resolution, and the no-Liberty-fallback rule.

## 12. Backward-compatible manifest proposal

Keep the existing top-level `counties` map and single-package fields for existing counties. Add optional partition fields that are ignored by the current LP031 loader until LP032.4.

```json
{
  "counties": {
    "harris-tx": {
      "status": "blocked_partition_required",
      "version": "lp032-candidate-v1",
      "partitioned": true,
      "partitionStrategy": "adaptive_spatial_with_community_index",
      "packageManifestUrl": "https://.../roadways/harris-tx/lp032-v1/manifest.json",
      "packageSelectionPolicy": {
        "initial": "community_seed_plus_edge_neighbors",
        "mapBounds": "buffered_bounds_intersection",
        "maxActivePackages": 8
      }
    }
  }
}
```

Remote Harris package manifest concept:

```json
{
  "countyId": "harris-tx",
  "version": "lp032-v1",
  "partitioned": true,
  "packages": [
    {
      "packageId": "harris-tx-q0123",
      "url": "https://.../harris-tx/lp032-v1/harris-tx-q0123.geojson",
      "version": "lp032-v1",
      "sha256": "...",
      "byteLength": 12345678,
      "featureCount": 30000,
      "geometryTypes": { "LineString": 30000 },
      "bounds": [-95.7, 29.5, -95.3, 29.8],
      "bufferedBounds": [-95.71, 29.49, -95.29, 29.81],
      "centroid": [-95.5, 29.65],
      "neighborPackageIds": ["harris-tx-q0122"]
    }
  ],
  "communityToPackageIds": {
    "Houston": ["harris-tx-q0123"]
  }
}
```

## 13. Build pipeline

Safest reusable flow:

Harris source -> county containment -> geometry normalization -> stable segment IDs -> adaptive spatial partitioning -> buffered boundary duplication -> per-package GeoJSON outside Git -> package validation -> SHA-256 -> package manifest -> small deployment manifest -> upload -> public verification -> runtime activation gate.

Existing scripts and assets can be reused for source inventory, county boundary checks, package registry concepts, and LP030 upload patterns. New tooling is needed for Harris roadway normalization/partitioning, package manifest validation, and multi-package runtime certification.

## 14. Deployment layout

Recommended future Supabase object layout:

```text
roadways/harris-tx/<version>/manifest.json
roadways/harris-tx/<version>/<package-id>.geojson
roadways/harris-tx/<version>/certification.json
```

Prefer a split manifest: commit a small app manifest entry that says Harris is partitioned and points to a remote package manifest, while the remote manifest beside the packages contains the full package inventory. This permits future package revisions without bundling a large package list into the app repository. Runtime activation should change the committed status only after remote verification passes.

## 15. Cache/race/failure policy

- Cache key: `countyId::version::packageId::sha256::url`.
- In-flight requests: package-indexed map; duplicate requests reuse the same package promise.
- Stale protection: county activation sequence plus package request generation; stale responses cannot mutate package cache or active view.
- Failure: failed package records are isolated and retryable; loaded neighbors remain usable.
- County switch: clear active Harris package set, active derived view, in-flight relevance, and resolver cache; immutable package cache may remain only if keyed by county and memory-safe.
- Duplicate suppression: active view contains one canonical feature per `stableSegmentId`.
- No fallback: never install Liberty roads for Harris or any non-Liberty county.

## 16. Performance acceptance criteria

Future LP032 implementation should measure and meet these provisional thresholds before activation:

- Package manifest resolution under 250 ms on cache hit and under 1 s on normal network.
- Individual package download target under 2 s and hard warning above 4 s on test mobile network.
- JSON parse target under 500 ms per package and warning above 1.5 s.
- Feature installation/active-view rebuild target under 300 ms for normal community seed and warning above 1 s.
- Initial active Harris feature count target under 120k and warning above 180k.
- Duplicate active feature count after dedupe must be zero by `stableSegmentId`.
- Boundary nearest-road fixtures must pass on both sides of every test package edge.
- County switch cleanup must leave no Harris active features when leaving Harris.
- Stale response suppression must be demonstrated by forced slow package responses.

These thresholds are not proven until LP032.5 browser/mobile validation.

## 17. Harris activation gate

Do not change Harris from `blocked_partition_required` until all conditions pass:

- All Harris packages built outside Git and validated.
- Package manifest validates schema, bounds, neighbors, community coverage, SHA-256, byte length, and feature count.
- Public URLs verified with expected hashes and no credentials.
- Browser validation proves no all-Harris startup download.
- Mobile validation proves package download, parse, active feature count, and memory thresholds.
- Boundary correctness fixtures pass for roads crossing package edges.
- Community coverage passes for Houston, Pasadena, Baytown, Humble, Katy, Cypress, Spring, Tomball, Channelview, Deer Park, La Porte, and Crosby.
- Cache-hit, duplicate in-flight, stale request, retry, and county-switch tests pass.
- No Liberty fallback occurs.
- Existing Liberty, Montgomery, San Jacinto, Jefferson, Fort Bend, and other LP031 counties continue passing.

## 18. Risks

- The committed repository has shapefile source components but not a committed full Harris GeoJSON, so byte-density recommendations remain estimates until Denise runs the local analysis command.
- Harris's dense Houston core may produce adaptive packages that are less human-readable than named regions.
- Buffered overlap improves correctness but increases bytes and requires rigorous dedupe.
- Mobile parse/memory behavior may require smaller package targets than desktop browser evidence suggests.
- Community names near county boundaries can require neighboring-county awareness later; LP032 should keep Harris package selection county-isolated for activation.
- Unrelated future presentation issue: literal `<br/>` text has been observed in some Beaumont DriveTexas alert cards and should be handled outside LP032.1.

## 19. Recommended LP032 implementation phases

- LP032.1: investigation, partition analysis, read-only measurement tooling.
- LP032.2: Harris package builder and local certification; no runtime activation.
- LP032.3: partition manifest, deployment tooling, upload dry-run, public verification plan.
- LP032.4: backward-compatible multi-package runtime loader behind Harris blocked gate.
- LP032.5: browser/mobile validation, acceptance evidence, and final Harris activation decision.

## 20. Exact local commands for the next step

If only the shapefile is available, first convert outside Git:

```powershell
mkdir C:\GridlyLocal\harris-lp032
ogr2ogr -f GeoJSON C:\GridlyLocal\harris-lp032\harris-road-segments.geojson assets\county-implementation\harris\runtime-assets\source\tl_2025_48201_roads.shp
```

Then run the read-only analyzer:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts\Analyze-HarrisRoadwayPartitioning.ps1 -SourcePath C:\GridlyLocal\harris-lp032\harris-road-segments.geojson -OutputPath C:\GridlyLocal\harris-lp032\harris-partition-analysis.json -GridSizes 4,6,8,10,12
```

For source inventory only, without conversion:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts\Analyze-HarrisRoadwayPartitioning.ps1 -SourcePath assets\county-implementation\harris\runtime-assets\source\tl_2025_48201_roads.shp -OutputPath C:\GridlyLocal\harris-lp032\harris-source-inventory.json
```
