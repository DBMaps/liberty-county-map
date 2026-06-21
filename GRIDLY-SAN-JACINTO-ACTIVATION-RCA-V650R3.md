# V650R.3 San Jacinto Activation Root Cause Audit

## Decision

San Jacinto must remain validation-only. This RCA does not recommend production activation, does not proceed to V651, and does not recommend merge for activation. The only runtime-safe remediation allowed in this milestone is audit crash hardening so browser diagnostics can return safe output instead of throwing.

Required status remains:

- `productionEnabled: false`
- `productionActivationBlocked: true`
- `reauthorizationRequired: true`
- `sourceAssetRecommendedForProduction: false` for the current boundary
- San Jacinto validation-only until an authoritative boundary and normalized road assets are accepted through browser validation

## 1. Boundary geometry is visually incorrect

### Root cause

`san-jacinto-county-boundary.geojson` is not a production-authoritative county boundary asset. Its embedded provenance says it is a `Gridly controlled activation county-specific boundary asset v646.1`, not a direct Census/TIGER, TxDOT, or county GIS export. The file carries `GEOID=48407` metadata, but the coordinate ring is a coarse, smoothed polygon with only 431 vertices, while the accepted Montgomery boundary in this repository has 6,828 vertices. The current San Jacinto shape therefore appears to be a generated or manually simplified placeholder derived for controlled activation display, not an authoritative extracted county feature.

The problem is not evidence that the app selected the wrong active county at render time. It is an asset-provenance and geometry-quality failure: metadata claims San Jacinto ownership, but the geometry does not visually match the real San Jacinto County boundary closely enough for production.

### Affected functions

- `gridlyGetActiveCountyBoundarySource()` / active county boundary source selection
- `loadCountyBoundaryOverlay()` and county boundary overlay rendering
- `gridlyCountyBoundaryOverlayAudit()` / boundary credibility audit
- Any browser validation path that treats `san-jacinto-county-boundary.geojson` as the rendered county outline

### Affected files

- `assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson`
- `js/app.js`
- `assets/county-implementation/san-jacinto/validation/san-jacinto-boundary-ownership-hardening-v648.json`
- Prior San Jacinto boundary/readiness documentation that accepted ownership metadata without visual geometry proof

### Why previous audits missed it

Previous audits validated ownership fields (`countyId`, `geoid`, source path, active county isolation) rather than performing browser visual correctness validation against an authoritative reference. They could pass when the file was San-Jacinto-owned even if the coordinate ring itself was not credible.

### Exact fix recommendation

Replace the boundary with a freshly extracted authoritative San Jacinto County feature from Census TIGER/Line county boundaries or another accepted authoritative county boundary source. The extraction must select exactly `STATEFP=48`, `COUNTYFP=407`, `GEOID=48407`, preserve the source CRS conversion to WGS84/EPSG:4326 GeoJSON, and retain enough vertex detail for the county outline to visually match the authoritative boundary. The replacement must be browser-validated visually before any activation recommendation.

### Safety

- Safe for Liberty: yes, if the replacement is scoped only to San Jacinto boundary assets and does not alter Liberty registry or overlay code.
- Safe for Montgomery: yes, if the replacement is scoped only to San Jacinto boundary assets and does not alter Montgomery registry or overlay code.
- San Jacinto remains validation-only: yes.

## 2. Road names are not resolving like Liberty/Montgomery

### Root cause

San Jacinto has source roadway shapefile components, but it does not have the normalized runtime `san-jacinto-county-road-segments.geojson` expected by the multi-county road-asset standard. In `js/app.js`, San Jacinto's `roadSegmentsPath` points directly to `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.shp`. The browser cannot consume this shapefile path as the same runtime road-segment GeoJSON used by the road-name resolver. As a result, coordinate-based `resolveNearestRoadName()` has no San Jacinto road segment index comparable to Liberty/Montgomery, and display surfaces fall back to generic county/place wording such as “near Coldspring” or “near San Jacinto County.”

This is not a copy problem. The road resolver is available, and incident fields are capable of supplying road names, but San Jacinto lacks registered normalized road segment data that the browser resolver can load and query.

### Affected functions

- `resolveNearestRoadName(lat, lng)`
- `resolveIncidentRoadLookupPayload(incident)`
- `resolveGridlyRoadHazardAuthoritativeLocationLabel(alert)`
- `buildRoadHazardDisplay(incident, resolvedLookup)`
- `normalizeGridlyCountyAwareDisplayText(...)`
- San Jacinto report/visibility audits that inspect road-name and location-line quality

### Affected files

- `js/app.js`
- `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.*`
- Missing required runtime artifact: `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-road-segments.geojson`
- `assets/county-implementation/multi-county-asset-package-manifest-v601.5.json`

### Why previous audits missed it

The audits checked that San Jacinto roadway source components existed and that the registry had a road source path. They did not require a browser-loadable normalized road-segments GeoJSON, did not assert that `resolveNearestRoadName()` had a San Jacinto index, and did not validate submitted San Jacinto incidents end-to-end for road-name resolution.

### Exact fix recommendation

Run the county asset normalization harness for San Jacinto to convert `tl_2025_48407_roads.*` into `san-jacinto-county-road-segments.geojson`. Register that GeoJSON as the San Jacinto runtime road segment path only after schema validation, browser loading, and resolver proof that submitted San Jacinto coordinates resolve to real road/corridor names. Do not solve this by adding San-Jacinto-specific copy strings.

