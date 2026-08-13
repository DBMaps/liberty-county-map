# PLACE presentation source audit

## Scope and conclusion

This is an audit-only result. It adds no runtime coordinates or geometry, changes no camera or Settings behavior, performs no deployment, and changes no protected system. The protected-system change count is **0**.

**Conclusion:** all 1,859 consumer-eligible PLACE GEOIDs can receive one governed PLACE-level presentation target from the already selected LP188 source. The best first artifact is a compact, deterministic lookup keyed by PLACE GEOID and populated from the Census-supplied `INTPTLAT` and `INTPTLON` fields in the locked **2025 TIGER/Line Texas Places** source. This does not require calculating or fabricating coordinates. The artifact must not be produced in this audit because the locked source/canonical output is not present in this checkout.

## Repository evidence and lineage

1. LP188.2 selected the United States Census Bureau's **2025 TIGER/Line Shapefiles — Places — Texas**, `tl_2025_48_place.zip`, from the official Census URL. The later LP188.2A builder locks the archive at **9,782,040 bytes** and SHA-256 **`5A0C4D49641F69028EE9F5C343BF09936EC00A378E5E6393115B106BAB935E13`**.
2. The source is a statewide PLACE polygon shapefile in NAD83 (EPSG:4269). Its governed canonical extraction explicitly selects `GEOID`, identity/classification fields, polygon-derived land/water area, and Census `INTPTLAT`/`INTPTLON`. Geometry is used separately for positive-area county intersection in EPSG:3083; the internal point and nearest county do not participate in membership.
3. LP188.3 evidence certifies 1,863 canonical PLACE GEOIDs, 2,062 memberships, and 163 multi-county places. The consumer projection excludes four C9 inactive/nonfunctioning incorporated places, leaving exactly **1,859 eligible GEOIDs**, **2,058 memberships**, and the same 163 multi-county identities.
4. The tracked consumer projection and county packages preserve identity and memberships but omit presentation coordinates. Only 12 legacy focus bridges exist in the current runtime. The partial LP157 coordinate seeds are not a complete statewide governed presentation source and must not be expanded or treated as the source of truth.

## Requested determinations

### A. Coverage

**Yes, source-level coverage is sufficient for all 1,859 eligible GEOIDs.** The governed canonical extraction is one row per all 1,863 source PLACE GEOIDs and carries the source's internal-point fields on each row. Filtering by the already governed `consumerEligible` decision yields 1,859 targets without a county join. Before manufacture, the future builder must fail closed on missing, nonnumeric, out-of-Texas, duplicate, or non-finite coordinates and must prove exact equality between the eligible GEOID set and output keys.

This is a source-contract conclusion, not a claim that a presentation artifact already exists locally. The locked raw source and canonical LP188.2A output are absent from this checkout.

### B. Exact authority and vintage

Use **United States Census Bureau, 2025 TIGER/Line Shapefiles — Places — Texas**, filename `tl_2025_48_place.zip`, official source URL `https://www2.census.gov/geo/tiger/TIGER2025/PLACE/tl_2025_48_place.zip`, source CRS EPSG:4269, governed byte size and SHA-256 stated above. The recommended coordinates are the source attributes `INTPTLAT` and `INTPTLON`, not a centroid, geocoder result, LP157 seed, county center, or manually chosen point.

No separate PLACE Gazetteer artifact is evidenced in the repository. Gazetteer-style coordinates therefore add another acquisition/provenance path without improving on the already locked TIGER internal-point attributes.

### C. Availability and recovery

| Item | State | Consequence |
|---|---|---|
| Raw 2025 Texas PLACE ZIP/shapefile | Not tracked or mounted in this checkout | Do not manufacture here from memory or substitutes. |
| LP188.2A canonical JSON containing `intptLat`/`intptLon` | Not tracked in this checkout | The promoted county packages cannot reconstruct the omitted coordinates. |
| Source identity, official URL, byte size, SHA-256, and deterministic builder | Tracked | The exact governed input is identifiable and remotely recoverable from Census, subject to hash verification. |
| Completed LP188.3 identities/counts/package hashes | Tracked | The eligible GEOID set and multi-county semantics can be verified locally. |
| PowerShell/GDAL toolchain and original source path | Not available in this container; the lineage names the owner Windows path/toolchain | Extraction/manufacture requires owner-local execution (or a separately approved environment) against bytes matching the governed hash. |

