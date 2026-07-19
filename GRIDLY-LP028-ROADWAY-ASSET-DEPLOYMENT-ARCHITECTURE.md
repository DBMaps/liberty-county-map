# GRIDLY LP028.3 Roadway Asset Deployment Architecture Review

## 1. Executive summary

**Recommendation: do not commit the copied county roadway GeoJSON packages into the `liberty-county-map` application repository.** Gridly should deploy roadway geometry through a separate, versioned static asset-delivery architecture and should treat the app repository as a lightweight shell plus runtime registry/manifest consumer.

The current application already supports county-aware lazy loading conceptually: the active county resolves to a single road source, `loadRoadwayDataset()` fetches that source only when the active county reports roads as available, and the in-memory roadway array is reset before each load. That is the correct runtime direction. The deployment architecture should match it by making roadway packages independently versioned, independently cacheable, and independently roll-backable.

The investigation found one important workspace discrepancy: the requested untracked directory `data/road-segments/` was **not present** in this Codex checkout at inspection time. `find data -maxdepth 2 -type f` showed only existing tracked `data/*` files, and `find /workspace/liberty-county-map -path '*/road-segments*'` returned no path. Therefore this document cannot honestly report an exact 24-file inventory from local files. The conclusion below relies on the task-provided LP028 totals for those absent files: approximately 211.2 MB for 24 copied county packages, and approximately 175.17 MB / 470,275 line features for Harris.

Final decision:

- **Option A, app-repository GeoJSON:** not recommended for long-term use; acceptable only for very small pilot counties or emergency rollback fixtures.
- **Option B, separate versioned static assets:** recommended baseline architecture.
- **Option C, optimized packages:** recommended as a required production data-manufacturing layer before broad rollout, especially for Harris and future Texas expansion.
- **Harris:** should use remote, versioned, spatially partitioned packages with a county manifest and community/viewport/tile selection; a single 175.17 MB file is not an acceptable runtime package and cannot fit normal GitHub per-file limits.
- **LP028.4 smallest safe task:** add a manifest-driven roadway source resolver that can read a versioned county asset manifest and select an absolute URL or same-origin URL without changing the road resolver itself.

## 2. Current Gridly static asset deployment architecture

### Repository asset to browser URL

The repository is a static web application. Runtime assets in `data/`, `assets/`, `Crossing-Packages/`, `Community-Packages/`, `css/`, and `js/` are plain files addressed by relative paths from the deployed site. `GRIDLY_COUNTY_REGISTRY` hardcodes those relative paths for boundary, crossing, override, and roadway sources.

The only GitHub Actions workflow in this checkout is `.github/workflows/capacitor-validation.yml`. It runs on pull requests and manual dispatch, checks out the repository, installs npm dependencies, prepares a `www` directory, copies `index.html`, `manifest.json`, `service-worker.js`, `css`, `js`, `assets`, and `data` into `www`, then mirrors `www` into `android/app/src/main/assets/public/`. It does **not** contain a Pages deployment job, artifact upload, branch publication, or explicit asset filtering beyond the directories copied into `www`.

Observed chain for same-origin assets:

1. Asset exists in the repository.
2. Asset is included in a Git commit and pushed to the GitHub remote.
3. Static hosting can serve that file at its repository-relative URL if the Pages source includes it.
4. Browser code calls `fetch()` with the configured relative path.
5. The service worker may intercept same-origin GET requests, but it only responds for navigations and an explicit small closure URL list.
6. Browser HTTP cache behavior is controlled by the browser/server and by per-call fetch options; roadway loading currently uses `cache: "no-store"`.
7. PWA installation installs the shell metadata/icons, not every unreferenced asset.
8. Capacitor validation currently copies the entire `data` directory into `www` and then into Android public assets, so any committed `data/road-segments/` package would be included in native web assets unless the copy process changes.

### GitHub Pages and deployment observations

This checkout does not include a Pages deployment workflow. Because this is a static app, GitHub Pages would serve committed GeoJSON files directly if the Pages source includes those files and the files are below platform limits. Unreferenced files still increase repository size, checkout size, and any broad directory copy size. They are not necessarily downloaded on app startup unless referenced by HTML, JavaScript, CSS, manifest, service worker precache list, or runtime `fetch()`.

