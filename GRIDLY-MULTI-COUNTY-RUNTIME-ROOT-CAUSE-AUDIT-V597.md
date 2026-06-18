# GRIDLY Multi-County Runtime Root Cause Audit V597

## Final Determination

**ROOT CAUSE IDENTIFIED WITH IMPLEMENTATION BLOCKERS**

## Scope and Method

This audit used static analysis of the runtime, county registry, road resolver, alert generation pipeline, storage helpers, and Montgomery package assets. It does not patch individual strings, does not enable historical systems, does not resume DriveTexas, and does not enable Transportation Intelligence.

Commands used:

- `rg -n "Local Road Impact|Impact Into|Into Liberty|generatedRoadIncidents|gridlyEventHistoryV1|ROADWAY_SEGMENTS_URL|resolveNearestRoadName|loadRoadwayDataset" js/app.js tests assets --glob '!node_modules/**'`
- `sed -n '1,230p' js/app.js`
- `sed -n '980,1215p' js/app.js`
- `sed -n '28245,28290p' js/app.js`
- `sed -n '45480,45555p' js/app.js`
- `sed -n '66380,66830p' js/app.js`
- `find assets/county-implementation/montgomery -maxdepth 2 -type f | sort`

## 1. ROOT CAUSE

The primary root cause is that Montgomery was activated in the county registry without promoting county-specific runtime data contracts into the producer pipeline. The registry makes Montgomery selectable and operational, but the active runtime constants for roads, rail crossings, crossing overrides, and road resolver geometry are read from the active county config fields that Montgomery does not define. As a result, downstream producers continue to rely on legacy Liberty-oriented defaults, global arrays, generic report fields, and string-normalization guards rather than a complete Montgomery road/crossing package.

The exact visible phrase **`Local Road Impact Into Liberty`** is not produced by a single Montgomery-specific formatter. It enters the alert pipeline as an already-produced or stored road/location value and is then consumed by multiple formatters. The exact producers and consumers are:

1. **Upstream report/hazard row road source:** `gridlyRoadClusterRoadName()` reads `roadName`, `road_name`, `street`, `nearest_road`, `location_name`, or `area`, and otherwise falls back to `Unknown road`. It does not attach active county context or invalidate a Liberty fallback before clustering.
2. **Generated incident aggregation:** `gridlyBuildRoadHazardIncidentsFromReports()` groups `activeHazards` into `generatedRoadIncidents` but carries `latestReport` through unchanged. It does not re-resolve road names against active county data and does not reject county-mismatched legacy labels at the producer boundary.
3. **Other-hazard narrative producer:** `resolveOtherHazardNarrativeRoadName()` accepts explicit road fields from the report before coordinate resolution. It has a Liberty-specific invalid-label guard, but the guard is a sanitizer, not a county-owned resolver. If a surface bypasses that guard or consumes a prebuilt title/subtitle, the Liberty label remains possible.
4. **Alert surface title producer:** `buildAlertTitle()` and `buildSpecificAlertTitle()` consume `roadName`, `corridor`, `primaryRoad`, `locationName`, `nearestRoad`, and related fields from the alert object. This confirms the alert-card producer is not solely resolving from active county geometry.
5. **County-aware string sanitizer:** `normalizeGridlyCountyAwareDisplayText()` was added to replace the Liberty phrase for non-Liberty contexts. This is a symptom patch, not the root producer. The continued appearance of the phrase means at least one alert-card path is still rendering stored/prebuilt copy or raw row metadata without passing through a county-aware producer.

The active county context is lost at the boundary between **county selection** and **data-source/runtime-constant initialization**. `gridlyGetActiveCountyId()` can read `window.GRIDLY_ACTIVE_COUNTY_ID`, but `FRA_URL`, `LOCAL_CROSSINGS_URL`, `CROSSING_REVIEW_OVERRIDES_URL`, `ROADWAY_SEGMENTS_URL`, and `LIBERTY_COUNTY_BOUNDARY_URL` are initialized once at module load from `gridlyGetActiveCountyConfig()`. Runtime county selection later cannot reliably rebuild those constants, reload county-specific road/crossing datasets, flush resolver caches, or regenerate active incidents from county-owned sources.

## 2. MISSED MILESTONE

