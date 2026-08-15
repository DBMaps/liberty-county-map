# LP201 — Statewide cartographic PLACE center source audit

## Final classification

**OWNER_INPUT_REQUIRED**

No runtime camera, identity, membership, ZIP, Houston/San Antonio, or other protected surface was activated or mutated.

## Product-center definition

The cartographically recognizable anchor for a named PLACE: the point around which a map user expects the settlement name/core to appear near the usable visual center. It is not presumed to equal a polygon, population, address-density, civic, administrative, or geographic center.

## Preserved findings

LP199: **GEOMETRY_ONLY_DERIVATION_INSUFFICIENT**, mean 4855.401 m. LP200: **ADDRESS_DERIVED_POPULATED_CORE_NOT_SUFFICIENT_FOR_CONSUMER_PRESENTATION_CAMERA**, best DENSEST_CONNECTED_CLUSTER_CENTROID, mean 3532.755 m, 27.241% improvement, below the 30% threshold.

## Existing governed source inventory

- **GOVERNED_EXISTING — Gridly canonical PLACE presentation points:** Census PLACE reference/presentation signal evaluated and rejected by LP199; it is not a cartographic label anchor.
- **GOVERNED_EXISTING — LP197 owner-approved cameras:** High-quality governed exceptions, not a systemic statewide source.
- **OWNER_LOCAL_GOVERNED_INPUT — LP200 owner address-derived candidates:** Preserved owner result was rejected as ADDRESS_DERIVED_POPULATED_CORE_NOT_SUFFICIENT_FOR_CONSUMER_PRESENTATION_CAMERA.
- **NOT_APPLICABLE — Repository destination, ZIP, crossing, roadway, and geocoder evidence:** No governed statewide named-place/cartographic-label point dataset was found.
- **IDENTITY_KNOWN_BYTES_UNAVAILABLE — 2025 TIGER/Line Texas PLACE polygons:** Polygon identity support only; geometry derivation is prohibited and LP199 found it insufficient.

## Current basemap and labels

Gridly uses Leaflet raster tiles: OpenStreetMap standard, CARTO dark, Esri World Imagery, and a CARTO raster label overlay. Settlement layers and label-anchor coordinates are not exposed by the configured raster endpoints. Tiles were not scraped. **OWNER_VISUAL_CERTIFICATION_REQUIRED**.

## Authoritative candidates, semantics, and coverage

| Rank | Source | Authority | Semantics | Reconciled coverage | Status |
|---:|---|---|---|---:|---|
| 1 | USGS_GNIS_DOMESTIC_NAMES | FEDERAL_GOVERNMENT | POPULATED_PLACE_POINT | 0/1859 (0%) | NOT_MEASURED_BYTES_UNAVAILABLE |
| 2 | CENSUS_GAZETTEER_PLACE | FEDERAL_GOVERNMENT | ADMINISTRATIVE_REFERENCE_POINT | 1859/1859 (100%) | RECONCILED_DIRECT_GEOID |
| 3 | TXDOT_COMMUNITY_POINTS | STATE_GOVERNMENT | UNKNOWN_SEMANTICS | 0/1859 (0%) | NO_VALIDATED_DATASET |
| 4 | TEXAS_STATE_GIS_COMMUNITY_POINTS | STATE_GOVERNMENT | UNKNOWN_SEMANTICS | 0/1859 (0%) | NO_VALIDATED_DATASET |
| 5 | OFFICIAL_MUNICIPAL_CIVIC_CENTERS | STATE_GOVERNMENT | UNKNOWN_SEMANTICS | 0/1859 (0%) | NOT_STATEWIDE |

Ranking is criterion-by-criterion, not a composite score: AUTHORITY, STATEWIDE_COVERAGE, CANONICAL_IDENTITY_RECONCILIATION, SEMANTIC_FIT_FOR_CARTOGRAPHIC_CENTER, CALIBRATION_ERROR, SMALL_PLACE_SUPPORT, CDP_SUPPORT, MULTI_COUNTY_SAFETY, REPRODUCIBILITY, LICENSING/GOVERNANCE, OWNER_VISUAL_REVIEW_POTENTIAL. GNIS ranks first for semantic investigation, not certification; its bytes, crosswalk, coverage, calibration, and visual behavior remain unvalidated.

## Identity reconciliation

Direct GEOID preferred. Otherwise require governed feature ID plus class, polygon containment, county compatibility, and unique deterministic selection. Never reconcile statewide solely by label. Duplicate, multiple-feature, alias, renamed, and historical cases fail closed unless governed evidence makes the selection unique. Census Gazetteer has 1,859 direct-GEOID matches. All unacquired candidates report zero matches rather than invented results.

## Calibration

The exact four LP197 cameras remain truth. Census/LP199 mean: 4855.401 m. LP200 best mean: 3532.755 m. No new candidate had validated coordinates, so Dallas, Fort Worth, Austin, El Paso, mean, median, total, and maximum are explicitly null rather than fabricated.

## Controls and small-place/CDP behavior

Owner failure controls: Corpus Christi, McAllen, Port Arthur, Tyler, Waco. Acceptable generic control: Amarillo. Representative cohort: Corpus Christi, McAllen, Port Arthur, Tyler, Waco, Amarillo, Lubbock, Laredo, Brownsville, Galveston, Denton, Temple, Nacogdoches, Alpine, Marfa, Palestine, Liberty. Every row is **OWNER_VISUAL_CERTIFICATION_REQUIRED**. The cohort includes incorporated small places and CDPs through the full 1,859-PLACE audit contract. GNIS may support rural named communities but its relationship to Census CDPs is not assumed and must be measured.

## Corpus Christi diagnostic

**EXACT_CAUSE_NOT_DETERMINABLE_FROM_COMMITTED_EVIDENCE.** Corpus Christi spans four governed county memberships and has water-heavy/offshore geometry, but neither fact proves why only 13 addresses intersected. The preserved owner candidate artifact/raw GDAL diagnostics are unavailable here, so address coverage, schema, containment, filtering, topology, and actual source limitation cannot be distinguished. This does not invalidate the statewide LP200 engine and is separate from source selection.

## Selected source and next owner action

No source is selected or certified. Download the official USGS GNIS Domestic Names source from https://www.usgs.gov/us-board-on-geographic-names/download-gnis-data; freeze it as `GNIS_TX_DOMESTIC_NAMES_OWNER_DOWNLOAD.zip` at `C:\GitHub\Gridly-Source-Data\USGS\GNIS\original\GNIS_TX_DOMESTIC_NAMES_OWNER_DOWNLOAD.zip`; record retrieval metadata, bytes, SHA-256, schema and license; set `GRIDLY_LP201_GNIS_TX_ZIP`; then execute the seven validation steps in the JSON audit. Do not activate cameras.

## Decision

**OWNER_INPUT_REQUIRED**