### Current asset versioning

Static paths are mostly path-versioned by file location/name, not by a central asset manifest. The current road loader fetches the configured URL with `cache: "no-store"`, so it does not use long-lived immutable browser caching. A query string would pass the `.geojson(?:$|[?#])` loadability test, so path-level or query-level package versioning is technically compatible with the current source validator.

## 3. Current roadway loader behavior

`GRIDLY_COUNTY_REGISTRY` is the controlling registry. Liberty, Montgomery, and San Jacinto have `.geojson` road segment paths. Many later counties have `roadSegmentsPath: null` and a `roadSegmentsPathPrevious` pointing at source shapefiles, so they are not loadable by the browser runtime.

`gridlyIsLoadableGeoJsonSource(path)` accepts only paths ending in `.geojson` or `.geojson` followed by query/hash. `GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY` maps each county to `roadSource` only when `roadSegmentsPath` passes that test.

`loadRoadwayDataset()` behavior from static inspection:

- Clears `roadwaySegmentFeatures` on every call.
- Increments the roadway revision and resets road-name resolver caches before loading.
- Reads only `gridlyGetActiveCountyRuntimeSources()`.
- Requires `gridlyCountyRuntimeSourceAvailable("roads")` and `roadSourceLoadable`.
- Fetches one URL with `fetch(activeRoadwaySegmentsUrl, { cache: "no-store" })`.
- Calls `response.json()` on the main thread.
- Filters `Feature` objects to `LineString` and `MultiLineString` geometries.
- Stores filtered features in the single global `roadwaySegmentFeatures` array.
- Sets `roadwayDatasetLoaded = true` only after parsing/filtering succeeds.
- Stores failure text in `roadwayDatasetLoadError`; failure does not throw out of the loader.

Runtime implications:

- Only one county roadway dataset is held in the application-level road array at a time.
- Switching counties discards prior geometry at the application level.
- There is no multi-county app-level package cache.
- Browser HTTP cache is intentionally bypassed for roadway fetches because of `cache: "no-store"`.
- JSON parsing and filtering occur on the main thread and can freeze the UI for large packages.
- Roadway lookups scan `roadwaySegmentFeatures`; `findNearestRoadwaySegment()` flattens geometry segments inside the scan, and `collectNearbyRoadCandidates()` also scans loaded features. There is cache support for resolved names, but no prebuilt spatial index bounding the initial scan cost.
- External absolute HTTPS URLs should pass the current `.geojson` loadability test if they end in `.geojson` or use `.geojson?v=...`. The service worker ignores cross-origin requests, so remote road assets would depend on normal CORS and browser caching.

## 4. Exact 24-file size inventory

The requested `data/road-segments/` directory and `data/road-segments/lp028-roadway-runtime-assets.json` manifest were not present in this checkout at inspection time. Commands used for confirmation:

```bash
find data -maxdepth 2 -type f -printf '%p\t%s\n' | sort
find data -maxdepth 2 -type d -print | sort
find /workspace/liberty-county-map -path '*/road-segments*' -maxdepth 4 -print | sort
git status --ignored --short data/road-segments
```

Because the files were absent, exact county-by-county byte sizes, manifest feature counts, line geometry counts, largest/five-largest/five-smallest/median, and threshold counts cannot be derived from local evidence in this run without inventing data.

The task-provided inventory baseline remains:

| Metric | Task-provided value | Verification in this checkout |
| --- | ---: | --- |
| Copied roadway packages | 24 | Not present locally |
| LP028 asset manifest | 1 | Not present locally |
| Total runtime-ready asset size excluding Harris | ~211.2 MB | Not present locally |
| Harris source size | ~175.17 MB | Not copied locally |
| Harris line features | ~470,275 | Not copied locally |
| Runtime-ready counties excluding Harris | 27 | Supported by task context; not by absent manifest |

Existing tracked roadway package sizes observed in this checkout:

| County | Path | Bytes | Approx MiB | Notes |
| --- | --- | ---: | ---: | --- |
| Liberty | `data/liberty-county-road-segments.geojson` | 11,393,784 | 10.87 | Same-origin app repository asset |
| Montgomery | `assets/county-implementation/montgomery/runtime-assets/montgomery-roads-raw.geojson` | 35,232,470 | 33.60 | Same-origin app repository asset; registry availability currently says roads missing |
| San Jacinto | `assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson` | 2,768,932 | 2.64 | Same-origin app repository asset |

## 5. Total repository increase if committed

Using the task-provided LP028 value, committing the 24 copied packages would add approximately **211.2 MB** to the repository immediately, before Git history overhead, GitHub object packing, future revisions, PR diff metadata, forks, or native packaging mirrors.

If Harris were added in the same raw shape, the roadway asset footprint would grow by approximately **175.17 MB** more, and the Harris file would exceed GitHub's normal 100 MB per-file limit. That means Option A cannot cover the complete 28-county target in raw form.

## 6. Browser/mobile performance risks

Large GeoJSON has three separate costs:

1. **Network transfer:** the user pays download time and data cost for every county package requested.
2. **JSON parse:** `response.json()` parses the entire payload on the main thread.
3. **Runtime memory:** parsed GeoJSON objects are much larger than compressed transfer bytes and remain reachable through `roadwaySegmentFeatures` until the next dataset reset.

Given current code, a single 20-50 MB package is a likely mobile jank risk, and a 175 MB Harris package is a likely freeze/crash risk. The risk is not only download size; it is the synchronous parse and repeated O(features × segments) nearest-road scans after load. Lazy loading by county prevents all 211.2 MB from downloading at startup, but it does not make a single large county safe on mobile.

## 7. GitHub and GitHub Pages risks

### App repository risks

- Repository size increases immediately by ~211.2 MB for the 24 copied files.
- Every clone, checkout, CI job, and branch that needs history pays the cost permanently.
- Future corrections duplicate large blobs in Git history.
- PR review becomes noisy and difficult; large GeoJSON diffs are not human-reviewable.
- Codex and browser diff tools are poorly suited for very large generated data artifacts.
- Harris cannot be represented as one raw package under normal GitHub per-file constraints.

### Pages/static hosting risks

- GitHub Pages can serve static GeoJSON, but deployment and repository management become increasingly brittle as data grows.
- Unreferenced committed files can still be included in broad publish/copy steps and can increase deployment artifacts.
- There is no independent asset release cadence; app rollback and data rollback become coupled unless filenames are versioned carefully.

## 8. PWA/service-worker implications

The current service worker is not a broad runtime cache. It precaches a small explicit list: shell URLs, manifest, icons, and a logo. It intercepts same-origin GET requests but only responds to navigations and URLs exactly matching the closure URL list. Roadway GeoJSON is not in that list, so the service worker should not accidentally cache roadway packages today.

However, future PWA offline work must avoid wildcard-caching `data/` or `*.geojson`. A broad cache-first route for same-origin assets could silently store tens or hundreds of megabytes on mobile devices. The recommended design should keep roadway caching explicitly bounded by package version, active area, and storage budget.

## 9. Capacitor/native packaging implications

Capacitor configuration uses `webDir: "www"`. The validation workflow copies the entire `data` directory into `www`, then mirrors all of `www` into `android/app/src/main/assets/public/`. Therefore committed files under `data/road-segments/` would become part of generated native web assets during sync/copy workflows unless excluded.

That would make Android/iOS packages larger even for users who never open those counties. It would also couple app-store updates to data refreshes. A remote asset architecture keeps native app binaries small and allows roadway package fixes without rebuilding the native shell.

## 10. Option A assessment: assets in app repository

### Advantages

- Lowest implementation complexity for current same-origin `fetch()` paths.
- No CORS work.
- Simple local development and rollback through Git checkout.
- Works for small counties already represented by Liberty and San Jacinto scale.

### Risks

- Adds ~211.2 MB immediately and permanently to Git history.
- Every future package rebuild compounds repository growth.
- Harris raw package cannot fit the model as one file.
- Broad CI copy steps would include the assets in `www` and Android public assets.
- PR diffs and code-review ergonomics degrade sharply.
- Mobile users still face large per-county downloads and main-thread parse stalls.
- Static asset versioning remains tied to app commits unless file paths are versioned.
- Future statewide expansion would create a giant application repository.

