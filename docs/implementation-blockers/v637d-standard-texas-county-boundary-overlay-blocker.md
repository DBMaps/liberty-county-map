# V637D Standard Texas County Boundary Overlay — Implementation Blocker

## Status

Blocked. The V637D implementation requires a real, documented statewide Texas county boundary GeoJSON asset. No suitable statewide Texas county boundary asset currently exists in this repository, and this environment could not fetch a source dataset safely enough to create one.

## Requirement causing the stop

V637D explicitly requires that if no suitable asset exists and Codex cannot safely fetch or generate one, implementation must stop and produce a blocker report instead of inventing boundary geometry. This report follows that requirement.

## Repository asset check

The repository contains county-specific runtime assets, including Liberty and Montgomery county boundaries, but no single statewide Texas counties boundary asset such as `assets/state-boundaries/texas-counties-simplified.geojson`.

Existing relevant local assets identified:

- `data/liberty-county-boundary.geojson`
- `assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson`

These are not sufficient for V637D because the requested overlay source must render all Texas county outlines consistently from one standardized statewide asset.

## Fetch/generation attempts

The following source options were attempted and blocked by network/proxy restrictions in this execution environment:

1. U.S. Census cartographic boundary county shapefile:
   - `https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_county_500k.zip`
   - Result: proxy tunnel returned `403 Forbidden`.

2. Plotly county FIPS GeoJSON mirror/raw source derived from U.S. Census county geometry:
   - `https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json`
   - Result: proxy tunnel returned `403 Forbidden` for local fetch.

3. CDN mirrors for the Plotly county GeoJSON:
   - `https://cdn.jsdelivr.net/gh/plotly/datasets@master/geojson-counties-fips.json`
   - `https://rawcdn.githack.com/plotly/datasets/master/geojson-counties-fips.json`
   - Result: proxy tunnel returned `403 Forbidden`.

4. U.S. Census TIGERweb GeoJSON query for Texas counties:
   - `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query?where=STATE%3D%2748%27&outFields=*&returnGeometry=true&f=geojson&outSR=4326`
   - Result: proxy tunnel returned `403 Forbidden`.

5. NPM package source option (`us-atlas`):
   - Result: `npm pack us-atlas` returned `403 Forbidden` from the registry.

## Why no placeholder asset was added

A fabricated, hand-drawn, partial, or approximate statewide Texas county file would violate the V637D asset requirements and could create false confidence in county context, map display, and audit output. Therefore no synthetic `texas-counties-simplified.geojson` was created.

## Required unblock path

To complete V637D, add a real statewide Texas county GeoJSON asset generated from an authoritative source, preferably:

- U.S. Census TIGER/Line or Cartographic Boundary county data filtered to Texas (`STATEFP = 48`), with approximately 254 county features.

Recommended local asset path:

- `assets/state-boundaries/texas-counties-simplified.geojson`

Recommended companion provenance path:

- `assets/state-boundaries/texas-counties-simplified.README.md`

The provenance file should document:

- Source dataset and URL
- Retrieval/generation date
- Simplification method and tolerance, if any
- Expected Texas county count: 254
- Intended use: non-legal visual county boundary overlay
- Known limitations
- Explicit warning not to use for legal, survey, parcel, emergency dispatch, or jurisdictional determinations

## Implementation work intentionally deferred

Because the real asset is unavailable, the following code/test changes were intentionally not made in this blocker-only change:

- Switching `payloadScope` from `supported_counties_only:liberty-tx,montgomery-tx` to `standard_texas_counties_static_geojson`
- Setting `usesStandardTexasBoundarySource: true`
- Reporting `texasCountyFeatureCount` from a real statewide payload
- Rendering passive outlines for all Texas counties
- Adding `tests/county-runtime/v637dStandardTexasCountyBoundaryOverlay.test.js`

Those changes should be made only after the real statewide Texas county boundary asset and provenance file are present.
