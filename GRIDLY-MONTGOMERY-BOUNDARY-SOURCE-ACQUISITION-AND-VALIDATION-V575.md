# GRIDLY Montgomery Boundary Source Acquisition and Validation V575

## 1. Executive Summary

V575 is a documentation-plus-source-acquisition milestone for Montgomery County boundary-source selection. It identifies candidate authoritative boundary sources, selects a preferred source for future Montgomery implementation artifacts, records acquisition status, and documents geometry suitability for future county-containment work.

This milestone does **not** create a Montgomery framework, activate Montgomery, onboard Montgomery, modify V550, modify V551, modify V571, modify application code, modify Supabase, perform migrations, create registry entries, create package manifests, perform historical reads, enable historical systems, resume DriveTexas, or enable Transportation Intelligence.

Protected boundaries remain unchanged:

```yaml
historicalReadsEnabled: false
historyUiEnabled: false
historicalApiExposure: false
consumerFacingHistoryDashboard: false
DriveTexasPaused: true
TransportationIntelligenceEnabled: false
TransportationIntelligenceDisplay: false
TransportationIntelligenceActivation: false
```

**Final Determination:** ACCEPTANCE RECOMMENDED WITH OBSERVATIONS

The preferred source is the U.S. Census Bureau 2025 TIGER/Line County boundary shapefile, filtered in future implementation work to Montgomery County, Texas (`STATEFP=48`, `COUNTYFP=339`, `GEOID=48339`). The source is authoritative enough for standardized county-boundary implementation planning because it is a federal government boundary product with documented vintage, publication channel, and repeatable access path. Acquisition was attempted during V575, but direct download from the execution environment was blocked by an HTTP 403 CONNECT tunnel response. The acquisition blocker is environmental access control rather than a source rejection.

## 2. Candidate Source Review

### 2.1 U.S. Census Bureau TIGER/Line County Boundaries

- **Source owner / steward:** U.S. Census Bureau.
- **Reference:** TIGER/Line Shapefiles, 2025 County shapefile archive.
- **Primary access page:** https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html
- **Direct archive reference:** https://www2.census.gov/geo/tiger/TIGER2025/COUNTY/tl_2025_us_county.zip
- **Version/date:** 2025 TIGER/Line; legal boundaries and names as of January 1, 2025; release date September 23, 2025, per the Census TIGER/Line page.
- **Format:** ESRI shapefile ZIP containing national county polygons and TIGER/Line attributes.
- **Update cadence:** Annual TIGER/Line vintage release cadence, with current-year vintages published through Census mapping-file channels.
- **Licensing / provenance posture:** U.S. federal government publication; source provenance is strong because it is published directly by the Census Bureau through official `.gov` channels.
- **Geometry suitability posture:** Suitable as the preferred standardized county-boundary source for future implementation planning, subject to future extraction of Montgomery County and programmatic geometry validation after a successful download.

### 2.2 Texas State GIS Sources

- **Source owner / steward:** Texas Open Data Portal / Texas state data ecosystem, with relevant statewide county boundary dataset entries identifying U.S. Census data as the provider for cartographic county boundaries.
- **Reference reviewed:** Texas Counties Cartographic Boundary Map, Texas Open Data Portal.
- **Source URL:** https://data.texas.gov/dataset/Texas-Counties-Cartographic-Boundary-Map/sw7f-2kkd
- **Version/date:** Portal listing reviewed during V575; the search result identified the dataset as last updated July 17, 2023 and data provided by U.S. Census.
- **Format:** Open-data portal dataset / cartographic boundary map.
- **Update cadence:** Portal-maintained dataset cadence; not selected because the reviewed state candidate appears derivative of U.S. Census data and less direct than the Census publication channel.
- **Licensing / provenance posture:** Useful state discovery reference, but source lineage points back to Census for the reviewed county-boundary candidate.
- **Geometry suitability posture:** Potentially suitable for visualization or comparison, but not preferred for future implementation artifacts because a direct Census source avoids derivative-source ambiguity.

### 2.3 Montgomery County GIS Sources