### Decision

**Not recommended** for long-term deployment. It is acceptable only as a temporary pilot mechanism for small, stable county packages where the package is below mobile parse-risk thresholds and never intended for statewide scale.

## 11. Option B assessment: separate static asset deployment

### Recommended shape

Use a separate, versioned static asset location owned by Gridly, with one small app-consumed manifest per release and immutable package URLs. The simplest compatible implementation is a separate GitHub Pages/static asset repository for generated packages, with the option to move large counties to object storage/CDN later while preserving the same manifest contract.

### Compatibility with current architecture

External absolute roadway URLs can be introduced without redesigning the road resolver because the runtime source validator accepts `.geojson` paths and `fetch()` can load absolute URLs. The required app change is a source-resolution layer, not a resolver fork: county registry entries should point to manifest metadata or a versioned package URL, and the loader can fetch the selected URL.

### Considerations

| Topic | Assessment |
| --- | --- |
| URL ownership | Use a Gridly-controlled domain or GitHub Pages asset repository path; avoid local build-machine paths. |
| CORS | Required for cross-origin assets; configure `Access-Control-Allow-Origin` for the app origins or public `*` for public reference geometry. |
| Versioning | Use immutable paths such as `/roadways/v2026.07.18/counties/liberty/road-segments.geojson` plus a manifest with checksums. |
| Cache control | Use long-lived immutable cache for versioned packages and short-lived/no-cache for the release pointer manifest. |
| Deployment workflow | Data pipeline publishes assets and manifest separately from app code. App releases can pin a manifest version. |
| Cost | GitHub Pages/static repo is operationally simple for small/medium packages; object storage/CDN is better for large/statewide scale. |
| Complexity | Slightly higher than app-repo files, but it decouples data release from application deployment. |
| Rollback | Pin the app to a previous manifest or switch the manifest pointer back. |
| Availability | Static assets can be cached by browser/CDN; avoid coupling outage domains where possible. |
| Texas expansion | Scales by county/tile package count instead of app repository size. |
| Capacitor | Native shell stays small; remote packages load on demand. Offline packs can be future explicit downloads. |
| PWA offline | Do not precache all; allow opt-in bounded offline county/community packages later. |

### Decision

**Recommended baseline architecture.** Use a separate versioned static asset deployment with manifest-driven package discovery.

## 12. Option C assessment: optimized county packages

Optimization should be a production manufacturing step, not an ad hoc manual edit. Safe methods:

- Retain only properties used by runtime resolution: road display/name candidates, reference, classification if needed, county/package IDs, and provenance keys.
- Remove unused source fields after documenting which resolver/display functions read properties.
- Exclude non-line features; the current loader uses only `LineString` and `MultiLineString`.
- Reduce coordinate precision only after measuring nearest-road/intersection drift against source geometry.
- Simplify geometry only with strict tolerance and validation gates.
- Partition by county, community, viewport tile, or bounded active area.
- Produce compressed transfer artifacts where hosting/runtime support preserves normal `fetch()` behavior; keep uncompressed checksums for provenance.

Accuracy validation required before simplification:

1. Compare nearest-road resolution before/after for a representative grid of points and known incidents.
2. Validate paired-road detection at intersections and rail crossings.
3. Measure maximum and percentile snap-distance drift.
4. Confirm no configured community loses local road context.
5. Confirm official incident road context and community report road context remain equivalent or intentionally flagged.

### Decision

**Recommended as mandatory for production expansion.** Option B solves deployment coupling; Option C solves mobile performance.

## 13. Recommended architecture

Adopt a **manifest-driven, versioned, separate static roadway asset architecture**:

- Keep application code and data packages separate.
- Publish generated roadway packages to Gridly-controlled static storage.
- Publish a small signed/checksummed manifest containing county, version, feature counts, checksums, URLs, package type, and certification status.
- Let the application load only the active county/community/tile package needed at runtime.
- Keep the road resolver shared; do not fork resolver logic by county.
- Add bounded application/runtime caches only after measuring mobile memory and storage behavior.
- Keep PWA service-worker caching explicit and opt-in.
- Keep native Capacitor bundles lightweight; remote-load roadway packages except for very small critical offline fixtures.

