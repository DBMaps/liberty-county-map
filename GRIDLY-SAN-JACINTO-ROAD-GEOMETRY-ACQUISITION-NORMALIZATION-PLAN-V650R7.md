# V650R.7 — San Jacinto Road Geometry Acquisition & Normalization Plan

## 1. Quick Summary

V650R.7 is a planning/documentation-only milestone for the largest remaining San Jacinto runtime asset gap from V650R.6: missing normalized roadway geometry. No runtime asset was created, no shapefile was converted, no San Jacinto activation was performed, and no production behavior was changed.

San Jacinto is **READY FOR NORMALIZATION** because the county-specific 2025 Census TIGER/Line road shapefile components already exist in the San Jacinto runtime asset source staging folder. The normalized runtime output is still missing: `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-road-segments.geojson`.

Recommended next milestone: **V650R.8 — San Jacinto Road Geometry Normalization**.

## 2. Road Geometry Inventory

| Source asset | Source type | Completeness | Source ownership | Planning disposition |
|---|---|---|---|---|
| `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.shp` | Census TIGER/Line county road shapefile geometry | Present as source staging material; not normalized GeoJSON | San Jacinto-owned implementation source inventory | Usable source for a future normalization milestone; do not register directly as runtime road geometry. |
| `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.dbf` | Census TIGER/Line road attributes | Present | San Jacinto-owned implementation source inventory | Attribute source for `FULLNAME`, `LINEARID`, `RTTYP`, `MTFCC`, and related road metadata when conversion is authorized. |
| `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.shx` | Census TIGER/Line shapefile index | Present | San Jacinto-owned implementation source inventory | Required companion file for conversion tooling. |
| `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.prj` | Projection metadata | Present | San Jacinto-owned implementation source inventory | Confirms projection for conversion to WGS84 GeoJSON if needed. |
| `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.cpg` | Encoding metadata | Present | San Jacinto-owned implementation source inventory | Preserve encoding during conversion. |
| `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.shp.iso.xml` | Census metadata | Present | Census source metadata staged under San Jacinto package | Evidence/provenance only. |
| `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.shp.ea.iso.xml` | Census metadata | Present | Census source metadata staged under San Jacinto package | Evidence/provenance only. |
| `GRIDLY-MANUAL-MULTI-COUNTY-ASSET-ACQUISITION-INSTRUCTIONS-V601.md` San Jacinto TIGER row | Acquisition instruction | Present | Gridly multi-county asset acquisition standard | Confirms exact upstream URL, expected ZIP contents, and expected final Gridly output path. |
| `assets/county-implementation/san-jacinto/inventory/san-jacinto-source-inventory-v639.json` | San Jacinto inventory evidence | Present | Gridly San Jacinto onboarding inventory | Confirms road source is inventory-only, not normalized, and not activated. |
| `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-road-segments.geojson` | Expected normalized runtime road asset | **Missing** | Would be San Jacinto-owned runtime asset after authorization | Required future output; not created by V650R.7. |

### Inventory Finding

A usable roadway **source** already exists, but a usable normalized roadway **runtime asset** does not. The source acquisition phase is substantially complete for Census TIGER/Line roads; the remaining work is controlled conversion, normalization, validation, and later runtime registration review.

## 3. Liberty Comparison

| Liberty characteristic | Observed value | Why it is usable |
|---|---:|---|
| Runtime path | `data/liberty-county-road-segments.geojson` | Registered directly as Liberty's road segment runtime source. |
| FeatureCollection feature count | 8,407 | Sufficient county-scale line coverage for road-name and nearest-road lookups. |
| Geometry types | 8,405 `LineString`; 2 `Polygon` service-area features | Runtime consumers primarily receive line geometry; future normalization should either remove non-road polygons or explicitly validate they cannot degrade road-name resolution. |
| Attribute model | Road features include source properties such as names, highway/service classification, references, and TIGER fields where present | Runtime lookup can derive human-readable road names and road context from source properties. |
| Ownership model | `liberty-owned` with `runtimeSourceAvailability.roads: available` | County-owned road geometry is declared available for operational use. |
| Runtime usage | `roadSegmentsPath` points to the Liberty GeoJSON | The application can fetch a normalized GeoJSON path without shapefile conversion at runtime. |

### What Makes Liberty Road Geometry Usable?

Liberty is usable because the runtime registry points to a browser-readable GeoJSON road-segment asset, the asset is already normalized into a FeatureCollection, road names are available in feature properties, geometry is overwhelmingly line-based, and county ownership/availability metadata marks roads as available.

San Jacinto should inherit the same usability contract: a county-owned GeoJSON FeatureCollection at the expected runtime asset path, line-based road geometries, preserved road name fields, and explicit county-source ownership.

## 4. Montgomery Comparison