- **Source owner / steward:** Montgomery County GIS / MCTX IT-GIS Hub / Geocore Open Data.
- **Primary portal:** https://gis.mctx.org/
- **Open-data portal:** https://data-moco.opendata.arcgis.com/
- **Candidate reviewed:** USCB County Boundary / Greater Montgomery County Area entries discovered through Montgomery County GIS open data.
- **Candidate URL:** https://data-moco.opendata.arcgis.com/datasets/MOCO%3A%3Auscb-county-boundary-2017/explore
- **Version/date:** Candidate naming indicates a 2017 USCB county-boundary dataset; search result text states the boundary information is sourced from U.S. Census Bureau TIGER/Line data.
- **Format:** ArcGIS Hub / hosted feature dataset.
- **Update cadence:** County portal cadence; not selected because the candidate appears to be a county-hosted derivative of Census TIGER/Line data and may be older than the 2025 TIGER/Line source.
- **Licensing / provenance posture:** Useful local discovery and cross-check candidate, but not preferred because the candidate is derivative and older than the current Census vintage.
- **Geometry suitability posture:** Useful as a local comparison source in a future implementation milestone, especially for discrepancy review, but not preferred for authoritative source-of-record selection in V575.

## 3. Selected Source

**Selected preferred source:** U.S. Census Bureau 2025 TIGER/Line County boundary shapefile.

**Selection rationale:**

1. It is published by the U.S. Census Bureau through official Census geography channels.
2. It provides a current, documented vintage: 2025 TIGER/Line, legal boundaries and names as of January 1, 2025, released September 23, 2025.
3. It has a repeatable direct archive path for the full national county shapefile.
4. It avoids derivative-source ambiguity present in Texas portal and Montgomery County GIS candidates that appear to reference Census-derived boundaries.
5. It is standardized across adjacent counties, which supports future shared-edge review between Montgomery, Liberty, Harris, Waller, Grimes, Walker, and San Jacinto counties.

## 4. Source Metadata

| Field | Value |
| --- | --- |
| Source owner | U.S. Census Bureau |
| Product | TIGER/Line Shapefiles |
| Selected layer | 2025 County boundary shapefile |
| Direct archive reference | `https://www2.census.gov/geo/tiger/TIGER2025/COUNTY/tl_2025_us_county.zip` |
| Primary documentation page | `https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html` |
| Boundary vintage | 2025 TIGER/Line |
| Legal boundary date | January 1, 2025 |
| Release date | September 23, 2025 |
| Expected file format | ZIP archive containing ESRI shapefile components |
| Expected Montgomery filter | `STATEFP=48`, `COUNTYFP=339`, `GEOID=48339`, `NAME=Montgomery` |
| Coordinate reference posture | TIGER/Line shapefile CRS must be confirmed from the downloaded `.prj` file before implementation conversion |
| Update cadence | Annual TIGER/Line vintage monitoring recommended |
| Retrieval attempt date | June 18, 2026 |
| Acquisition status | Blocked in execution environment by HTTP 403 CONNECT tunnel failure |

## 5. Licensing / Provenance Review

The selected source has a strong provenance posture because it is published directly by the U.S. Census Bureau through official Census geography pages and the Census TIGER archive. The reviewed Census page identifies TIGER/Line shapefiles as a Census Bureau geography product and states that the core TIGER/Line shapefiles contain geographic entity codes linkable to Census demographic data.

The selected source should remain auditable if future implementation work records:

- the exact archive URL,
- the download date,
- the downloaded ZIP checksum,
- the extracted Montgomery feature attributes,
- any coordinate conversion,
- any simplification or transformation, and
- the generated implementation artifact checksum.

No Montgomery runtime, registry, Supabase, historical, DriveTexas, or Transportation Intelligence permissions are granted by this provenance review.

## 6. Geometry Review

Because the selected archive could not be downloaded in this execution environment, V575 performs suitability validation by source characteristics and records the required future geometry checks. Programmatic geometry validation must be repeated after a successful acquisition.

Expected suitability characteristics for the selected TIGER/Line county layer:

- **Completeness:** The national county layer is expected to include a complete Montgomery County polygon feature identified by `GEOID=48339`.
- **County closure:** The Montgomery feature is expected to be a closed polygon or multipolygon suitable for county containment after extraction.
- **Shared-edge behavior:** Because adjacent counties are represented in the same national county layer, the source should support future shared-edge comparison without mixing vintages.
- **Containment compatibility:** The county polygon should support point-in-polygon containment after future conversion to the project-standard geometry format.
- **Implementation suitability:** Suitable for future implementation artifact development only after acquisition succeeds and programmatic validation confirms valid geometry.

Required future validation after successful download:

1. Confirm the archive checksum and preserve it in source-acquisition evidence.
2. Extract the Montgomery County feature by `GEOID=48339`.
3. Confirm the feature count is exactly one Montgomery county record unless the source encodes geometry as a multipolygon within one record.
4. Confirm polygon or multipolygon validity.
5. Confirm ring closure.
6. Confirm no self-intersection defects.
7. Confirm expected adjacency against Liberty County (`GEOID=48291`) without overlap or gap introduced by transformation.
8. Confirm point containment behavior for known Montgomery interior, Liberty interior, and shared-edge-adjacent control points.