The missed milestone was **county-aware data source integration before activation**. Montgomery activation needed a hard gate requiring all of the following before `operational`, `productionEnabled`, and `selectable` became true:

- County-aware data source integration for boundary, road segments, rail crossings, crossing overrides, and containment fixtures.
- County-aware resolver integration for nearest-road, tap-map coordinate resolution, road-name lookup, fallback road labels, and invalid candidate handling.
- County-aware alert pipeline migration for active hazards, `generatedRoadIncidents`, alert cards, subtitles, popups, route context, marker metadata, and lifecycle metadata.
- County-aware storage migration for `gridlyEventHistoryV1`, report history, lifecycle history, and local event history.
- Montgomery road and crossing asset ingestion. The current Montgomery package contains boundary and containment artifacts, but no Montgomery road-segment or rail-crossing runtime files are present.

## 3. SYSTEMS STILL LIBERTY-BOUND

### County Runtime Context

- `GRIDLY_DEFAULT_COUNTY_ID` remains `liberty-tx`, which is correct for default behavior but unsafe as a silent fallback for activated non-default counties.
- `gridlyNormalizeCountyId()` returns the default Liberty county for unknown or non-operational county ids.
- `gridlyValidateCountyContainment()` treats missing `county_id` as Liberty, which preserves legacy behavior but can contaminate Montgomery if legacy rows enter a Montgomery display path.
- `gridlyGetCountyDisplayContext()` can use Montgomery labels, but it does not solve producer ownership when rows already contain Liberty text.

### Road Resolver

- `ROADWAY_SEGMENTS_URL` is initialized from `gridlyGetActiveCountyConfig().roadSegmentsPath`. Montgomery has no `roadSegmentsPath` in the runtime registry, so the road resolver has no accepted Montgomery geometry contract.
- `loadRoadwayDataset()` fetches exactly one `ROADWAY_SEGMENTS_URL` and stores it in global `roadwaySegmentFeatures`; it is not county-keyed.
- `resolveNearestRoadName()` scans global `roadwaySegmentFeatures` and global `crossings`; neither collection is county-namespaced.
- `resolveOtherHazardNarrativeRoadName()` accepts row-provided `roadName`/`nearest_road` before coordinate resolution, so county context can be bypassed by stored report metadata.
- `GRIDLY_VALIDATED_PRIMARY_CORRIDORS` is a static Liberty-oriented corridor list with partial Montgomery relevance (`US 59`) but no county ownership model.

### Rail Crossing Source

- Liberty defines `crossingsPath`, `localCrossingsPath`, and `crossingOverridesPath` in the registry.
- Montgomery defines only `boundaryPath`, containment fixture path, package metadata, and activation metadata. It has no runtime `crossingsPath`, `localCrossingsPath`, or `crossingOverridesPath`.
- `FRA_URL`, `LOCAL_CROSSINGS_URL`, and `CROSSING_REVIEW_OVERRIDES_URL` are initialized from active county config once and then used by `loadCrossings()` and crossing lookup consumers.
- The Montgomery package file inventory does not include rail-crossing GeoJSON or crossing override JSON.

### Incident Generation

- `getLiveHazardIncidents()` reads `activeHazards` and `recentlyClearedRoadHazards`, not a county-owned incident source.
- `gridlyBuildRoadHazardIncidentsFromReports()` groups current global hazards and preserves raw `latestReport` metadata.
- `buildRoadHazardDisplay()`, `buildLocalizedLocationPhrase()`, `buildAlertTitle()`, `buildSpecificAlertTitle()`, popup detail code, route context, and marker metadata consume raw or shared lookup values from the generated incidents.
- `normalizeGridlyCountyAwareDisplayText()` is downstream string rewriting. It proves the architecture is patching the symptom rather than preventing Liberty text from entering Montgomery incidents.

### Storage / Event History

- `GRIDLY_EVENT_HISTORY_STORAGE_KEY` remains the global key `gridlyEventHistoryV1`.
- `gridlyReadEventHistoryState()` and `gridlyWriteEventHistoryState()` read/write the global history key directly, despite the existence of `gridlyBuildCountyStorageKey()`.
- Historical systems remain protected and should stay disabled, but the global key still represents a county-contamination risk if any active pipeline or audit path consumes it later.