| Montgomery asset / pattern | Current state | San Jacinto implication |
|---|---|---|
| `assets/county-implementation/montgomery/runtime-assets/source/tl_2025_48339_roads.*` | Source shapefile components present | Montgomery and San Jacinto share the same Census TIGER/Line source-staging pattern. |
| `assets/county-implementation/montgomery/runtime-assets/montgomery-county-road-segments.geojson` | Not present | Montgomery has not completed normalized runtime road asset placement. |
| Runtime registry `roadSegmentsPath` | `null` | Montgomery avoids registering an unnormalized shapefile as runtime road geometry. |
| Runtime availability | `roads: "missing"` with a data blocker | Missing normalized roads are handled as a runtime data gap rather than silently using Liberty roads. |
| V598 integration model | Montgomery fails safe with no Liberty road candidates | San Jacinto should follow county containment and fail-safe behavior until its own normalized road GeoJSON is available. |

### Onboarding Pattern San Jacinto Should Inherit

San Jacinto should inherit Montgomery's source-staging and containment discipline, but not Montgomery's unresolved road gap. The correct pattern is:

1. Keep source shapefile materials in `assets/county-implementation/san-jacinto/runtime-assets/source/`.
2. Produce the normalized county road GeoJSON only in an authorized normalization milestone.
3. Keep runtime registration non-production/validation-only until the normalized asset passes road-name, corridor, wording, and containment audits.
4. Never fall back to Liberty or Montgomery road geometry for San Jacinto context.

## 5. Normalization Plan

Future output: `assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-road-segments.geojson`.

### Source Dataset

Use the staged Census TIGER/Line 2025 roads source for San Jacinto County, GEOID `48407`: `assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.shp` and companion files.

### Extraction Process

1. Confirm all shapefile companions are present: `.shp`, `.shx`, `.dbf`, `.prj`, `.cpg`, and metadata XML files.
2. Confirm the source is county-specific `tl_2025_48407_roads`, not statewide or neighboring-county material.
3. Convert the shapefile to GeoJSON using approved local GIS tooling in a future milestone.
4. Preserve source fields required by the V601 standard, especially `LINEARID`, `FULLNAME`, `RTTYP`, and `MTFCC` when present.

### Filtering Process

1. Retain only road/corridor features from the San Jacinto source.
2. Exclude non-road artifacts if conversion tooling emits non-line geometries or metadata-only records.
3. Normalize empty, null, or whitespace-only names into a consistent property state rather than inventing names.
4. Preserve route/reference fields for numbered highways and farm-to-market roads.
5. Do not import Liberty, Montgomery, OSM-only, or synthetic features into the San Jacinto asset.

### Geometry Preparation

1. Output a GeoJSON `FeatureCollection`.
2. Prefer `LineString` and `MultiLineString` road geometries; reject or quarantine unexpected polygon/point features unless explicitly justified.
3. Keep coordinates in WGS84 longitude/latitude order.
4. Preserve segment granularity sufficient for nearest-road lookup and corridor matching.
5. Validate that features remain inside or plausibly adjacent to the San Jacinto boundary where road centerlines cross county edges.

### Output Structure

Minimum expected structure per feature:

- `type: "Feature"`
- `geometry.type: "LineString"` or `"MultiLineString"`
- `properties.LINEARID` when available
- `properties.FULLNAME` or equivalent source road-name field when available
- `properties.RTTYP` when available
- `properties.MTFCC` when available
- optional normalized helper properties may be added only if explicitly authorized by the normalization milestone

## 6. Roadway Readiness Impact

Expected improvements after normalization:

| Runtime behavior | Current likely symptom without normalized San Jacinto roads | Expected improvement after normalization |
|---|---|---|
| Road-name resolution | County-level fallback wording or generic road labels | Nearest-road and named-road wording can resolve to San Jacinto road names. |
| Corridor resolution | Weak corridor matching for FM, SH, US, local, and county roads | Corridor resolver can associate reports with nearby named/numbered roads. |
| Alert wording | Alerts may omit useful road context | Alerts can include specific road/corridor phrases when confidence is sufficient. |
| Awareness wording | Awareness copy may degrade to county-wide language | Awareness can reference local roadway context while preserving county ownership. |
| Location wording | Reports may sound geographically vague | Location labels can combine San Jacinto county context with nearest-road context. |
| Count ownership context | Counts can be county-owned but not road-context-owned | Counts remain San Jacinto-owned and can be explained by local road/corridor context. |

### V650 Browser Findings Likely Explained by Missing Road Geometry

The following browser findings are likely explained in whole or part by missing normalized road geometry:

- county-level fallback wording
- poor road-name resolution
- weak corridor resolution
- awareness wording degradation
- location wording degradation

The following are only partially explained by missing road geometry and still require separate validation:

- boundary production clearance
- activation authorization
- cross-county containment behavior
- final production visibility/selectability rules

## 7. Validation Plan

Future validation should include:

1. **Road-name lookup audit** — sample points near known San Jacinto roads and confirm expected names or deliberate unknown-name handling.
2. **Roadway coverage audit** — verify coverage across Coldspring, Shepherd, Point Blank, Oakhurst, major highways, FM corridors, and rural county-road areas.
3. **Corridor audit** — confirm numbered routes and named local roads resolve consistently without Liberty/Montgomery bleed-through.
4. **Awareness wording audit** — confirm top-awareness wording improves from county-only fallback to location-aware copy when road confidence is high.
5. **Alert wording audit** — confirm alert text uses road names only when confidence meets threshold and does not hallucinate names.
6. **Location wording audit** — compare report cards, popups, and detail labels for before/after clarity.
7. **Cross-county containment audit** — ensure San Jacinto reports never use Liberty or Montgomery road geometry.
8. **Geometry schema audit** — validate GeoJSON syntax, FeatureCollection shape, geometry types, required properties, and coordinate sanity.
9. **Protected-system audit** — reconfirm historical reads, history UI, DriveTexas, and Transportation Intelligence protected flags remain unchanged.

## 8. Activation Impact Assessment

Roadway normalization is a **BLOCKER** for future San Jacinto activation at Liberty/Montgomery-quality wording and route-intelligence parity.

Rationale:

- San Jacinto can remain validation-only with crossings and boundary materials, but production-quality road-name, corridor, alert, awareness, location, and count-context wording require normalized county road geometry.
- Registering a shapefile path is not equivalent to runtime-ready GeoJSON because browser consumers expect normalized assets.
- Activating without normalized roads would preserve the exact V650/V650R symptoms this plan is intended to close.
- The blocker is specific to production-quality activation; it is not a blocker for documentation, source inventory, or a future normalization milestone.

## 9. Road Geometry Readiness Matrix

| Category | Status | Notes |
|---|---|---|
| Roadway Source Availability | READY | San Jacinto TIGER/Line shapefile components are staged under the county source directory. |
| Source Quality | ACCEPTABLE FOR NORMALIZATION | County-specific Census TIGER/Line roads are the standard multi-county acquisition source; final quality must be proven by audits. |
| Normalization Feasibility | READY | Required source components are present; conversion and filtering are future authorized work. |
| Runtime Integration Compatibility | NOT READY UNTIL GEOJSON EXISTS | Runtime should consume a normalized GeoJSON asset, not a raw `.shp` source path. |
| Road-Name Resolution Impact | HIGH | Missing normalized geometry directly affects nearest-road and named-corridor wording. |
| Awareness Impact | HIGH | Local road context is needed to reduce county-wide fallback language. |
| Activation Impact | BLOCKER | Production activation should not proceed until normalized roads are created, validated, and registered through an authorized milestone. |

## 10. Final Determination

**READY FOR NORMALIZATION**.

Rationale: source acquisition is not blocked because the San Jacinto county-specific TIGER/Line source shapefile and companion files are already staged. Normalization is still required because the expected runtime GeoJSON file is absent, and current registration/inventory evidence treats roads as inventory-only rather than runtime-ready.

## 11. Recommended Next Milestone

**V650R.8 — San Jacinto Road Geometry Normalization**.

Recommended scope for V650R.8:

1. Convert `tl_2025_48407_roads.shp` to `san-jacinto-county-road-segments.geojson`.
2. Preserve and normalize road-name, route, and source identifier fields.
3. Validate geometry type, schema, coverage, and county containment.
4. Produce a validation evidence packet.
5. Do not activate San Jacinto unless a later activation milestone explicitly authorizes it.

## 12. Merge Recommendation

**MERGE RECOMMENDED** for V650R.7 documentation only.

This milestone adds a plan and does not create road geometry assets, normalize road geometry, activate San Jacinto, expose San Jacinto in production, alter Liberty behavior, alter Montgomery behavior, modify boundaries, modify overlays, or modify protected systems.

## Testing / Checks Performed

| Required check | Result | Evidence |
|---|---|---|
| Roadway source inventory review | PASS | San Jacinto source shapefile components and V639 inventory were reviewed. |
| Liberty roadway asset review | PASS | `data/liberty-county-road-segments.geojson` was reviewed for feature count, geometry types, properties, ownership, and runtime usage. |
| Montgomery roadway asset review | PASS | Montgomery staged TIGER/Line source files, runtime registry behavior, and V598 data-source integration evidence were reviewed. |
| Runtime registration review | PASS | `js/app.js` county registry was reviewed for Liberty, Montgomery, and San Jacinto road registration behavior. |
| `git diff --check` | PASS | Whitespace check completed successfully. |

## Protected Systems Confirmation

The following protected systems were not changed by V650R.7:

- `historicalReadsEnabled: false`
- `historyUiEnabled: false`
- `DriveTexasPaused: true`
- `TransportationIntelligenceEnabled: false`
- `TransportationIntelligenceDisplay: false`
- `TransportationIntelligenceActivation: false`
