# GRIDLY Texas County Boundary Source Forensics — V650R.5

## 1. Quick summary

**Mission result:** `assets/state-boundaries/Texas_Counties_Cartographic_Boundary_Map_20260620.geojson` is **not trustworthy for county boundary use**.

**Trust classification:** **D. NOT TRUSTED FOR COUNTY BOUNDARY USE**

The file is internally parseable and contains 254 unique Texas-style GEOIDs, but the geometry is not credible county boundary geometry:

- Every feature is a five-coordinate rectangular `MultiPolygon`.
- Every county has exactly five coordinates, which is only enough to close a simple box.
- Most `name` values are placeholders such as `County 48407`, not authoritative county names.
- The file does not provide `STATEFP` or `COUNTYFP` properties even though the GEOID embeds those values.
- Selected GEOIDs resolve to implausible locations, including GEOID `48407`, which should be San Jacinto County in East Texas but resolves to far-west Texas coordinates near longitude `-104.57` and latitude `28.28`.
- The statewide coordinate extent is truncated to approximately west/south/central Texas through the Houston-area east edge, not the full Texas county geography.

**Operational conclusion:** this source must not be used for active county display, active county extraction, county onboarding, audit validation, or passive statewide boundary context. At most, it can be used as evidence that a prior placeholder/synthetic dataset existed and must be replaced.

## 2. Source file inspection

Inspected source:

```text
assets/state-boundaries/Texas_Counties_Cartographic_Boundary_Map_20260620.geojson
```

Observed top-level and schema facts:

| Field | Finding |
|---|---:|
| Top-level type | `FeatureCollection` |
| Feature count | `254` |
| CRS member | absent / `None` |
| Property keys present | `geoid`, `name`, `statefp` |
| Geometry type distribution | `254` `MultiPolygon` features |
| Statewide coordinate bbox | `[-106.0, 25.0, -95.1, 30.4]` |
| Longitude range | `-106.0` to `-95.1` |
| Latitude range | `25.0` to `30.4` |

Notes:

- The file parses as valid JSON/GeoJSON.
- The coordinate ordering appears to be longitude/latitude, not latitude/longitude.
- Coordinates use plausible numeric ranges for some Texas longitudes/latitudes, but many county GEOIDs are mapped to implausible places.
- The absence of an explicit CRS is normal for GeoJSON if WGS84 longitude/latitude is intended, but the geometry content itself is not credible.

## 3. GEOID integrity review

| Check | Result |
|---|---:|
| Feature count | `254` |
| GEOID count | `254` |
| Unique GEOID count | `254` |
| Duplicate GEOIDs | `0` |
| Missing GEOIDs | `0` |
| County name count | `254` |
| Unique county name count | `254` |
| Duplicate county names | `0` |
| Missing county names | `0` |

Important limitation:

- GEOID uniqueness is syntactically clean, but identity is not trustworthy because most county names are placeholders and selected GEOIDs do not map to plausible county locations.
- `statefp` exists as a property key, but inspected selected features reported `None` for `STATEFP` because the file uses lowercase `statefp`; no separate uppercase `STATEFP` or `COUNTYFP` fields are present.
- No dedicated `COUNTYFP` property was observed.

## 4. County plausibility matrix

The following selected counties were inspected by GEOID, name, geometry type, bounding box, centroid, and broad geographic plausibility.