### Safety

- Safe for Liberty: yes, if the resolver remains county-scoped and Liberty road path/config is unchanged.
- Safe for Montgomery: yes, if Montgomery road path/config is unchanged and shared resolver behavior is regression-tested.
- San Jacinto remains validation-only: yes.

## 3. Alert/marker/location-card counts are not reconciled

### Root cause

San Jacinto visibility is split across multiple count sources. Alerts and markers can observe active report/incident collections, while the location card/top awareness path uses `buildGridlyAwarenessHazardCountConsistencyModel()` and selected-awareness filters. San Jacinto reports can therefore be visible as markers/alerts but not included in the location-card count when San Jacinto awareness/card state is not fully promoted or when the count model is fed only one collection (`activeHazards`) instead of the unified county-visible incident set.

The current V650R.2 audit attempted to expose this lineage, but the browser crash prevented reliable diagnostics. Once the crash is fixed, the audit should show separate values for raw county-matched reports, unified incidents, rendered markers, visible alerts, awareness count, and location-card count.

### Count-source inventory

- Alert panel: visible alert incident count from alert input/rendered alert state, surfaced through `getGridlyVisibleAlertIncidentCount()` and `buildGridlyAwarenessHazardCountConsistencyModel()`.
- Top awareness: bottom/top awareness displayed hazard count from `buildGridlyAwarenessHazardCountConsistencyModel()` and active awareness summary inputs.
- Location card: currently follows awareness/location-card count derivation, not necessarily the same source as marker rendering.
- Marker layer: rendered unified incident layer count (`unifiedIncidentLayer.getLayers().length`) and marker count from the count-consistency model.

### Affected functions

- `gridlyGetCurrentCountyVisibleIncidentAudit(countyId)`
- `gridlySanJacintoReportSubmissionAudit()`
- `buildGridlyAwarenessHazardCountConsistencyModel(options)`
- `getGridlyVisibleAlertIncidentCount()`
- Unified incident marker rendering / `unifiedIncidentLayer`
- Location-card/top-awareness count derivation near active awareness summary handling

### Affected files

- `js/app.js`
- `tests/county-runtime/sanJacintoBrowserValidationV650R2.test.js`

### Why previous audits missed it

Previous audits compared derived summary counts after fallback normalization instead of auditing each surface's source collection independently. They also allowed a generic count model to stand in for multiple surfaces without verifying that San Jacinto incidents passed through the same awareness/card filters as the marker and alert surfaces.

### Exact fix recommendation

After audit crash hardening, add a diagnostic-only count lineage audit that reports each surface's source collection and county filter result. Then implement a scoped reconciliation fix so San Jacinto validation-only incidents use one county-visible incident set for marker, alert, awareness, and location-card counts. This must be validated in a real browser with a fresh San Jacinto test report before any production activation discussion.

### Safety

- Safe for Liberty: yes only if the change is diagnostic-first and shared count model changes are regression-tested against Liberty PASS.
- Safe for Montgomery: yes only if Montgomery PASS is preserved through browser and automated tests.
- San Jacinto remains validation-only: yes.

## 4. San Jacinto audit crashes

### Root cause

`gridlyGetCurrentCountyVisibleIncidentAudit()` defines `currentIncidentCount`, but the returned object references `currentVisibleIncidentCount`, which is not defined. The resulting `ReferenceError` propagates through `gridlySanJacintoReportSubmissionAudit()` and crashes browser validation.

### Affected functions

- `gridlyGetCurrentCountyVisibleIncidentAudit(countyId)`
- `gridlySanJacintoReportSubmissionAudit()`
- `gridlySanJacintoLanguageAndCountReconciliationAudit(options)` when it calls the report submission audit

### Affected files

- `js/app.js`
- `tests/county-runtime/sanJacintoBrowserValidationV650R2.test.js`

### Why previous audits missed it

The existing V650R.2 test was a string/sentinel test. It verified that expected audit field names existed in source text, but it did not execute `gridlyGetCurrentCountyVisibleIncidentAudit()` in a browser-like or VM context. Static inclusion checks cannot catch an undefined local variable in a returned object.

### Exact fix recommendation

Define `currentVisibleIncidentCount` from `currentIncidentCount` before return, and wrap the San Jacinto audit's current-visible diagnostic call in a safe fallback so missing data returns a structured diagnostic object instead of throwing. This is audit hardening only and does not activate San Jacinto.

### Safety

- Safe for Liberty: yes; it only corrects a diagnostic variable and safe fallback.
- Safe for Montgomery: yes; it preserves the shared audit shape and only prevents diagnostic crashes.
- San Jacinto remains validation-only: yes.

## Recommended next implementation milestone

Do not proceed to V651 activation. The next milestone should be **V650R.4 San Jacinto Asset and Count Remediation**, limited to:

1. Replace the San Jacinto boundary from an authoritative `GEOID=48407` source and browser-validate visual correctness.
2. Generate and register `san-jacinto-county-road-segments.geojson` from the existing TIGER roads source through the normalization harness.
3. Add browser-executed road resolver diagnostics proving San Jacinto incident coordinates resolve to road/corridor names.
4. Add diagnostic-only count lineage output for alert panel, marker layer, top awareness, and location card, then reconcile only after the lineage is proven.
5. Keep `productionEnabled: false`, `productionActivationBlocked: true`, and `reauthorizationRequired: true` until browser validation passes.
