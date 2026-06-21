# GRIDLY Standard Texas County Boundary Source Evaluation — V637C

## 1. Purpose

V637C evaluates a single standardized Texas county boundary source for Gridly county-outline rendering. The immediate objective is documentation and source selection only. This report does not implement runtime changes, does not replace the V637B overlay, and does not activate any county.

## 2. Current V637B State

V637B added a county boundary overlay that is intentionally narrow and safe:

- The overlay scope is hard-coded to Liberty and Montgomery only through `GRIDLY_COUNTY_BOUNDARY_OVERLAY_COUNTY_IDS`.
- The overlay reuses each supported county's existing `boundaryPath` from the county registry.
- Liberty currently resolves to `data/liberty-county-boundary.geojson`.
- Montgomery currently resolves to `assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson`.
- The overlay creates a dedicated Leaflet pane, disables pointer events, and renders county polygons as non-interactive reference geometry.
- The active county is styled more strongly than passive counties; passive county geometry is still visible but subdued.
- The V637B audit surface reports a supported-counties-only payload scope and explicitly reports `usesStatewidePayload: false`.

Current local boundary file sizes:

| Existing local asset | Approximate size | Notes |
|---|---:|---|
| `data/liberty-county-boundary.geojson` | 63,739 bytes / 62.2 KiB | Repository-wide Liberty baseline asset. |
| `assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson` | 156,042 bytes / 152.4 KiB | Montgomery package boundary asset that predates the later canonical runtime-assets path. |

V637B is therefore useful proof that county outlines improve map context, but it is not yet a statewide source standard.

## 3. Why Supported-Counties-Only Overlay Is Not the Final Scalable Approach

The current V637B approach is acceptable as a contained phase-1 overlay, but it should not become the long-term Texas county boundary model:

1. **Different source histories can drift.** Liberty and Montgomery are stored in different parts of the repository and were introduced through different package paths. Even if both are valid, their simplification tolerance, source vintage, metadata, and conversion history may diverge.
2. **County #3 would require another hand-built outline.** Each additional supported county would need a new local boundary acquisition, validation, placement decision, registry path, and visual comparison before it can appear as passive context.
3. **Adjacent passive context is incomplete.** A supported-counties-only payload can only show counties already in Gridly's runtime registry. It cannot reliably show the surrounding county fabric unless every adjacent county has been independently onboarded.
4. **Styling consistency is harder to guarantee.** Active/passive styling can be consistent in code, but geometry density and boundary fidelity can still differ if each county asset is independently generated.
5. **Operational governance becomes repetitive.** Every new county repeats source selection, conversion, simplification, file-size review, and path governance instead of using one statewide boundary artifact.
6. **Audit language must keep explaining payload scope.** V637B currently reports a supported-counties-only payload. That is safe, but it is not the clean final answer for a standardized Texas boundary layer.

## 4. Candidate Sources Evaluated

### Candidate A — Existing Local Assets Already in Repository

**Description:** Continue using `boundaryPath` assets already present for activated/supported counties.

**Strengths:**

- Already works offline from the static application bundle.
- No API key, no framework dependency, no Supabase dependency.
- Minimal immediate implementation risk because V637B already uses this pattern.
- Existing Liberty and Montgomery assets are small enough for current overlay use.

**Weaknesses:**

- Not a single standardized geometry source for all Texas counties.
- Does not solve future County #3 without adding another county-specific outline.
- Passive counties remain limited to registered/supported counties.
- Geometry simplification and metadata may remain inconsistent across county packages.

**Fit:** Good current fallback; not the recommended long-term standard.

### Candidate B — Simplified Texas Counties GeoJSON

**Description:** Add one static GeoJSON `FeatureCollection` containing all Texas county polygons, simplified to map-overlay fidelity and including stable properties such as `STATEFP`, `COUNTYFP`, `GEOID`, `NAME`, and a Gridly-derived county id/slug.

**Likely source family:** U.S. Census Bureau TIGER/Line county boundary data filtered to `STATEFP=48`, then simplified and exported as one static GeoJSON artifact.

**Strengths:**

- Single geometry source for all Texas counties.
- Works offline/static from GitHub Pages as a normal asset.
- No API key dependency.
- No framework dependency; can be fetched and rendered with the existing Leaflet/GeoJSON path.
- No Supabase schema changes.
- Supports active county and passive county styling consistently from one feature set.
- Supports future County #3 without adding another hand-built outline; implementation only needs registry/styling selection logic.
- Human-readable and easy to validate with existing GeoJSON tooling.
- Lower implementation complexity than TopoJSON because no decoding library is required.

**Weaknesses:**