## 14. Recommended Harris architecture

Harris should not be shipped as one raw county GeoJSON. Recommended Harris design:

1. **Separate remote Harris asset family** under the same versioned manifest system.
2. **Spatial partitions** sized for mobile parsing, ideally by tile or bounded community coverage, not by one monolithic county file.
3. **Community-aware package selection** for configured Harris communities: Houston, Pasadena, Baytown, Humble, Katy, Cypress, Spring, Tomball, Channelview, Deer Park, La Porte, and Crosby.
4. **Overlap buffers** around package boundaries so paired-road resolution and intersections near community edges still work.
5. **Local roads included**, not highway-only. Highway-only Harris would be an inadequate temporary fallback because it would lose useful community roadway context and many paired-road cases.
6. **Manifest metadata** listing each Harris partition's bounding box, communities covered, feature count, checksum, and package version.
7. **On-demand active-area loading** so selecting a small Harris community never downloads all 175.17 MB.

A single optimized Harris package may be useful as a build artifact or fallback if it drops far below mobile-risk thresholds, but the production runtime should still prefer partitions because Houston-area interaction should not require parsing all Harris geometry.

## 15. Recommended migration sequence

1. Preserve the copied LP028 source-output files outside the app repository as staging evidence; do not commit them to the app repository.
2. Define the roadway asset manifest schema: county ID, package ID, version, URL, checksum, bytes, feature count, geometry count, bounds, source dataset, build timestamp, certification status, and rollback pointer.
3. Publish one or two non-Harris pilot packages to a separate static asset location.
4. Add a small manifest-driven source resolver in the app while preserving `loadRoadwayDataset()` semantics and the shared road resolver.
5. Validate CORS, cache headers, and `cache` behavior on mobile.
6. Add production package optimization and validation gates.
7. Introduce Harris partition generation and selection.
8. Expand county-by-county through manifest updates, not manual app-code path edits.

## 16. Current 24 copied files: commit, relocate, regenerate, or remove?

Because the 24 copied files were not present in this checkout, no file operation was performed. Architecture recommendation:

- **Do not commit them to the app repository.**
- **Relocate/publish them through a separate versioned asset repository or static storage after manifest/schema validation.**
- **Regenerate optimized production packages before broad deployment.**
- **Remove the app-repository staging copies only after confirming the canonical source-data and asset-delivery copies are safely preserved elsewhere.**

## 17. Smallest safe LP028.4 implementation task

Add a read-only, manifest-driven roadway source resolver that can map an active county to a versioned roadway asset URL without changing roadway resolution behavior. Scope should be limited to:

- a small roadway asset manifest fixture,
- a pure function that selects the active county package URL,
- support for same-origin and absolute HTTPS `.geojson` URLs,
- checksum/version metadata exposure for diagnostics,
- no resolver changes,
- no service-worker broad caching,
- no bulk package commits.

## 18. Files inspected

- `.github/workflows/capacitor-validation.yml`
- `package.json`
- `manifest.json`
- `service-worker.js`
- `capacitor.config.json`
- `.gitignore`
- `README.md`
- `README-V33.txt`
- `js/app.js`
- `data/liberty-county-road-segments.geojson` size only
- `assets/county-implementation/montgomery/runtime-assets/montgomery-roads-raw.geojson` size only
- `assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson` size only

## 19. Files changed

- `GRIDLY-LP028-ROADWAY-ASSET-DEPLOYMENT-ARCHITECTURE.md` only.

## 20. Confirmation that untracked roadway files remained untouched

No `data/road-segments/` files were present in this checkout to touch. No command moved, deleted, renamed, rewrote, minified, simplified, registered, staged, or ignored that directory. No `.gitignore` entry was added. No production code was modified.

## 21. Merge recommendation

Do **not** merge this investigation as a deployment implementation. It is safe to merge only as documentation if the team wants the architectural decision recorded. It does not activate new counties, does not change roadway loading, and does not register the copied assets.

## 22. Commit hash for the investigation document only

To be filled after commit.

## 23. PR metadata confirmation

To be filled after the PR metadata tool records the pull-request title and body.
