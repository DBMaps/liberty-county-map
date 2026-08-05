# LP163 — Statewide Destination Routing Certification

## Purpose and decision boundary

LP163 certifies the governed path from a manufactured destination selection through Gridly's existing route request and preview contracts. It does not manufacture data, expand runtime county membership, activate counties, deploy code, or introduce a routing provider. Gridly remains **Awareness Platform First, Route Intelligence Second**.

## Authoritative baseline and architecture inventory

The audit used the LP160 source identity and fixtures, LP160.1 manufacturing manifest, LP161 integration evidence, LP161.1 reconciliation, and LP162 consumer-search evidence. The live application path is:

1. A destination candidate becomes the selected destination or saved place without changing its identifier or coordinates.
2. `startInlineRouteWatch` validates the selected origin and destination.
3. `renderRoutePreviewLine` constructs an OSRM request in longitude/latitude order and invokes the existing public HTTPS provider.
4. A response is accepted only when its first route has at least two valid GeoJSON coordinates.
5. The validated geometry becomes the Leaflet preview and endpoint-marker contract; route distance and duration are used only when supplied by OSRM.
6. Existing route-intelligence, destination-impact, awareness, saved-place, and Route Watch layers hydrate from the accepted route state.

The public OSRM request is network-dependent. Default certification therefore makes no network call and never interprets coordinate validity as proof that a route exists.

## Audit finding and narrow patch

The audit found one truthfulness defect: when OSRM failed, the preview renderer continued with a two-point straight line between the selected endpoints and could treat that interpolation as a rendered route. LP163 removes that fallback. Provider failure now records unavailable geometry, clears travel metrics, and returns failure before creating a preview. No routing algorithm or provider was replaced.

## Certification methodology

The tool deterministically audits live-path source contracts, validates every governed LP160 destination fixture, and tests valid, malformed, geometry-free, invalid-coordinate, and missing-identity inputs. Selection ordering is county FIPS, governed category, normalized name, destination identifier, then source coordinate order. Exact selected coordinates are copied into the route request and marker contract; no county centroid, locality centroid, road midpoint, nearby place, or inferred coordinate is permitted. Provider snapping was not evidenced in the current request/preview path, so no acceptance threshold was invented.

### Representative counties

The governed 16-county cohort is sorted by FIPS and covers the Liberty benchmark; Harris, Dallas, Tarrant, and Travis urban density; Fort Bend and Montgomery metropolitan/medium scale; Cameron, El Paso, and Webb border regions; Potter and Lubbock Panhandle/South Plains; Brewster and Loving sparse West Texas; Galveston and Jefferson Gulf Coast/East Texas. Each county's reason is recorded in `representative-county-routing-results.json`. County package execution is honestly classified as source-unavailable where package bytes are not stored in this repository.

### Representative destinations

Seventeen governed LP160 fixtures exercise name, alias, category, and business selection across the locally available category and geographic evidence. They are evidence samples, not a claim that the external 1,339,710-row county package corpus was executed locally. Every case records identity, locality, county, category, coordinates, request coordinates, marker coordinates, compatibility results, and the network-validation boundary.

## Route contracts and truthful failure

* **Request:** both endpoints must be finite coordinates; destination identity and display name must exist; the OSRM URL receives the exact selected longitude and latitude.
* **Response:** `routes[0].geometry.coordinates` must contain at least two finite coordinate pairs. Missing or malformed geometry is `INVALID_ROUTE_RESPONSE`.
* **Preview:** only validated provider geometry may create the global preview layer. A real layer with at least two points is required. Distance and travel time are optional provider fields.
* **Failure:** invalid identity/coordinates, unavailable provider, malformed response, or missing geometry cannot create a successful preview. Network validation not run is reported as `NETWORK_VALIDATION_NOT_EXECUTED`, never PASS.

Route intelligence, destination impact, Route Watch, awareness, and saved-place contracts remain present and compatible. Directional consumer labels remain paused.

## Liberty preservation

Liberty destination identity, exact coordinates, search, route intelligence, awareness, Route Watch, and saved-place compatibility pass. `274 County Road 677` remains `NO_VERIFIED_RESULT`; no interpolation, nearby-number substitution, road-only promotion, or inferred address match was introduced.

## Determinism and protected artifacts

Governed reports use sorted keys and arrays, LF endings, and `1970-01-01T00:00:00.000Z`. Verification generates reports twice in isolated OS temporary directories, compares their bytes and governed bytes, supplies SHA-256/first-byte diagnostics on mismatch, and does not rewrite repository reports. The protected-hash report covers available address/runtime manifests and LP135/LP161/LP161.1/LP162 evidence. Destination manufacturing, address packages, runtime membership, deployment authorization, and activation authorization remain unchanged.

## Results and remaining boundary

All 17 local destination fixtures pass deterministic selection, identity, coordinate, request, preview-contract, intelligence, Route Watch, awareness, saved-place, and truthful-failure checks. Deterministic provider-response contract fixtures pass. No live route response is counted as PASS because public-network execution is not deterministic. Owner-controlled live OSRM validation remains required for full live certification.

**Final classification: `CONDITIONALLY_CERTIFIED_LIVE_NETWORK_VALIDATION_REQUIRED`.**

Runtime is **UNCHANGED**. Deployment is **UNAUTHORIZED**. Activation is **UNAUTHORIZED**.

## Owner validation (PowerShell 5.1)

```powershell
Set-Location C:\GitHub\liberty-county-map
git branch --show-current
git status --short
npm run certify:lp163
npm run verify:lp163
npm run test:lp163
npm run verify:lp160
npm run test:lp160
npm run verify:lp161
npm run test:lp161
npm run verify:lp1611
npm run test:lp1611
npm run verify:lp162
npm run test:lp162
npm run test:lp1601m
git status --short
git log -5 --oneline
```