- Larger than equivalent TopoJSON because shared county borders are duplicated between polygons.
- Requires a simplification standard to prevent excessive payload size.
- Must avoid loading too much detail on initial map startup; lazy loading after map initialization is preferable.

**Fit:** Strongest practical recommendation for the next implementation milestone if size is kept reasonable.

### Candidate C — Simplified Texas Counties TopoJSON

**Description:** Add one static TopoJSON topology containing all Texas counties, simplified to map-overlay fidelity.

**Strengths:**

- Usually smaller than GeoJSON for adjacent polygons because shared borders are encoded once.
- Single statewide geometry source.
- Works offline/static from GitHub Pages.
- No API key dependency.
- Can support active/passive styling after conversion to GeoJSON features in the browser.

**Weaknesses:**

- Requires a TopoJSON client-side decoder or a build-time conversion step.
- Adds a format dependency and more implementation complexity than static GeoJSON.
- If the app does not already ship TopoJSON support, it may introduce a new dependency or custom decoder path.
- Debugging and manual inspection are less straightforward than GeoJSON.

**Fit:** Viable if payload size becomes the dominant constraint, but not preferred for the first standardized implementation because the app can meet the requirements with simpler static GeoJSON.

### Candidate D — Lightweight Vector/Tile Boundary Source

**Description:** Use a vector tile source, hosted tile package, PMTiles archive, MBTiles-derived static export, or external boundary tile service.

**Strengths:**

- Excellent rendering performance at multiple zoom levels when implemented with a tile renderer.
- Can scale beyond county boundaries if the product later needs more administrative layers.
- Can keep initial load very small if tiles are requested lazily.

**Weaknesses:**

- External tile services often introduce network and availability assumptions and may require an API key.
- A self-hosted static tile archive is more complex than a single GeoJSON asset on GitHub Pages.
- Leaflet vector-tile rendering would likely require another plugin/dependency.
- Tile generation, versioning, and validation are more operationally expensive than one static file.
- Overkill for 254 Texas county outlines at the current product scope.

**Fit:** Not recommended for V637C/V637D. Revisit only if Gridly later needs multi-layer statewide cartography, many zoom-dependent administrative layers, or national-scale boundary rendering.

## 5. File Size and Performance Considerations

The current two-county local assets total approximately 219.8 KiB uncompressed. A statewide all-county GeoJSON generated at the same per-county detail could become too large for a lightweight static overlay, especially because GeoJSON duplicates shared borders. However, county-outline rendering does not require survey-grade or road-matching precision.

Recommended file-size posture:

- Use a single simplified Texas counties GeoJSON rather than raw full-detail TIGER/Line output.
- Keep only properties needed for identification and styling: `STATEFP`, `COUNTYFP`, `GEOID`, `NAME`, and a normalized Gridly county slug/id if desired.
- Remove unused TIGER attributes from the runtime overlay artifact.
- Quantize/simplify coordinates for visual overlay use after retaining a separate provenance note for the source vintage and conversion command.
- Target a compressed transfer size that is comfortable for GitHub Pages. As a practical planning target, the simplified statewide artifact should preferably stay well below 1 MiB gzip and ideally in the low hundreds of KiB gzip.
- Lazy-load the statewide boundary file only when the map is initialized and the overlay feature is enabled/needed.
- Render passive counties with low stroke weight/fill opacity and keep polygons non-interactive to avoid marker/report click interference.
- Cache the parsed statewide FeatureCollection in memory after first load.

TopoJSON should remain the fallback if simplified GeoJSON cannot meet the payload target. Vector tiles should remain a future architecture option, not the next step.

## 6. Recommended Source

**Recommendation: adopt a single static simplified Texas counties GeoJSON derived from U.S. Census Bureau TIGER/Line county boundary data, filtered to Texas (`STATEFP=48`), simplified for map-overlay rendering, and stored as a Gridly-owned static runtime asset.**

Recommended artifact concept:

```text
assets/boundaries/texas-counties-simplified.geojson
```

Recommended provenance companion:

```text
assets/boundaries/texas-counties-simplified-provenance.json
```

Recommended source baseline:

```text
U.S. Census Bureau TIGER/Line county boundary shapefile, current approved Gridly source vintage, filtered to STATEFP=48.
```

This aligns with prior Gridly source guidance that already recommended Census TIGER/Line county boundary data for missing or normalization-required county boundaries. It also satisfies the key V637C requirement: one consistent geometry source for every Texas county, usable offline and statically without API keys or schema changes.

## 7. Recommended Implementation Plan

This plan is for a future implementation milestone, not V637C itself.

