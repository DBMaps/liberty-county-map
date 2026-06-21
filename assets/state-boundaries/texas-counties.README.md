# Texas Counties Boundary Asset Inspection

## Asset

- **File:** `assets/state-boundaries/Texas_Counties_Cartographic_Boundary_Map_20260620.geojson`
- **Source dataset:** Texas county cartographic boundary GeoJSON, using U.S. Census-style county attributes (`statefp`, `countyfp`, `countyns`, `affgeoid`, `geoid`, `name`, `lsad`, `aland`, `awater`).
- **Retrieval date:** 2026-06-20, as indicated by the asset filename.
- **Inspection date:** 2026-06-21.
- **File size:** 197,931 bytes (`196K` reported by `du -h`).

## Validation Summary

- **Feature count:** 254 GeoJSON features.
- **County count:** 254 unique county names.
- **Texas coverage:** Complete. The asset contains all 254 Texas counties, with no missing or extra county names when compared against the expected Texas county list.
- **County-name field:** `name`.
- **Primary stable county identifier:** `geoid`.
- **FIPS fields:** `statefp`, `countyfp`, and derived combined county FIPS in `geoid`.
- **All records are Texas records:** every feature has `statefp = "48"`.
- **Identifier uniqueness:** `name`, `countyfp`, and `geoid` are each unique across the 254 features.
- **Missing required values:** no empty values were found in any schema field.

## Field Inventory

| Field | Description / runtime relevance |
| --- | --- |
| `:id` | Source platform row identifier; not recommended for runtime joins. |
| `:version` | Source platform row version metadata; not recommended for runtime joins. |
| `:created_at` | Source platform creation timestamp metadata. |
| `:updated_at` | Source platform update timestamp metadata. |
| `statefp` | Two-digit state FIPS code. All records use `48` for Texas. |
| `countyfp` | Three-digit county FIPS code, unique within Texas. |
| `countyns` | Census county National Standard code. Stable source identifier, but less convenient than `geoid` for app joins. |
| `affgeoid` | American FactFinder-style geographic identifier, e.g. `0500000US48421`. |
| `geoid` | Five-digit combined state/county FIPS GEOID, e.g. `48421`; recommended primary runtime key. |
| `name` | County display name without the word `County`; recommended label field. |
| `lsad` | Legal/statistical area description code. All records use `06`. |
| `aland` | Land area attribute from the source dataset. |
| `awater` | Water area attribute from the source dataset. |

## GEOID and FIPS Notes

- `statefp` is the Texas state FIPS code (`48`).
- `countyfp` is the county-level FIPS code within Texas.
- `geoid` is the combined state/county FIPS identifier (`statefp` + `countyfp`) and is the best stable join key for future V637D implementation.
- `affgeoid` is also stable, but it is longer and less ergonomic for app-side joins than `geoid`.

## Geometry Characteristics

- **GeoJSON type:** `FeatureCollection`.
- **Feature geometry type:** all 254 features are `MultiPolygon`.
- **Coordinate reference:** coordinates are longitude/latitude decimal degrees as represented directly in the GeoJSON coordinates.
- **Bounding box observed:** west `-106.63588`, south `25.840117`, east `-93.530936`, north `36.500439`.
- **Total coordinate positions:** 3,290.
- **Average coordinate positions per county:** approximately 13.0.
- **Minimum coordinate positions in a county:** 5.
- **Maximum coordinate positions in a county:** 40.
- **Ring count:** 254 total rings; each feature has one ring in this cartographic asset.
- **Polygon-part count:** 254 total parts; each `MultiPolygon` contains one polygon part in this asset.

## Rendering Suitability

This asset is suitable for future county overlay rendering because it is already cartographic/generalized, compact, complete for Texas, and has stable identifiers suitable for joining county runtime data. The small vertex count should be inexpensive to parse and render for a statewide county overlay.

Recommended future V637D runtime usage:

1. Load this file as a static county boundary overlay asset.
2. Use `geoid` as the canonical join key for county activation, county metadata, or future county-level intelligence layers.
3. Use `name` for human-readable labels and UI display.
4. Preserve `statefp`, `countyfp`, `countyns`, and `affgeoid` in the asset for traceability and future interoperability.
5. Treat source metadata fields beginning with `:` as non-runtime metadata.

## Simplification Recommendation

Additional geometry simplification is **not recommended before V637D integration**. The current file is only 197,931 bytes, contains 3,290 total coordinate positions, and appears already generalized for cartographic use. Further simplification would provide little runtime benefit and could noticeably degrade county boundary shape quality, especially for small or irregular border counties.

If a future mobile-performance pass requires even smaller payloads, create a separate derivative file rather than replacing this canonical inspection asset.

## Known Limitations

- The asset appears cartographic/generalized and should not be used for survey-grade, legal, cadastral, or parcel-level boundary decisions.
- All geometries are represented as `MultiPolygon`, even though each feature currently contains one polygon part.
- County names are bare names such as `Liberty`, not full labels such as `Liberty County`.
- Source platform metadata fields (`:id`, `:version`, `:created_at`, `:updated_at`) are included but should not be used as application identifiers.
- The inspection did not implement V637D runtime behavior, county activation, crossing systems, awareness systems, historical systems, DriveTexas, Transportation Intelligence, or Supabase schema changes.
