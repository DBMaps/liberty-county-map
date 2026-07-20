# LP033 — Regional Roadway Consumer Certification

## Scope and conclusion

LP033 is an investigation-only certification of whether the completed LP031/LP032 roadway delivery foundation is reaching Gridly's consumer location pipeline. No roadway packages, Supabase assets, production manifests, reporting behavior, DriveTexas ingestion, Alerts rendering, popups, Travel Brief, or Awareness presentation were changed.

The certification result is **not fully certified**. Production roadway geometry is loaded into one active in-memory roadway dataset and the nearest-road resolver reads that dataset, so the foundation can improve road-aware community locations when an active county package is installed. However, repository inspection and passive audit coverage do not prove that every consumer surface consistently preserves a distinct secondary road/intersection through normalization, canonical incidents, Alerts, popups, Travel Brief, and Awareness. The first detail-loss risk remains the handoff from coordinate road-context resolution into normalized/canonical consumer records when no explicit reference-road fields survive.

## Production roadway architecture by runtime type

| Runtime type | Counties inspected | Source ownership | Runtime behavior | LP033 finding |
| --- | --- | --- | --- | --- |
| Local/special runtime | Liberty; Montgomery is still manifest-classified as local runtime | Registry/manifest URL points at local committed GeoJSON | `gridlyResolveRoadwayRuntimeSource()` prefers a loadable registry road source before external manifest URLs. `loadRoadwayDataset()` stores valid line geometry in `roadwaySegmentFeatures` for the active county. | Geometry becomes available to nearest-road consumers after active-county activation. Liberty fallback is not expected for non-Liberty counties because the active source is county-specific. |
| External single-package runtime | Jefferson, Polk, Chambers (chosen smaller external county) | Production Supabase public storage URLs from `data/roadway-runtime-manifest.json` | Manifest entries marked `external_runtime` resolve to versioned HTTPS GeoJSON and load with `force-cache`. | Architecture generalizes to all normal external counties in the manifest because the resolver path is data-driven and keyed by county/version/URL. |
| Harris partition runtime | Harris | Production Supabase partition manifest and package prefix | Harris resolves to a partition manifest, selected/visible packages, bounded queue/cache, canonical segment ownership, and active geometry assembly into `roadwaySegmentFeatures`. | Harris is architecturally distinct but still publishes the active assembled partition geometry through the same in-memory roadway array used by road-context consumers. |

## Representative county findings

| County | Runtime source classification | Source URL or manifest | Load/feature evidence boundary | County ownership and containment | Consumer geometry availability |
| --- | --- | --- | --- | --- | --- |
| Harris | `partition_runtime_ready` / partition runtime | `https://nhwhkbkludzkuyxmkkcj.supabase.co/storage/v1/object/public/gridly-roadways/roadways/harris-tx/lp032.2/manifest.json` | Browser audit reports active package IDs, load status, and active feature count when Harris is selected. | Harris active assembly sets `loadedCounty` to `harris-tx`; county-switch cleanup deactivates active partition geometry when leaving Harris. | Available to nearest-road consumers after partition assembly because assembled features are copied into `roadwaySegmentFeatures`. |
| Liberty | `local_runtime` | `data/liberty-county-road-segments.geojson` | Local baseline; feature count is observable only after active-county activation. | Liberty owns the local baseline. Liberty fallback is valid only when active county is Liberty. | Available to nearest-road consumers after load. |
| Jefferson | `external_runtime` | Supabase `roadways/jefferson-tx/lp030-v1/jefferson-road-segments.geojson` | External single-package runtime; feature count is observable after activation/browser fetch. | Dataset owner should be `jefferson-tx`; Liberty fallback for this county is a certification failure. | Available to nearest-road consumers after load. |
| Polk | `external_runtime` | Supabase `roadways/polk-tx/lp030-v1/polk-road-segments.geojson` | External single-package runtime; feature count is observable after activation/browser fetch. | Dataset owner should be `polk-tx`; use Livingston coordinates for sample road context. | Available to nearest-road consumers after load. |
| Montgomery | `local_runtime` | `assets/county-implementation/montgomery/runtime-assets/montgomery-roads-raw.geojson` | Local runtime rather than external runtime in the current manifest. This is a key LP033 finding because the prompt classified Montgomery as external, but the production manifest does not. | Dataset owner should be `montgomery-tx`; use Cleveland/Conroe-area context. | Available to nearest-road consumers after load. |
| Chambers | `external_runtime` | Supabase `roadways/chambers-tx/lp030-v1/chambers-road-segments.geojson` | Smaller external county chosen from the manifest. | Dataset owner should be `chambers-tx`; no Liberty fallback should occur. | Available to nearest-road consumers after load. |

## Complete consumer-location ownership map

1. Active county selection owns the county ID used by roadway activation.
2. `gridlyResolveRoadwayRuntimeSource()` owns runtime-source classification and URL/manifest selection.
3. `loadRoadwayDataset()` owns single-package fetch, geometry validation, stale-request suppression, and installation into `roadwaySegmentFeatures`.
4. Harris partition runtime owns manifest fetch, package selection, bounded queue/cache, package deduplication, and assembly into `roadwaySegmentFeatures`.
5. `findNearestRoadwaySegment()`, `resolveNearestRoadName()`, and `resolveNearbyRoadPair()` are the road-context consumers that can read active production roadway geometry.
6. Community, crossing, and official adapters under the LP023 consumer-location contract own canonical display-location selection for surfaces.
7. Alerts cards and popups consume the LP023 contract where present rather than independently promoting provider prose.
8. Travel Brief and Awareness consume transportation/community evidence and presentation models, but LP033 cannot prove from passive inspection that every road-pair detail survives into those narrative surfaces.

