# V650R.9 — San Jacinto Road Geometry Runtime Integration Validation

## 1. Quick summary

**Final determination:** **ROAD GEOMETRY NOT INTEGRATED**.

The San Jacinto road geometry runtime asset exists as a normalized GeoJSON file with 3,906 features, but the active runtime registry does **not** point to that GeoJSON. The runtime still registers San Jacinto roads as the source shapefile path and marks road source availability as `inventory-only`. Because the roadway loader fetches the registered `roadSource` only when road source availability is accepted as available, the new GeoJSON is not loaded into `roadwaySegmentFeatures` and therefore cannot improve road-name resolution, corridor resolution, alert wording, awareness wording, or location wording.

No San Jacinto activation, production authorization, protected-system change, Liberty behavior change, or Montgomery behavior change is made by this validation.

## 2. Runtime registration findings

**Classification:** **FAIL**

### Source path reviewed

- Expected new runtime GeoJSON path from the milestone request: `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-road-segments.geojson`.
- Actual normalized GeoJSON present in the repository: `assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson`.
- Actual feature count observed: `3,906`.
- Feature metadata fields observed: `id`, `name`, `tiger:linearid`, `tiger:fullname`, `tiger:rttyp`, `tiger:mtfcc`, `source`, `county`, `county_fips`, `countyId`.

### Registration path reviewed

- Runtime county registry: `GRIDLY_COUNTY_REGISTRY["san-jacinto-tx"]`.
- Runtime source registry derivation: `GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY` maps `roadSource` from `config.roadSegmentsPath`.
- Active San Jacinto registration still points to `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.shp`.
- Active San Jacinto road availability remains `roads: "inventory-only"`.

### Loading path reviewed

- `ROADWAY_SEGMENTS_URL` is initialized from `gridlyGetActiveCountyRuntimeSources().roadSource`.
- `loadRoadwayDataset()` fetches `ROADWAY_SEGMENTS_URL` only if `gridlyCountyRuntimeSourceAvailable("roads")` and `ROADWAY_SEGMENTS_URL` are truthy.
- Because San Jacinto is registered as `inventory-only` and not pointed at the normalized GeoJSON, the new file is not the runtime roadway source.

## 3. Runtime loading findings

**Classification:** **FAIL**

| Requirement | Result | Evidence |
| --- | --- | --- |
| File exists | **Observation / path mismatch** | The expected root runtime-assets GeoJSON path does not exist, while the normalized file exists under `runtime-assets/source/`. |
| File is referenced | **Fail** | Runtime references the San Jacinto shapefile path, not the normalized GeoJSON. |
| File is loaded | **Fail** | `loadRoadwayDataset()` loads only the registered `ROADWAY_SEGMENTS_URL`; San Jacinto does not register the new GeoJSON. |
| File is available to runtime systems | **Fail** | Road availability is `inventory-only`, so runtime road resolver systems cannot rely on the new GeoJSON as an available source. |

## 4. Road resolver findings

**Classification:** **FAIL**

San Jacinto incidents do not currently have runtime access to the new GeoJSON's Census road metadata via the active resolver path.

### Metadata availability in asset

The normalized asset contains equivalent Tiger-derived properties for the required fields:

| Required field | Asset property observed | Runtime status |
| --- | --- | --- |
| `FULLNAME` | `tiger:fullname` plus normalized `name` | Present in the file, not loaded. |
| `LINEARID` | `tiger:linearid` plus `id` | Present in the file, not loaded. |
| `RTTYP` | `tiger:rttyp` | Present in the file, not loaded. |
| `MTFCC` | `tiger:mtfcc` | Present in the file, not loaded. |

### Road-name lookup path

The local road-name resolver scans `roadwaySegmentFeatures`, reads candidate names from `properties.name`, `properties.ref`, and `properties.highway`, flattens LineString/MultiLineString geometry, and computes nearest-road candidates. San Jacinto cannot use the new asset in this path because the asset is not registered or loaded.

### Corridor lookup path

The primary corridor resolver builds a validated corridor inventory from loaded road geometry and selects nearby validated corridors. San Jacinto cannot benefit from FM 945, TX 150, or US 59 geometry in this path until the normalized GeoJSON is registered and loaded.

### Fallback path

When no valid road/corridor is resolved, county-aware formatting falls back to active county display context, awareness area, default city, or county name. That means San Jacinto wording can still collapse to county/area-level phrasing such as San Jacinto County instead of specific roads.

### Where San Jacinto enters the pipeline

San Jacinto currently enters through county selection and registry metadata as a validation-only, production-disabled county with boundary/crossing/awareness metadata. It does **not** enter the road-geometry resolver with the new normalized road-segments GeoJSON.

## 5. Alert wording findings

**Classification:** **FAIL**

