# LP032.1A Harris Runtime Loading Architecture

## 1. Executive decision

Harris remains `blocked_partition_required` in LP032.1A. LP032.4 should implement a Harris-only multi-package extension behind the existing active-county roadway activation owner; all existing single-package counties must continue through the current `gridlyResolveRoadwayRuntimeSource()` → `gridlyActivateRoadwayDatasetForActiveCounty()` → `loadRoadwayDataset()` path unchanged.

Recommended first implementation: **hybrid initial selection** = selected-community required seed packages + current settled visible bounds + edge-neighbor prefetch, with focus-target package priority overriding both. Do not download all Harris at startup.

## 2. Existing lifecycle trace

- Startup: `DOMContentLoaded` initializes the app; `initMap()` chooses the hometown/countywide startup anchor, creates Leaflet, and calls `setView`. Roadways are then activated through the active-county roadway owner when county context changes or startup code invokes the same activation path.
- First-run area selection: onboarding/settings persistence updates hometown/community preferences; `applyGridlyHomeTownAwarenessContext({ fitMap })` and `gridlyFitMapToActiveCountyContext()` move the map to the selected community or countywide bounds.
- Settings county/community change: `gridlySetActiveCountyContext(resolvedCountyId)` is the owner for county changes; it clears stale selected awareness area, resets crossings, calls `ensureGridlyActiveCountyCrossingInventory()`, calls `gridlyActivateRoadwayDatasetForActiveCounty("active-county-change")`, resyncs visible surfaces, renders overlays, then fits the map.
- Active community update: community identity comes from `getGridlySelectedAwarenessArea()` and `getGridlyHomeTownAwarenessAnchor()`. It is usually available after settings/profile load, but can be fallback/countywide or temporarily stale while `gridlyClearStaleAwarenessAreaForCountyContext()` reconciles a county change.
- Map focus after area selection: `gridlyFitMapToActiveCountyContext()` prefers `gridlyGetCanonicalMapFocusArea()` when it is a community; otherwise it fits county bounds. `setGridlyAwarenessView()` may set and then pan the viewport, so selected-area state and final map bounds can briefly disagree.
- Map pan/zoom: `initMap()` listens to `dragstart zoomstart` and `zoomend moveend`. Current handlers are crossing/render lifecycle owners, not roadway package owners. LP032.4 may extend `moveend/zoomend` with a debounced Harris package-selection request, but continuous movement must not fetch packages.
- Alert/destination/report focus: existing focus systems should continue to move the map/popup first. LP032.4 should enqueue target package selection from a shared focus-target hook before road-context resolution waits, without rewriting DriveTexas, destination, reporting, crossing, or popup owners.
- Return to previous county: `gridlySetActiveCountyContext(previousCountyId)` should clear active Harris view membership when leaving Harris and may reuse session parsed caches when returning if version/cache keys match.

Lifecycle owner decision: **extend the existing active-county roadway activation owner** for Harris initial selection. Add a debounced Harris-only bounds selector from Leaflet `moveend/zoomend`. Do not make alerts, reports, crossings, or destination code owners of package state; they should only submit focus-target selection requests later.

Events that must not reload packages: base-layer changes, popup open/close, crossing render suppression moves, UI resize/visualViewport events, continuous `drag`/`zoom`, layer toggles, report marker clicks that do not focus a new point, and re-render-only community UI updates.

## 3. Initial package-selection algorithm

Options compared: community-only misses countywide/focus cases; bounds-only is unstable before startup bounds settle; community+bounds lacks boundary prefetch; center+neighbors ignores Houston/community breadth; hybrid covers all known entry paths.

Deterministic LP032.4 algorithm:

1. Increment `selectionSequence` for Harris activation and load/validate remote manifest.
2. Resolve `selectedCommunityKey` from selected awareness area if non-countywide and same county.
3. Resolve `settledBounds` only after the map is ready and one microtask/requestAnimationFrame after any immediate `setView`/`fitBounds`.
4. Required set = target/focus containing package when present; else `communityToPackageIds[selectedCommunityKey].requiredSeedPackageIds`; else package containing map center from countywide Harris.
5. Visible set = packages whose raw `bounds` intersects current raw map bounds, capped by priority/distance when the viewport is countywide.
6. Prefetch set = neighbor package IDs for active packages whose `edgeDistanceMeters` is within the configured buffer, plus packages intersecting buffered map bounds.
7. Enqueue in priority order: focus target, community required, visible bounds, edge prefetch. Exclude speculative warming in first implementation.
8. Build active view from loaded required+visible packages; optional prefetch becomes active only if still eligible when loaded.

## 4. Community-to-package contract

`communityToPackageIds` is a **runtime selection hint and required seed contract**, not a consumer-facing boundary. Each mapping should include `requiredSeedPackageIds`, `preferredPackageIds`, and optional `neighborPackageIds`. It is not guaranteed to list every package intersecting a very large named place such as Houston.

Houston may map to many preferred packages but only a bounded seed set around the chosen community focus. Cypress/Spring/Tomball overlaps, Baytown/La Porte/Crosby county-edge proximity, and cross-boundary practical areas must be handled by map-bounds and neighbor prefetch, not by exposing package edges. Countywide Harris has no community seed and starts from map center + visible bounds. Renamed/new communities should fall back to countywide/center selection until the manifest index is regenerated.

## 5. Map-bounds selection policy

Use manifest package `bounds` for active ownership eligibility and `bufferedBounds` for lookup/prefetch eligibility. Raw map bounds select visible packages; buffered map bounds select optional prefetch packages. Provisional buffer: max of 1,000 meters or 15% of viewport diagonal, capped at 3,000 meters until mobile tests refine it.

Selection runs only on `moveend/zoomend` with a 250 ms debounce and sequence suppression. No selection runs while zoom < 10 unless a focus target exists; countywide zooms use map-center package + at most two nearest visible packages. No new work is needed when required+visible+prefetch IDs equal the previous normalized selection. Packages outside current bounds may remain active until eviction runs to avoid active-view rebuild churn during small pans.

## 6. Package state machine

States: `unrequested`, `queued`, `loading`, `loaded`, `failed`, `stale`, `evicted`.

Allowed transitions: `unrequested→queued→loading→loaded`; `loading→failed`; `loading→stale`; `loaded→evicted`; `failed→queued` when retry eligible; `evicted→queued` when cache was discarded; `evicted→loaded` when parsed cache is retained and reactivated. Retry limit: 2 retries per package per session with exponential backoff 1s then 3s. Failed required packages mark partial readiness false; failed optional packages mark partial readiness true with warnings. County departure increments county/selection sequence and makes completions stale rather than installable.

## 7. Cache and in-flight architecture

Multi-package cache key: `countyId::countyVersion::packageId::packageVersion::sha256::url`. Manifest cache key: `countyId::countyVersion::remoteManifestUrl::remoteManifestVersion`. Session memory only; IndexedDB/offline persistent cache is out of scope.

Ownership: `manifestCache` stores validated manifest metadata; `packageMetadataById` stores descriptors; `inFlightPackagePromises` is package-keyed; `parsedPackageCache` stores immutable line-feature arrays and dedupe metadata; `activePackageIds` and derived active view are separate. Changing county version, package version, URL, or sha invalidates package cache identity.

## 8. Concurrency and queue limits

Provisional limits: concurrent downloads = 2; active lookup packages = 8; retained parsed package cache = 12; queued package requests = 16. The 8-package cap means included in active roadway lookups, not total cached or simultaneous downloads. These limits are unmeasured on mobile; they are based on Jefferson/Fort Bend desktop validation and expected Harris demand of 1-6 packages.

Queue ordering is stable by priority, then current selection sequence, then distance to focus/map center, then package ID.

## 9. Active package and cache limits

Loaded/parsed in memory can exceed active lookup membership up to retained cache limit. Simultaneous network requests are governed separately. Cache hits may reactivate evicted packages without network if the cache key still matches. Queue overflow drops lowest-priority optional prefetch first; required/focus requests cannot be dropped.