## Community report pipeline

A safe read-only trace is:

`map tap coordinate → active county roadway dataset → nearest-road / nearby-road-pair resolver → road context candidate → report structured fields → saved report → normalized report → canonical incident → Alerts card / popup → Travel Brief / Awareness`.

The repository shows that coordinate-based report helpers call `resolveNearestRoadName()` for road-name enrichment, and the nearest-road resolver reads `roadwaySegmentFeatures`. Therefore a loaded active county can produce primary-road context. The pipeline is **not fully certified** for intersection-quality output such as `US 90 and Waco Street` across all representative counties because LP033 does not prove that a distinct secondary road is always resolved and persisted through saved/normalized/canonical records without submitting production reports.

## DriveTexas pipeline

A safe read-only trace is:

`DriveTexas provider coordinates/properties → normalized official incident → official LP023 adapter → canonical consumer location → Alerts / popup / Travel Brief / Awareness`.

The provider connector normalization preserves structured official fields and prior LP023 tests protect against advisory prose promotion. LP033 cannot prove that production roadway geometry materially improves official incidents rather than being loaded beside them unless live normalized official records include coordinates near loaded road geometry and the audit observes resolver-derived `nearestRoadName`, `referenceRoadA`, or `referenceRoadB` fields. Provider advisory prose must remain evidence/detail, not canonical location ownership.

## Crossing pipeline

A safe read-only trace is:

`crossing package / FRA context / reviewed override → crossing location adapter → canonical consumer location → crossing Alerts card / popup → Travel Brief / Awareness`.

Reviewed Liberty crossing context can supply known road/intersection labels such as US 90/Waco Street. External roadway geometry may help coordinate road lookups, but crossing presentation primarily depends on crossing metadata, reviewed overrides, and LP023 crossing adapter fields. LP033 does not change crossing behavior.

## County-switch behavior

The required browser switch sequence is Harris → Liberty → Jefferson → Harris. Expected results:

- Leaving Harris clears active Harris rendered geometry, active package IDs, queues, and in-flight requests.
- Liberty activates only Liberty local roadway geometry.
- Jefferson activates only Jefferson external geometry and must not reuse Liberty geometry.
- Returning to Harris restores selected Harris partition packages and assembled Harris geometry.
- Any non-Liberty county reporting `data/liberty-county-road-segments.geojson` or `loadedCounty: liberty-tx` is a failure.

## Consumer output quality findings

LP033 added a passive browser audit that reports whether primary road, secondary road, and intersection proof are available from read-only coordinate resolution. The audit intentionally reports unverified/disconnected instead of inventing PASS results. Current source inspection finds strong guards against duplicate/same-road phrasing and internal/advisory prose leakage in consumer-location helpers, but full consumer-output quality must be certified in a browser with representative active records or safe simulated records.

## Performance and safety findings

- Single-package counties load one active county package and do not iterate over all launch counties.
- Harris remains bounded by queue, concurrency, cache, selected/visible packages, and active package IDs.
- Road-context resolution uses the active loaded dataset; resolver-runtime caches are reset when roadway geometry changes.
- LP033 audit is passive/read-only and samples at most 250 feature centers for containment so it does not introduce startup work, hot loops, package fetches, report writes, Supabase writes, or UI rendering changes.

## Disconnected stages

The exact first disconnected/detail-loss stage is **secondary-road/intersection proof after coordinate road-context resolution**. Primary-road geometry consumption can be traced to the active roadway dataset, but LP033 cannot prove that distinct secondary road/intersection detail survives into all saved, normalized, canonical, Alerts, popup, Travel Brief, and Awareness outputs across representative counties.

## Browser audit

Run after loading the app and selecting a representative county/community:

```js
window.gridlyLp033RegionalRoadwayConsumerCertificationAudit?.()
```

Optional read-only coordinate sample:

```js
window.gridlyLp033RegionalRoadwayConsumerCertificationAudit?.({ coordinate: { lat: 30.0466, lng: -94.8852 } })
```

## Exact browser testing steps

1. Hard refresh the app with DevTools open.
2. Select Harris / Houston context; wait for roadway status to settle; run `window.gridlyLp033RegionalRoadwayConsumerCertificationAudit?.()`.
3. Select Liberty / Dayton or Liberty; wait for roadway status; run the audit with a US 90/Waco Street coordinate if available.
4. Select Jefferson / Beaumont or Port Neches context; wait and run the audit.
5. Select Polk / Livingston context; wait and run the audit.
6. Select Montgomery / Cleveland or Conroe context; wait and run the audit.
7. Select Chambers as the smaller external county; wait and run the audit.
8. Execute Harris → Liberty → Jefferson → Harris and compare `activeCountyId`, `roadwayDatasetOwner`, `activeRoadwayFeatureCount`, `partitionRuntimeActive`, `activePackageIds`, `libertyFallbackDetected`, and `staleCountyGeometryDetected` after each switch.
9. Inspect visible Alerts cards, hazard popups, official incident popups, Travel Brief, and Awareness output for duplicated road labels, county/community-only fallback when road context exists, raw JSON, provider metadata, internal classifications, and malformed slash-separated wording.
10. Do not submit production reports. Use existing active records, read-only coordinate audits, or local/sandbox simulations only.

## Recommended next milestone

LP034 should be a focused resolver-to-consumer integration certification/repair milestone. It should add safe non-production fixtures or a local simulation harness that proves `coordinate → primary road → distinct secondary road/intersection → LP023 structured location → normalized/canonical incident → Alerts/popup/Travel Brief/Awareness` for Harris, Liberty, Jefferson, Polk, Montgomery, and one smaller external county. Only after that proof should presentation or persistence repairs be made.