Alerts cannot reliably improve from county-level fallback wording to road-specific wording such as:

- `Road Closed near FM 945`
- `Road Closed near TX 150`
- `Road Closed near US 59`

The alert road-hazard resolver first uses explicit alert fields and parsed rendered text, then consults corridor evidence from loaded road geometry. Since San Jacinto's normalized road geometry is not loaded, the resolver cannot use the new San Jacinto road inventory to promote those road labels. Alert card/detail generation may still display explicitly supplied road fields when present, but V650R.9 found no runtime wiring that lets the newly generated San Jacinto GeoJSON improve wording from coordinates alone.

## 6. Awareness wording findings

**Classification:** **FAIL**

Top Awareness cannot currently use the new San Jacinto road geometry as resolved road context. Awareness models can use explicit record text/fields, selected awareness areas, and county-aware fallback context, but the San Jacinto road geometry asset is not loaded into the road/corridor resolver. Therefore Top Awareness is still expected to fall back to county-level or selected-area wording when explicit road context is missing.

## 7. Browser readiness determination

**Classification:** **NOT READY**

The new road geometry asset is **not likely to improve browser road-name resolution, alert wording, or awareness wording yet** because additional runtime wiring is required. Required wiring should remain validation-only and must not activate San Jacinto.

Minimum required runtime wiring milestone:

1. Move or copy the normalized GeoJSON to the intended runtime path, or update the milestone/path contract to the actual `runtime-assets/source/` path.
2. Register San Jacinto `roadSegmentsPath` to the normalized GeoJSON path, not the shapefile.
3. Change San Jacinto road runtime availability from `inventory-only` to an explicitly validation-only loadable state that `gridlyCountyRuntimeSourceAvailable("roads")` accepts without production activation.
4. Ensure the loader accepts and parses the normalized GeoJSON for San Jacinto only during validation-only browser testing.
5. Add audit coverage proving `roadwaySegmentFeatures` contains San Jacinto GeoJSON features when San Jacinto validation mode is selected.
6. Add resolver evidence for FM 945, TX 150, and US 59 sample coordinates without changing Liberty or Montgomery behavior.

## 8. Liberty regression validation

**Classification:** **PASS**

Liberty road geometry remains registered to `data/liberty-county-road-segments.geojson`, with road availability still `available`. No Liberty runtime registry, loader, resolver, or behavior changes were made by this validation.

## 9. Montgomery regression validation

**Classification:** **PASS**

Montgomery road geometry remains unchanged: `roadSegmentsPath` is still `null`, and road availability remains `missing`. No Montgomery runtime registry, loader, resolver, or behavior changes were made by this validation.

## 10. Road geometry integration matrix

| Category | Result | Notes |
| --- | --- | --- |
| Runtime Registration | **FAIL** | San Jacinto registers a shapefile path, not the normalized GeoJSON; availability remains `inventory-only`. |
| Runtime Loading | **FAIL** | Loader fetches the registered source only when roads are available; the new GeoJSON is not registered or loaded. |
| Road Resolver | **FAIL** | Resolver scans `roadwaySegmentFeatures`; San Jacinto GeoJSON features are absent from that runtime array. |
| Alert Wording | **FAIL** | Road-specific wording can only come from explicit alert fields or loaded geometry; the new geometry is not loaded. |
| Awareness Wording | **FAIL** | Top Awareness cannot use unloaded San Jacinto geometry and remains dependent on explicit fields/fallback context. |
| Browser Readiness | **NOT READY** | Additional validation-only runtime wiring is required before browser rerun. |
| Liberty Regression | **PASS** | Liberty road source remains unchanged and available. |
| Montgomery Regression | **PASS** | Montgomery road source remains unchanged and missing. |

## 11. Final determination

**ROAD GEOMETRY NOT INTEGRATED**

Rationale: the normalized San Jacinto road geometry exists in the repository and contains useful road-name and TIGER metadata, but the runtime does not point to it, does not mark it as loadable, and therefore does not expose it to road-name lookup, corridor lookup, alert wording, awareness wording, or location wording.

## 12. Recommended next milestone

**V650R.10 — San Jacinto Road Geometry Runtime Wiring (Validation-Only)**

This milestone should be limited to registering and loading the San Jacinto normalized GeoJSON for validation-only browser testing. It must explicitly preserve:

- No San Jacinto production activation.
- No removal of validation-only protections.
- No V651 progression.
- No Liberty behavior changes.
- No Montgomery behavior changes.
- No protected system changes.

After V650R.10 wiring is complete and validated, the browser rerun should be:

**V650R.11 — San Jacinto Browser Validation Rerun**

## 13. Merge recommendation

**Merge documentation-only validation.**

This report records that the new San Jacinto road geometry asset is not integrated into runtime road resolution yet. It makes no production behavior changes and does not activate San Jacinto.