## 10. Eviction policy

Use hybrid LRU + required-package protection. Cannot evict focus package, selected-community required seed packages, or currently visible raw-bounds packages. Eviction runs after package load completion, after debounced selection completion, and when leaving Harris. First eviction removes active-view membership; parsed cache is removed only when retained parsed cache exceeds 12 or future memory pressure signals require it. Switching away from Harris clears active Harris geometry immediately but may retain parsed package cache for session reuse.

## 11. Active roadway view design

Recommendation D: immutable parsed package cache plus a derived active deduped `roadwaySegmentFeatures` view. This preserves the single active array consumed by nearest-road and intersection lookups, minimizes resolver rewrites, keeps LP016 hot-loop protections meaningful, and permits future spatial-index migration. Rebuild only when active package membership changes or a required package finishes; do not rebuild for optional stale completions.

## 12. Boundary deduplication contract

Stable ID priority: `stableSegmentId` property, then source `LINEARID`, then source `id`, then normalized geometry hash + normalized name/ref. Packages must include `canonicalOwnerPackageId` and duplicate metadata (`duplicateOfStableSegmentId`, `isBufferedDuplicate`, `sourcePackageId`). During active-view derivation, dedupe by stable ID; canonical owner wins when present, otherwise lowest package ID wins. Conflicting duplicate properties are audited and canonical properties prevail; geometry mismatch falls back to geometry hash groups and increments conflict telemetry. Suppression occurs during active-view derivation, not parse cache storage. Nearest-road results remain stable because the active view has one candidate per stable segment and canonical copies replace neighbors when loaded.

## 13. Remote manifest lifecycle

Flow: committed county entry stays small and blocked until LP032.5 activation; future entry points to a remote Harris package manifest; validated manifest yields selected package descriptors; descriptors fetch package GeoJSON.

Load manifest on first Harris activation/focus/bounds request, once per session/version. Validate schema version, `countyId=harris-tx`, county version consistency, package IDs, raw/buffered bounds, neighbor IDs, `communityToPackageIds`, HTTPS GeoJSON URLs, byte lengths, feature counts, sha256 metadata, and no credentials. If manifest fetch/validation fails, Harris runtime remains blocked/unavailable and no package requests run. Stale manifest completions are suppressed by county+manifest sequence.

## 14. Focus-target package loading

For DriveTexas alert focus, community alert focus, destination search/route destination, report tap, and crossing popup focus: map focus may occur immediately to preserve UI responsiveness. A focus-target package request is enqueued at Priority 1 using point-in-buffered-bounds. Road-context resolution may wait up to 1.5s for the target package; on timeout it shows roadway context pending/unavailable without freezing. Adjacent packages are prefetch Priority 4 only.

## 15. Failure and partial-readiness policy

Never fall back to Liberty for Harris. Manifest fetch/parse/schema failure keeps Harris blocked and pass only for blocked-invalid-manifest audit mode. One package fetch/JSON/schema failure marks that package failed; required package failure makes `partialReadiness=false`; optional neighbor failure preserves loaded required packages. SHA mismatch, when enabled, is fatal for that package. Stale completions increment telemetry and install nothing. County switch during loading makes all completions stale. Correctly loaded packages are not cleared because optional packages fail.

## 16. Loading priorities

Priority 1 focus target; Priority 2 selected-community required seed; Priority 3 visible map bounds; Priority 4 edge-neighbor prefetch; Priority 5 speculative cache warming. Exclude Priority 5 from LP032.4 first implementation.

## 17. Future audit contract