| Expected county | GEOID | Feature name in source | Geometry type | Coordinate count | Bounding box `[minLon, minLat, maxLon, maxLat]` | Approx centroid `[lon, lat]` | Plausibility finding |
|---|---:|---|---|---:|---|---|---|
| Liberty County | `48291` | `Liberty` | `MultiPolygon` | `5` | `[-95.3, 30.0, -95.1, 30.2]` | `[-95.22, 30.08]` | Location is broadly near southeast Texas, but the 5-point box is not a credible county boundary and is too simplified for boundary use. |
| Montgomery County | `48339` | `Montgomery` | `MultiPolygon` | `5` | `[-95.75, 30.2, -95.55, 30.4]` | `[-95.67, 30.28]` | Location is broadly near Montgomery County, but the shape is a synthetic/simple rectangle and not credible boundary geometry. |
| San Jacinto County | `48407` | `County 48407` | `MultiPolygon` | `5` | `[-104.65, 28.2, -104.45, 28.4]` | `[-104.57, 28.28]` | Not plausible. This resolves to far-west Texas/northern Mexico vicinity, not East Texas near Coldspring, Shepherd, Lake Livingston, Cleveland, Liberty, or Montgomery. |
| Harris County | `48201` | `County 48201` | `MultiPolygon` | `5` | `[-106.0, 26.6, -105.8, 26.8]` | `[-105.92, 26.68]` | Not plausible. Harris County should be in the Houston area near longitude about `-95`, not far west near `-106`. |
| Chambers County | `48071` | `County 48071` | `MultiPolygon` | `5` | `[-99.25, 25.32, -99.05, 25.52]` | `[-99.17, 25.40]` | Not plausible. Chambers County should be on the upper Texas coast east of Houston, not south Texas/interior near `-99`. |
| Jefferson County | `48245` | `County 48245` | `MultiPolygon` | `5` | `[-105.1, 26.92, -104.9, 27.12]` | `[-105.02, 27.00]` | Not plausible. Jefferson County should be near Beaumont/Port Arthur on the upper Texas coast, not far west near `-105`. |
| Polk County | `48373` | `County 48373` | `MultiPolygon` | `5` | `[-103.3, 27.88, -103.1, 28.08]` | `[-103.22, 27.96]` | Not plausible. Polk County should be in East Texas near Livingston, not far west/southwest Texas. |

## 5. San Jacinto GEOID 48407 findings

For GEOID `48407`:

| Field | Finding |
|---|---|
| Expected county | San Jacinto County, Texas |
| Feature name | `County 48407` |
| GEOID | `48407` |
| STATEFP | Not available as uppercase `STATEFP`; lowercase schema key exists as `statefp` |
| COUNTYFP | Not available as separate property |
| Geometry type | `MultiPolygon` |
| Coordinate count | `5` |
| Bounding box | `[-104.65, 28.2, -104.45, 28.4]` |
| Approximate centroid | `[-104.57, 28.28]` |
| Plausible for San Jacinto? | **No** |

San Jacinto County should resolve to East Texas near Coldspring, Shepherd, Lake Livingston, and the Cleveland/north-of-Liberty/Montgomery corridor. The source feature for `48407` instead resolves near longitude `-104.57`, latitude `28.28`, which is far west/southwest of the expected county area and outside any plausible San Jacinto County boundary location.

This confirms the V650R.4 concern: `48407` is not a trustworthy San Jacinto boundary source in this statewide file.

## 6. Geometry simplification findings

| Metric | Finding |
|---|---:|
| Total coordinate count | `1,270` |
| Average coordinate count per county | `5.0` |
| Minimum coordinate count | `5` |
| Maximum coordinate count | `5` |
| Counties with fewer than 10 coordinates | `254` |
| Liberty coordinate count | `5` |
| Montgomery coordinate count | `5` |
| San Jacinto coordinate count | `5` |

Interpretation:

- A five-coordinate polygon is a closed rectangle or rectangle-like ring, not a county boundary.
- Because every county has exactly five coordinates, this appears to be a synthetic gridded/boxed placeholder file rather than a cartographic county boundary dataset.
- Liberty and Montgomery have broadly nearby locations but still fail shape fidelity requirements because they are represented as simple boxes.
- San Jacinto fails both identity/location plausibility and geometry quality.

Suitability by role:

| Role | Suitability |
|---|---|
| Active county display | **Not suitable** |
| Active county boundary extraction | **Not suitable** |
| Passive statewide context | **Not suitable** because many GEOID locations are wrong and every shape is synthetic/rectangular |
| Lookup metadata only | **Not suitable as authoritative metadata** because names are placeholders and selected GEOID-to-location mappings are wrong |
| Audit validation | **Not suitable** |
| Future county onboarding | **Not suitable** |

## 7. CRS / coordinate-order findings

| Check | Finding |
|---|---|
| Longitude/latitude order | Coordinates appear ordered as `[longitude, latitude]`. |
| Coordinate numeric ranges | Values fall within broad longitude/latitude numeric ranges, but not within full credible Texas county extents for selected GEOIDs. |
| Inverted coordinate signs | No evidence of positive-west or inverted-sign coordinates. Longitudes are negative and latitudes are positive. |
| CRS declaration | No explicit CRS member. GeoJSON default WGS84 semantics are implied, but the data content is not credible. |
| Suspicious repeated boxes | Yes. Every county has exactly a five-coordinate rectangular `MultiPolygon`. |
| Impossible Texas locations | Selected East Texas/Gulf Coast GEOIDs resolve to far-west/southwest Texas positions. |
| Geometry outside Texas bounds | The statewide bbox is within broad Texas/northern-border-region numeric ranges, but the county-specific GEOID placements are impossible or implausible for multiple selected counties. |