### Data Sources

- Liberty runtime data exists under `data/`: boundary, rail crossings, road segments, and crossing overrides.
- Montgomery runtime package contains boundary and governance/validation artifacts, but no road segments, rail crossings, or crossing overrides.
- The Montgomery registry artifact says activation is enabled, but its package manifest still describes implementation artifacts with no runtime references and no production registry records. This is an architecture-state mismatch.

### UI Surfaces

- Top awareness and welcome flows have Montgomery labels and bounds, but several fallback strings still use Liberty copy.
- Alert panel cards can consume prebuilt alert/hazard fields without guaranteed county-aware resolver output.
- Popup and marker metadata use generated incidents and shared lookup results rooted in global arrays.
- Route context scans active/global incident arrays and road labels rather than a county-scoped incident repository.
- Settings/debug/audit surfaces still preserve Liberty as the default and contain Liberty-specific assumptions.

## 4. REQUIRED ROOT FIX

The minimum root architectural fix is to introduce a **County Runtime Data Session** that is created whenever the active county changes and that owns all county-dependent producers before any UI surface renders.

The session must include:

1. A complete county registry schema with required runtime asset fields for every operational county:
   - `boundaryPath`
   - `roadSegmentsPath`
   - `crossingsPath` or accepted local crossing path
   - `localCrossingsPath`
   - `crossingOverridesPath`
   - awareness areas
   - default city/county labels
   - storage namespace policy
2. Fail-closed activation validation: an operational county cannot be selectable if any required runtime asset or producer contract is missing.
3. County-keyed runtime collections:
   - `roadwaySegmentFeaturesByCounty`
   - `crossingsByCounty`
   - `activeHazardsByCounty`
   - `recentlyClearedRoadHazardsByCounty`
   - resolver caches keyed by county id
4. Producer-boundary containment:
   - Reject or quarantine rows with missing/mismatched `county_id` outside the default Liberty compatibility mode.
   - Re-resolve road labels from active county assets before creating `generatedRoadIncidents`.
   - Prevent raw `roadName`, `nearest_road`, `location_name`, or prebuilt title strings from becoming authoritative unless their county provenance matches the active county.
5. Surface-level consumers should render only county-resolved incident view models, not raw report rows.

## 5. PATCHES TO AVOID

Do not continue these patch-style fixes:

- More `.replace("Liberty", "Montgomery")` or regex sanitizers in alert cards.
- Adding individual string exceptions for `Local Road Impact Into Liberty` in every UI surface.
- Treating `defaultCity: "Conroe"` as a substitute for Montgomery road/crossing datasets.
- Allowing Montgomery activation while `roadSegmentsPath`, `crossingsPath`, or crossing overrides are undefined.
- Reusing global `roadwaySegmentFeatures`, `crossings`, `activeHazards`, or resolver caches for multiple counties.
- Letting legacy missing-county rows participate in Montgomery context.
- Backfilling alert subtitles after rendering instead of fixing incident view-model production.

## 6. COUNTY #3 BLUEPRINT IMPACT

County #3 must not repeat Montgomery's registry-first activation pattern. The future county blueprint must require a county package to include accepted runtime data assets, producer contracts, and containment tests before activation. A county is not runtime-ready merely because it appears in the registry or has a boundary file.

County #3 onboarding must include:

- Complete runtime asset package: boundary, roads, crossings, overrides, awareness areas, fixtures, and source provenance.
- Automated activation gate that fails if any operational registry field is missing.
- County-switch session rebuild test proving roads, crossings, active incidents, popups, alerts, route context, storage keys, and marker metadata all use the active county.
- Negative leakage tests using known County #1 and County #2 fallback strings.
- Evidence that raw report metadata cannot override active-county resolver output without matching county provenance.

## Protected Boundary Confirmation

- `historicalReadsEnabled`: false
- `historyUiEnabled`: false
- `historicalApiExposure`: false
- `consumerFacingHistoryDashboard`: false
- `DriveTexasPaused`: true
- `TransportationIntelligenceEnabled`: false
- `TransportationIntelligenceDisplay`: false
- `TransportationIntelligenceActivation`: false

No DriveTexas work is recommended. No Transportation Intelligence work is recommended. Historical systems remain disabled.