`window.gridlyLp032HarrisPartitionRuntimeAudit?.()` should report: `available`, `activeCountyId`, `harrisRuntimeStatus`, `countyVersion`, `remoteManifestStatus`, `remoteManifestUrl`, `remoteManifestVersion`, `selectedCommunity`, `mapBounds`, `selectionReason`, `requiredPackageIds`, `visibleBoundsPackageIds`, `prefetchPackageIds`, `queuedPackageIds`, `loadingPackageIds`, `loadedPackageIds`, `failedPackageIds`, `activePackageIds`, `cachedPackageIds`, `evictedPackageIds`, `activePackageCount`, `activeFeatureCount`, `dedupedFeatureCount`, `duplicateSuppressedCount`, `concurrentRequestCount`, `cacheHitCount`, `staleRequestSuppressedCount`, `lastSelectionStarted`, `lastSelectionCompleted`, `partialReadiness`, `legacyLibertyFallbackUsed`, `lastError`, `pass`.

Pass logic: community/countywide/focus activation passes when required packages are loaded, no stale geometry installed, no Liberty fallback, and active count within cap. Optional-neighbor failure can pass with `partialReadiness=true`. Invalid manifest passes only as a blocked validation scenario when no package URLs are requested. Switching away from Harris passes when active Harris geometry is cleared and stale completions are suppressed.

## 18. Telemetry/performance contract

Measure remote manifest fetch, package selection, package download, JSON parse per package, dedupe, active-view build, resolver readiness, memory/feature counts, county-switch cleanup, and cache-hit activation time. Provisional unproven targets: manifest < 500 ms, selection < 50 ms, package download < 2 s on broadband, parse < 750 ms/package desktop and < 2 s mobile, active-view build < 250 ms for 8 packages, cache-hit activation < 100 ms. Jefferson under ~1s and Fort Bend ~2.9s are desktop/localhost evidence, not mobile guarantees.

## 19. Exact LP032 phase boundaries

- LP032.2: source conversion outside Git, analyzer run, deterministic builder, stable IDs, package generation outside Git, local certification. Stop if any package exceeds hard max or stable IDs are missing.
- LP032.3: remote manifest generation, deployment tooling, dry-run/upload verification. Stop if manifest validation, SHA/byte checks, or URL safety fails.
- LP032.4: Harris-only multi-package runtime loader, active view, cache, stale protection, audit. Stop if single-package counties regress or Harris can fall back to Liberty.
- LP032.5: browser/mobile validation, boundary tests, activation gate, and only then Harris activation. Stop if mobile performance, dedupe, partial failure, or audit pass criteria fail.

## 20. Implementation pseudocode

```js
async function selectHarrisPackages(reason, focusPoint) {
  const sequence = ++state.selectionSequence;
  const manifest = await ensureHarrisManifest(sequence);
  if (!isCurrent(sequence)) return markStale();
  const selectedCommunity = getSelectedHarrisCommunityOrNull();
  const bounds = await getSettledMapBounds();
  const required = focusPoint ? packagesContainingPoint(manifest, focusPoint, "bufferedBounds") : communitySeedsOrCenter(manifest, selectedCommunity, bounds);
  const visible = packagesIntersectingBounds(manifest, bounds.raw, { capAtCountyZoom: true });
  const prefetch = edgeNeighbors(manifest, union(required, visible), bounds.buffered);
  enqueue(required, 1, sequence);
  enqueue(visible, 3, sequence);
  enqueue(prefetch, 4, sequence);
  await drainQueue({ concurrency: 2, sequence });
  deriveActiveRoadwayView(sequence);
  evictInactivePackages();
}
```

## 21. Risks and unresolved decisions

Unresolved until package generation/mobile validation: exact buffer meters, final active/cache caps, SHA runtime verification cost, whether Houston needs subcommunity seed variants, memory-pressure integration, and future spatial-index migration timing.

## 22. Exact local next commands

```powershell
pwsh -NoProfile -Command "[System.Management.Automation.Language.Parser]::ParseFile('scripts/Analyze-HarrisRoadwayPartitioning.ps1',[ref]$null,[ref]$null) | Out-Null"
pwsh -NoProfile -File scripts/Analyze-HarrisRoadwayPartitioning.ps1 -SourcePath <local-outside-git>\harris-road-segments.geojson -OutputPath artifacts\harris-roadway-partition-analysis.json
node tests/lp032-harris-runtime-loading-architecture.test.js
git diff --check
git status --short
git diff --stat
```