The dominant issue is not coordinate order or sign inversion. The dominant issue is apparent synthetic geometry and incorrect GEOID-to-place mapping.

## 8. Trust classification

**Classification: D. NOT TRUSTED FOR COUNTY BOUNDARY USE**

Rationale:

1. **County identity is not trustworthy.** Most names are placeholders like `County 48201`, not authoritative county names.
2. **GEOID matching is not trustworthy for location.** Unique GEOIDs exist, but selected GEOIDs map to implausible bounding boxes.
3. **Active county extraction is not trustworthy.** Every county is represented by a five-coordinate rectangular feature, and San Jacinto `48407` is geographically wrong.
4. **Passive context is not trustworthy.** Passive statewide context would visually mislead users because the shapes are boxes and many are in wrong places.
5. **Audit validation is not trustworthy.** This file cannot validate county boundary lineage or activation readiness.
6. **Future county onboarding is not trustworthy.** It would propagate incorrect identity/location assumptions into new county programs.

## 9. Replacement strategy recommendation

Replace this statewide source before using any statewide Texas boundary file for Gridly county-boundary workflows.

Required replacement strategy:

1. **Acquire an authoritative Texas county boundary source.** Use an official or authoritative source with documented lineage, such as Census TIGER/Line county boundaries, Census cartographic county boundaries at an appropriate resolution, or an authoritative Texas state GIS county boundary layer.
2. **Preserve source lineage.** Record source URL, publisher, publication date, download date, processing steps, simplification tolerance if any, and checksum.
3. **Verify schema.** Require `STATEFP=48`, `COUNTYFP`, `GEOID`, and authoritative county names such as `NAME`/`NAMELSAD`.
4. **Extract active county assets by verified GEOID.** Active county boundary assets should be county-specific and extracted only after confirming `STATEFP=48` and the intended `COUNTYFP`/`GEOID`.
5. **Run automated plausibility checks.** Validate feature count, unique GEOIDs, missing names, coordinate ranges, bounding boxes, coordinate counts, geometry validity, and selected county centroids.
6. **Run browser visual validation.** Visually inspect each active county boundary against expected roads, communities, water bodies, and neighboring counties before activation.
7. **Require county-specific activation evidence.** County onboarding should include a short boundary provenance note and validation checklist before any runtime activation.
8. **Do not reuse this file for extraction.** Treat `Texas_Counties_Cartographic_Boundary_Map_20260620.geojson` as failed forensic evidence only.

## 10. County-program impact

- **San Jacinto:** Remains boundary-failed and activation-held. Do not activate, expose in production, or treat the current active boundary as authoritative until replacement/source-lineage work is complete.
- **Liberty:** No runtime or asset change is recommended in this milestone. Existing Liberty behavior remains unchanged.
- **Montgomery:** No runtime or asset change is recommended in this milestone. Existing Montgomery behavior remains unchanged.
- **Future counties:** Do not onboard using this statewide source. Require replacement authoritative statewide/county-specific boundary provenance first.
- **Protected systems:** This milestone made no runtime changes and does not authorize any changes to `historicalReadsEnabled`, `historyUiEnabled`, `DriveTexasPaused`, `TransportationIntelligenceEnabled`, `TransportationIntelligenceDisplay`, or `TransportationIntelligenceActivation`.

## 11. Merge recommendation

**Merge recommendation:** Merge only as a documentation-only forensic milestone.

Merge is appropriate because this document clearly records that the inspected statewide Texas county boundary source is not trustworthy for Gridly county-boundary use and must not be used for active display, extraction, passive statewide context, audit validation, or future county onboarding.

No runtime changes, UI changes, boundary asset changes, county activation, or production behavior changes are included or authorized by this milestone.

## Testing performed

Required forensic checks completed:

- ✅ Parsed statewide GeoJSON.
- ✅ Validated feature count: `254`.
- ✅ Validated GEOID uniqueness: `254` unique GEOIDs, no duplicates, no missing GEOIDs.
- ✅ Validated selected county bounding boxes for Liberty, Montgomery, San Jacinto, Harris, Chambers, Jefferson, and Polk.
- ✅ Validated coordinate ranges: statewide bbox `[-106.0, 25.0, -95.1, 30.4]`.
- ✅ Validated coordinate-count distribution: total `1,270`, average `5.0`, min `5`, max `5`, all `254` counties below 10 coordinates.
- ✅ Ran `git diff --check`.