## 7. County Containment Compatibility Review

The selected source is compatible with future county-containment work because it provides standardized, same-vintage county polygons for Montgomery and adjacent counties. This is preferable to combining a Montgomery-only county-hosted derivative with a separate Liberty source unless a future comparison proves exact compatibility.

Future containment work must preserve these boundaries:

```yaml
historicalReadsEnabled: false
historyUiEnabled: false
historicalApiExposure: false
consumerFacingHistoryDashboard: false
DriveTexasPaused: true
TransportationIntelligenceEnabled: false
TransportationIntelligenceDisplay: false
TransportationIntelligenceActivation: false
```

Future implementation milestones must also verify:

- Montgomery containment does not classify Liberty-owned points as Montgomery-owned.
- Liberty containment does not classify Montgomery-owned points as Liberty-owned.
- Shared-edge or near-edge inputs are handled with explicit tolerance rules.
- Unknown-county handling remains explicit for points outside accepted county boundaries.
- No county boundary source is used to authorize historical reads, runtime onboarding, registry changes, or activation.

## 8. Acquisition Result

**Acquisition attempted:** Yes.

**Requested source archive:**

```text
https://www2.census.gov/geo/tiger/TIGER2025/COUNTY/tl_2025_us_county.zip
```

**Attempted local command:**

```bash
curl -L -I https://www2.census.gov/geo/tiger/TIGER2025/COUNTY/tl_2025_us_county.zip
```

**Observed blocker:**

```text
curl: (56) CONNECT tunnel failed, response 403
HTTP/1.1 403 Forbidden
```

A second Python `urllib.request` acquisition probe with a browser-like `User-Agent` also failed with:

```text
URLError <urlopen error Tunnel connection failed: 403 Forbidden>
```

**Acquisition determination:** The selected source is identified and suitable for future acquisition, but the geometry file was not downloaded into the repository during V575 because the execution environment blocked the outbound Census archive request at the CONNECT tunnel layer. This is an environment/network blocker, not a source-quality blocker.

**No boundary geometry file was committed by V575.** This avoids committing an incomplete or unverified artifact and preserves the documentation-only plus acquisition-evidence boundary of this milestone.

## 9. Validation Findings

| Validation Area | Finding |
| --- | --- |
| Source authority | Pass with observation. Census is the preferred direct source owner for the selected county boundary product. |
| Source versioning | Pass. 2025 TIGER/Line vintage, legal boundaries as of January 1, 2025, released September 23, 2025. |
| Provenance | Pass with observation. Provenance is strong through official Census URLs; future successful download must record checksum. |
| Licensing posture | Pass with observation. Federal-source provenance is favorable; final implementation artifact should still record attribution/terms posture. |
| Acquisition | Observation. Attempted acquisition was blocked by HTTP 403 CONNECT tunnel failure in the execution environment. |
| Geometry completeness | Conditional. Expected to be complete based on source product, but must be confirmed after download. |
| County closure | Conditional. Expected to be a valid county polygon/multipolygon, but must be confirmed after download. |
| Shared-edge behavior | Pass with observation. Same-vintage national county layer supports adjacent-county comparison; future validation must test Liberty/Montgomery edge. |
| Containment compatibility | Pass with observation. Source is suitable for future containment artifacts after extraction and validation. |
| Implementation suitability | Acceptance recommended with observations; future implementation must not proceed until acquisition succeeds and geometry checks are recorded. |

## 10. Acceptance Recommendation

**Final Determination: ACCEPTANCE RECOMMENDED WITH OBSERVATIONS**

V575 recommends accepting the U.S. Census Bureau 2025 TIGER/Line County boundary shapefile as the preferred authoritative Montgomery County boundary source for future implementation artifact development, with the following observations:

1. Acquisition from the Census archive was blocked in this execution environment by HTTP 403 CONNECT tunnel failure.
2. No Montgomery geometry file is committed by this milestone.
3. Future implementation work must successfully download the archive, preserve original source metadata, record checksums, extract `GEOID=48339`, and validate geometry before any implementation artifact is accepted.
4. Montgomery remains inactive and not onboarded.
5. Protected historical, DriveTexas, and Transportation Intelligence boundaries remain unchanged.

## Merge Recommendation

Merge is recommended as a documentation-only source-selection and acquisition-validation artifact. V575 identifies the preferred authoritative Montgomery boundary source, records candidate-source review, documents the exact acquisition blocker, and defines required future geometry validation without creating Montgomery runtime artifacts or changing protected system boundaries.