### D. Deterministic representative points

Yes. Two governed options exist, neither of which changes identity or containment:

1. **Recommended:** copy the Census-provided `INTPTLAT`/`INTPTLON` for each eligible GEOID. This is deterministic, small, already part of the governed shapefile schema, and does not recompute geometry.
2. If owner policy later requires a geometry-derived point, calculate a point-on-surface/interior point from each locked PLACE polygon with a pinned GDAL/GEOS version, declared CRS and precision, stable GEOID sorting, and deterministic serialization. Treat that result only as presentation metadata. Do not use it to certify county membership, and do not replace the positive-area polygon-intersection method.

A raw geometric centroid is not recommended: it can fall outside concave or multipart geometry. A point-on-surface is safer for presentation, but the Census internal point avoids tool-version sensitivity and is already available.

### E. Multi-county places

They resolve naturally to one shared target because the target is keyed only by PLACE GEOID and comes from the single statewide PLACE feature. All county occurrences of any of the 163 multi-county places reference that same lookup row. County FIPS must not be part of the presentation key.

### F. Recommended artifact contract

Create a versioned, deterministic artifact such as `gridly-place-presentation-targets-tiger2025-v1.json` with:

```json
{
  "schemaVersion": "gridly.placePresentationTargets.tiger2025.v1",
  "source": {
    "dataset": "2025 TIGER/Line Shapefiles — Places — Texas",
    "sourceSha256": "5A0C4D49641F69028EE9F5C343BF09936EC00A378E5E6393115B106BAB935E13",
    "coordinateFields": ["INTPTLAT", "INTPTLON"],
    "sourceCrs": "EPSG:4269"
  },
  "targetsByPlaceGeoid": {
    "<PLACE_GEOID>": { "lat": "<source INTPTLAT>", "lon": "<source INTPTLON>" }
  }
}
```

Keep source precision (prefer canonical decimal strings), sort keys lexically, serialize with stable UTF-8/LF rules, publish byte length and SHA-256, and enforce exactly 1,859 keys matching the consumer projection. Names, county memberships, identity classification, zoom, and county fallbacks do not belong in this artifact. No example coordinate is included here because this audit must not manufacture one.

### G. Size and runtime loading

At 1,859 rows with a seven-digit GEOID and two short decimal strings, expect roughly **120–180 KiB uncompressed JSON** and approximately **35–60 KiB compressed**, depending on envelope and whitespace. This is an estimate to be replaced by measured byte/gzip sizes during owner-local manufacture.

Load it once as a small immutable statewide sidecar and index by GEOID (or consume the keyed object directly). Avoid duplicating targets into 254 county records: the 2,058 membership occurrences would enlarge the runtime and risk cross-county drift. It may be eagerly loaded with the statewide community projection or lazily fetched before the first PLACE camera transition; either way, unresolved/failed loading must remain an unresolved PLACE target and must not trigger county geometry as a PLACE substitute.

### H. Initial zoom policy

**Zoom 13 is reasonable only as an initial default after a valid PLACE target resolves**, especially for ordinary compact municipalities and CDPs. It should not be treated as the complete long-term policy: Texas places vary greatly in area and shape, and a fixed zoom can underframe large places or overframe very small ones. A later governed policy can use PLACE polygon bounds/area, viewport padding, and min/max constraints. Until then, resolution of a valid PLACE target is the precondition; missing focus must fail closed rather than fitting county geometry.

## Test-fixture finding

The successive-selection test referenced `Laredo`, but its local `required` fixture map did not define Laredo and the same file correctly asserts that Webb has no legacy focus bridge. This is unambiguously a stale test fixture, not evidence for inventing a Laredo target. The sequence now uses already-defined Brownsville, preserving the intended assertion that successive governed targets do not reuse the prior center.

## Stop boundary

No presentation artifact was manufactured. No camera consolidation or Settings change was implemented. No coordinate was added. No production code, deployment, activation, Supabase object, membership, identity, or containment behavior changed. Owner review is required before any implementation.
