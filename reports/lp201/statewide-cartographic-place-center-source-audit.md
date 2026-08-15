# LP201 — Statewide cartographic PLACE center source audit

## Final classification

**OWNER_INPUT_REQUIRED**

This is an audit only. No runtime camera or protected identity surface was activated.

## Product definition and preserved evidence

The cartographically recognizable anchor for a named PLACE: the point around which a map user expects the settlement name/core to appear near the usable visual center. It is not presumed to equal a polygon, population, address-density, civic, administrative, or geographic center.

LP199 remains **GEOMETRY_ONLY_DERIVATION_INSUFFICIENT** (4855.401 m mean). LP200 remains **ADDRESS_DERIVED_POPULATED_CORE_NOT_SUFFICIENT_FOR_CONSUMER_PRESENTATION_CAMERA** (12,130,953 records; 3532.755 m best mean; 27.241% improvement). The Dayton lifecycle repair is distinct from center quality.

## OSM source, provenance, license, and architecture

The reproducible discovery target is Geofabrik's Texas planet-derived extract: [Texas metadata](https://download.geofabrik.de/north-america/us/texas.html) and [PBF download](https://download.geofabrik.de/north-america/us/texas-latest.osm.pbf). It is expected as `texas-latest.osm.pbf`, PBF, normally refreshed daily. Exact retrieval date, bytes, and SHA-256 are deliberately unreported until owner bytes exist. OSM data is ODbL 1.0: attribute OpenStreetMap contributors, preserve provenance, and review derived-database share-alike duties.

- **OSM_LABEL_ANCHOR / CARTOGRAPHIC_LABEL_ANCHOR:** boundary-relation node member `role=label`; closest semantic hypothesis to the requested label/logical/cultural center.
- **OSM_ADMIN_CENTRE / ADMINISTRATIVE_CENTRE:** relation member `role=admin_centre`; administrative seat, not presumed best label point.
- **OSM_PLACE_NODE / NAMED_PLACE_ANCHOR:** a `place=city|town|village|hamlet|municipality|*` node. A node satisfying several roles remains one identity with every role recorded.

Raster tiles were not scraped and screenshots supply no coordinates.

## GNIS source and semantics

The official discovery endpoint is [USGS GNIS downloads](https://www.usgs.gov/us-board-on-geographic-names/download-gnis-data). Acquire the Texas **FullModel** state download, preserve the exact official filename, GIS format, metadata/vintage, feature classes, CRS, bytes, and SHA-256. Populated Place is a named-feature point; Civil and Census are distinct feature semantics and are not silently treated as Census PLACE identities.

## Input identities and reconciliation

The governed target is exactly **1,859 PLACE GEOIDs / 2,058 county memberships**. OSM retains element type/ID, relation ID, role, name, place class, coordinates, Wikidata, Wikipedia, population, and admin level. GNIS retains feature ID, federal/Census codes when present, class, state/county, coordinates, and source metadata. Direct identifiers/crosswalks precede relation evidence, polygon containment, county compatibility, governed normalized name, and unique selection. Statewide name-only matching is forbidden; duplicates, aliases, history, multi-county cases, and multiple points fail closed when unresolved.

## Coverage and calibration

| Study order | Source | Semantics | Reconciled | Status |
|---:|---|---|---:|---|
| 1 | OSM_TEXAS_PLACE_ANCHORS | CARTOGRAPHIC_LABEL_ANCHOR | 0/1859 (0%) | NOT_MEASURED_BYTES_UNAVAILABLE |
| 2 | USGS_GNIS_FULLMODEL_TEXAS | POPULATED_PLACE_POINT | 0/1859 (0%) | NOT_MEASURED_BYTES_UNAVAILABLE |
| 3 | CENSUS_GAZETTEER_PLACE | ADMINISTRATIVE_REFERENCE_POINT | 1859/1859 (100%) | RECONCILED_DIRECT_GEOID |
| 4 | TXDOT_COMMUNITY_POINTS | UNKNOWN_SEMANTICS | 0/1859 (0%) | NO_VALIDATED_DATASET |
| 5 | TEXAS_STATE_GIS_COMMUNITY_POINTS | UNKNOWN_SEMANTICS | 0/1859 (0%) | NO_VALIDATED_DATASET |
| 6 | OFFICIAL_MUNICIPAL_CIVIC_CENTERS | UNKNOWN_SEMANTICS | 0/1859 (0%) | NOT_STATEWIDE |

OSM label/admin-centre/place and GNIS each measure **0 matched, 0 ambiguous, 1,859 unmatched (0%)** because their bytes are absent—not because empirical coverage is known to be zero. Incorporated, CDP, multi-county, and small/rural breakdowns are **NOT_MEASURED**. Census has 1,859 direct-GEOID baseline matches.

The four exact LP197 truth cameras (Dallas, Fort Worth, Austin, El Paso; zoom 13) remain unchanged. LP199 mean is 4855.401 m and LP200 best mean is 3532.755 m. New per-city, mean, median, total, and maximum metrics are null rather than fabricated.

## Dayton, known-bad, small-place, and CDP controls

Dayton's approved anchor is **30.0466, -94.8852, zoom 13** (reload 30.046658937805077, -94.88513946533205). OSM label/admin-centre/place and GNIS comparisons are unmeasured. Failure controls are Tyler, Waco, McAllen, Port Arthur, and Corpus Christi; Amarillo is the acceptable generic control. The statewide cohort also includes Liberty, Palestine, Lubbock, Laredo, Brownsville, Galveston, Denton, Temple, Nacogdoches, Alpine, Marfa, and CDPs Abram and Aldine. Corpus Christi's LP200 13-address anomaly remains separate.

## Label versus admin centre and source ranking

The semantic hypothesis is label anchor first, place node second, administrative centre third, GNIS populated-place point fourth, and Census administrative reference point last **for semantic fit only**. No empirical winner is declared. Authority, licensing/governance, statewide coverage, identity reconciliation, semantic fit, LP197 calibration, Dayton, known-bad potential, CDP support, small-place support, multi-county safety, and reproducibility are reported independently; missing bytes prevent measured ranking on most axes.

No systemic source or tiered model is selected. A tiered contract is not invented merely to increase coverage.

## Exact owner action

1. Download Geofabrik Texas PBF to `C:\GitHub\Gridly-Source-Data\OpenStreetMap\Geofabrik\original\texas-latest.osm.pbf` and freeze its retrieval timestamp, URL, byte count, SHA-256, metadata, and ODbL notice.
2. Download official USGS GNIS Texas FullModel to `C:\GitHub\Gridly-Source-Data\USGS\GNIS\original\<official-filename>`, preserving the official filename; freeze the same provenance plus schema, vintage, feature classes, and CRS.
3. Set `GRIDLY_LP201_OSM_SOURCE` and `GRIDLY_LP201_GNIS_SOURCE` to those files and run `npm run build:lp201`. Do not activate cameras.

## Protected surfaces

The audit records and verifies hashes for js/app.js, reports/lp197/governed-place-consumer-presentation-cameras.json, data/generated/gridly-statewide-consumer-community-projection-v1.json, data/generated/gridly-statewide-consumer-zip-index-v1.json. Houston, San Antonio, Route Watch, Supabase, deployment, and hazard lifecycle were not touched.

## Decision

**OWNER_INPUT_REQUIRED**