1. **Create the standardized asset.**
   - Acquire the approved TIGER/Line county boundary source.
   - Filter to Texas counties only (`STATEFP=48`).
   - Preserve exactly 254 Texas county features.
   - Simplify to overlay fidelity using a documented tolerance.
   - Export WGS84 longitude/latitude GeoJSON.
   - Strip nonessential properties.

2. **Add provenance and validation evidence.**
   - Record source URL, source vintage, acquisition date, conversion tool/version, simplification tolerance, feature count, output byte size, and checksum.
   - Validate that each feature has a unique `GEOID` and county name.
   - Validate that expected supported counties (`liberty-tx`, `montgomery-tx`) can be selected by GEOID/name mapping.

3. **Add read-only runtime loader behind existing overlay behavior.**
   - Load the statewide GeoJSON lazily.
   - Keep the layer non-interactive.
   - Keep the existing overlay pane and z-index behavior.
   - Style the active county strongly and passive counties subtly from the same source.
   - Do not alter report, awareness, crossing, route, activation, DriveTexas, Transportation Intelligence, or Supabase paths.

4. **Preserve county registry semantics.**
   - County activation should remain controlled by the registry/lifecycle model.
   - The statewide boundary file should provide visual context only.
   - Presence of a county polygon must not imply county support, activation, reporting availability, Transportation Intelligence coverage, or data ingestion.

5. **Add tests/audits.**
   - Verify the statewide payload reports source scope separately from activation scope.
   - Verify `usesStatewidePayload: true` is accompanied by `visualContextOnly: true` and no protected-system mutation flags.
   - Verify active county emphasis changes when active county changes.
   - Verify passive counties remain non-interactive.
   - Verify no Supabase, DriveTexas, Transportation Intelligence, report, awareness, crossing, or county activation code paths are modified.

6. **Decommission county-specific overlay dependencies only after parity.**
   - Keep existing county-owned boundary assets for package/provenance use as needed.
   - Stop using county-specific `boundaryPath` for the visual overlay only after the statewide file passes parity and protected-system verification.

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Statewide GeoJSON too large | Slower map startup or unnecessary bandwidth | Simplify, strip properties, lazy-load, gzip through static hosting, fall back to TopoJSON if needed. |
| Simplification too aggressive | County edges look inaccurate or create visual gaps/overlaps | Define tolerance, inspect adjacent counties, compare Liberty/Montgomery visually before replacing overlay source. |
| Users infer statewide support | Passive county outlines might imply Gridly supports all Texas counties | Add audit flags and product language that statewide boundaries are visual context only; activation remains registry-controlled. |
| Source vintage drift | Boundary source can become outdated | Record source vintage and schedule explicit refresh reviews rather than silent replacement. |
| Implementation touches protected systems | Reports, awareness, crossings, county activation, Supabase, DriveTexas, or Transportation Intelligence behavior could regress | Keep the boundary loader isolated; add protected-system verification tests before merge. |
| TopoJSON/tiles chosen prematurely | New dependency and debugging cost | Start with GeoJSON; only escalate if measured payload size requires it. |

## 9. Protected-System Verification

V637C is documentation-only and does not change runtime behavior. The recommended future implementation must preserve the following protections:

- **No Supabase schema changes.** Boundary rendering remains static client-side asset loading.
- **No DriveTexas changes.** Boundary rendering must not start, stop, resume, parse, ingest, or alter DriveTexas paths.
- **No Transportation Intelligence changes.** Boundary rendering must not affect transportation scoring, route intelligence, incident interpretation, or route-watch behavior.
- **No reports changes.** Boundary rendering must not alter report creation, report display, report storage, or report lifecycle state.
- **No awareness changes.** Boundary rendering must not alter awareness summaries, language, historical intelligence, or visibility rules.
- **No crossing changes.** Boundary rendering must not alter rail crossing source data, crossing review state, or crossing marker behavior.
- **No county activation changes.** A polygon in the statewide boundary file must never activate a county or mark it as supported.
- **No framework dependency.** Static GeoJSON should use the current map stack and existing browser fetch/Leaflet GeoJSON handling.
- **No API key dependency.** The chosen artifact must be hosted with the app and work offline/static from GitHub Pages.

## 10. Merge Recommendation

**Merge recommendation: APPROVE V637C as a documentation/evaluation milestone.**

Recommended next milestone:

**V637D — Create and validate `texas-counties-simplified.geojson` as a static visual-context artifact, with provenance and no runtime protected-system changes.**

Do not replace the V637B runtime overlay until the statewide asset has passed file-size review, visual parity for Liberty/Montgomery, feature-count validation, protected-system verification, and audit-surface updates.
